import { observability } from '@/observability/context/observabilityContext';
import type { RideCommandDiagnosticRecord, RideCommandPolicyResult, RideCommandRoute, RideCommandValidationResult } from './rideCommandTypes';

export interface RideCommandTelemetryRecord {
  commandId: string;
  commandType: string;
  mode: string;
  route: RideCommandRoute;
  validation: RideCommandValidationResult;
  policy: RideCommandPolicyResult;
  previewCreated: boolean;
  timestamp: string;
  correlationId: string;
}

export interface RideCommandTelemetry {
  record(record: RideCommandTelemetryRecord): void;
}

export class ObservabilityRideCommandTelemetry implements RideCommandTelemetry {
  record(record: RideCommandTelemetryRecord) {
    observability.metrics.counter('ride.command.validated', 1, {
      commandType: record.commandType,
      mode: record.mode,
    });
    observability.logger.info('RideCommandValidated', {
      commandId: record.commandId,
      commandType: record.commandType,
      mode: record.mode,
      correlationId: record.correlationId,
      route: record.route.routeName,
    });

    if (!record.validation.valid) {
      observability.metrics.counter('ride.command.rejected', 1, { commandType: record.commandType });
      observability.logger.warn('RideCommandRejected', {
        commandId: record.commandId,
        commandType: record.commandType,
        issues: record.validation.issues,
      });
      return;
    }

    if (!record.policy.allowed) {
      observability.metrics.counter('ride.command.policy_denied', 1, { commandType: record.commandType });
      observability.logger.warn('RideCommandPolicyDenied', {
        commandId: record.commandId,
        commandType: record.commandType,
        reason: record.policy.reason,
      });
      return;
    }

    if (record.mode === 'dryRun') {
      observability.metrics.counter('ride.command.dry_run', 1, { commandType: record.commandType });
      observability.logger.info('RideCommandDryRun', {
        commandId: record.commandId,
        commandType: record.commandType,
      });
    }

    if (record.mode === 'shadow') {
      observability.metrics.counter('ride.command.shadow_recorded', 1, { commandType: record.commandType });
      observability.logger.info('RideCommandShadowRecorded', {
        commandId: record.commandId,
        commandType: record.commandType,
      });
    }

    if (record.previewCreated) {
      observability.metrics.counter('ride.command.enqueue_preview_created', 1, { commandType: record.commandType });
      observability.logger.info('RideCommandEnqueuePreviewCreated', {
        commandId: record.commandId,
        commandType: record.commandType,
      });
    }
  }
}

export class MemoryRideCommandTelemetry implements RideCommandTelemetry {
  records: RideCommandTelemetryRecord[] = [];

  record(record: RideCommandTelemetryRecord) {
    this.records = [...this.records, record];
  }
}

export function createRideCommandDiagnosticRecord<T extends RideCommandDiagnosticRecord>(record: T) {
  return record;
}

