import type { CapabilitySnapshot } from '@/capabilities';
import type { PendingMutationPriority, RetryPolicy } from '@/offline';
import type { RideLifecycleCommand, RideActorRole, StartRideCommand, CompleteRideCommand } from '../commands';
import type { ActiveRideReadModel, RidePhase, RideStatus } from '../readModels';

export type RideTransactionCommandType = 'ride.start' | 'ride.complete';
export type RideTransactionState = 'Pending' | 'Accepted' | 'Rejected' | 'Committed' | 'RolledBack' | 'Expired';

export interface RideTransactionValidationIssue {
  field: string;
  message: string;
  code: string;
}

export interface RideTransactionValidationResult {
  valid: boolean;
  issues: RideTransactionValidationIssue[];
}

export interface RideTransactionRollbackContext {
  transactionId: string;
  rideId: string;
  commandType: RideTransactionCommandType;
  commandId: string;
  actorId: string;
  actorRole: RideActorRole;
  timestamp: string;
  reason?: string | null;
}

export interface RideTransactionCompensationHook {
  name: string;
  rollback(context: RideTransactionRollbackContext): void | Promise<void>;
}

export interface RideTransactionRollbackPlan {
  transactionId: string;
  rideId: string;
  commandType: RideTransactionCommandType;
  hooks: string[];
}

export interface RideTransactionPreview<TCommand extends RideLifecycleCommand = RideLifecycleCommand> {
  transactionId: string;
  rideId: string;
  commandId: string;
  idempotencyKey: string;
  actorId: string;
  actorRole: RideActorRole;
  commandType: RideTransactionCommandType;
  state: 'Pending';
  statusBefore: RideStatus | null;
  phaseBefore: RidePhase | null;
  statusAfter: Extract<RideStatus, 'started' | 'completed'>;
  phaseAfter: RidePhase;
  priority: PendingMutationPriority;
  retryPolicy: RetryPolicy;
  createdAt: string;
  expiresAt: string | null;
  payload: TCommand['payload'];
  rollbackPlan: RideTransactionRollbackPlan;
}

export interface RideTransactionBoundaryContext {
  currentRide: ActiveRideReadModel | null;
  capabilitySnapshot?: CapabilitySnapshot | null;
  appliedCommandIds?: readonly string[];
  appliedIdempotencyKeys?: readonly string[];
  lastSequenceNumber?: number | null;
  commandSequenceNumber?: number | null;
  now?: () => Date;
  compensationHooks?: readonly RideTransactionCompensationHook[];
  transactionIdFactory?: () => string;
}

export interface RideTransactionBoundaryResult<TCommand extends RideLifecycleCommand = RideLifecycleCommand> {
  transactionId: string;
  rideId: string;
  commandId: string;
  commandType: RideTransactionCommandType;
  state: RideTransactionState;
  accepted: boolean;
  duplicate: boolean;
  orderingViolation: boolean;
  validation: RideTransactionValidationResult;
  preview: RideTransactionPreview<TCommand> | null;
  reason: string;
  timestamp: string;
}

export interface RideTransactionDiagnostics {
  processedCount: number;
  acceptedCount: number;
  rejectedCount: number;
  duplicateCount: number;
  orderingViolationCount: number;
  lastResult: RideTransactionBoundaryResult | null;
  records: RideTransactionBoundaryResult[];
}

export interface RideTransactionEvaluationContext extends RideTransactionBoundaryContext {}

export type RideTransactionPreviewCommand = StartRideCommand | CompleteRideCommand;
