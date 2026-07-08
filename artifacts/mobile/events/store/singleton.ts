import { DomainEventBus } from '../bus/domainEventBus';
import { DeadLetterQueue } from '../dead-letter/deadLetterQueue';
import { DomainEventDispatcher } from '../dispatcher/domainEventDispatcher';
import { ProjectorRegistry } from '../projectors/projectorRegistry';
import { EventReplayService } from '../replay/replayService';
import { InMemoryEventStore } from './inMemoryEventStore';

export const domainEventBus = new DomainEventBus();
export const domainEventStore = new InMemoryEventStore();
export const domainProjectors = new ProjectorRegistry();
export const domainDeadLetters = new DeadLetterQueue();
export const domainEventDispatcher = new DomainEventDispatcher({
  bus: domainEventBus,
  store: domainEventStore,
  projectors: domainProjectors,
  deadLetters: domainDeadLetters,
});
export const domainEventReplay = new EventReplayService(domainEventStore, domainProjectors);
