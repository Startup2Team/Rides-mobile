export type HybridRolloutStage =
  | 'disabled'
  | 'shadow_remote'
  | 'hybrid_dry_run'
  | 'hybrid_canary'
  | 'hybrid_enabled'
  | 'remote_candidate';

export type HybridRolloutDecision = 'hold' | 'advance' | 'block';

export type HybridRollbackReason =
  | 'restore_local'
  | 'clear_rollout_flags'
  | 'rollback_due_to_regression'
  | 'rollback_due_to_expired_approval'
  | 'rollback_due_to_production_guard'
  | 'rollback_due_to_documentation_gap'
  | 'manual_revert';

export interface HybridDomainPolicy {
  domain: string;
  stage: HybridRolloutStage;
  decision: HybridRolloutDecision;
  rollbackReason: HybridRollbackReason;
  riskCategory: string;
  requiresHumanApproval: boolean;
  requiresShadowHealth: boolean;
  requiresBaselineParity: boolean;
  requiresProductionGuardPass: boolean;
  supportsLocalFallback: boolean;
  supportsWriteShadow: boolean;
  writeShadowEnabledByDefault: boolean;
  notes: string[];
}

export const defaultHybridDomainPolicy: HybridDomainPolicy = {
  domain: 'savedLocations',
  stage: 'disabled',
  decision: 'hold',
  rollbackReason: 'restore_local',
  riskCategory: 'low',
  requiresHumanApproval: true,
  requiresShadowHealth: true,
  requiresBaselineParity: true,
  requiresProductionGuardPass: true,
  supportsLocalFallback: true,
  supportsWriteShadow: false,
  writeShadowEnabledByDefault: false,
  notes: [
    'Phase 13H is planning only.',
    'LOCAL remains authoritative until a future rollout PR changes runtime behavior.',
  ],
};
