import { observability } from '@/observability/context/observabilityContext';
import { resetObservabilityForTests } from '@/observability/context/observabilityContext';
import type { Ride } from '@/types';
import { getCanaryHealthReport } from '../../canary/canaryReport';
import { resetRideCanaryHealthForTests } from '../../canary/canaryHealth';
import { rideProjectionCoordinator } from '../projectionCoordinator';
import { resolveProjectedRideDetail } from '../rideDetailCanary';
import type { RideShadowSnapshot } from '../../shadow/shadowTypes';

function createRide(overrides: Partial<Ride> = {}): Ride {
  return {
    id: 'ride-detail-1',
    customerId: 'customer-1',
    customerName: 'Customer One',
    vehicleType: 'moto',
    pickup: { latitude: -1.94, longitude: 30.06, address: 'Pickup' },
    destination: { latitude: -1.95, longitude: 30.07, address: 'Destination' },
    status: 'completed',
    distance: 5,
    duration: 18,
    suggestedFare: 12000,
    agreedFare: 10000,
    negotiation: [],
    createdAt: '2026-06-08T09:00:00.000Z',
    completedAt: '2026-06-08T09:22:00.000Z',
    driverId: 'driver-1',
    driverName: 'Driver One',
    ...overrides,
  };
}

function createProjectedRide(overrides: Partial<RideShadowSnapshot['shadowRideHistory'][number]> = {}) {
  return {
    rideId: 'ride-detail-1',
    status: 'completed' as const,
    customer: {
      userId: 'customer-1',
      role: 'customer' as const,
      displayName: 'Customer One',
    },
    pickup: { latitude: -1.94, longitude: 30.06, address: 'Pickup' },
    destination: { latitude: -1.95, longitude: 30.07, address: 'Destination' },
    fare: { amount: 10000, currency: 'RWF', source: 'final' as const, finalizedAt: '2026-06-08T09:22:00.000Z' },
    requestedAt: '2026-06-08T09:00:00.000Z',
    completedAt: '2026-06-08T09:22:00.000Z',
    paymentAuthorizedAt: '2026-06-08T09:20:00.000Z',
    paymentCompletedAt: '2026-06-08T09:21:00.000Z',
    paymentId: 'payment-1',
    rating: 5,
    ratingSubmittedAt: '2026-06-08T09:23:00.000Z',
    sequenceNumber: 9,
    projection: { appliedEventIds: ['ride.completed'] },
    ...overrides,
  } satisfies RideShadowSnapshot['shadowRideHistory'][number];
}

function createShadowSnapshot(projectedRideHistory: RideShadowSnapshot['shadowRideHistory'] = []) {
  return {
    enabled: true,
    running: true,
    projectionStatus: 'running',
    lastProcessedEvent: null,
    comparisonCount: 0,
    mismatchCount: 0,
    lastComparison: null,
    shadowActiveRide: null,
    shadowRideHistory: projectedRideHistory,
    shadowDriverRequests: [],
  } satisfies RideShadowSnapshot;
}

describe('ride detail canary', () => {
  beforeEach(() => {
    resetObservabilityForTests();
    resetRideCanaryHealthForTests();
    rideProjectionCoordinator.reset();
    jest.restoreAllMocks();
  });

  test('returns live detail when the canary is disabled', () => {
    const live = createRide();

    const result = resolveProjectedRideDetail(live, live.id, {
      canaryEnabled: false,
      useProjectedRideReadModel: false,
      shadowSnapshot: createShadowSnapshot(),
    });

    expect(result.source).toBe('live');
    expect(result.detail).toBe(live);
    expect(result.fallback).toBe(false);
    expect(result.projectedAvailable).toBe(false);
    expect(result.comparison).toBeNull();
  });

  test('returns live detail when projected flag is disabled', () => {
    const live = createRide();

    const result = resolveProjectedRideDetail(live, live.id, {
      canaryEnabled: true,
      useProjectedRideReadModel: false,
      shadowSnapshot: createShadowSnapshot([createProjectedRide()]),
    });

    expect(result.source).toBe('live');
    expect(result.detail).toBe(live);
    expect(result.fallback).toBe(false);
    expect(result.projectedAvailable).toBe(false);
  });

  test('returns projected detail when both flags are enabled', () => {
    const live = createRide();
    const projectedRide = createProjectedRide();

    const result = resolveProjectedRideDetail(live, live.id, {
      canaryEnabled: true,
      useProjectedRideReadModel: true,
      shadowSnapshot: createShadowSnapshot([projectedRide]),
    });

    expect(result.source).toBe('projected');
    expect(result.fallback).toBe(false);
    expect(result.projectedAvailable).toBe(true);
    expect(result.detail).toMatchObject({
      id: 'ride-detail-1',
      status: 'completed',
      agreedFare: 10000,
      completedAt: '2026-06-08T09:22:00.000Z',
    });
    expect(getCanaryHealthReport().canaries.detail.comparisonCount).toBe(1);
    expect(live.pickup.address).toBe('Pickup');
    expect(observability.metrics.getPoints().map(point => point.name)).toEqual(expect.arrayContaining([
      'ride.detail.canary.enabled',
      'ride.detail.comparison',
      'ride.detail.source_selected',
    ]));
    expect(observability.logger.getLogs().map(log => log.message)).toEqual(expect.arrayContaining([
      'RideDetailCanaryEnabled',
      'RideProjectionSourceSelected',
      'RideDetailComparison',
      'RideDetailSourceSelected',
    ]));
  });

  test('falls back to live detail when projected detail is unavailable', () => {
    const live = createRide();

    const result = resolveProjectedRideDetail(live, live.id, {
      canaryEnabled: true,
      useProjectedRideReadModel: true,
      shadowSnapshot: {
        ...createShadowSnapshot(),
        enabled: false,
        running: false,
        projectionStatus: 'stopped',
      },
    });

    expect(result.source).toBe('live');
    expect(result.detail).toBe(live);
    expect(result.fallback).toBe(true);
    expect(observability.logger.getLogs().some(log => log.message === 'RideDetailFallback')).toBe(true);
  });

  test('falls back to live detail when comparison fails', () => {
    const live = createRide();
    const projectedRide = createProjectedRide({ status: 'cancelled' });

    const result = resolveProjectedRideDetail(live, live.id, {
      canaryEnabled: true,
      useProjectedRideReadModel: true,
      shadowSnapshot: createShadowSnapshot([projectedRide]),
    });

    expect(result.source).toBe('live');
    expect(result.detail).toBe(live);
    expect(result.fallback).toBe(true);
    expect(result.comparison?.mismatch).toBeTruthy();
    expect(observability.logger.getLogs().some(log => log.message === 'RideDetailMismatch')).toBe(true);
  });

  test('falls back to live detail when mapping fails', () => {
    const live = createRide();
    const projectedRide = createProjectedRide({
      pickup: null as any,
      destination: null as any,
    });

    const result = resolveProjectedRideDetail(live, live.id, {
      canaryEnabled: true,
      useProjectedRideReadModel: true,
      shadowSnapshot: createShadowSnapshot([projectedRide]),
    });

    expect(result.source).toBe('live');
    expect(result.detail).toBe(live);
    expect(result.fallback).toBe(true);
    expect(observability.logger.getLogs().some(log => log.message === 'RideDetailMappingFailure')).toBe(true);
  });

  test('emits telemetry for the canary flow', () => {
    const live = createRide();
    const projectedRide = createProjectedRide();

    resolveProjectedRideDetail(live, live.id, {
      canaryEnabled: true,
      useProjectedRideReadModel: true,
      shadowSnapshot: createShadowSnapshot([projectedRide]),
    });

    expect(observability.metrics.getPoints().map(point => point.name)).toEqual(expect.arrayContaining([
      'ride.detail.canary.enabled',
      'ride.detail.comparison',
      'ride.detail.source_selected',
    ]));
    expect(observability.logger.getLogs().map(log => log.message)).toEqual(expect.arrayContaining([
      'RideDetailCanaryEnabled',
      'RideProjectionSourceSelected',
      'RideDetailComparison',
      'RideDetailSourceSelected',
    ]));
  });
});
