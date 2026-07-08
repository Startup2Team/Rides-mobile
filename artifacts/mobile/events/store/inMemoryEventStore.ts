import type { DomainEvent } from '../types';

export interface EventStoreSnapshot {
  events: DomainEvent[];
  archived: DomainEvent[];
  eventCount: number;
  archivedCount: number;
  lastEvent: DomainEvent | null;
}

export class InMemoryEventStore {
  private events: DomainEvent[] = [];
  private archived: DomainEvent[] = [];

  append(event: DomainEvent) {
    this.events = [...this.events, event].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    return event;
  }

  read(eventId: string) {
    return this.events.find(event => event.eventId === eventId) ?? null;
  }

  readAggregateStream(aggregateType: string, aggregateId: string) {
    return this.events
      .filter(event => event.aggregateType === aggregateType && event.aggregateId === aggregateId)
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  }

  readGlobalStream() {
    return [...this.events].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  }

  readEventTypeStream(eventType: string) {
    return this.events
      .filter(event => event.eventType === eventType)
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  }

  archive(eventId: string) {
    const event = this.read(eventId);
    if (!event) return null;
    this.archived = [...this.archived, event];
    return event;
  }

  clear() {
    this.events = [];
    this.archived = [];
  }

  getSnapshot(): EventStoreSnapshot {
    const events = this.readGlobalStream();
    return {
      events,
      archived: [...this.archived],
      eventCount: events.length,
      archivedCount: this.archived.length,
      lastEvent: events[events.length - 1] ?? null,
    };
  }
}
