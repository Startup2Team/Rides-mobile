import { observability, resetObservabilityForTests } from '@/observability/context/observabilityContext';
import type { Ride } from '@/types';
import {
  isReadyForActiveRideCanary,
  recordRideCanaryFallback,
  recordRideCanaryMappingFailure,
  recordRideCanaryProjectionUnavailable,
  recordRideDetailParity,
  recordRideHistoryParity,
  resetRideCanaryHealthForTests,
} from '../canaryHealth';
import { getCanaryHealthReport } from '../canaryReport';

function createRide(overrides: Partial<Ride> = {}): Ride {
  return {
    id: 'ride-1',
    customerId: 'customer-1',
    customerName: 'Customer One',
    vehicleType: 'moto',
    pickup: { latitude: -1.94, longitude: 30.06, address: 'Pickup' },
    destination: { latitude: -1.95, longitude: 30.07, address: 'Destination' },
    status: 'completed',
    distance: 6,
    duration: 15,
    suggestedFare: 12000,
    agreedFare: 10000,
    negotiation: [],
    createdAt: '2026-06-08T09:00:00.000Z',
    completedAt: '2026-06-08T09:24:00.000Z',
    arrivedAt: '2026-06-08T09:19:00.000Z',
    waitStartedAt: '2026-06-08T09:14:00.000Z',
    ...overrides,
  };
}

describe('ride canary health', () => {
  beforeEach(() => {
    resetObservabilityForTests();
    resetRideCanaryHealthForTests();
  });

  test('records history parity success', () => {
    const ride = createRide();

    recordRideHistoryParity([ride], [ride]);

    const report = getCanaryHealthReport();
    expect(report.canaries.history.comparisonCount).toBe(1);
    expect(report.canaries.history.successRate).toBe(1);
    expect(report.canaries.history.mismatchRate).toBe(0);
    expect(report.canaries.history.currentStatus).toBe('healthy');
    expect(observability.logger.getLogs().map(log => log.message)).toEqual(expect.arrayContaining([
      'RideHistoryParitySuccess',
      'RideCanaryReadinessUpdated',
      'RideCanaryHealthReportGenerated',
    ]));
  });

  test('records history parity mismatch', () => {
    const live = createRide();
    const projected = createRide({ status: 'cancelled' });

    recordRideHistoryParity([live], [projected]);

    const report = getCanaryHealthReport();
    expect(report.canaries.history.comparisonCount).toBe(1);
    expect(report.canaries.history.mismatchRate).toBe(1);
    expect(report.canaries.history.lastMismatch?.fieldDiff.length).toBeGreaterThan(0);
    expect(observability.logger.getLogs().some(log => log.message === 'RideHistoryParityMismatch')).toBe(true);
  });

  test('records detail parity success and mismatch', () => {
    const live = createRide();
    const projected = createRide();
    const mismatch = createRide({ agreedFare: 9000 });

    recordRideDetailParity(live, projected);
    recordRideDetailParity(live, mismatch);

    const report = getCanaryHealthReport();
    expect(report.canaries.detail.comparisonCount).toBe(2);
    expect(report.canaries.detail.successRate).toBe(0.5);
    expect(report.canaries.detail.mismatchRate).toBe(0.5);
    expect(observability.logger.getLogs().map(log => log.message)).toEqual(expect.arrayContaining([
      'RideDetailParitySuccess',
      'RideDetailParityMismatch',
    ]));
  });

  test('tracks fallback, projection unavailable, and mapping failure counts', () => {
    recordRideCanaryProjectionUnavailable('history');
    recordRideCanaryFallback('history', 'projected-unavailable');
    recordRideCanaryMappingFailure('detail', 'mapping-failure', new Error('boom'));

    const report = getCanaryHealthReport();
    expect(report.canaries.history.projectionUnavailableCount).toBe(1);
    expect(report.canaries.history.fallbackCount).toBe(1);
    expect(report.canaries.detail.mappingFailures).toBe(1);
    expect(report.canaries.detail.currentStatus).toBe('unhealthy');
    expect(observability.logger.getLogs().map(log => log.message)).toEqual(expect.arrayContaining([
      'RideCanaryAvailabilityObserved',
      'RideCanaryFallback',
      'RideCanaryMappingFailure',
    ]));
  });

  test('generates a structured report with last mismatch and fallback', () => {
    const live = createRide();
    const projected = createRide({ status: 'cancelled' });

    recordRideHistoryParity([live], [projected]);
    recordRideCanaryFallback('history', 'comparison-failure');
    recordRideDetailParity(live, live);

    const report = getCanaryHealthReport();

    expect(report.generatedAt).toEqual(expect.any(String));
    expect(report.canaries.history.lastMismatch).toMatchObject({
      canaryName: 'history',
      mismatchCount: 1,
    });
    expect(report.canaries.history.lastFallback).toMatchObject({
      canaryName: 'history',
      reason: 'comparison-failure',
    });
    expect(report.canaries.history.lastComparisonTimestamp).toEqual(expect.any(String));
    expect(report.summary.totalComparisons).toBe(2);
    expect(report.summary.totalFallbacks).toBe(1);
  });

  test('evaluates readiness using configurable thresholds', () => {
    const ride = createRide();
    recordRideHistoryParity([ride], [ride]);
    recordRideDetailParity(ride, ride);

    expect(isReadyForActiveRideCanary()).toBe(true);
    expect(isReadyForActiveRideCanary(undefined, {
      maxMismatchRate: 0,
      maxFallbackRate: 0,
      minProjectedAvailabilityRate: 1,
      maxMappingFailureRate: 0,
    })).toBe(true);

    recordRideCanaryFallback('detail', 'comparison-failure');

    expect(isReadyForActiveRideCanary()).toBe(false);
  });
});
