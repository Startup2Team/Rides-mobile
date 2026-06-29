import { QueryClient } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';
import React from 'react';
import { RideProvider, useRide } from '@/context/RideContext';
import { createRideRequestedEvent } from '../../eventFactories';
import { projectActiveRideEvent } from '../../projectors';
import { rideShadowProjectionManager } from '../../shadow/shadowProjectionManager';
import { resetObservabilityForTests, observability } from '@/observability/context/observabilityContext';
import { clearOfflineQueueState } from '@/offline/storage/offlineQueueStorage';
import {
  assertProjectedReadDisabledInProduction,
  createRideDualReadSnapshot,
  forceLiveRideReadModel,
  getReadModelSource,
  useActiveRideReadModel,
  useDriverRequestsReadModel,
  useRideHistoryReadModel,
  useRideReadModel,
} from '../rideDualReadAdapter';
import { compareActiveRide } from '../rideDualReadComparator';
import { recordRideDualReadTelemetry, MemoryRideDualReadTelemetry } from '../rideDualReadMetrics';
import { ENABLE_RIDE_DUAL_READ, USE_PROJECTED_RIDE_READ_MODEL } from '../rideDualReadTypes';
import { rideProjectionCoordinator } from '../../projection';

const originalNodeEnv = process.env.NODE_ENV;
const environment = process.env as Record<string, string | undefined>;

describe('ride dual read', () => {
  beforeEach(async () => {
    await clearOfflineQueueState();
    resetObservabilityForTests();
    rideShadowProjectionManager.stop();
    rideShadowProjectionManager.reset();
    rideProjectionCoordinator.reset();
  });

  afterEach(async () => {
    await clearOfflineQueueState();
    resetObservabilityForTests();
    rideShadowProjectionManager.stop();
    rideShadowProjectionManager.reset();
    rideProjectionCoordinator.reset();
    environment.NODE_ENV = originalNodeEnv;
    jest.resetModules();
  });

  test('dual read is disabled in production', () => {
    environment.NODE_ENV = 'production';
    jest.resetModules();
    const module = require('../rideDualReadTypes') as typeof import('../rideDualReadTypes');

    expect(module.ENABLE_RIDE_DUAL_READ).toBe(false);
    expect(module.USE_PROJECTED_RIDE_READ_MODEL).toBe(false);
  });

  test('projected source is disabled everywhere by default', () => {
    expect(USE_PROJECTED_RIDE_READ_MODEL).toBe(false);
    expect(getReadModelSource({ projectedAvailable: true })).toBe('live');
    expect(assertProjectedReadDisabledInProduction()).toBe(true);
  });

  test('hooks return live ride provider state', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => <RideProvider>{children}</RideProvider>;
    const { result } = renderHook(() => {
      const ride = useRide();
      const dualRead = useRideReadModel();
      return { ride, dualRead };
    }, { wrapper });

    expect(result.current.dualRead.source).toBe('live');
    expect(result.current.dualRead.live.activeRide).toBe(result.current.ride.currentRide);
    expect(result.current.dualRead.live.rideHistory).toBe(result.current.ride.rideHistory);
    expect(result.current.dualRead.live.driverRequests).toEqual([]);
  });

  test('comparator reports semantic differences', () => {
    const live = {
      id: 'ride-1',
      customerId: 'customer-1',
      customerName: 'Customer',
      customerPhone: '',
      vehicleType: 'moto' as const,
      requestedVehicleType: 'moto' as const,
      pickup: { address: 'Pickup A', latitude: -1.95, longitude: 30.06, locationType: 'generic' as const },
      destination: { address: 'Destination A', latitude: -1.96, longitude: 30.07, locationType: 'generic' as const },
      status: 'searching' as const,
      distance: 1,
      duration: 5,
      suggestedFare: 1000,
      negotiation: [],
      createdAt: '2026-06-29T10:00:00.000Z',
    };
    const projected = projectActiveRideEvent(null, createRideRequestedEvent({
      rideId: 'ride-1',
      customer: { userId: 'customer-1', role: 'customer' },
      pickup: { address: 'Pickup B', latitude: -1.95, longitude: 30.06 },
      destination: { address: 'Destination B', latitude: -1.96, longitude: 30.07 },
      requestedVehicleType: 'moto',
    }, {
      eventId: 'event-1',
      correlationId: 'correlation-1',
      causationId: 'command-1',
      sequenceNumber: 1,
      timestamp: '2026-06-29T10:00:00.000Z',
      producer: 'test',
    }));

    const diff = compareActiveRide(live, projected);

    expect(diff.length).toBeGreaterThan(0);
    expect(diff.some(entry => entry.field === 'activeRide.pickup.address')).toBe(true);
  });

  test('telemetry is emitted on mismatch', () => {
    recordRideDualReadTelemetry({
      enabled: true,
      source: 'live',
      projectedAvailable: true,
      live: { activeRide: null, rideHistory: [], driverRequests: [] },
      projected: { activeRide: null, rideHistory: [], driverRequests: [] },
      comparison: {
        activeRideDiff: [{ field: 'activeRide.status', production: 'searching', shadow: 'matching' }],
        historyDiff: [],
        driverRequestDiff: [],
        mismatch: {
          name: 'RideProjectionMismatch',
          aggregateId: 'ride-1',
          eventId: 'event-1',
          eventType: 'ride.requested',
          correlationId: 'correlation-1',
          sequenceNumber: 1,
          fieldDiff: [{ field: 'activeRide.status', production: 'searching', shadow: 'matching' }],
        },
      },
    }, new MemoryRideDualReadTelemetry());

    recordRideDualReadTelemetry({
      enabled: true,
      source: 'live',
      projectedAvailable: true,
      live: { activeRide: null, rideHistory: [], driverRequests: [] },
      projected: { activeRide: null, rideHistory: [], driverRequests: [] },
      comparison: {
        activeRideDiff: [{ field: 'activeRide.status', production: 'searching', shadow: 'matching' }],
        historyDiff: [],
        driverRequestDiff: [],
        mismatch: {
          name: 'RideProjectionMismatch',
          aggregateId: 'ride-1',
          eventId: 'event-1',
          eventType: 'ride.requested',
          correlationId: 'correlation-1',
          sequenceNumber: 1,
          fieldDiff: [{ field: 'activeRide.status', production: 'searching', shadow: 'matching' }],
        },
      },
    });

    expect(observability.metrics.getPoints().map(point => point.name)).toEqual(expect.arrayContaining([
      'ride.dual_read.source',
      'ride.dual_read.compared',
      'ride.dual_read.active_mismatch',
    ]));
    expect(observability.logger.getLogs().map(log => log.message)).toEqual(expect.arrayContaining([
      'RideDualReadSourceUsed',
      'RideDualReadMismatch',
    ]));
  });

  test('forceLiveRideReadModel always returns live source', () => {
    expect(forceLiveRideReadModel()).toBe('live');
    expect(getReadModelSource({ projectedAvailable: true })).toBe('live');
  });

  test('projected unavailable falls back to live', () => {
    const snapshot = createRideDualReadSnapshot({
      activeRide: null,
      rideHistory: [],
      driverRequests: [],
    }, null);

    expect(snapshot.source).toBe('live');
    expect(snapshot.projected).toBeNull();
    expect(snapshot.projectedAvailable).toBe(false);
    expect(snapshot.comparison).toBeNull();
  });

  test('does not mutate query cache or RideProvider state', () => {
    const client = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => <RideProvider>{children}</RideProvider>;
    const { result } = renderHook(() => {
      const ride = useRide();
      useRideReadModel();
      useActiveRideReadModel();
      useRideHistoryReadModel();
      useDriverRequestsReadModel();
      return ride;
    }, { wrapper });

    const beforeRide = result.current.currentRide;
    const beforeHistory = result.current.rideHistory;
    const beforePending = result.current.pendingRequest;
    const beforeQueries = client.getQueryCache().getAll();

    expect(result.current.currentRide).toBe(beforeRide);
    expect(result.current.rideHistory).toBe(beforeHistory);
    expect(result.current.pendingRequest).toBe(beforePending);
    expect(client.getQueryCache().getAll()).toEqual(beforeQueries);
  });
});
