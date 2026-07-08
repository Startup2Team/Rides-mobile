import AsyncStorage from '@react-native-async-storage/async-storage';
import { OfflineMutationQueue } from '../queue/offlineQueue';
import { clearOfflineQueueState } from '../storage/offlineQueueStorage';
import { getRetryDelayMs } from '../retry/backoff';

function createClock(value = '2026-06-29T10:00:00.000Z') {
  let current = new Date(value);
  return {
    now: () => current,
    advance(ms: number) {
      current = new Date(current.getTime() + ms);
    },
  };
}

describe('offline mutation queue', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await clearOfflineQueueState();
  });

  test('enqueue creates idempotent pending mutations and persists them', async () => {
    const clock = createClock();
    const queue = new OfflineMutationQueue({ now: clock.now, idFactory: () => 'mutation-1' });

    const mutation = await queue.enqueue({ type: 'profile.edit', payload: { name: 'Alice' }, priority: 'high' });
    const restored = new OfflineMutationQueue({ now: clock.now });
    await restored.restore();

    expect(mutation).toMatchObject({
      id: 'mutation-1',
      idempotencyKey: 'profile.edit:mutation-1',
      retryCount: 0,
      priority: 'high',
      status: 'pending',
    });
    expect(restored.size()).toBe(1);
    expect(restored.peek()).toMatchObject({ id: 'mutation-1' });
  });

  test('dequeue and peek are priority-aware', async () => {
    const queue = new OfflineMutationQueue();
    await queue.enqueue({ type: 'low', payload: {}, priority: 'low', id: 'low' });
    await queue.enqueue({ type: 'critical', payload: {}, priority: 'critical', id: 'critical' });
    await queue.enqueue({ type: 'normal', payload: {}, priority: 'normal', id: 'normal' });

    expect(queue.peek()?.id).toBe('critical');
    await expect(queue.dequeue()).resolves.toMatchObject({ id: 'critical' });
    await expect(queue.dequeue()).resolves.toMatchObject({ id: 'normal' });
    await expect(queue.dequeue()).resolves.toMatchObject({ id: 'low' });
    expect(queue.size()).toBe(0);
  });

  test('process removes successful mutations', async () => {
    const processor = jest.fn(async () => ({ ok: true }));
    const queue = new OfflineMutationQueue({ processor });
    await queue.enqueue({ type: 'profile.edit', payload: { name: 'Alice' }, id: 'profile-1' });

    await expect(queue.process()).resolves.toMatchObject({ id: 'profile-1' });

    expect(processor).toHaveBeenCalledWith(expect.objectContaining({ id: 'profile-1' }));
    expect(queue.size()).toBe(0);
  });

  test('retry scheduling uses exponential backoff and retry due dates', async () => {
    const clock = createClock();
    const processor = jest.fn(async () => {
      throw new Error('offline');
    });
    const queue = new OfflineMutationQueue({
      now: clock.now,
      processor,
      retryPolicy: { baseDelayMs: 1_000, maxDelayMs: 10_000, maxRetryCount: 3 },
    });
    await queue.enqueue({ type: 'profile.edit', payload: {}, id: 'retry-1' });

    await queue.process();
    const failed = queue.getSnapshot().mutations[0];

    expect(failed.retryCount).toBe(1);
    expect(failed.nextRetryAt).toBe('2026-06-29T10:00:01.000Z');
    expect(failed.lastError).toBe('offline');
    expect(queue.peek()).toBeNull();

    clock.advance(1_000);
    expect(queue.peek()?.id).toBe('retry-1');
    expect(getRetryDelayMs(3, { baseDelayMs: 1_000, maxDelayMs: 10_000, maxRetryCount: 5, jitterRatio: 0 })).toBe(4_000);
  });

  test('expires mutations after retry budget is exhausted', async () => {
    const processor = jest.fn(async () => {
      throw new Error('nope');
    });
    const queue = new OfflineMutationQueue({
      processor,
      retryPolicy: { baseDelayMs: 1, maxDelayMs: 1, maxRetryCount: 1 },
    });
    await queue.enqueue({ type: 'profile.edit', payload: {}, id: 'expire-budget' });

    await queue.process();

    expect(queue.size()).toBe(0);
    expect(queue.getSnapshot().mutations).toEqual([]);
  });

  test('expires mutations by expiresAt before processing', async () => {
    const clock = createClock();
    const processor = jest.fn(async () => ({ ok: true }));
    const queue = new OfflineMutationQueue({ now: clock.now, processor });
    await queue.enqueue({
      type: 'profile.edit',
      payload: {},
      id: 'expired-1',
      expiresAt: '2026-06-29T09:59:59.000Z',
    });

    await queue.process();

    expect(processor).not.toHaveBeenCalled();
    expect(queue.size()).toBe(0);
  });

  test('collapse replace-latest keeps the latest safe mutation only', async () => {
    const queue = new OfflineMutationQueue();
    await queue.enqueue({
      type: 'profile.edit',
      payload: { name: 'A' },
      id: 'profile-1',
      collapseKey: 'profile:user-1',
      collapseStrategy: 'replace-latest',
    });
    await queue.enqueue({
      type: 'profile.edit',
      payload: { name: 'B' },
      id: 'profile-2',
      collapseKey: 'profile:user-1',
      collapseStrategy: 'replace-latest',
    });
    await queue.enqueue({ type: 'ride.book', payload: { pickup: 'Kigali' }, id: 'ride-1' });

    expect(queue.getSnapshot().mutations.map(mutation => mutation.id)).toEqual(['profile-2', 'ride-1']);
  });

  test('pause and resume gate processing', async () => {
    const processor = jest.fn(async () => ({ ok: true }));
    const queue = new OfflineMutationQueue({ processor });
    await queue.enqueue({ type: 'profile.edit', payload: {}, id: 'pause-1' });

    await queue.pause();
    await queue.process();
    expect(processor).not.toHaveBeenCalled();
    expect(queue.peek()?.status).toBe('paused');

    await queue.resume();
    await queue.process();
    expect(processor).toHaveBeenCalledTimes(1);
    expect(queue.size()).toBe(0);
  });

  test('network offline pauses and online resumes queue processing', async () => {
    const processor = jest.fn(async () => ({ ok: true }));
    const queue = new OfflineMutationQueue({ processor });
    await queue.enqueue({ type: 'profile.edit', payload: {}, id: 'network-1' });

    queue.setNetworkState({ isOnline: false, isInternetReachable: false });
    await queue.process();
    expect(queue.getSnapshot()).toMatchObject({ paused: true });
    expect(processor).not.toHaveBeenCalled();

    queue.setNetworkState({ isOnline: true, isInternetReachable: true });
    await queue.process();
    expect(processor).toHaveBeenCalledTimes(1);
  });

  test('cancel, replace, clear, and size keep queue state consistent', async () => {
    const queue = new OfflineMutationQueue();
    await queue.enqueue({ type: 'profile.edit', payload: {}, id: 'one' });
    await queue.enqueue({ type: 'profile.edit', payload: {}, id: 'two' });

    await queue.replace('two', current => ({ ...current, priority: 'critical' }));
    expect(queue.peek()?.id).toBe('two');

    await queue.cancel('two');
    expect(queue.size()).toBe(1);

    await queue.clear();
    expect(queue.size()).toBe(0);
  });
});
