export type ReadinessGateStatus = 'pass' | 'fail' | 'warn';

export interface ReadinessMetric {
  name: string;
  value: number | string | boolean;
  unit?: string;
  detail?: string;
}

export interface ReadinessGateResult {
  gateName: string;
  status: ReadinessGateStatus;
  metrics: ReadinessMetric[];
  failureReason: string | null;
  timestamp: string;
  recommendedAction: string;
}

export interface ReadinessGateDefinition {
  gateName: string;
  description: string;
  run(): Promise<ReadinessGateResult> | ReadinessGateResult;
}

export interface ReadinessReport {
  generatedAt: string;
  readinessScore: number;
  overallStatus: ReadinessGateStatus;
  counts: {
    pass: number;
    warn: number;
    fail: number;
    total: number;
  };
  gates: ReadinessGateResult[];
}

export interface ReadinessStressProfile {
  offlineMutations: number;
  domainEvents: number;
  projectionReplays: number;
  reconnectStorm: number;
  shadowReplayEvents: number;
}

export const FULL_READINESS_STRESS_PROFILE: ReadinessStressProfile = {
  offlineMutations: 10_000,
  domainEvents: 50_000,
  projectionReplays: 10_000,
  reconnectStorm: 1_000,
  shadowReplayEvents: 10_000,
};

export const CI_SAFE_READINESS_STRESS_PROFILE: ReadinessStressProfile = {
  offlineMutations: 100,
  domainEvents: 250,
  projectionReplays: 100,
  reconnectStorm: 25,
  shadowReplayEvents: 100,
};

export function createReadinessGateResult(
  gateName: string,
  status: ReadinessGateStatus,
  metrics: ReadinessMetric[],
  failureReason: string | null,
  recommendedAction: string,
  now: () => Date = () => new Date(),
): ReadinessGateResult {
  return {
    gateName,
    status,
    metrics,
    failureReason,
    timestamp: now().toISOString(),
    recommendedAction,
  };
}
