import { createRideCommandId } from '../idempotency';
import type { RideLifecycleCommand } from '../commands';
import { createRideTransactionPreview, getRideTransactionCommandType } from './transactionPolicies';
import { validateRideTransactionCommand } from './transactionValidator';
import { ObservabilityRideTransactionTelemetry, createRideTransactionTelemetryRecord, type RideTransactionTelemetry, MemoryRideTransactionTelemetry } from './transactionMetrics';
import type {
  RideTransactionBoundaryContext,
  RideTransactionBoundaryResult,
  RideTransactionDiagnostics,
  RideTransactionPreview,
  RideTransactionRollbackPlan,
  RideTransactionCompensationHook,
  RideTransactionState,
} from './transactionTypes';

function resolveTransactionId(
  command: RideLifecycleCommand,
  context: RideTransactionBoundaryContext,
) {
  return context.transactionIdFactory?.() ?? command.commandId ?? createRideCommandId('ride_transaction');
}

function resolveTimestamp(context: RideTransactionBoundaryContext) {
  return (context.now ?? (() => new Date()))().toISOString();
}

function asSet(values?: readonly string[] | null) {
  return new Set(values ?? []);
}

function buildRollbackPlan(
  transactionId: string,
  rideId: string,
  commandType: ReturnType<typeof getRideTransactionCommandType>,
  compensationHooks: readonly RideTransactionCompensationHook[] = [],
): RideTransactionRollbackPlan {
  return {
    transactionId,
    rideId,
    commandType: commandType ?? 'ride.start',
    hooks: compensationHooks.map(hook => hook.name),
  };
}

export class RideTransactionBoundary {
  private readonly telemetry: RideTransactionTelemetry;
  private readonly now: () => Date;
  private readonly transactionIdFactory: () => string;
  private appliedCommandIds = new Set<string>();
  private appliedIdempotencyKeys = new Set<string>();
  private lastSequenceNumber: number | null = null;
  private lastResult: RideTransactionBoundaryResult | null = null;
  private records: RideTransactionBoundaryResult[] = [];
  private processedCount = 0;
  private acceptedCount = 0;
  private rejectedCount = 0;
  private duplicateCount = 0;
  private orderingViolationCount = 0;

  constructor(options: {
    telemetry?: RideTransactionTelemetry;
    now?: () => Date;
    transactionIdFactory?: () => string;
  } = {}) {
    this.telemetry = options.telemetry ?? new ObservabilityRideTransactionTelemetry();
    this.now = options.now ?? (() => new Date());
    this.transactionIdFactory = options.transactionIdFactory ?? (() => createRideCommandId('ride_transaction'));
  }

  reset() {
    this.appliedCommandIds = new Set<string>();
    this.appliedIdempotencyKeys = new Set<string>();
    this.lastSequenceNumber = null;
    this.lastResult = null;
    this.records = [];
    this.processedCount = 0;
    this.acceptedCount = 0;
    this.rejectedCount = 0;
    this.duplicateCount = 0;
    this.orderingViolationCount = 0;
  }

  getDiagnostics(): RideTransactionDiagnostics {
    return {
      processedCount: this.processedCount,
      acceptedCount: this.acceptedCount,
      rejectedCount: this.rejectedCount,
      duplicateCount: this.duplicateCount,
      orderingViolationCount: this.orderingViolationCount,
      lastResult: this.lastResult,
      records: [...this.records],
    };
  }

  createRollbackPlan(
    command: RideLifecycleCommand,
    context: RideTransactionBoundaryContext,
  ): RideTransactionRollbackPlan {
    const commandType = getRideTransactionCommandType(command);
    const transactionId = resolveTransactionId(command, context);
    const rideId = command.payload.rideId;
    return buildRollbackPlan(transactionId, rideId, commandType, context.compensationHooks ?? []);
  }

  preview<TCommand extends RideLifecycleCommand>(command: TCommand, context: RideTransactionBoundaryContext): RideTransactionPreview<TCommand> | null {
    const commandType = getRideTransactionCommandType(command);
    if (!commandType) return null;
    const transactionId = resolveTransactionId(command, context);
    return createRideTransactionPreview(command, transactionId, {
      now: context.now?.() ?? this.now(),
      hooks: context.compensationHooks ?? [],
    });
  }

  evaluate<TCommand extends RideLifecycleCommand>(
    command: TCommand,
    context: RideTransactionBoundaryContext,
  ): RideTransactionBoundaryResult<TCommand> {
    const transactionId = resolveTransactionId(command, context);
    const commandType = getRideTransactionCommandType(command);
    const duplicateCommandIds = asSet(context.appliedCommandIds);
    const duplicateIdempotencyKeys = asSet(context.appliedIdempotencyKeys);
    const validation = validateRideTransactionCommand(command, {
      ...context,
      appliedCommandIds: [...duplicateCommandIds, ...this.appliedCommandIds],
      appliedIdempotencyKeys: [...duplicateIdempotencyKeys, ...this.appliedIdempotencyKeys],
      lastSequenceNumber: context.lastSequenceNumber ?? this.lastSequenceNumber,
      transactionIdFactory: this.transactionIdFactory,
    });
    const duplicate = duplicateCommandIds.has(command.commandId)
      || duplicateIdempotencyKeys.has(command.idempotencyKey)
      || this.appliedCommandIds.has(command.commandId)
      || this.appliedIdempotencyKeys.has(command.idempotencyKey);
    const orderingViolation = validation.issues.some(issue => issue.code === 'ordering-violation' || issue.code === 'ordering-invalid');
    const accepted = Boolean(commandType) && validation.valid;
    const state: RideTransactionState = accepted ? 'Accepted' : 'Rejected';
    const reason = !commandType
      ? 'unsupported'
      : duplicate
        ? 'duplicate'
        : orderingViolation
          ? 'ordering-violation'
          : validation.issues.some(issue => issue.code === 'capability-denied')
            ? 'capability-denied'
            : validation.issues.some(issue => issue.code === 'invalid-phase')
              ? 'invalid-phase'
              : validation.issues.some(issue => issue.code === 'ride-not-found')
                ? 'ride-not-found'
                : validation.issues.some(issue => issue.code === 'ride-mismatch')
                  ? 'ride-mismatch'
                  : validation.issues.length > 0
                    ? 'validation-failed'
                    : 'accepted';
    const timestamp = resolveTimestamp(context);
    const preview = accepted && commandType
      ? this.preview(command, context)
      : null;
    const result: RideTransactionBoundaryResult<TCommand> = {
      transactionId,
      rideId: command.payload.rideId,
      commandId: command.commandId,
      commandType: commandType ?? 'ride.start',
      state,
      accepted,
      duplicate,
      orderingViolation,
      validation,
      preview,
      reason,
      timestamp,
    };

    this.telemetry.record(createRideTransactionTelemetryRecord(result));
    this.processedCount += 1;
    this.acceptedCount += accepted ? 1 : 0;
    this.rejectedCount += accepted ? 0 : 1;
    this.duplicateCount += duplicate ? 1 : 0;
    this.orderingViolationCount += orderingViolation ? 1 : 0;
    this.lastResult = result;
    this.records = [...this.records, result];

    if (accepted) {
      this.appliedCommandIds.add(command.commandId);
      this.appliedIdempotencyKeys.add(command.idempotencyKey);
      if (typeof context.commandSequenceNumber === 'number') {
        this.lastSequenceNumber = context.commandSequenceNumber;
      }
    }

    return result;
  }

  commit<TCommand extends RideLifecycleCommand>(
    command: TCommand,
    context: RideTransactionBoundaryContext,
  ) {
    const result = this.evaluate(command, context);
    if (!result.accepted) {
      return {
        ...result,
        state: 'Rejected' as const,
      };
    }
    return {
      ...result,
      state: 'Committed' as const,
    };
  }

  rollback<TCommand extends RideLifecycleCommand>(
    command: TCommand,
    context: RideTransactionBoundaryContext,
    reason?: string | null,
  ) {
    const result = this.evaluate(command, context);
    const rollbackPlan = this.createRollbackPlan(command, context);
    return {
      ...result,
      state: 'RolledBack' as const,
      reason: reason ?? result.reason,
      preview: result.preview
        ? {
            ...result.preview,
            rollbackPlan,
          }
        : null,
    };
  }

  expire<TCommand extends RideLifecycleCommand>(
    command: TCommand,
    context: RideTransactionBoundaryContext,
  ) {
    const result = this.evaluate(command, context);
    return {
      ...result,
      state: 'Expired' as const,
      accepted: false,
      reason: 'expired',
    };
  }
}

export const rideTransactionBoundary = new RideTransactionBoundary();

export function processRideTransaction<TCommand extends RideLifecycleCommand>(
  command: TCommand,
  context: RideTransactionBoundaryContext,
) {
  return rideTransactionBoundary.evaluate(command, context);
}

export { MemoryRideTransactionTelemetry };
