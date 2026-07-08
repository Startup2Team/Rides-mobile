import type {
  StagingShadowHealthPolicies,
  StagingShadowHealthRecommendation,
  StagingShadowHealthStatus,
} from './stagingShadowHealthTypes';

export const stagingShadowHealthPolicies: StagingShadowHealthPolicies = {
  minHealthyAttempts: 5,
  minHybridCandidateAttempts: 8,
  minReadySuccessRate: 0.9,
  blockedFailureRate: 0.4,
  blockedMismatchRate: 0.2,
  healthyFailureRate: 0.15,
  healthyMismatchRate: 0.0,
  degradedFailureRate: 0.25,
  degradedMismatchRate: 0.1,
  degradedTimeoutRate: 0.25,
};

function clampRate(value: number) {
  if (!Number.isFinite(value) || value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function rate(count: number, attempts: number) {
  if (attempts <= 0) return 0;
  return clampRate(count / attempts);
}

function successRate(successes: number, attempts: number) {
  return rate(successes, attempts);
}

export function evaluateStagingShadowHealth(input: {
  blocked: boolean;
  shadowAttempts: number;
  shadowSuccesses: number;
  shadowFailures: number;
  timeouts: number;
  semanticMismatches: number;
  shapeMismatches: number;
  policies?: Partial<StagingShadowHealthPolicies>;
}): {
  status: StagingShadowHealthStatus;
  recommendation: StagingShadowHealthRecommendation;
  failureRate: number;
  mismatchRate: number;
  timeoutRate: number;
  successRate: number;
} {
  const policies = { ...stagingShadowHealthPolicies, ...(input.policies ?? {}) };
  const attempts = input.shadowAttempts;
  const totalFailures = input.shadowFailures + input.timeouts;
  const totalMismatches = input.semanticMismatches + input.shapeMismatches;
  const failureRate = rate(totalFailures, attempts);
  const mismatchRate = rate(totalMismatches, attempts);
  const timeoutRate = rate(input.timeouts, attempts);
  const healthySuccessRate = successRate(input.shadowSuccesses, attempts);

  if (input.blocked) {
    return {
      status: 'blocked',
      recommendation: 'blocked',
      failureRate,
      mismatchRate,
      timeoutRate,
      successRate: healthySuccessRate,
    };
  }

  if (attempts === 0) {
    return {
      status: 'idle',
      recommendation: 'collect_data',
      failureRate,
      mismatchRate,
      timeoutRate,
      successRate: healthySuccessRate,
    };
  }

  if (failureRate >= policies.blockedFailureRate || mismatchRate >= policies.blockedMismatchRate) {
    return {
      status: 'failing',
      recommendation: 'investigate',
      failureRate,
      mismatchRate,
      timeoutRate,
      successRate: healthySuccessRate,
    };
  }

  if (attempts >= policies.minHealthyAttempts) {
    const healthy =
      failureRate <= policies.healthyFailureRate &&
      mismatchRate <= policies.healthyMismatchRate &&
      timeoutRate <= policies.degradedTimeoutRate &&
      healthySuccessRate >= policies.minReadySuccessRate;
    if (healthy) {
      const readyForHybrid =
        attempts >= policies.minHybridCandidateAttempts &&
        failureRate <= policies.degradedFailureRate &&
        mismatchRate <= policies.degradedMismatchRate &&
        healthySuccessRate >= policies.minReadySuccessRate;
      return {
        status: 'healthy',
        recommendation: readyForHybrid ? 'ready_for_hybrid_candidate' : 'continue_shadow',
        failureRate,
        mismatchRate,
        timeoutRate,
        successRate: healthySuccessRate,
      };
    }
  }

  const degraded =
    totalFailures > 0 ||
    totalMismatches > 0 ||
    timeoutRate > policies.degradedTimeoutRate ||
    attempts < policies.minHealthyAttempts;

  return {
    status: degraded ? 'degraded' : 'healthy',
    recommendation: 'continue_shadow',
    failureRate,
    mismatchRate,
    timeoutRate,
    successRate: healthySuccessRate,
  };
}
