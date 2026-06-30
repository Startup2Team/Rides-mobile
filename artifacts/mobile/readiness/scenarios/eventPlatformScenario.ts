import { DomainEventBus } from '@/events/bus/domainEventBus';
import { DeadLetterQueue } from '@/events/dead-letter/deadLetterQueue';
import { DomainEventDispatcher } from '@/events/dispatcher/domainEventDispatcher';
import { ProjectorRegistry } from '@/events/projectors/projectorRegistry';
import { EventReplayService } from '@/events/replay/replayService';
import { InMemoryEventStore } from '@/events/store/inMemoryEventStore';
import type { DomainEvent } from '@/events/types';
import { createDeterministicClock, createReadinessStressProfile } from '../stress/readinessStress';
import { createReadinessGateResult } from '../types';
import type { ReadinessStressProfile } from '../types';

function createEvent(sequenceNumber: number, overrides: Partial<DomainEvent> = {}): DomainEvent {
  return {
    eventId: `event-${sequenceNumber}`,
    aggregateId: 'aggregate-1',
    aggregateType: 'profile',
    eventType: 'profile.updated',
    eventVersion: 1,
    sequenceNumber,
    timestamp: `2026-06-29T10:${String(sequenceNumber % 60).padStart(2, '0')}:00.000Z`,
    correlationId: 'correlation-1',
    causationId: null,
    producer: 'readiness',
    payload: { sequenceNumber },
    ...overrides,
  };
}

export async function runEventPlatformReadinessScenario(
  profile: ReadinessStressProfile = createReadinessStressProfile(),
) {
  const clock = createDeterministicClock();
  const bus = new DomainEventBus();
  const store = new InMemoryEventStore();
  const projectors = new ProjectorRegistry();
  const deadLetters = new DeadLetterQueue({ idFactory: () => `dead-${clock.iso()}`, now: clock.now });
  const dispatcher = new DomainEventDispatcher({ bus, store, projectors, deadLetters });
  const replay = new EventReplayService(store, projectors);
  const projected: string[] = [];

  projectors.register({
    id: 'readiness.profile.projector',
    eventTypes: '*',
    project: event => {
      projected.push(event.eventId);
    },
  });

  for (let sequenceNumber = 1; sequenceNumber <= profile.domainEvents; sequenceNumber += 1) {
    await dispatcher.dispatch(createEvent(sequenceNumber));
    clock.advance(1);
  }

  const duplicate = await dispatcher.dispatch(createEvent(profile.domainEvents, { eventId: `event-${profile.domainEvents}` }));
  const stale = await dispatcher.dispatch(createEvent(profile.domainEvents - 1, { eventId: 'event-stale', sequenceNumber: profile.domainEvents - 1 }));
  const failingProjector = projectors.register({
    id: 'readiness.failure.projector',
    eventTypes: '*',
    project: () => {
      throw new Error('projector.failure');
    },
  });
  const failure = await dispatcher.dispatch(createEvent(profile.domainEvents + 1, { eventId: `event-${profile.domainEvents + 1}`, sequenceNumber: profile.domainEvents + 1 }));
  failingProjector();

  const replayed = await replay.replayGlobal();
  const snapshot = store.getSnapshot();
  const ordered = snapshot.events.every((event, index, events) => index === 0 || events[index - 1].sequenceNumber <= event.sequenceNumber);
  const success =
    snapshot.eventCount === profile.domainEvents + 1 &&
    replayed === profile.domainEvents + 1 &&
    ordered &&
    duplicate.ok === false &&
    stale.ok === false &&
    failure.ok === false &&
    deadLetters.size() >= 3 &&
    projected.length >= profile.domainEvents;

  return createReadinessGateResult(
    'event_platform',
    success ? 'pass' : 'fail',
    [
      { name: 'eventCount', value: snapshot.eventCount, unit: 'events' },
      { name: 'replayedCount', value: replayed, unit: 'events' },
      { name: 'deadLetters', value: deadLetters.size(), unit: 'events' },
      { name: 'ordered', value: ordered },
      { name: 'projectedCount', value: projected.length, unit: 'events' },
    ],
    success ? null : 'Domain event dispatch, replay, ordering, or dead-letter handling failed under stress.',
    success
      ? 'Keep validation, ordering, replay, and dead-letter behavior unchanged before ride lifecycle migration.'
      : 'Investigate event validation, projector failures, or replay order before migrating ride writes.',
    clock.now,
  );
}
