import type { GeocodeSuggestion } from '@/services/geocoding';
import type { RouteResult } from '@/services/mapbox';
import type { Coords, RideLocation } from '@/types';
import type { FareEstimatePreview } from '../mappers/mapMapper';

export interface SearchComparisonPolicy {
  coordinateToleranceDegrees: number;
  minimumSemanticOverlapRatio: number;
}

export interface MapComparisonPolicy {
  coordinateToleranceDegrees: number;
  distanceToleranceMeters: number;
  distanceToleranceRatio: number;
  durationToleranceSeconds: number;
  durationToleranceRatio: number;
  fareToleranceAmount: number;
  fareToleranceRatio: number;
}

export const defaultSearchComparisonPolicy: SearchComparisonPolicy = {
  coordinateToleranceDegrees: 0.01,
  minimumSemanticOverlapRatio: 0.35,
};

export const defaultMapComparisonPolicy: MapComparisonPolicy = {
  coordinateToleranceDegrees: 0.01,
  distanceToleranceMeters: 500,
  distanceToleranceRatio: 0.15,
  durationToleranceSeconds: 180,
  durationToleranceRatio: 0.2,
  fareToleranceAmount: 500,
  fareToleranceRatio: 0.15,
};

function normalizeName(value?: string | null) {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function distanceBucket(distanceMeters?: number | null) {
  if (typeof distanceMeters !== 'number') return 'unknown';
  if (distanceMeters < 1_000) return 'under_1km';
  if (distanceMeters < 5_000) return '1_5km';
  if (distanceMeters < 10_000) return '5_10km';
  return 'over_10km';
}

function durationBucket(durationSeconds?: number | null) {
  if (typeof durationSeconds !== 'number') return 'unknown';
  if (durationSeconds < 300) return 'under_5m';
  if (durationSeconds < 900) return '5_15m';
  if (durationSeconds < 1_800) return '15_30m';
  return 'over_30m';
}

function approximatelySameCoords(a?: Coords | null, b?: Coords | null, tolerance = defaultSearchComparisonPolicy.coordinateToleranceDegrees) {
  if (!a || !b) return false;
  return Math.abs(a.latitude - b.latitude) <= tolerance
    && Math.abs(a.longitude - b.longitude) <= tolerance;
}

export function compareSearchResults(
  local: GeocodeSuggestion[],
  remote: GeocodeSuggestion[],
  policy: SearchComparisonPolicy = defaultSearchComparisonPolicy,
) {
  const localKeys = new Set(local.map(item => normalizeName(item.title || item.place_name)).filter(Boolean));
  const remoteKeys = new Set(remote.map(item => normalizeName(item.title || item.place_name)).filter(Boolean));
  const overlap = [...localKeys].filter(key => remoteKeys.has(key)).length;
  const denominator = Math.max(1, Math.min(localKeys.size || local.length, remoteKeys.size || remote.length));
  const overlapRatio = overlap / denominator;
  const coordinateMatches = local.filter(localItem =>
    remote.some(remoteItem => approximatelySameCoords(localItem.coords, remoteItem.coords, policy.coordinateToleranceDegrees)),
  ).length;

  return {
    mismatch: local.length > 0 && remote.length > 0 && overlapRatio < policy.minimumSemanticOverlapRatio && coordinateMatches === 0,
    category: 'semantic_overlap',
    localCount: local.length,
    remoteCount: remote.length,
    overlapRatio,
    coordinateMatches,
  };
}

export function compareLocation(
  local: RideLocation | null,
  remote: RideLocation | null,
  policy: Pick<SearchComparisonPolicy, 'coordinateToleranceDegrees'> = defaultSearchComparisonPolicy,
) {
  if (!local && !remote) return { mismatch: false, category: 'availability' };
  if (!local || !remote) return { mismatch: true, category: 'availability' };
  return {
    mismatch: !approximatelySameCoords(local, remote, policy.coordinateToleranceDegrees),
    category: 'coordinate_parity',
  };
}

export function compareRoute(
  local: RouteResult | null,
  remote: RouteResult | null,
  policy: MapComparisonPolicy = defaultMapComparisonPolicy,
) {
  if (!local && !remote) return { mismatch: false, category: 'availability' };
  if (!local || !remote) return { mismatch: true, category: 'availability' };

  const distanceDelta = Math.abs(local.distanceMeters - remote.distanceMeters);
  const durationDelta = Math.abs(local.durationSeconds - remote.durationSeconds);
  const distanceRatio = distanceDelta / Math.max(1, local.distanceMeters);
  const durationRatio = durationDelta / Math.max(1, local.durationSeconds);
  const distanceMismatch = distanceDelta > policy.distanceToleranceMeters && distanceRatio > policy.distanceToleranceRatio;
  const durationMismatch = durationDelta > policy.durationToleranceSeconds && durationRatio > policy.durationToleranceRatio;

  return {
    mismatch: distanceMismatch || durationMismatch,
    category: distanceMismatch ? 'distance' : durationMismatch ? 'duration' : 'within_tolerance',
    distanceBucket: distanceBucket(local.distanceMeters),
    durationBucket: durationBucket(local.durationSeconds),
    distanceDelta,
    durationDelta,
    distanceRatio,
    durationRatio,
  };
}

export function compareFarePreview(
  local: FareEstimatePreview | null,
  remote: FareEstimatePreview | null,
  policy: MapComparisonPolicy = defaultMapComparisonPolicy,
) {
  if (!local && !remote) return { mismatch: false, category: 'availability' };
  if (!local || !remote) return { mismatch: true, category: 'availability' };
  const amountDelta = Math.abs(local.estimatedAmount - remote.estimatedAmount);
  const amountRatio = amountDelta / Math.max(1, local.estimatedAmount);
  return {
    mismatch: amountDelta > policy.fareToleranceAmount && amountRatio > policy.fareToleranceRatio,
    category: 'fare_preview',
    amountDelta,
    amountRatio,
  };
}
