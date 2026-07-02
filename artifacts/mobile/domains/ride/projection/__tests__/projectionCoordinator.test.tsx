import { QueryClient } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';
import React from 'react';
import { RideProvider, useRide } from '@/context/RideContext';
import { createRideRequestedEvent } from '../../eventFactories';
import { rideShadowProjectionManager } from '../../shadow/shadowProjectionManager';
import { clearOfflineQueueState } from '@/offline/storage/offlineQueueStorage';
import { observability, resetObservabilityForTests } from '@/observability/context/observabilityContext';
import {
  rideProjectionCoordinator,
  useProjectionCoordinator,
  useRideProjectionDiagnostics,
} from '../projectionCoordinator';
import { ENABLE_RIDE_PROJECTION_COORDINATION } from '../projectionTypes';

const originalNodeEnv = process.env.NODE_ENV;
const environment = process.env as Record<string, string | undefined>;

describe('ride projection coordinator', () => {
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

  test('selection resolves to live by default', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => <RideProvider>{children}</RideProvider>;
    const { result } = renderHook(() => useProjectionCoordinator(), { wrapper });

    expect(result.current.currentSource).toBe('LIVE');
    expect(result.current.source).toBe('live');
    expect(result.current.fallbackToLive).toBe(true);
  });

  test('rollbackToLive forces live snapshots', () => {
    const snapshot = rideProjectionCoordinator.rollbackToLive({
      activeRide: null,
      rideHistory: [],
      driverRequests: [],
    });

    expect(snapshot.source).toBe('live');
    expect(snapshot.currentSource).toBe('LIVE');
    expect(snapshot.fallbackToLive).toBe(true);
  });

  test('telemetry emits selection and mismatch diagnostics', () => {
    rideShadowProjectionManager.start();
    rideShadowProjectionManager.processEvent(createRideRequestedEvent({
      rideId: 'ride-coord-1',
      customer: { userId: 'customer-1', role: 'customer' },
      pickup: { address: 'Pickup', latitude: -1.95, longitude: 30.06 },
      destination: { address: 'Destination', latitude: -1.96, longitude: 30.07 },
      requestedVehicleType: 'moto',
    }, {
      eventId: 'event-coord-1',
      correlationId: 'correlation-coord-1',
      causationId: 'command-coord-1',
      sequenceNumber: 1,
      timestamp: '2026-06-30T10:00:00.000Z',
      producer: 'test',
    }));

    const wrapper = ({ children }: { children: React.ReactNode }) => <RideProvider>{children}</RideProvider>;
    renderHook(() => useProjectionCoordinator(), { wrapper });

    expect(observability.metrics.getPoints().map(point => point.name)).toEqual(expect.arrayContaining([
      'ride.projection.source',
      'ride.projection.compared',
    ]));
    expect(observability.logger.getLogs().map(log => log.message)).toEqual(expect.arrayContaining([
      'RideProjectionSourceSelected',
    ]));
  });

  test('projected unavailable falls back to live and marks diagnostics', () => {
    const snapshot = rideProjectionCoordinator.createSnapshot({
      activeRide: null,
      rideHistory: [],
      driverRequests: [],
    }, null);

    expect(snapshot.projected).toBeNull();
    expect(snapshot.source).toBe('live');
    expect(snapshot.currentSource).toBe('LIVE');
    expect(snapshot.projectedAvailable).toBe(false);
  });

  test('no RideProvider mutation or query cache mutation', () => {
    const client = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => <RideProvider>{children}</RideProvider>;
    const { result } = renderHook(() => {
      const ride = useRide();
      const diagnostics = useRideProjectionDiagnostics();
      return { ride, diagnostics };
    }, { wrapper });

    const beforeRide = result.current.ride.currentRide;
    const beforeHistory = result.current.ride.rideHistory;
    const beforePending = result.current.ride.pendingRequest;
    const beforeQueries = client.getQueryCache().getAll();

    expect(result.current.ride.currentRide).toBe(beforeRide);
    expect(result.current.ride.rideHistory).toBe(beforeHistory);
    expect(result.current.ride.pendingRequest).toBe(beforePending);
    expect(client.getQueryCache().getAll()).toEqual(beforeQueries);
    expect(result.current.diagnostics.currentSource).toBe('LIVE');
  });

  test('feature flags remain production-safe', () => {
    expect(ENABLE_RIDE_PROJECTION_COORDINATION).toBe(process.env.NODE_ENV !== 'production');
  });
});
