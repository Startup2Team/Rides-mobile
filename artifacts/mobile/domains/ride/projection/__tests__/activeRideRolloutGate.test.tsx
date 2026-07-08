import { QueryClient } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';
import React from 'react';
import { RideProvider, useRide } from '@/context/RideContext';
import { observability, resetObservabilityForTests } from '@/observability/context/observabilityContext';
import type { Ride } from '@/types';
import { recordRideDetailParity, recordRideHistoryParity, resetRideCanaryHealthForTests } from '../../canary/canaryHealth';
import {
  disableProjectedActiveRide,
  evaluateActiveRideRolloutGate,
  forceActiveRideLiveSource,
  getActiveRideRolloutStatus,
  resetActiveRideRolloutGateForTests,
  seedActiveRideRolloutGateForTests,
} from '../activeRideRolloutGate';
import { rideProjectionCoordinator } from '../projectionCoordinator';

const originalAllowProjectedActiveRideUi = process.env.ALLOW_PROJECTED_ACTIVE_RIDE_UI;
const originalEnableProjectedActiveRideCanary = process.env.ENABLE_PROJECTED_ACTIVE_RIDE_CANARY;
const originalUseProjectedRideReadModel = process.env.USE_PROJECTED_RIDE_READ_MODEL;
const environment = process.env as Record<string, string | undefined>;

function setEnvironment({
  allowUi = false,
  canaryEnabled = true,
  useProjected = true,
}: {
  allowUi?: boolean;
  canaryEnabled?: boolean;
  useProjected?: boolean;
} = {}) {
  environment.ALLOW_PROJECTED_ACTIVE_RIDE_UI = String(allowUi);
  environment.ENABLE_PROJECTED_ACTIVE_RIDE_CANARY = String(canaryEnabled);
  environment.USE_PROJECTED_RIDE_READ_MODEL = String(useProjected);
}

function restoreEnvironment() {
  if (originalAllowProjectedActiveRideUi === undefined) {
    delete environment.ALLOW_PROJECTED_ACTIVE_RIDE_UI;
  } else {
    environment.ALLOW_PROJECTED_ACTIVE_RIDE_UI = originalAllowProjectedActiveRideUi;
  }

  if (originalEnableProjectedActiveRideCanary === undefined) {
    delete environment.ENABLE_PROJECTED_ACTIVE_RIDE_CANARY;
  } else {
    environment.ENABLE_PROJECTED_ACTIVE_RIDE_CANARY = originalEnableProjectedActiveRideCanary;
  }

  if (originalUseProjectedRideReadModel === undefined) {
    delete environment.USE_PROJECTED_RIDE_READ_MODEL;
  } else {
    environment.USE_PROJECTED_RIDE_READ_MODEL = originalUseProjectedRideReadModel;
  }
}

function createLiveRide(overrides: Partial<Ride> = {}): Ride {
  return {
    id: 'ride-rollout-1',
    customerId: 'customer-1',
    customerName: 'Customer One',
    vehicleType: 'moto',
    pickup: { latitude: -1.94, longitude: 30.06, address: 'Pickup' },
    destination: { latitude: -1.95, longitude: 30.07, address: 'Destination' },
    status: 'in_progress',
    distance: 7,
    duration: 22,
    suggestedFare: 12000,
    agreedFare: 10000,
    negotiation: [],
    createdAt: '2026-06-08T09:00:00.000Z',
    arrivedAt: '2026-06-08T09:18:00.000Z',
    waitStartedAt: '2026-06-08T09:14:00.000Z',
    driverId: 'driver-1',
    driverName: 'Driver One',
    driver: {
      id: 'driver-1',
      name: 'Driver One',
      phone: '+250788111001',
      vehicleType: 'moto',
      plateNumber: 'RAD 001 A',
      location: { latitude: -1.93, longitude: 30.05 },
      rating: 4.8,
      eta: 3,
    },
    ...overrides,
  };
}

function seedHealthyRolloutWindow() {
  recordRideHistoryParity([createLiveRide()], [createLiveRide()]);
  recordRideDetailParity(createLiveRide(), createLiveRide());
  seedActiveRideRolloutGateForTests({
    startedAt: '2026-06-08T09:00:00.000Z',
    lastUpdatedAt: '2026-06-08T09:20:00.000Z',
    comparisonCount: 24,
    projectedAvailableCount: 24,
    mismatchCount: 0,
    fallbackCount: 0,
    stalenessCount: 0,
    mappingFailureCount: 0,
    unresolvedProjectionErrorCount: 0,
    disabled: false,
    forcedLive: false,
    lastReason: 'rollout-approved',
  });
}

describe('active ride rollout gate', () => {
  beforeEach(() => {
    resetObservabilityForTests();
    resetRideCanaryHealthForTests();
    resetActiveRideRolloutGateForTests();
    setEnvironment();
    jest.restoreAllMocks();
  });

  afterEach(() => {
    restoreEnvironment();
  });

  test('denies rollout by default', () => {
    const status = getActiveRideRolloutStatus();

    expect(status.eligible).toBe(false);
    expect(status.reason).toBe('health-gate');
  });

  test('denies rollout when comparison count is too low', () => {
    setEnvironment({ allowUi: true });
    recordRideHistoryParity([createLiveRide()], [createLiveRide()]);
    recordRideDetailParity(createLiveRide(), createLiveRide());
    seedActiveRideRolloutGateForTests({
      startedAt: '2026-06-08T08:40:00.000Z',
      lastUpdatedAt: '2026-06-08T09:20:00.000Z',
      comparisonCount: 3,
      projectedAvailableCount: 3,
      mismatchCount: 0,
      fallbackCount: 0,
      stalenessCount: 0,
      mappingFailureCount: 0,
      unresolvedProjectionErrorCount: 0,
      disabled: false,
      forcedLive: false,
      lastReason: 'comparison-count-too-low',
    });

    const status = getActiveRideRolloutStatus();

    expect(status.eligible).toBe(false);
    expect(status.reason).toBe('comparison-count-too-low');
  });

  test('denies rollout when observation window is too short', () => {
    setEnvironment({ allowUi: true });
    recordRideHistoryParity([createLiveRide()], [createLiveRide()]);
    recordRideDetailParity(createLiveRide(), createLiveRide());
    seedActiveRideRolloutGateForTests({
      startedAt: '2026-06-08T09:10:00.000Z',
      lastUpdatedAt: '2026-06-08T09:15:00.000Z',
      comparisonCount: 25,
      projectedAvailableCount: 25,
      mismatchCount: 0,
      fallbackCount: 0,
      stalenessCount: 0,
      mappingFailureCount: 0,
      unresolvedProjectionErrorCount: 0,
      disabled: false,
      forcedLive: false,
      lastReason: 'observation-window-too-short',
    });

    const status = getActiveRideRolloutStatus();

    expect(status.eligible).toBe(false);
    expect(status.reason).toBe('observation-window-too-short');
  });

  test.each([
    ['mismatch-rate-too-high', { mismatchCount: 1, fallbackCount: 0, stalenessCount: 0, mappingFailureCount: 0, unresolvedProjectionErrorCount: 0 }],
    ['fallback-rate-too-high', { mismatchCount: 0, fallbackCount: 1, stalenessCount: 0, mappingFailureCount: 0, unresolvedProjectionErrorCount: 0 }],
    ['staleness-rate-too-high', { mismatchCount: 0, fallbackCount: 0, stalenessCount: 1, mappingFailureCount: 0, unresolvedProjectionErrorCount: 0 }],
    ['mapping-failure-detected', { mismatchCount: 0, fallbackCount: 0, stalenessCount: 0, mappingFailureCount: 1, unresolvedProjectionErrorCount: 0 }],
  ])('denies rollout on %s', (reason, counters) => {
    setEnvironment({ allowUi: true });
    recordRideHistoryParity([createLiveRide()], [createLiveRide()]);
    recordRideDetailParity(createLiveRide(), createLiveRide());
    seedActiveRideRolloutGateForTests({
      startedAt: '2026-06-08T09:00:00.000Z',
      lastUpdatedAt: '2026-06-08T09:20:00.000Z',
      comparisonCount: 25,
      projectedAvailableCount: 25,
      disabled: false,
      forcedLive: false,
      lastReason: reason,
      ...counters,
    });

    const status = getActiveRideRolloutStatus();

    expect(status.eligible).toBe(false);
    expect(status.reason).toBe(reason);
  });

  test('denies rollout on unresolved projection errors', () => {
    setEnvironment({ allowUi: true });
    recordRideHistoryParity([createLiveRide()], [createLiveRide()]);
    recordRideDetailParity(createLiveRide(), createLiveRide());
    seedActiveRideRolloutGateForTests({
      startedAt: '2026-06-08T09:00:00.000Z',
      lastUpdatedAt: '2026-06-08T09:20:00.000Z',
      comparisonCount: 25,
      projectedAvailableCount: 25,
      mismatchCount: 0,
      fallbackCount: 0,
      stalenessCount: 0,
      mappingFailureCount: 0,
      unresolvedProjectionErrorCount: 1,
      disabled: false,
      forcedLive: false,
      lastReason: 'unresolved-projection-error-detected',
    });

    const status = getActiveRideRolloutStatus();

    expect(status.eligible).toBe(false);
    expect(status.reason).toBe('unresolved-projection-error-detected');
  });

  test('approves rollout only when all thresholds pass', () => {
    setEnvironment({ allowUi: true });
    seedHealthyRolloutWindow();

    const status = evaluateActiveRideRolloutGate({
      canaryEnabled: true,
      useProjectedRideReadModel: true,
      projectedAvailable: true,
      fallback: false,
      stale: false,
      matched: true,
      mappingFailure: false,
      unresolvedProjectionError: false,
      comparisonTimestamp: '2026-06-08T09:20:00.000Z',
    });

    expect(status.eligible).toBe(true);
    expect(status.reason).toBe('rollout-approved');
    expect(observability.logger.getLogs().map(log => log.message)).toEqual(expect.arrayContaining([
      'RideActiveRideSustainedParityWindowUpdated',
      'RideActiveRideRolloutGateEvaluated',
      'RideActiveRideRolloutGateApproved',
    ]));
  });

  test('production guard blocks by default', () => {
    seedHealthyRolloutWindow();

    const status = evaluateActiveRideRolloutGate({
      canaryEnabled: true,
      useProjectedRideReadModel: true,
      projectedAvailable: true,
      fallback: false,
      stale: false,
      matched: true,
      mappingFailure: false,
      unresolvedProjectionError: false,
      comparisonTimestamp: '2026-06-08T09:20:00.000Z',
    });

    expect(status.eligible).toBe(false);
    expect(status.reason).toBe('production-guard-blocked');
    expect(observability.logger.getLogs().map(log => log.message)).toEqual(expect.arrayContaining([
      'RideActiveRideProductionGuardBlocked',
    ]));
  });

  test('disableProjectedActiveRide blocks projected rollout immediately', () => {
    setEnvironment({ allowUi: true });
    seedHealthyRolloutWindow();

    const status = disableProjectedActiveRide('test-disable');

    expect(status.eligible).toBe(false);
    expect(status.reason).toBe('hard-rollback');
    expect(getActiveRideRolloutStatus().eligible).toBe(false);
    expect(observability.logger.getLogs().map(log => log.message)).toEqual(expect.arrayContaining([
      'RideActiveRideHardRollbackTriggered',
    ]));
  });

  test('forceActiveRideLiveSource forces live source without mutating RideProvider or query cache', () => {
    setEnvironment({ allowUi: true });
    seedHealthyRolloutWindow();
    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => <RideProvider>{children}</RideProvider>;
    const { result } = renderHook(() => useRide(), { wrapper });
    const beforeRide = result.current.currentRide;
    const beforeHistory = result.current.rideHistory;
    const beforePending = result.current.pendingRequest;
    const beforeQueries = queryClient.getQueryCache().getAll();

    const status = forceActiveRideLiveSource('manual-rollback');

    expect(status.eligible).toBe(false);
    expect(rideProjectionCoordinator.isLiveForced()).toBe(true);
    expect(result.current.currentRide).toBe(beforeRide);
    expect(result.current.rideHistory).toBe(beforeHistory);
    expect(result.current.pendingRequest).toBe(beforePending);
    expect(queryClient.getQueryCache().getAll()).toEqual(beforeQueries);
    expect(observability.logger.getLogs().map(log => log.message)).toEqual(expect.arrayContaining([
      'RideActiveRideHardRollbackTriggered',
    ]));
  });
});
