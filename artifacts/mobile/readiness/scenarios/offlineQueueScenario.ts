import { clearOfflineQueueState } from '@/offline/storage/offlineQueueStorage';
import { OfflineMutationQueue } from '@/offline/queue/offlineQueue';
import { createDeterministicClock, createReadinessStressProfile } from '../stress/readinessStress';
import { createReadinessGateResult } from '../types';
import type { ReadinessStressProfile } from '../types';

export async function runOfflineQueueReadinessScenario(
  profile: ReadinessStressProfile = createReadinessStressProfile(),
) {
  await clearOfflineQueueState();
  const clock = createDeterministicClock();
  let id = 0;
  const nextId = () => `offline-${++id}`;

  const queue = new OfflineMutationQueue({
    now: clock.now,
    idFactory: nextId,
    retryPolicy: { baseDelayMs: 1_000, maxDelayMs: 10_000, maxRetryCount: 3, jitterRatio: 0 },
    processor: async () => ({ ok: true as const }),
  });

  for (let index = 0; index < profile.offlineMutations; index += 1) {
    await queue.enqueue({
      type: 'profile.edit',
      payload: { index },
      priority: index % 4 === 0 ? 'critical' : 'normal',
      collapseKey: `profile:${index % 5}`,
      collapseStrategy: index % 5 === 0 ? 'replace-latest' : 'none',
      createdAt: clock.iso(),
    });
    clock.advance(1);
  }

  const restoreQueue = new OfflineMutationQueue({ now: clock.now, idFactory: nextId });
  await restoreQueue.restore();
  const restoredSize = restoreQueue.size();
  const queuedSizeBeforeProcessing = queue.size();

  let processed = 0;
  while (await queue.process()) {
    processed += 1;
    clock.advance(1);
  }

  const retryQueue = new OfflineMutationQueue({
    now: clock.now,
    idFactory: nextId,
    retryPolicy: { baseDelayMs: 1_000, maxDelayMs: 10_000, maxRetryCount: 3, jitterRatio: 0 },
    processor: async () => {
      throw new Error('offline.retry');
    },
  });
  await retryQueue.enqueue({ type: 'profile.edit', payload: { name: 'Retry' }, id: 'retry-1', createdAt: clock.iso() });
  clock.advance(1);
  await retryQueue.process();

  const pausedQueue = new OfflineMutationQueue({ now: clock.now, idFactory: nextId, processor: async () => ({ ok: true as const }) });
  await pausedQueue.enqueue({ type: 'profile.edit', payload: { name: 'Paused' }, id: 'paused-1', createdAt: clock.iso() });
  await pausedQueue.pause();
  const pausedAttempt = await pausedQueue.process();
  await pausedQueue.resume();
  const resumedAttempt = await pausedQueue.process();

  const expiringQueue = new OfflineMutationQueue({ now: clock.now, idFactory: nextId, processor: async () => ({ ok: true as const }) });
  await expiringQueue.enqueue({
    type: 'profile.edit',
    payload: { name: 'Expired' },
    id: 'expired-1',
    expiresAt: '2026-06-29T09:59:59.000Z',
  });
  const expiredAttempt = await expiringQueue.process();

  const collapsedQueue = new OfflineMutationQueue({ now: clock.now, idFactory: nextId });
  await collapsedQueue.enqueue({
    type: 'profile.edit',
    payload: { name: 'First' },
    id: 'collapse-1',
    collapseKey: 'profile:1',
    collapseStrategy: 'replace-latest',
  });
  await collapsedQueue.enqueue({
    type: 'profile.edit',
    payload: { name: 'Second' },
    id: 'collapse-2',
    collapseKey: 'profile:1',
    collapseStrategy: 'replace-latest',
  });

  const failure = retryQueue.getSnapshot().mutations[0] ?? null;
  const restored = restoredSize === queuedSizeBeforeProcessing;
  const expectedProcessed = profile.offlineMutations - Math.floor((profile.offlineMutations - 1) / 5);
  const success = processed === expectedProcessed && restored && Boolean(failure) && pausedAttempt === null && resumedAttempt?.id === 'paused-1' && expiredAttempt === null;
  const status = success ? 'pass' : 'fail';

  return createReadinessGateResult(
    'offline_queue',
    status,
    [
      { name: 'queued', value: profile.offlineMutations, unit: 'mutations' },
      { name: 'processed', value: processed, unit: 'mutations' },
      { name: 'restored', value: restored },
      { name: 'retryCount', value: failure?.retryCount ?? 0 },
      { name: 'collapsedSize', value: collapsedQueue.getSnapshot().mutations.length, unit: 'mutations' },
    ],
    success ? null : 'Offline queue stress scenario did not satisfy persistence, retry, pause/resume, expiry, or collapse checks.',
    success
      ? 'Keep offline queue semantics stable and verify production storage restore under device restart conditions.'
      : 'Investigate queue persistence, retry scheduling, or collapse handling before migrating command writes.',
    clock.now,
  );
}
