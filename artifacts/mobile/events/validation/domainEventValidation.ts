import type { DomainEvent, EventValidationIssue, EventValidationResult } from '../types';
import type { InMemoryEventStore } from '../store/inMemoryEventStore';

const requiredFields: Array<keyof DomainEvent> = [
  'eventId',
  'aggregateId',
  'aggregateType',
  'eventType',
  'eventVersion',
  'sequenceNumber',
  'timestamp',
  'correlationId',
  'producer',
  'payload',
];

export function validateDomainEvent(event: DomainEvent, store?: InMemoryEventStore): EventValidationResult {
  const issues: EventValidationIssue[] = [];

  requiredFields.forEach(field => {
    const value = event[field];
    if (value === undefined || value === null || value === '') {
      issues.push({
        code: 'missing_metadata',
        eventId: event.eventId,
        message: `Missing required event metadata: ${String(field)}`,
      });
    }
  });

  if (!Number.isInteger(event.eventVersion) || event.eventVersion < 1) {
    issues.push({ code: 'invalid_version', eventId: event.eventId, message: 'Event version must be a positive integer' });
  }

  if (!Number.isInteger(event.sequenceNumber) || event.sequenceNumber < 1) {
    issues.push({ code: 'invalid_sequence', eventId: event.eventId, message: 'Sequence number must be a positive integer' });
  }

  if (Number.isNaN(new Date(event.timestamp).getTime())) {
    issues.push({ code: 'invalid_timestamp', eventId: event.eventId, message: 'Timestamp must be an ISO date string' });
  }

  if (store?.read(event.eventId)) {
    issues.push({ code: 'duplicate_event', eventId: event.eventId, message: 'Event has already been appended' });
  }

  const aggregateEvents = store?.readAggregateStream(event.aggregateType, event.aggregateId) ?? [];
  const highestSequence = aggregateEvents.reduce((max, current) => Math.max(max, current.sequenceNumber), 0);
  if (highestSequence > 0 && event.sequenceNumber !== highestSequence + 1) {
    issues.push({
      code: 'invalid_sequence',
      eventId: event.eventId,
      message: `Expected sequence ${highestSequence + 1} for aggregate ${event.aggregateType}:${event.aggregateId}`,
    });
  }

  return { ok: issues.length === 0, issues };
}
