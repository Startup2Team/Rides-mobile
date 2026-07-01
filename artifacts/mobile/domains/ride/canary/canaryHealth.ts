import type { Ride } from '@/types';
import { analyzeRideDetailParity, analyzeRideHistoryParity } from './parityAnalyzer';
import {
  DEFAULT_RIDE_CANARY_HEALTH_THRESHOLDS,
  type RideCanaryFallbackRecord,
  type RideCanaryHealthSnapshot,
  type RideCanaryHealthState,
  type RideCanaryHealthThresholds,
  type RideCanaryName,
  type RideCanaryParityAnalysis,
} from './canaryTypes';
import {
  emitRideCanaryAvailabilityTelemetry,
  emitRideCanaryComparisonTelemetry,
  emitRideCanaryFallbackTelemetry,
  emitRideCanaryMappingFailureTelemetry,
  emitRideCanaryReadinessTelemetry,
} from './canaryMetrics';

function createEmptyCanaryState(): RideCanaryHealthState {
  return {
    comparisons: 0,
    matches: 0,
    mismatches: 0,
    liveFallbacks: 0,
    projectionUnavailable: 0,
    mappingFailures: 0,
    lastMismatch: null,
    lastFallback: null,
    lastComparisonTimestamp: null,
  };
}

function cloneState(state: RideCanaryHealthState): RideCanaryHealthState {
  return {
    ...state,
    lastMismatch: state.lastMismatch ? { ...state.lastMismatch, fieldDiff: [...state.lastMismatch.fieldDiff] } : null,
    lastFallback: state.lastFallback ? { ...state.lastFallback } : null,
  };
}

function createSnapshotFromStates(history: RideCanaryHealthState, detail: RideCanaryHealthState): RideCanaryHealthSnapshot {
  return {
    history: cloneState(history),
    detail: cloneState(detail),
  };
}

function evaluateRates(state: RideCanaryHealthState) {
  const comparisons = state.comparisons;
  const projectionOpportunities = comparisons + state.projectionUnavailable + state.mappingFailures;
  const mismatchRate = comparisons === 0 ? 0 : state.mismatches / comparisons;
  const fallbackRate = projectionOpportunities === 0 ? 0 : state.liveFallbacks / projectionOpportunities;
  const projectedAvailabilityRate = projectionOpportunities === 0 ? 0 : comparisons / projectionOpportunities;
  const mappingFailureRate = comparisons === 0 ? 0 : state.mappingFailures / comparisons;
  const successRate = comparisons === 0 ? 0 : state.matches / comparisons;

  return {
    comparisons,
    mismatchRate,
    fallbackRate,
    projectedAvailabilityRate,
    mappingFailureRate,
    successRate,
  };
}

function emitReadiness(state: RideCanaryHealthSnapshot, thresholds: RideCanaryHealthThresholds) {
  emitRideCanaryReadinessTelemetry({
    ready: isReadyForActiveRideCanary(state, thresholds),
    reason: `comparisons=${state.history.comparisons + state.detail.comparisons}`,
  });
}

export class RideCanaryHealth {
  private state: RideCanaryHealthSnapshot = {
    history: createEmptyCanaryState(),
    detail: createEmptyCanaryState(),
  };

  recordComparison(analysis: RideCanaryParityAnalysis) {
    const canaryState = this.state[analysis.canaryName];
    const nextState: RideCanaryHealthState = {
      ...canaryState,
      comparisons: canaryState.comparisons + 1,
      matches: canaryState.matches + (analysis.matched ? 1 : 0),
      mismatches: canaryState.mismatches + (analysis.matched ? 0 : 1),
      lastMismatch: analysis.matched
        ? canaryState.lastMismatch
        : {
            ...analysis,
            mismatchCount: canaryState.mismatches + 1,
          },
      lastComparisonTimestamp: analysis.comparisonTimestamp,
    };
    this.state = {
      ...this.state,
      [analysis.canaryName]: nextState,
    };
    emitRideCanaryComparisonTelemetry(analysis);
    emitReadiness(this.state, DEFAULT_RIDE_CANARY_HEALTH_THRESHOLDS);
    return this.getState();
  }

  recordFallback(canaryName: RideCanaryName, reason: string) {
    const canaryState = this.state[canaryName];
    const record: RideCanaryFallbackRecord = {
      canaryName,
      reason,
      fallbackTimestamp: new Date().toISOString(),
    };
    this.state = {
      ...this.state,
      [canaryName]: {
        ...canaryState,
        liveFallbacks: canaryState.liveFallbacks + 1,
        lastFallback: record,
      },
    };
    emitRideCanaryFallbackTelemetry(record);
    emitReadiness(this.state, DEFAULT_RIDE_CANARY_HEALTH_THRESHOLDS);
    return this.getState();
  }

  recordProjectionUnavailable(canaryName: RideCanaryName) {
    const canaryState = this.state[canaryName];
    this.state = {
      ...this.state,
      [canaryName]: {
        ...canaryState,
        projectionUnavailable: canaryState.projectionUnavailable + 1,
      },
    };
    emitRideCanaryAvailabilityTelemetry({
      canaryName,
      available: false,
    });
    emitReadiness(this.state, DEFAULT_RIDE_CANARY_HEALTH_THRESHOLDS);
    return this.getState();
  }

  recordProjectionAvailable(canaryName: RideCanaryName) {
    emitRideCanaryAvailabilityTelemetry({
      canaryName,
      available: true,
    });
    return this.getState();
  }

  recordMappingFailure(canaryName: RideCanaryName, reason: string, error?: unknown) {
    const canaryState = this.state[canaryName];
    this.state = {
      ...this.state,
      [canaryName]: {
        ...canaryState,
        mappingFailures: canaryState.mappingFailures + 1,
      },
    };
    emitRideCanaryMappingFailureTelemetry({ canaryName, reason, error });
    emitReadiness(this.state, DEFAULT_RIDE_CANARY_HEALTH_THRESHOLDS);
    return this.getState();
  }

  getState() {
    return createSnapshotFromStates(this.state.history, this.state.detail);
  }

  reset() {
    this.state = {
      history: createEmptyCanaryState(),
      detail: createEmptyCanaryState(),
    };
    return this.getState();
  }
}

export const rideCanaryHealth = new RideCanaryHealth();

export function recordRideHistoryParity(liveHistory: Ride[], projectedHistory: Ride[]) {
  return rideCanaryHealth.recordComparison(analyzeRideHistoryParity(liveHistory, projectedHistory));
}

export function recordRideDetailParity(liveRide: Ride | null, projectedRide: Ride | null) {
  return rideCanaryHealth.recordComparison(analyzeRideDetailParity(liveRide, projectedRide));
}

export function getRideCanaryHealthSnapshot() {
  return rideCanaryHealth.getState();
}

export function resetRideCanaryHealthForTests() {
  return rideCanaryHealth.reset();
}

export function recordRideCanaryFallback(canaryName: RideCanaryName, reason: string) {
  return rideCanaryHealth.recordFallback(canaryName, reason);
}

export function recordRideCanaryProjectionUnavailable(canaryName: RideCanaryName) {
  return rideCanaryHealth.recordProjectionUnavailable(canaryName);
}

export function recordRideCanaryMappingFailure(canaryName: RideCanaryName, reason: string, error?: unknown) {
  return rideCanaryHealth.recordMappingFailure(canaryName, reason, error);
}

export function isReadyForActiveRideCanary(
  snapshot: RideCanaryHealthSnapshot = rideCanaryHealth.getState(),
  thresholds: RideCanaryHealthThresholds = DEFAULT_RIDE_CANARY_HEALTH_THRESHOLDS,
) {
  const history = snapshot.history;
  const detail = snapshot.detail;
  const historyRates = evaluateRates(history);
  const detailRates = evaluateRates(detail);

  const historyReady =
    history.comparisons > 0
    && historyRates.mismatchRate <= thresholds.maxMismatchRate
    && historyRates.fallbackRate <= thresholds.maxFallbackRate
    && historyRates.projectedAvailabilityRate >= thresholds.minProjectedAvailabilityRate
    && historyRates.mappingFailureRate <= thresholds.maxMappingFailureRate
    && history.mappingFailures === 0;

  const detailReady =
    detail.comparisons > 0
    && detailRates.mismatchRate <= thresholds.maxMismatchRate
    && detailRates.fallbackRate <= thresholds.maxFallbackRate
    && detailRates.projectedAvailabilityRate >= thresholds.minProjectedAvailabilityRate
    && detailRates.mappingFailureRate <= thresholds.maxMappingFailureRate
    && detail.mappingFailures === 0;

  return historyReady && detailReady;
}
