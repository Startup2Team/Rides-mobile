import type { DomainEvent } from '../types';
import type { DomainEventBus } from '../bus/domainEventBus';
import type { DeadLetterQueue } from '../dead-letter/deadLetterQueue';
import type { ProjectorRegistry } from '../projectors/projectorRegistry';
import type { InMemoryEventStore } from '../store/inMemoryEventStore';
import { validateDomainEvent } from '../validation/domainEventValidation';
import { observability } from '@/observability/context/observabilityContext';

export interface DomainEventDispatcherOptions {
  bus: DomainEventBus;
  store: InMemoryEventStore;
  projectors: ProjectorRegistry;
  deadLetters: DeadLetterQueue;
}

export class DomainEventDispatcher {
  private readonly bus: DomainEventBus;
  private readonly store: InMemoryEventStore;
  private readonly projectors: ProjectorRegistry;
  private readonly deadLetters: DeadLetterQueue;

  constructor(options: DomainEventDispatcherOptions) {
    this.bus = options.bus;
    this.store = options.store;
    this.projectors = options.projectors;
    this.deadLetters = options.deadLetters;
  }

  async dispatch(event: DomainEvent) {
    const span = observability.tracer.startSpan('domain_event.dispatch', null, {
      eventType: event.eventType,
      aggregateType: event.aggregateType,
    });
    observability.metrics.counter('domain_event.dispatch', 1, { eventType: event.eventType });
    const validation = validateDomainEvent(event, this.store);
    if (!validation.ok) {
      observability.tracer.endSpan(span.spanId, 'error');
      observability.metrics.counter('domain_event.validation_failed', 1, { eventType: event.eventType });
      this.deadLetters.add(event, 'validation_failed', validation.issues);
      return { ok: false as const, validation };
    }

    this.store.append(event);

    try {
      await this.bus.publish(event);
      await this.projectors.project(event);
      this.store.archive(event.eventId);
      observability.tracer.endSpan(span.spanId, 'ok');
      return { ok: true as const, event };
    } catch (error) {
      observability.tracer.endSpan(span.spanId, 'error');
      observability.metrics.counter('domain_event.dispatch_failed', 1, { eventType: event.eventType });
      const message = error instanceof Error ? error.message : String(error);
      this.deadLetters.add(event, message);
      return { ok: false as const, error: message };
    }
  }
}
