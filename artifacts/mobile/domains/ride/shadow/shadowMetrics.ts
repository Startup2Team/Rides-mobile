import type { RideShadowTelemetry, RideProjectionMismatch } from './shadowTypes';
import type { DomainEvent } from '@/events';
import { observability } from '@/observability/context/observabilityContext';

export class ObservabilityRideShadowTelemetry implements RideShadowTelemetry {
  recordMismatch(mismatch: RideProjectionMismatch) {
    observability.metrics.counter('ride.shadow_projection.mismatch', 1, {
      eventType: mismatch.eventType ?? 'unknown',
    });
    observability.logger.warn('RideProjectionMismatch', {
      aggregateId: mismatch.aggregateId,
      eventId: mismatch.eventId,
      eventType: mismatch.eventType,
      correlationId: mismatch.correlationId,
      sequenceNumber: mismatch.sequenceNumber,
      fieldDiff: mismatch.fieldDiff,
    });
  }

  recordProjection(event: DomainEvent) {
    observability.metrics.counter('ride.shadow_projection.event', 1, {
      eventType: event.eventType,
    });
  }

  recordReplay(count: number) {
    observability.metrics.counter('ride.shadow_projection.replay', count);
  }
}

export class MemoryRideShadowTelemetry implements RideShadowTelemetry {
  mismatches: RideProjectionMismatch[] = [];
  projectedEvents: DomainEvent[] = [];
  replayCounts: number[] = [];

  recordMismatch(mismatch: RideProjectionMismatch) {
    this.mismatches = [...this.mismatches, mismatch];
  }

  recordProjection(event: DomainEvent) {
    this.projectedEvents = [...this.projectedEvents, event];
  }

  recordReplay(count: number) {
    this.replayCounts = [...this.replayCounts, count];
  }
}
