export type StagingConnectionChecklistCategory =
  | 'environment'
  | 'transport'
  | 'authentication'
  | 'contracts'
  | 'dataIsolation'
  | 'privacy'
  | 'observability'
  | 'resilience'
  | 'rateLimits'
  | 'rollback'
  | 'domainReadiness';

export type StagingConnectionItemStatus =
  | 'unknown'
  | 'pending'
  | 'passed'
  | 'failed'
  | 'blocked'
  | 'not_applicable';

export type StagingConnectionSeverity = 'info' | 'warning' | 'critical';

export type StagingConnectionAuthStrategy =
  | 'not_required'
  | 'unresolved'
  | 'injected_token_provider'
  | 'service_test_identity'
  | 'unsupported';

export type StagingConnectionOverallStatus =
  | 'not_configured'
  | 'pending_evidence'
  | 'blocked'
  | 'ready_for_staging_shadow';

export type StagingConnectionRecommendedAction =
  | 'configure_staging'
  | 'collect_backend_evidence'
  | 'resolve_blockers'
  | 'connect_staging_shadow'
  | 'hold';

export type StagingConnectionDomain = 'savedLocations' | 'profile' | (string & {});

export interface StagingConnectionChecklistItem {
  key: string;
  category: StagingConnectionChecklistCategory;
  status: StagingConnectionItemStatus;
  severity: StagingConnectionSeverity;
  title: string;
  details: string;
  evidence?: string[];
  blocker?: boolean;
}

export interface StagingConnectionDomainContractOperation {
  operation: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  requestContract: string;
  responseContract: string;
  authenticationExpected: 'required' | 'not_required' | 'unknown';
  idempotencyExpected: boolean;
  correlationExpected: boolean;
}

export interface StagingConnectionDomainContractDefinition {
  operations: StagingConnectionDomainContractOperation[];
}

export interface StagingConnectionDomainContractStatus {
  domain: StagingConnectionDomain;
  passed: boolean;
  missingOperations: string[];
  contractBlockers: string[];
  warnings: string[];
}

export interface StagingConnectionEvidenceStatusValue extends Record<string, unknown> {
  state?: 'unknown' | 'confirmed' | 'failed';
}

export interface StagingConnectionEvidenceAuth {
  requiresAuthentication?: 'unknown' | boolean;
  authStrategy?: StagingConnectionAuthStrategy;
  tokenProviderAvailable?: 'unknown' | boolean;
  tokenPersistenceOwnedByTransport?: 'unknown' | boolean;
}

export interface StagingConnectionEvidenceIsolation {
  stagingDatabaseIsolation?: 'unknown' | 'confirmed' | 'failed';
  stagingObjectStorageIsolation?: 'unknown' | 'confirmed' | 'failed';
  stagingCredentialIsolation?: 'unknown' | 'confirmed' | 'failed';
  stagingLogsSeparated?: 'unknown' | 'confirmed' | 'failed';
  stagingSmsAndPaymentSideEffectsSandboxed?: 'unknown' | 'confirmed' | 'failed';
}

export interface StagingConnectionEvidencePrivacy {
  telemetrySanitizationDocumented?: 'unknown' | 'confirmed' | 'failed';
  semanticComparisonSanitizationDocumented?: 'unknown' | 'confirmed' | 'failed';
  rawBackendStackTracesBlocked?: 'unknown' | 'confirmed' | 'failed';
  fullResponseBodiesLogged?: 'unknown' | 'confirmed' | 'failed';
  requestPayloadsLogged?: 'unknown' | 'confirmed' | 'failed';
}

export interface StagingConnectionEvidenceObservability {
  correlationIdsSupported?: 'unknown' | 'confirmed' | 'failed';
  requestIdsSupported?: 'unknown' | 'confirmed' | 'failed';
  stagingRequestTelemetryAvailable?: 'unknown' | 'confirmed' | 'failed';
  successTelemetryAvailable?: 'unknown' | 'confirmed' | 'failed';
  failureTelemetryAvailable?: 'unknown' | 'confirmed' | 'failed';
  timeoutTelemetryAvailable?: 'unknown' | 'confirmed' | 'failed';
  latencyTelemetryAvailable?: 'unknown' | 'confirmed' | 'failed';
  mismatchTelemetryAvailable?: 'unknown' | 'confirmed' | 'failed';
  stagingHealthAggregationWired?: 'unknown' | 'confirmed' | 'failed';
  snapshotReportAvailable?: 'unknown' | 'confirmed' | 'failed';
  ciArtifactAvailable?: 'unknown' | 'confirmed' | 'failed';
  baselineComparisonAvailable?: 'unknown' | 'confirmed' | 'failed';
}

export interface StagingConnectionEvidenceResilience {
  timeoutConfigured?: 'unknown' | 'confirmed' | 'failed';
  timeoutAbortSupport?: 'unknown' | 'confirmed' | 'failed';
  boundedRetry?: 'unknown' | 'confirmed' | 'failed';
  getRetrySafety?: 'unknown' | 'confirmed' | 'failed';
  unsafeWriteRetryBlocked?: 'unknown' | 'confirmed' | 'failed';
  idempotentWriteMetadataSupported?: 'unknown' | 'confirmed' | 'failed';
  exponentialBackoff?: 'unknown' | 'confirmed' | 'failed';
  jitter?: 'unknown' | 'confirmed' | 'failed';
  localFallback?: 'unknown' | 'confirmed' | 'failed';
  remoteTimeoutDoesNotBlockLocal?: 'unknown' | 'confirmed' | 'failed';
  remoteFailureDoesNotBlockLocal?: 'unknown' | 'confirmed' | 'failed';
  malformedResponseDoesNotBlockLocal?: 'unknown' | 'confirmed' | 'failed';
}

export interface StagingConnectionEvidenceRateLimits {
  backendRateLimitPolicyKnown?: 'unknown' | 'confirmed' | 'failed';
  retryAfterSupported?: 'unknown' | 'confirmed' | 'failed';
  stagingLimitsKnown?: 'unknown' | 'confirmed' | 'failed';
}

export interface StagingConnectionEvidenceRollback {
  repositoryDefaultLocal?: 'unknown' | boolean;
  invalidConfigReturnsLocal?: 'unknown' | boolean;
  missingConfigReturnsLocal?: 'unknown' | boolean;
  productionReturnsLocal?: 'unknown' | boolean;
  writeShadowIndependent?: 'unknown' | boolean;
  envFlagsRestoreLocal?: 'unknown' | boolean;
  restartRequirementClaimed?: 'unknown' | boolean;
}

export interface StagingConnectionEvidenceContracts {
  endpointContractConfirmation?: 'unknown' | 'confirmed' | 'failed';
  backendOwnerConfirmationTimestamp?: string | null;
  backendOwnerConfirmationReference?: string | null;
}

export interface StagingConnectionEvidenceDomainReadiness {
  savedLocations?: 'unknown' | 'confirmed' | 'failed';
  profile?: 'unknown' | 'confirmed' | 'failed';
}

export interface StagingConnectionEvidence {
  version: 1;
  auth: StagingConnectionEvidenceAuth;
  isolation: StagingConnectionEvidenceIsolation;
  privacy: StagingConnectionEvidencePrivacy;
  observability: StagingConnectionEvidenceObservability;
  resilience: StagingConnectionEvidenceResilience;
  rateLimits: StagingConnectionEvidenceRateLimits;
  rollback: StagingConnectionEvidenceRollback;
  contracts: StagingConnectionEvidenceContracts;
  domainReadiness: StagingConnectionEvidenceDomainReadiness;
}

export interface StagingConnectionChecklistCategoryReport {
  category: StagingConnectionChecklistCategory;
  items: StagingConnectionChecklistItem[];
}

export interface StagingConnectionDomainReport {
  domain: StagingConnectionDomain;
  contract: StagingConnectionDomainContractStatus;
  readiness: StagingConnectionItemStatus;
  blockers: string[];
  warnings: string[];
}

export interface StagingConnectionReport {
  generatedAt: string;
  overallStatus: StagingConnectionOverallStatus;
  recommendedAction: StagingConnectionRecommendedAction;
  checklistCategories: StagingConnectionChecklistCategoryReport[];
  domains: StagingConnectionDomainReport[];
  domainContractStatus: StagingConnectionDomainContractStatus[];
  criticalBlockers: string[];
  pendingEvidence: string[];
  warnings: string[];
  strictViolations: string[];
  manifestPath: string;
  evidencePath: string;
}
