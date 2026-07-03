export type RemoteReadinessDomain =
  | 'auth'
  | 'profile'
  | 'savedLocations'
  | 'notifications'
  | 'vehicles'
  | 'packages'
  | 'paymentMethods'
  | 'rideReads'
  | 'driverOnboarding'
  | 'search'
  | 'map'
  | 'rideCommands'
  | 'realtimeEvents'
  | 'paymentTransactions'
  | 'wallet'
  | 'adminReview';

export type RemoteReadinessRiskCategory =
  | 'low'
  | 'medium'
  | 'high'
  | 'financial'
  | 'lifecycle'
  | 'identity/security';

export type RemoteReadinessRecommendation =
  | 'not_ready'
  | 'shadow_only'
  | 'staging_shadow_candidate'
  | 'hybrid_candidate'
  | 'remote_candidate';

export type RemoteReadinessRuntimeMode = 'LOCAL' | 'SHADOW_REMOTE' | 'HYBRID' | 'REMOTE';

export interface ContractReadinessChecklist {
  apiDtosExist: boolean;
  mappersExist: boolean;
  remoteRepositoryExists: boolean;
  typedErrorsExist: boolean;
  fakeTransportTestsExist: boolean;
}

export interface ShadowReadinessChecklist {
  shadowWrapperExists: boolean;
  localAuthoritative: boolean;
  remoteIgnoredInRuntime: boolean;
  telemetryExists: boolean;
  semanticComparisonExists: boolean;
}

export interface SafetyReadinessChecklist {
  idempotencyRulesDocumented: boolean;
  sensitiveTelemetrySanitized: boolean;
  authorityBoundariesDocumented: boolean;
  rollbackPathDocumented: boolean;
  productionDefaultRemainsLocal: boolean;
}

export interface RemoteReadinessDomainEntry {
  domain: RemoteReadinessDomain;
  label: string;
  riskCategory: RemoteReadinessRiskCategory;
  contractReadiness: ContractReadinessChecklist;
  shadowReadiness: ShadowReadinessChecklist;
  safetyReadiness: SafetyReadinessChecklist;
  currentSupportedModes: RemoteReadinessRuntimeMode[];
  recommendedNextMode: RemoteReadinessRecommendation;
  documentationEvidence: string[];
  blockers: string[];
  warnings: string[];
  baseScore: number;
  remoteAuthorityBlocked: boolean;
}

export interface RemoteReadinessScore {
  domain: RemoteReadinessDomain;
  score: number;
  blockers: string[];
  warnings: string[];
  recommendedMode: RemoteReadinessRecommendation;
}

export interface RemoteReadinessReportItem {
  domain: RemoteReadinessDomain;
  score: number;
  riskCategory: RemoteReadinessRiskCategory;
  currentSupportedModes: RemoteReadinessRuntimeMode[];
  recommendedNextMode: RemoteReadinessRecommendation;
  blockers: string[];
  warnings: string[];
  lastEvaluatedAt: string;
}

export interface RemoteReadinessReport {
  lastEvaluatedAt: string;
  domains: RemoteReadinessReportItem[];
  safeStagingCandidates: RemoteReadinessDomain[];
  hybridCandidates: RemoteReadinessDomain[];
  blockedDomains: RemoteReadinessDomain[];
  productionGuardAudit: RemoteProductionGuardAudit;
}

export interface RemoteProductionGuardAuditFinding {
  name: string;
  passed: boolean;
  details: string;
}

export interface RemoteProductionGuardAudit {
  passed: boolean;
  findings: RemoteProductionGuardAuditFinding[];
}
