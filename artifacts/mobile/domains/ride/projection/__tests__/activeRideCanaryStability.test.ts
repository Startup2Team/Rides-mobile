import { observability, resetObservabilityForTests } from '@/observability/context/observabilityContext';
import {
  DEFAULT_ACTIVE_RIDE_CANARY_STABILITY_THRESHOLDS,
  getActiveRideCanaryStabilitySnapshot,
  isReadyForNextActiveRideSurface,
  recordActiveRideCanaryComparisonMismatch,
  recordActiveRideCanaryFallback,
  recordActiveRideCanaryGateDenial,
  recordActiveRideCanaryMappingFailure,
  recordActiveRideCanaryProjectedSelection,
  recordActiveRideCanaryRollback,
  recordActiveRideCanaryStaleProjection,
  resetActiveRideCanaryStabilityForTests,
  seedActiveRideCanaryStabilityForTests,
} from '../activeRideCanaryStability';

describe('active ride canary stability', () => {
  beforeEach(() => {
    resetObservabilityForTests();
    resetActiveRideCanaryStabilityForTests();
  });

  test('readiness is false by default', () => {
    expect(isReadyForNextActiveRideSurface()).toBe(false);
    expect(observability.logger.getLogs().map(log => log.message)).toEqual(
      expect.arrayContaining(['RideActiveRideCanaryStabilityDenied']),
    );
  });

  test('projected selection alone does not expand the UI scope', () => {
    recordActiveRideCanaryProjectedSelection();
    expect(isReadyForNextActiveRideSurface()).toBe(false);
  });

  test('readiness is false with insufficient projected reads', () => {
    seedActiveRideCanaryStabilityForTests({
      startedAt: '2026-06-01T09:00:00.000Z',
      lastUpdatedAt: '2026-06-01T09:20:00.000Z',
      projectedSourceSelections: DEFAULT_ACTIVE_RIDE_CANARY_STABILITY_THRESHOLDS.minimumSuccessfulProjectedReads - 1,
      liveFallbacks: 0,
    });

    expect(isReadyForNextActiveRideSurface()).toBe(false);
  });

  test('readiness is false with mapping failure', () => {
    seedActiveRideCanaryStabilityForTests({
      startedAt: '2026-06-01T09:00:00.000Z',
      lastUpdatedAt: '2026-06-01T09:20:00.000Z',
      projectedSourceSelections: DEFAULT_ACTIVE_RIDE_CANARY_STABILITY_THRESHOLDS.minimumSuccessfulProjectedReads,
      mappingFailures: 1,
    });

    expect(isReadyForNextActiveRideSurface()).toBe(false);
  });

  test('readiness is false with stale projection', () => {
    seedActiveRideCanaryStabilityForTests({
      startedAt: '2026-06-01T09:00:00.000Z',
      lastUpdatedAt: '2026-06-01T09:20:00.000Z',
      projectedSourceSelections: DEFAULT_ACTIVE_RIDE_CANARY_STABILITY_THRESHOLDS.minimumSuccessfulProjectedReads,
      staleProjectionIncidents: 1,
    });

    expect(isReadyForNextActiveRideSurface()).toBe(false);
  });

  test('readiness is false with mismatch', () => {
    seedActiveRideCanaryStabilityForTests({
      startedAt: '2026-06-01T09:00:00.000Z',
      lastUpdatedAt: '2026-06-01T09:20:00.000Z',
      projectedSourceSelections: DEFAULT_ACTIVE_RIDE_CANARY_STABILITY_THRESHOLDS.minimumSuccessfulProjectedReads,
      comparisonMismatches: 1,
    });

    expect(isReadyForNextActiveRideSurface()).toBe(false);
  });

  test('readiness is false after rollback', () => {
    seedActiveRideCanaryStabilityForTests({
      startedAt: '2026-06-01T09:00:00.000Z',
      lastUpdatedAt: '2026-06-01T09:20:00.000Z',
      projectedSourceSelections: DEFAULT_ACTIVE_RIDE_CANARY_STABILITY_THRESHOLDS.minimumSuccessfulProjectedReads,
      rollbackEvents: 1,
    });

    expect(isReadyForNextActiveRideSurface()).toBe(false);
  });

  test('readiness is true only when all criteria pass', () => {
    seedActiveRideCanaryStabilityForTests({
      startedAt: '2026-06-01T09:00:00.000Z',
      lastUpdatedAt: '2026-06-01T09:20:00.000Z',
      projectedSourceSelections: DEFAULT_ACTIVE_RIDE_CANARY_STABILITY_THRESHOLDS.minimumSuccessfulProjectedReads,
      liveFallbacks: 0,
      gateDenials: 0,
      mappingFailures: 0,
      staleProjectionIncidents: 0,
      comparisonMismatches: 0,
      rollbackEvents: 0,
    });

    expect(isReadyForNextActiveRideSurface()).toBe(true);
    expect(observability.logger.getLogs().map(log => log.message)).toEqual(
      expect.arrayContaining(['RideActiveRideCanaryStabilityApproved']),
    );
  });

  test('metrics reset correctly', () => {
    recordActiveRideCanaryProjectedSelection();
    recordActiveRideCanaryFallback('projection-unavailable');
    recordActiveRideCanaryGateDenial('feature-disabled');
    recordActiveRideCanaryMappingFailure('mapping-failure');
    recordActiveRideCanaryStaleProjection('stale');
    recordActiveRideCanaryComparisonMismatch();
    recordActiveRideCanaryRollback('manual');

    const snapshot = resetActiveRideCanaryStabilityForTests();
    expect(snapshot.projectedSourceSelections).toBe(0);
    expect(snapshot.liveFallbacks).toBe(0);
    expect(snapshot.gateDenials).toBe(0);
    expect(snapshot.mappingFailures).toBe(0);
    expect(snapshot.staleProjectionIncidents).toBe(0);
    expect(snapshot.comparisonMismatches).toBe(0);
    expect(snapshot.rollbackEvents).toBe(0);
    expect(snapshot.ready).toBe(false);
  });

  test('snapshot exposes time since last mismatch and fallback', () => {
    seedActiveRideCanaryStabilityForTests({
      startedAt: '2026-06-01T09:00:00.000Z',
      lastUpdatedAt: '2026-06-01T09:20:00.000Z',
      lastMismatchAt: '2026-06-01T09:18:00.000Z',
      lastFallbackAt: '2026-06-01T09:19:00.000Z',
      projectedSourceSelections: DEFAULT_ACTIVE_RIDE_CANARY_STABILITY_THRESHOLDS.minimumSuccessfulProjectedReads,
      liveFallbacks: 0,
    });

    const snapshot = getActiveRideCanaryStabilitySnapshot();
    expect(snapshot.timeSinceLastMismatchMs).not.toBeNull();
    expect(snapshot.timeSinceLastFallbackMs).not.toBeNull();
  });
});
