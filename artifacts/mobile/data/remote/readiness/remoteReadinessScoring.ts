import { remoteReadinessMatrix } from './remoteReadinessMatrix';
import { remoteReadinessPolicies } from './remoteReadinessPolicies';
import type {
  RemoteReadinessDomain,
  RemoteReadinessRecommendation,
  RemoteReadinessScore,
} from './remoteReadinessTypes';

const recommendationOrder: RemoteReadinessRecommendation[] = [
  'not_ready',
  'shadow_only',
  'staging_shadow_candidate',
  'hybrid_candidate',
  'remote_candidate',
];

function clampScore(score: number) {
  if (score < 0) return 0;
  if (score > 100) return 100;
  return Math.round(score);
}

function recommendationFromScore(score: number): RemoteReadinessRecommendation {
  if (score >= remoteReadinessPolicies.scoreThresholds.remote_candidate) {
    return 'remote_candidate';
  }
  if (score >= remoteReadinessPolicies.scoreThresholds.hybrid_candidate) {
    return 'hybrid_candidate';
  }
  if (score >= remoteReadinessPolicies.scoreThresholds.staging_shadow_candidate) {
    return 'staging_shadow_candidate';
  }
  if (score >= remoteReadinessPolicies.scoreThresholds.shadow_only) {
    return 'shadow_only';
  }
  return 'not_ready';
}

export function scoreRemoteReadiness(domain: RemoteReadinessDomain): RemoteReadinessScore {
  const entry = remoteReadinessMatrix[domain];
  const score = clampScore(entry.baseScore);
  const thresholdRecommendation = recommendationFromScore(score);

  const recommendedMode = recommendationOrder[
    Math.min(
      recommendationOrder.indexOf(entry.recommendedNextMode),
      recommendationOrder.indexOf(thresholdRecommendation),
    )
  ];

  return {
    domain,
    score,
    blockers: [...entry.blockers],
    warnings: [...entry.warnings],
    recommendedMode,
  };
}
