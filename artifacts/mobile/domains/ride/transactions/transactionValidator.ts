import type { CapabilitySnapshot } from '@/capabilities';
import type { RideLifecycleCommand } from '../commands';
import type { ActiveRideReadModel, RidePhase, RideStatus } from '../readModels';
import {
  getRideTransactionAllowedPhases,
  getRideTransactionAllowedStatuses,
  getRideTransactionCommandType,
} from './transactionPolicies';
import type {
  RideTransactionBoundaryContext,
  RideTransactionValidationIssue,
  RideTransactionValidationResult,
} from './transactionTypes';

function addIssue(
  issues: RideTransactionValidationIssue[],
  field: string,
  message: string,
  code: string,
) {
  issues.push({ field, message, code });
}

function assertString(
  value: unknown,
  field: string,
  issues: RideTransactionValidationIssue[],
  code = 'required',
) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    addIssue(issues, field, `${field} is required`, code);
  }
}

function getCapabilitySnapshot(context: RideTransactionBoundaryContext): CapabilitySnapshot | null {
  return context.capabilitySnapshot ?? null;
}

function isApprovedDriver(context: RideTransactionBoundaryContext) {
  const capabilitySnapshot = getCapabilitySnapshot(context);
  return Boolean(capabilitySnapshot?.capabilities?.canDrive && capabilitySnapshot?.state?.isApprovedDriver);
}

function validateCommandMetadata(command: RideLifecycleCommand, issues: RideTransactionValidationIssue[]) {
  assertString(command.commandId, 'commandId', issues);
  assertString(command.idempotencyKey, 'idempotencyKey', issues);
  assertString(command.correlationId, 'correlationId', issues);
  assertString(command.actorId, 'actorId', issues);
  assertString(command.actorRole, 'actorRole', issues);
  assertString(command.timestamp, 'timestamp', issues);
}

function validateRideTarget(command: RideLifecycleCommand, context: RideTransactionBoundaryContext, issues: RideTransactionValidationIssue[]) {
  const rideId = command.payload.rideId;
  assertString(rideId, 'payload.rideId', issues);

  if (!context.currentRide) {
    addIssue(issues, 'currentRide', 'currentRide is required for transaction readiness', 'ride-not-found');
    return;
  }

  if (context.currentRide.rideId !== rideId) {
    addIssue(issues, 'payload.rideId', 'payload.rideId does not match current ride', 'ride-mismatch');
  }
}

function validateDuplicateState(
  command: RideLifecycleCommand,
  context: RideTransactionBoundaryContext,
  issues: RideTransactionValidationIssue[],
  duplicateCommandIds: readonly string[],
  duplicateIdempotencyKeys: readonly string[],
) {
  if (duplicateCommandIds.includes(command.commandId)) {
    addIssue(issues, 'commandId', 'duplicate command detected', 'duplicate-command');
  }
  if (duplicateIdempotencyKeys.includes(command.idempotencyKey)) {
    addIssue(issues, 'idempotencyKey', 'duplicate idempotency key detected', 'duplicate-idempotency');
  }
}

function validateOrdering(
  context: RideTransactionBoundaryContext,
  issues: RideTransactionValidationIssue[],
) {
  if (typeof context.commandSequenceNumber !== 'number') return;
  if (!Number.isInteger(context.commandSequenceNumber) || context.commandSequenceNumber < 1) {
    addIssue(issues, 'commandSequenceNumber', 'commandSequenceNumber must be a positive integer', 'ordering-invalid');
    return;
  }
  if (typeof context.lastSequenceNumber === 'number' && context.commandSequenceNumber <= context.lastSequenceNumber) {
    addIssue(issues, 'commandSequenceNumber', 'command ordering violation', 'ordering-violation');
  }
}

function validatePhase(command: RideLifecycleCommand, context: RideTransactionBoundaryContext, issues: RideTransactionValidationIssue[]) {
  const commandType = getRideTransactionCommandType(command);
  if (!commandType) {
    return;
  }

  if (!context.currentRide) return;

  const allowedStatuses: readonly RideStatus[] = getRideTransactionAllowedStatuses(commandType);
  const allowedPhases: readonly RidePhase[] = getRideTransactionAllowedPhases(commandType);
  if (!allowedStatuses.includes(context.currentRide.status)) {
    addIssue(issues, 'currentRide.status', `ride phase is not ready for ${commandType}`, 'invalid-phase');
  }
  if (!allowedPhases.includes(context.currentRide.phase)) {
    addIssue(issues, 'currentRide.phase', `ride phase is not ready for ${commandType}`, 'invalid-phase');
  }
}

function validateCapability(command: RideLifecycleCommand, context: RideTransactionBoundaryContext, issues: RideTransactionValidationIssue[]) {
  const commandType = getRideTransactionCommandType(command);
  if (!commandType) return;

  if (command.actorRole !== 'driver') {
    addIssue(issues, 'actorRole', 'driver actor role is required', 'capability-denied');
    return;
  }

  if (!isApprovedDriver(context)) {
    addIssue(issues, 'capabilities.canDrive', 'approved driver capability is required', 'capability-denied');
  }
}

export function validateRideTransactionCommand(
  command: RideLifecycleCommand,
  context: RideTransactionBoundaryContext,
): RideTransactionValidationResult {
  const issues: RideTransactionValidationIssue[] = [];
  const commandType = getRideTransactionCommandType(command);
  validateCommandMetadata(command, issues);
  validateRideTarget(command, context, issues);
  validateDuplicateState(
    command,
    context,
    issues,
    context.appliedCommandIds ?? [],
    context.appliedIdempotencyKeys ?? [],
  );
  validateOrdering(context, issues);
  validatePhase(command, context, issues);
  validateCapability(command, context, issues);

  if (!commandType) {
    addIssue(issues, 'commandType', 'unsupported ride transaction command', 'unsupported-command');
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
