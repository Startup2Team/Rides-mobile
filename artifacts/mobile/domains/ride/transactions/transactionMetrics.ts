import { observability } from '@/observability/context/observabilityContext';
import type { RideTransactionBoundaryResult } from './transactionTypes';

export interface RideTransactionTelemetryRecord {
  transactionId: string;
  rideId: string;
  commandId: string;
  commandType: string;
  state: string;
  accepted: boolean;
  duplicate: boolean;
  orderingViolation: boolean;
  reason: string;
  timestamp: string;
}

export interface RideTransactionTelemetry {
  record(record: RideTransactionTelemetryRecord): void;
}

export class ObservabilityRideTransactionTelemetry implements RideTransactionTelemetry {
  record(record: RideTransactionTelemetryRecord) {
    observability.metrics.counter('ride.transaction.accepted', record.accepted ? 1 : 0, {
      commandType: record.commandType,
    });
    observability.logger.info('RideTransactionEvaluated', {
      transactionId: record.transactionId,
      rideId: record.rideId,
      commandId: record.commandId,
      commandType: record.commandType,
      state: record.state,
      accepted: record.accepted,
      duplicate: record.duplicate,
      orderingViolation: record.orderingViolation,
      reason: record.reason,
    });

    if (!record.accepted) {
      observability.metrics.counter('ride.transaction.rejected', 1, { commandType: record.commandType });
      observability.logger.warn('RideTransactionRejected', {
        transactionId: record.transactionId,
        commandType: record.commandType,
        reason: record.reason,
      });
    }

    if (record.duplicate) {
      observability.metrics.counter('ride.transaction.duplicate_detected', 1, { commandType: record.commandType });
      observability.logger.warn('RideTransactionDuplicateDetected', {
        transactionId: record.transactionId,
        commandType: record.commandType,
      });
    }

    if (record.orderingViolation) {
      observability.metrics.counter('ride.transaction.ordering_violation', 1, { commandType: record.commandType });
      observability.logger.warn('RideTransactionOrderingViolation', {
        transactionId: record.transactionId,
        commandType: record.commandType,
      });
    }

    if (!record.accepted && record.reason === 'capability-denied') {
      observability.metrics.counter('ride.transaction.capability_denied', 1, { commandType: record.commandType });
      observability.logger.warn('RideTransactionCapabilityDenied', {
        transactionId: record.transactionId,
        commandType: record.commandType,
      });
    }
  }
}

export class MemoryRideTransactionTelemetry implements RideTransactionTelemetry {
  records: RideTransactionTelemetryRecord[] = [];

  record(record: RideTransactionTelemetryRecord) {
    this.records = [...this.records, record];
  }
}

export function createRideTransactionTelemetryRecord(result: RideTransactionBoundaryResult): RideTransactionTelemetryRecord {
  return {
    transactionId: result.transactionId,
    rideId: result.rideId,
    commandId: result.commandId,
    commandType: result.commandType,
    state: result.state,
    accepted: result.accepted,
    duplicate: result.duplicate,
    orderingViolation: result.orderingViolation,
    reason: result.reason,
    timestamp: result.timestamp,
  };
}
