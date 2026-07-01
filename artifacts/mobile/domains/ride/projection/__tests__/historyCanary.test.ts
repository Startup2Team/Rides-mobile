import { observability } from '@/observability/context/observabilityContext';
import { resetObservabilityForTests } from '@/observability/context/observabilityContext';
import type { Ride } from '@/types';
import { rideProjectionCoordinator } from '../projectionCoordinator';
import { resolveProjectedRideHistory } from '../historyCanary';
import type { RideShadowSnapshot } from '../../shadow/shadowTypes';

function createRide(overrides: Partial<Ride> = {}): Ride {
  return {
    id: 'ride-1',
    customerId: 'customer-1',
    customerName: 'Customer One',
    vehicleType: 'moto',
    pickup: { latitude: -1.94, longitude: 30.06, address: 'Pickup' },
    destination: { latitude: -1.95, longitude: 30.07, address: 'Destination' },
    status: 'completed',
    distance: 3,
    duration: 12,
    suggestedFare: 12000,
    agreedFare: 10000,
    negotiation: [],
    createdAt: '2026-06-08T09:00:00.000Z',
    completedAt: '2026-06-08T09:25:00.000Z',
    ...overrides,
  };
}

function createShadowSnapshot(projectedRideHistory: RideShadowSnapshot['shadowRideHistory']) {
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

describe('ride history canary', () => {
  beforeEach(() => {
    resetObservabilityForTests();
    jest.restoreAllMocks();
  });

  test('returns live history when canary is disabled', () => {
    const live = [createRide()];
    const snapshot = createShadowSnapshot([] as RideShadowSnapshot['shadowRideHistory']);

    const result = resolveProjectedRideHistory(live, 'user-1', {
      canaryEnabled: false,
      useProjectedRideReadModel: false,
      shadowSnapshot: snapshot,
    });

    expect(result.source).toBe('live');
    expect(result.history).toBe(live);
    expect(result.fallback).toBe(false);
    expect(result.projectedAvailable).toBe(false);
    expect(result.comparison).toBeNull();
    expect(observability.logger.getLogs()).toHaveLength(0);
    expect(observability.metrics.getPoints()).toHaveLength(0);
  });

  test('returns projected history when the canary is enabled', () => {
    const live = [createRide()];
    const projectedRide = {
      rideId: 'ride-1',
      status: 'completed',
      customer: { userId: 'customer-1', role: 'customer', displayName: 'Customer One' },
      pickup: { latitude: -1.94, longitude: 30.06, address: 'Pickup' },
      destination: { latitude: -1.95, longitude: 30.07, address: 'Destination' },
      fare: { amount: 10000, currency: 'RWF', source: 'final' as const, finalizedAt: '2026-06-08T09:22:00.000Z' },
      requestedAt: '2026-06-08T09:00:00.000Z',
      completedAt: '2026-06-08T09:22:00.000Z',
      paymentAuthorizedAt: '2026-06-08T09:21:00.000Z',
      paymentCompletedAt: '2026-06-08T09:23:00.000Z',
      paymentId: 'payment-1',
      rating: 5,
      ratingSubmittedAt: '2026-06-08T09:24:00.000Z',
      sequenceNumber: 7,
      projection: { appliedEventIds: ['ride.completed'] },
    } satisfies RideShadowSnapshot['shadowRideHistory'][number];
    const snapshot = createShadowSnapshot([projectedRide]);
    const createSnapshotSpy = jest.spyOn(rideProjectionCoordinator, 'createSnapshot').mockReturnValue({
      enabled: true,
      flags: {
        enableProjectionCoordination: true,
        enableDualRead: true,
        useProjectedRideReadModel: true,
        enableProjectedHistoryCanary: true,
      },
      source: 'live',
      selection: { source: 'LIVE', reason: 'test', projectedAvailable: true },
      projectedAvailable: true,
      live: { activeRide: null, rideHistory: live, driverRequests: [] },
      projected: { activeRide: null, rideHistory: [projectedRide], driverRequests: [] },
      comparison: null,
      fallbackToLive: false,
      comparisonCount: 1,
      mismatchCount: 0,
      lastMismatch: null,
      lastProjection: null,
      currentSource: 'LIVE',
    } as any);

    const result = resolveProjectedRideHistory(live, 'user-1', {
      canaryEnabled: true,
      useProjectedRideReadModel: true,
      shadowSnapshot: snapshot,
    });

    expect(createSnapshotSpy).toHaveBeenCalledTimes(1);
    expect(result.source).toBe('projected');
    expect(result.fallback).toBe(false);
    expect(result.projectedAvailable).toBe(true);
    expect(result.history[0]).toMatchObject({
      id: 'ride-1',
      status: 'completed',
      completedAt: '2026-06-08T09:22:00.000Z',
      agreedFare: 10000,
      customerName: 'Customer One',
    });
    expect(observability.metrics.getPoints().map(point => point.name)).toEqual([
      'ride.history.canary.enabled',
      'ride.history.comparison',
      'ride.history.source_selected',
    ]);
    expect(observability.logger.getLogs().map(log => log.message)).toEqual([
      'RideHistoryCanaryEnabled',
      'RideHistoryComparison',
      'RideHistorySourceSelected',
    ]);
  });

  test('falls back to live history when projected history is unavailable', () => {
    const live = [createRide()];
    const createSnapshotSpy = jest.spyOn(rideProjectionCoordinator, 'createSnapshot').mockReturnValue({
      enabled: true,
      flags: {
        enableProjectionCoordination: true,
        enableDualRead: true,
        useProjectedRideReadModel: true,
        enableProjectedHistoryCanary: true,
      },
      source: 'live',
      selection: { source: 'LIVE', reason: 'test', projectedAvailable: false },
      projectedAvailable: false,
      live: { activeRide: null, rideHistory: live, driverRequests: [] },
      projected: null,
      comparison: null,
      fallbackToLive: true,
      comparisonCount: 1,
      mismatchCount: 0,
      lastMismatch: null,
      lastProjection: null,
      currentSource: 'LIVE',
    } as any);

    const result = resolveProjectedRideHistory(live, 'user-1', {
      canaryEnabled: true,
      useProjectedRideReadModel: true,
    });

    expect(createSnapshotSpy).toHaveBeenCalledTimes(1);
    expect(result.source).toBe('live');
    expect(result.history).toBe(live);
    expect(result.fallback).toBe(true);
    expect(observability.logger.getLogs().some(log => log.message === 'RideHistoryFallback')).toBe(true);
  });

  test('falls back to live history when comparison fails', () => {
    const live = [createRide()];
    const createSnapshotSpy = jest.spyOn(rideProjectionCoordinator, 'createSnapshot').mockReturnValue({
      enabled: true,
      flags: {
        enableProjectionCoordination: true,
        enableDualRead: true,
        useProjectedRideReadModel: true,
        enableProjectedHistoryCanary: true,
      },
      source: 'live',
      selection: { source: 'LIVE', reason: 'test', projectedAvailable: true },
      projectedAvailable: true,
      live: { activeRide: null, rideHistory: live, driverRequests: [] },
      projected: {
        activeRide: null,
        rideHistory: [
          {
            rideId: 'ride-1',
            status: 'cancelled',
            customer: { userId: 'customer-1', role: 'customer', displayName: 'Customer One' },
            pickup: { latitude: -1.94, longitude: 30.06, address: 'Pickup' },
            destination: { latitude: -1.95, longitude: 30.07, address: 'Destination' },
            fare: { amount: 9500, currency: 'RWF', source: 'final' as const, finalizedAt: '2026-06-08T09:22:00.000Z' },
            requestedAt: '2026-06-08T09:00:00.000Z',
            completedAt: null,
            paymentAuthorizedAt: null,
            paymentCompletedAt: null,
            paymentId: null,
            rating: null,
            ratingSubmittedAt: null,
            sequenceNumber: 7,
            projection: { appliedEventIds: ['ride.completed'] },
          },
        ],
        driverRequests: [],
      },
      comparison: {
        activeRideDiff: [],
        historyDiff: [{ field: 'history.0.status', production: 'completed', shadow: 'cancelled' }],
        driverRequestDiff: [],
        mismatch: {
          name: 'RideProjectionMismatch',
          aggregateId: 'ride-1',
          eventId: 'event-1',
          eventType: 'ride.completed',
          correlationId: 'corr-1',
          sequenceNumber: 7,
          fieldDiff: [{ field: 'history.0.status', production: 'completed', shadow: 'cancelled' }],
        },
      } as any,
      fallbackToLive: false,
      comparisonCount: 1,
      mismatchCount: 0,
      lastMismatch: null,
      lastProjection: null,
      currentSource: 'LIVE',
    } as any);

    const result = resolveProjectedRideHistory(live, 'user-1', {
      canaryEnabled: true,
      useProjectedRideReadModel: true,
    });

    expect(createSnapshotSpy).toHaveBeenCalledTimes(1);
    expect(result.source).toBe('live');
    expect(result.history).toBe(live);
    expect(result.fallback).toBe(true);
    expect(result.comparison?.mismatch).toBeTruthy();
    expect(observability.logger.getLogs().some(log => log.message === 'RideHistoryMismatch')).toBe(true);
    expect(observability.logger.getLogs().some(log => log.message === 'RideHistoryFallback')).toBe(true);
  });
});
