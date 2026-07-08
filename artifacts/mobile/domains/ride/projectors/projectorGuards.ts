import type { DomainEvent } from '@/events';
import { rideEventTypes, type RideLifecycleEvent } from '../events';

export function hasAppliedEvent(model: { projection?: { appliedEventIds: string[] } } | null | undefined, eventId: string) {
  return Boolean(model?.projection?.appliedEventIds.includes(eventId));
}

export function hasStaleSequence(model: { sequenceNumber: number } | null | undefined, sequenceNumber: number) {
  return Boolean(model && sequenceNumber <= model.sequenceNumber);
}

export function shouldIgnoreEvent(model: { sequenceNumber: number; projection?: { appliedEventIds: string[] } } | null | undefined, event: DomainEvent) {
  return hasAppliedEvent(model, event.eventId) || hasStaleSequence(model, event.sequenceNumber);
}

export function applyEventMetadata<TModel extends { sequenceNumber: number; projection: { appliedEventIds: string[] } }>(
  model: TModel,
  event: DomainEvent,
): TModel {
  return {
    ...model,
    sequenceNumber: event.sequenceNumber,
    projection: {
      appliedEventIds: [...model.projection.appliedEventIds, event.eventId],
    },
  };
}

export function isTerminalRideEvent(event: RideLifecycleEvent) {
  const terminalEvents: string[] = [rideEventTypes.completed, rideEventTypes.cancelled, rideEventTypes.timeout];
  return terminalEvents.includes(event.eventType);
}
