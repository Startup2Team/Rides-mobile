import { DomainEventBus } from '../bus/domainEventBus';
import { DeadLetterQueue } from '../dead-letter/deadLetterQueue';
import { DomainEventDispatcher } from '../dispatcher/domainEventDispatcher';
import { ProjectorRegistry } from '../projectors/projectorRegistry';
import { EventReplayService } from '../replay/replayService';
import { InMemoryEventStore } from '../store/inMemoryEventStore';
import type { DomainEvent } from '../types';
import { validateDomainEvent } from '../validation/domainEventValidation';

function createEvent(overrides: Partial<DomainEvent> = {}): DomainEvent {
  return {
    eventId: 'event-1',
    aggregateId: 'aggregate-1',
    aggregateType: 'profile',
    eventType: 'profile.updated',
    eventVersion: 1,
    sequenceNumber: 1,
    timestamp: '2026-06-29T10:00:00.000Z',
    correlationId: 'correlation-1',
    causationId: null,
    producer: 'test',
    payload: { value: 1 },
    ...overrides,
  };
}

function createPlatform() {
  const bus = new DomainEventBus();
  const store = new InMemoryEventStore();
  const projectors = new ProjectorRegistry();
  const deadLetters = new DeadLetterQueue({ idFactory: () => 'dead-1' });
  const dispatcher = new DomainEventDispatcher({ bus, store, projectors, deadLetters });
  return { bus, store, projectors, deadLetters, dispatcher };
}

describe('domain event platform', () => {
  test('event bus publishes to typed and global subscribers and supports unsubscribe', async () => {
    const bus = new DomainEventBus();
    const typed = jest.fn();
    const global = jest.fn();
    const event = createEvent();

    const unsubscribeTyped = bus.subscribe('profile.updated', typed);
    const unsubscribeGlobal = bus.subscribe('*', global);

    await bus.publish(event);
    unsubscribeTyped();
    unsubscribeGlobal();
    await bus.publish(createEvent({ eventId: 'event-2', sequenceNumber: 2 }));

    expect(typed).toHaveBeenCalledTimes(1);
    expect(global).toHaveBeenCalledTimes(1);
    expect(typed).toHaveBeenCalledWith(event);
  });

  test('store appends, reads, orders streams, archives, and clears events', () => {
    const store = new InMemoryEventStore();
    const second = createEvent({ eventId: 'event-2', sequenceNumber: 2 });
    const first = createEvent();

    store.append(second);
    store.append(first);

    expect(store.read('event-1')).toEqual(first);
    expect(store.readAggregateStream('profile', 'aggregate-1').map(event => event.eventId)).toEqual(['event-1', 'event-2']);
    expect(store.readGlobalStream().map(event => event.eventId)).toEqual(['event-1', 'event-2']);
    expect(store.readEventTypeStream('profile.updated')).toHaveLength(2);
    expect(store.archive('event-1')).toEqual(first);
    expect(store.getSnapshot()).toMatchObject({ eventCount: 2, archivedCount: 1, lastEvent: second });

    store.clear();
    expect(store.getSnapshot()).toMatchObject({ eventCount: 0, archivedCount: 0 });
  });

  test('validation rejects missing metadata, invalid version, duplicates, and sequence gaps', () => {
    const store = new InMemoryEventStore();
    const first = createEvent();
    store.append(first);

    expect(validateDomainEvent(createEvent({ eventId: '', eventVersion: 0, timestamp: 'bad-date' }), store).issues.map(issue => issue.code))
      .toEqual(expect.arrayContaining(['missing_metadata', 'invalid_version', 'invalid_timestamp']));
    expect(validateDomainEvent(createEvent({ eventId: 'event-1' }), store).issues.map(issue => issue.code))
      .toEqual(expect.arrayContaining(['duplicate_event']));

    const gap = createEvent({ eventId: 'event-3', sequenceNumber: 3 });
    expect(validateDomainEvent(gap, store).issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'invalid_sequence' }),
    ]));
  });

  test('dispatcher validates, deduplicates, archives, publishes, and projects events in order', async () => {
    const { bus, store, projectors, deadLetters, dispatcher } = createPlatform();
    const listener = jest.fn();
    const projected: string[] = [];

    bus.subscribe('profile.updated', listener);
    projectors.register({
      id: 'profile-projector',
      eventTypes: ['profile.updated'],
      project: event => {
        projected.push(event.eventId);
      },
    });

    await expect(dispatcher.dispatch(createEvent())).resolves.toMatchObject({ ok: true });
    await expect(dispatcher.dispatch(createEvent({ eventId: 'event-2', sequenceNumber: 2 }))).resolves.toMatchObject({ ok: true });
    await expect(dispatcher.dispatch(createEvent({ eventId: 'event-2', sequenceNumber: 3 }))).resolves.toMatchObject({ ok: false });

    expect(listener).toHaveBeenCalledTimes(2);
    expect(projected).toEqual(['event-1', 'event-2']);
    expect(store.getSnapshot()).toMatchObject({ eventCount: 2, archivedCount: 2 });
    expect(deadLetters.size()).toBe(1);
  });

  test('dispatcher sends projector failures to dead letter queue', async () => {
    const { dispatcher, projectors, deadLetters } = createPlatform();
    projectors.register({
      id: 'failing-projector',
      eventTypes: '*',
      project: () => {
        throw new Error('projection failed');
      },
    });

    await expect(dispatcher.dispatch(createEvent())).resolves.toMatchObject({ ok: false, error: 'projection failed' });

    expect(deadLetters.inspect()).toEqual([
      expect.objectContaining({ reason: 'projection failed', event: expect.objectContaining({ eventId: 'event-1' }) }),
    ]);
  });

  test('projector registry supports multiple projectors per event and reset for replay', async () => {
    const registry = new ProjectorRegistry();
    const first = jest.fn();
    const second = jest.fn();
    const reset = jest.fn();
    const event = createEvent();

    registry.register({ id: 'one', eventTypes: ['profile.updated'], project: first, reset });
    registry.register({ id: 'two', eventTypes: '*', project: second });

    await registry.project(event);
    await registry.resetAll();

    expect(first).toHaveBeenCalledWith(event);
    expect(second).toHaveBeenCalledWith(event);
    expect(reset).toHaveBeenCalled();
    expect(registry.getSnapshot().size).toBe(2);
  });

  test('replay supports aggregate, event type, and global replay', async () => {
    const store = new InMemoryEventStore();
    const projectors = new ProjectorRegistry();
    const projected: string[] = [];
    const replay = new EventReplayService(store, projectors);

    projectors.register({
      id: 'audit',
      eventTypes: '*',
      project: event => {
        projected.push(event.eventId);
      },
    });
    store.append(createEvent());
    store.append(createEvent({ eventId: 'event-2', sequenceNumber: 2, eventType: 'profile.renamed' }));
    store.append(createEvent({ eventId: 'event-3', aggregateId: 'aggregate-2', sequenceNumber: 1 }));

    await expect(replay.replayAggregate('profile', 'aggregate-1')).resolves.toBe(2);
    await expect(replay.replayEventType('profile.updated')).resolves.toBe(2);
    await expect(replay.replayGlobal()).resolves.toBe(3);

    expect(projected).toEqual(['event-1', 'event-2', 'event-1', 'event-3', 'event-1', 'event-3', 'event-2']);
    expect(replay.getSnapshot()).toMatchObject({ status: 'completed', replayedCount: 3 });
  });

  test('dead letter queue supports retry, archive, inspect, remove, and clear', () => {
    const queue = new DeadLetterQueue({
      idFactory: () => 'dead-1',
      now: () => new Date('2026-06-29T10:00:00.000Z'),
    });
    const entry = queue.add(createEvent(), 'validation_failed');

    expect(entry).toMatchObject({ id: 'dead-1', retryCount: 0, archivedAt: null });
    expect(queue.retry('dead-1')).toMatchObject({ retryCount: 1 });
    expect(queue.archive('dead-1')).toMatchObject({ archivedAt: '2026-06-29T10:00:00.000Z' });
    expect(queue.size()).toBe(0);
    expect(queue.inspect('dead-1')).toMatchObject({ id: 'dead-1' });
    expect(queue.remove('dead-1')).toMatchObject({ id: 'dead-1' });

    queue.add(createEvent(), 'again');
    queue.clear();
    expect(queue.inspect()).toEqual([]);
  });
});
