import { observability } from '@/observability/context/observabilityContext';
import type { RideDualReadComparison } from '../dualRead/rideDualReadTypes';
import type { RideProjectionSelectionResult } from './projectionSelection';

export interface RideProjectionTelemetryRecord {
  selection: RideProjectionSelectionResult;
  comparison: RideDualReadComparison | null;
  rollback: boolean;
  timestamp: string;
}

export interface RideProjectionTelemetry {
  record(record: RideProjectionTelemetryRecord): void;
}

export class ObservabilityRideProjectionTelemetry implements RideProjectionTelemetry {
  record(record: RideProjectionTelemetryRecord) {
    observability.metrics.counter('ride.projection.source', 1, {
      source: record.selection.source,
    });
    observability.logger.info('RideProjectionSourceSelected', {
      source: record.selection.source,
      reason: record.selection.reason,
      projectedAvailable: record.selection.projectedAvailable,
    });

    if (record.rollback) {
      observability.metrics.counter('ride.projection.rollback', 1);
      observability.logger.info('RideProjectionRollbackToLive', {
        source: record.selection.source,
      });
    }

    if (!record.comparison) {
      observability.metrics.counter('ride.projection.projected_unavailable', 1);
      return;
    }

    observability.metrics.counter('ride.projection.compared', 1, {
      source: record.selection.source,
    });

    if (record.comparison.activeRideDiff.length > 0) {
      observability.metrics.counter('ride.projection.active_mismatch', 1);
    }
    if (record.comparison.historyDiff.length > 0) {
      observability.metrics.counter('ride.projection.history_mismatch', 1);
    }
    if (record.comparison.driverRequestDiff.length > 0) {
      observability.metrics.counter('ride.projection.driver_request_mismatch', 1);
    }
    if (record.comparison.mismatch) {
      observability.metrics.counter('ride.projection.mismatch', 1);
      observability.logger.warn('RideProjectionMismatch', {
        aggregateId: record.comparison.mismatch.aggregateId,
        eventId: record.comparison.mismatch.eventId,
        eventType: record.comparison.mismatch.eventType,
        correlationId: record.comparison.mismatch.correlationId,
        sequenceNumber: record.comparison.mismatch.sequenceNumber,
        fieldDiff: record.comparison.mismatch.fieldDiff,
      });
    }
  }
}

export class MemoryRideProjectionTelemetry implements RideProjectionTelemetry {
  records: RideProjectionTelemetryRecord[] = [];

  record(record: RideProjectionTelemetryRecord) {
    this.records = [...this.records, record];
  }
}
