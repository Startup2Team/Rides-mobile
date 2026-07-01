import { observability, resetObservabilityForTests } from '@/observability/context/observabilityContext';
import type { Ride } from '@/types';
import { recordRideDetailParity, recordRideHistoryParity, resetRideCanaryHealthForTests } from '../../canary/canaryHealth';
import { resolveProjectedActiveRide } from '../activeRideCanary';
import type { RideShadowSnapshot } from '../../shadow/shadowTypes';

function createLiveRide(overrides: Partial<Ride> = {}): Ride {
  return {
    id: 'ride-active-1',
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

function createProjectedActiveRide(overrides: Partial<RideShadowSnapshot['shadowActiveRide']> = {}) {
  return {
    rideId: 'ride-active-1',
    status: 'started' as const,
    phase: 'active' as const,
    customer: { userId: 'customer-1', role: 'customer' as const, displayName: 'Customer One' },
    driver: { userId: 'driver-1', role: 'driver' as const, displayName: 'Driver One' },
    pickup: { latitude: -1.94, longitude: 30.06, address: 'Pickup' },
    destination: { latitude: -1.95, longitude: 30.07, address: 'Destination' },
    fare: { amount: 10000, currency: 'RWF', source: 'final' as const, finalizedAt: '2026-06-08T09:22:00.000Z' },
    etaMinutes: 3,
    updatedAt: '2026-06-08T09:22:00.000Z',
    sequenceNumber: 10,
    projection: { appliedEventIds: ['ride.started'] },
    ...overrides,
  } satisfies NonNullable<RideShadowSnapshot['shadowActiveRide']>;
}

function createShadowSnapshot(overrides: Partial<RideShadowSnapshot> = {}): RideShadowSnapshot {
  return {
    enabled: true,
    running: true,
    projectionStatus: 'running',
    lastProcessedEvent: {
      aggregateId: 'ride-active-1',
      aggregateType: 'ride',
      eventId: 'event-10',
      eventType: 'ride.started',
      eventVersion: 1,
      sequenceNumber: 10,
      timestamp: '2026-06-08T09:22:00.000Z',
      correlationId: 'corr-1',
      causationId: 'cmd-1',
      producer: 'test',
      payload: {
        rideId: 'ride-active-1',
        startedAt: '2026-06-08T09:22:00.000Z',
      },
    },
    comparisonCount: 0,
    mismatchCount: 0,
    lastComparison: null,
    shadowActiveRide: createProjectedActiveRide(),
    shadowRideHistory: [],
    shadowDriverRequests: [],
    ...overrides,
  };
}

describe('projected active ride canary', () => {
  beforeEach(() => {
    resetObservabilityForTests();
    resetRideCanaryHealthForTests();
    jest.restoreAllMocks();
  });

  test('returns live active ride when feature is disabled', () => {
    const live = createLiveRide();

    const result = resolveProjectedActiveRide(live, {
      canaryEnabled: false,
      useProjectedRideReadModel: false,
      shadowSnapshot: createShadowSnapshot(),
    });

    expect(result.source).toBe('live');
    expect(result.activeRide).toBe(live);
    expect(result.readinessDenied).toBe(true);
    expect(observability.logger.getLogs().some(log => log.message === 'RideActiveRideReadinessDenied')).toBe(true);
  });

  test('returns live active ride when readiness is false', () => {
    const live = createLiveRide();

    const result = resolveProjectedActiveRide(live, {
      canaryEnabled: true,
      useProjectedRideReadModel: true,
      shadowSnapshot: createShadowSnapshot(),
    });

    expect(result.source).toBe('live');
    expect(result.activeRide).toBe(live);
    expect(result.readinessDenied).toBe(true);
  });

  test('falls back to live active ride when projection is unavailable', () => {
    const live = createLiveRide();
    recordRideHistoryParity([live], [live]);
    recordRideDetailParity(live, live);

    const result = resolveProjectedActiveRide(live, {
      canaryEnabled: true,
      useProjectedRideReadModel: true,
      shadowSnapshot: createShadowSnapshot({ enabled: false, running: false, shadowActiveRide: null }),
    });

    expect(result.source).toBe('live');
    expect(result.fallback).toBe(true);
    expect(result.projectedAvailable).toBe(false);
    expect(observability.logger.getLogs().map(log => log.message)).toEqual(expect.arrayContaining([
      'RideActiveRideComparison',
      'RideActiveRideSourceSelected',
      'RideActiveRideFallback',
    ]));
  });

  test('falls back to live active ride when projection is stale', () => {
    const live = createLiveRide();
    recordRideHistoryParity([live], [live]);
    recordRideDetailParity(live, live);

    const result = resolveProjectedActiveRide(live, {
      canaryEnabled: true,
      useProjectedRideReadModel: true,
      shadowSnapshot: createShadowSnapshot({
        lastProcessedEvent: {
          aggregateId: 'ride-active-1',
          aggregateType: 'ride',
          eventId: 'event-11',
          eventType: 'ride.driver.arrived',
          eventVersion: 1,
          sequenceNumber: 11,
          timestamp: '2026-06-08T09:23:00.000Z',
          correlationId: 'corr-1',
          causationId: 'cmd-1',
          producer: 'test',
          payload: {
            rideId: 'ride-active-1',
            driverId: 'driver-1',
            arrivedAt: '2026-06-08T09:23:00.000Z',
          },
        },
        shadowActiveRide: createProjectedActiveRide({
          sequenceNumber: 9,
          updatedAt: '2026-06-08T09:21:00.000Z',
        }),
      }),
    });

    expect(result.source).toBe('live');
    expect(result.stale).toBe(true);
    expect(observability.logger.getLogs().some(log => log.message === 'RideActiveRideProjectionStale')).toBe(true);
  });

  test('falls back to live active ride when mapping fails', () => {
    const live = createLiveRide();
    recordRideHistoryParity([live], [live]);
    recordRideDetailParity(live, live);

    const result = resolveProjectedActiveRide(live, {
      canaryEnabled: true,
      useProjectedRideReadModel: true,
      shadowSnapshot: createShadowSnapshot({
        shadowActiveRide: createProjectedActiveRide({
          pickup: null as any,
        }),
      }),
    });

    expect(result.source).toBe('live');
    expect(result.fallback).toBe(true);
  });

  test('returns projected active ride when healthy', () => {
    const live = createLiveRide();
    recordRideHistoryParity([live], [live]);
    recordRideDetailParity(live, live);

    const result = resolveProjectedActiveRide(live, {
      canaryEnabled: true,
      useProjectedRideReadModel: true,
      shadowSnapshot: createShadowSnapshot(),
    });

    expect(result.source).toBe('projected');
    expect(result.fallback).toBe(false);
    expect(result.projectedAvailable).toBe(true);
    expect(result.activeRide).toMatchObject({
      rideId: 'ride-active-1',
      status: 'started',
      phase: 'active',
      etaMinutes: 3,
    });
    expect(observability.logger.getLogs().map(log => log.message)).toEqual(expect.arrayContaining([
      'RideActiveRideComparison',
      'RideActiveRideSourceSelected',
    ]));
  });

  test('falls back to live active ride when comparison mismatches', () => {
    const live = createLiveRide();
    recordRideHistoryParity([live], [live]);
    recordRideDetailParity(live, live);

    const result = resolveProjectedActiveRide(live, {
      canaryEnabled: true,
      useProjectedRideReadModel: true,
      shadowSnapshot: createShadowSnapshot({
        shadowActiveRide: createProjectedActiveRide({ status: 'accepted' as const }),
      }),
    });

    expect(result.source).toBe('live');
    expect(result.fallback).toBe(true);
    expect(observability.logger.getLogs().some(log => log.message === 'RideActiveRideMismatch')).toBe(true);
  });
});
