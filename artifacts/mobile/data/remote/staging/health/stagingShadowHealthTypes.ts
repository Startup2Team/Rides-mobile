export type StagingShadowDomain = string;

export type StagingShadowEventType =
  | 'local_operation_completed'
  | 'shadow_attempted'
  | 'shadow_success'
  | 'shadow_failure'
  | 'timeout'
  | 'semantic_mismatch'
  | 'shape_mismatch'
  | 'skipped_invalid_config'
  | 'skipped_mode_local'
  | 'skipped_write_shadow_disabled';

export type StagingShadowHealthStatus = 'idle' | 'healthy' | 'degraded' | 'failing' | 'blocked';

export type StagingShadowHealthRecommendation =
  | 'collect_data'
  | 'continue_shadow'
  | 'investigate'
  | 'blocked'
  | 'ready_for_hybrid_candidate';

export interface StagingShadowHealthPolicies {
  minHealthyAttempts: number;
  minHybridCandidateAttempts: number;
  minReadySuccessRate: number;
  blockedFailureRate: number;
  blockedMismatchRate: number;
  healthyFailureRate: number;
  healthyMismatchRate: number;
  degradedFailureRate: number;
  degradedMismatchRate: number;
  degradedTimeoutRate: number;
}

export interface StagingShadowHealthEvent {
  domain: StagingShadowDomain;
  operation: string;
  event: StagingShadowEventType;
  latencyMs?: number;
  statusClass?: string;
  mismatchCategory?: string;
  errorCategory?: string;
  fieldCategory?: string;
  count?: number;
  timestamp?: string;
}

export interface StagingShadowDomainHealthMetrics {
  localOperations: number;
  shadowAttempts: number;
  shadowSuccesses: number;
  shadowFailures: number;
  timeouts: number;
  skippedInvalidConfig: number;
  skippedModeLocal: number;
  skippedWriteShadowDisabled: number;
  semanticMismatches: number;
  shapeMismatches: number;
  totalLatencyMs: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastMismatchCategory: string | null;
  lastErrorCategory: string | null;
  blocked: boolean;
  blockedReason: string | null;
}

export interface StagingShadowDomainHealth extends StagingShadowDomainHealthMetrics {
  domain: StagingShadowDomain;
  status: StagingShadowHealthStatus;
  recommendation: StagingShadowHealthRecommendation;
  attemptsForHealth: number;
  attemptsForRecommendation: number;
  averageLatencyMs: number;
  failureRate: number;
  mismatchRate: number;
  timeoutRate: number;
  lastUpdatedAt: string | null;
}

export interface StagingShadowHealthReport {
  lastEvaluatedAt: string;
  domains: StagingShadowDomainHealth[];
}
