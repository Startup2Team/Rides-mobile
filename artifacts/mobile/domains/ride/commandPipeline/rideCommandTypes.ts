import type { CapabilityName, CapabilitySnapshot } from '@/capabilities';
import type { PendingMutationPriority, RetryPolicy } from '@/offline';
import type { RideActorRole, RideLifecycleCommand } from '../commands';

export const ENABLE_RIDE_COMMAND_PIPELINE = process.env.NODE_ENV !== 'production';
export const ENABLE_RIDE_COMMAND_ENQUEUE = process.env.ENABLE_RIDE_COMMAND_ENQUEUE === 'true' && process.env.NODE_ENV !== 'production';

export type RideCommandPipelineMode = 'disabled' | 'dryRun' | 'shadow' | 'enqueueReady';

export const RIDE_COMMAND_PIPELINE_MODE: RideCommandPipelineMode = (() => {
  const configured = process.env.RIDE_COMMAND_PIPELINE_MODE as RideCommandPipelineMode | undefined;
  if (configured === 'disabled' || configured === 'dryRun' || configured === 'shadow' || configured === 'enqueueReady') {
    return process.env.NODE_ENV === 'production' ? 'disabled' : configured;
  }
  if (process.env.NODE_ENV === 'production') return 'disabled';
  return 'shadow';
})();

export type RideCommandSafety = 'safe' | 'guarded' | 'critical';

export interface RideCommandRoute {
  commandType: string;
  routeName: 'requestRide' | 'cancelRide' | 'acceptRide' | 'declineRide' | 'startRide' | 'completeRide' | 'submitRating';
  priority: PendingMutationPriority;
  collapsible: false;
  requiresOnline: boolean;
  requiresIdempotencyKey: true;
  requiresActorCapability: CapabilityName | null;
  mutationTypeName: string;
  safety: RideCommandSafety;
}

export interface RideCommandValidationIssue {
  field: string;
  message: string;
}

export interface RideCommandValidationResult {
  valid: boolean;
  issues: RideCommandValidationIssue[];
}

export interface RideCommandPolicyResult {
  allowed: boolean;
  reason: string;
  requiredCapability: CapabilityName | null;
}

export interface RideOfflineMutationPreview<TCommand extends RideLifecycleCommand = RideLifecycleCommand> {
  id: string;
  commandId: string;
  idempotencyKey: string;
  correlationId: string;
  actorId: string;
  actorRole: RideActorRole;
  type: string;
  commandType: string;
  payload: TCommand['payload'];
  priority: PendingMutationPriority;
  retryPolicy: RetryPolicy;
  collapseStrategy: 'none';
  collapseKey: null;
  expiresAt: string | null;
}

export interface RideCommandDiagnosticRecord<TCommand extends RideLifecycleCommand = RideLifecycleCommand> {
  commandId: string;
  commandType: string;
  mode: RideCommandPipelineMode;
  route: RideCommandRoute;
  validation: RideCommandValidationResult;
  policy: RideCommandPolicyResult;
  preview: RideOfflineMutationPreview<TCommand> | null;
  timestamp: string;
  correlationId: string;
}

export interface RideCommandPipelineDiagnostics {
  mode: RideCommandPipelineMode;
  enabled: boolean;
  enqueueEnabled: boolean;
  processedCount: number;
  rejectedCount: number;
  lastRecord: RideCommandDiagnosticRecord | null;
  records: RideCommandDiagnosticRecord[];
  currentSelection: 'disabled' | 'dryRun' | 'shadow' | 'enqueueReady';
}

export interface RideCommandPipelineContext {
  capabilitySnapshot?: CapabilitySnapshot | null;
  now?: () => Date;
  mode?: RideCommandPipelineMode;
}
