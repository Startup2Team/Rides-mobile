import { observability } from '@/observability/context/observabilityContext';
import type { RideDualReadComparison, RideReadModelSource, RideDualReadSnapshot } from './rideDualReadTypes';

export interface RideDualReadTelemetryRecord {
  source: RideReadModelSource;
  projectedAvailable: boolean;
  comparison: RideDualReadComparison | null;
  timestamp: string;
}

export interface RideDualReadTelemetry {
  record(record: RideDualReadTelemetryRecord): void;
}

export class ObservabilityRideDualReadTelemetry implements RideDualReadTelemetry {
  record(record: RideDualReadTelemetryRecord) {
    observability.metrics.counter('ride.dual_read.source', 1, { source: record.source });
    observability.logger.info('RideDualReadSourceUsed', {
      source: record.source,
      projectedAvailable: record.projectedAvailable,
    });

    if (!record.projectedAvailable || !record.comparison) {
      observability.metrics.counter('ride.dual_read.projected_unavailable', 1);
      observability.logger.warn('RideDualReadProjectedUnavailable', {
        source: record.source,
      });
      return;
    }

    observability.metrics.counter('ride.dual_read.compared', 1, { source: record.source });

    if (record.comparison.activeRideDiff.length > 0) {
      observability.metrics.counter('ride.dual_read.active_mismatch', 1);
    }
    if (record.comparison.historyDiff.length > 0) {
      observability.metrics.counter('ride.dual_read.history_mismatch', 1);
    }
    if (record.comparison.driverRequestDiff.length > 0) {
      observability.metrics.counter('ride.dual_read.driver_request_mismatch', 1);
    }
    if (record.comparison.mismatch) {
      observability.logger.warn('RideDualReadMismatch', {
        activeRideDiff: record.comparison.activeRideDiff,
        historyDiff: record.comparison.historyDiff,
        driverRequestDiff: record.comparison.driverRequestDiff,
        mismatch: record.comparison.mismatch,
      });
    }
  }
}

export class MemoryRideDualReadTelemetry implements RideDualReadTelemetry {
  records: RideDualReadTelemetryRecord[] = [];

  record(record: RideDualReadTelemetryRecord) {
    this.records = [...this.records, record];
  }
}

export function recordRideDualReadTelemetry(
  snapshot: RideDualReadSnapshot,
  telemetry: RideDualReadTelemetry = new ObservabilityRideDualReadTelemetry(),
) {
  telemetry.record({
    source: snapshot.source,
    projectedAvailable: snapshot.projectedAvailable,
    comparison: snapshot.comparison,
    timestamp: new Date().toISOString(),
  });
}
