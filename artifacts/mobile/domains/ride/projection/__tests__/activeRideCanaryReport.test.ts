import { resetObservabilityForTests } from '@/observability/context/observabilityContext';
import {
  DEFAULT_ACTIVE_RIDE_CANARY_STABILITY_THRESHOLDS,
  resetActiveRideCanaryStabilityForTests,
  seedActiveRideCanaryStabilityForTests,
} from '../activeRideCanaryStability';
import {
  formatActiveRideCanaryReport,
  getActiveRideCanaryReport,
  resetActiveRideCanaryReport,
} from '../activeRideCanaryReport';

describe('active ride canary report', () => {
  beforeEach(() => {
    resetObservabilityForTests();
    resetActiveRideCanaryStabilityForTests();
    resetActiveRideCanaryReport();
  });

  test('default report is collect_data', () => {
    const report = getActiveRideCanaryReport();

    expect(report.recommendedAction).toBe('collect_data');
    expect(report.stabilityStatus).toBe('idle');
    expect(report.readinessForNextSurface).toBe(false);
  });

  test('insufficient data returns hold', () => {
    seedActiveRideCanaryStabilityForTests({
      startedAt: '2026-06-01T09:00:00.000Z',
      lastUpdatedAt: '2026-06-01T09:05:00.000Z',
      projectedSourceSelections: DEFAULT_ACTIVE_RIDE_CANARY_STABILITY_THRESHOLDS.minimumSuccessfulProjectedReads - 1,
    });

    expect(getActiveRideCanaryReport().recommendedAction).toBe('hold');
  });

  test('mismatch returns investigate', () => {
    seedActiveRideCanaryStabilityForTests({
      startedAt: '2026-06-01T09:00:00.000Z',
      lastUpdatedAt: '2026-06-01T09:20:00.000Z',
      projectedSourceSelections: DEFAULT_ACTIVE_RIDE_CANARY_STABILITY_THRESHOLDS.minimumSuccessfulProjectedReads,
      comparisonMismatches: 1,
    });

    expect(getActiveRideCanaryReport().recommendedAction).toBe('investigate');
  });

  test('stale projection returns investigate', () => {
    seedActiveRideCanaryStabilityForTests({
      startedAt: '2026-06-01T09:00:00.000Z',
      lastUpdatedAt: '2026-06-01T09:20:00.000Z',
      projectedSourceSelections: DEFAULT_ACTIVE_RIDE_CANARY_STABILITY_THRESHOLDS.minimumSuccessfulProjectedReads,
      staleProjectionIncidents: 1,
    });

    expect(getActiveRideCanaryReport().recommendedAction).toBe('investigate');
  });

  test('rollback returns rollback', () => {
    seedActiveRideCanaryStabilityForTests({
      startedAt: '2026-06-01T09:00:00.000Z',
      lastUpdatedAt: '2026-06-01T09:20:00.000Z',
      projectedSourceSelections: DEFAULT_ACTIVE_RIDE_CANARY_STABILITY_THRESHOLDS.minimumSuccessfulProjectedReads,
      rollbackEvents: 1,
    });

    expect(getActiveRideCanaryReport().recommendedAction).toBe('rollback');
  });

  test('stability pass returns ready_for_next_surface', () => {
    seedActiveRideCanaryStabilityForTests({
      startedAt: '2026-06-01T09:00:00.000Z',
      lastUpdatedAt: '2026-06-01T09:20:00.000Z',
      projectedSourceSelections: DEFAULT_ACTIVE_RIDE_CANARY_STABILITY_THRESHOLDS.minimumSuccessfulProjectedReads,
      liveFallbacks: 0,
      mappingFailures: 0,
      staleProjectionIncidents: 0,
      comparisonMismatches: 0,
      rollbackEvents: 0,
    });

    expect(getActiveRideCanaryReport().recommendedAction).toBe('ready_for_next_surface');
  });

  test('formatted report includes key metrics', () => {
    seedActiveRideCanaryStabilityForTests({
      startedAt: '2026-06-01T09:00:00.000Z',
      lastUpdatedAt: '2026-06-01T09:20:00.000Z',
      projectedSourceSelections: DEFAULT_ACTIVE_RIDE_CANARY_STABILITY_THRESHOLDS.minimumSuccessfulProjectedReads,
      liveFallbacks: 0,
    });

    const formatted = formatActiveRideCanaryReport();
    expect(formatted).toContain('projectedReadCount=');
    expect(formatted).toContain('liveFallbackCount=');
    expect(formatted).toContain('recommendedAction=');
  });

  test('reset clears report state', () => {
    getActiveRideCanaryReport();
    expect(resetActiveRideCanaryReport()).toBeNull();
  });
});
