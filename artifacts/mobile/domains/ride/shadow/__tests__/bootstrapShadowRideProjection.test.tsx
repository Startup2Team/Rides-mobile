import { QueryClient } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';
import React from 'react';
import { RideProvider, useRide } from '@/context/RideContext';
import { createRideRequestedEvent } from '../../eventFactories';

const originalNodeEnv = process.env.NODE_ENV;
const environment = process.env as Record<string, string | undefined>;

let cleanup: (() => void) | undefined;

function loadShadowBootstrap(nodeEnv: 'development' | 'test' | 'production' = 'test') {
  environment.NODE_ENV = nodeEnv;
  jest.resetModules();

  const bootstrap = require('../bootstrapShadowRideProjection') as typeof import('../bootstrapShadowRideProjection');
  const shadowManager = require('../shadowProjectionManager') as typeof import('../shadowProjectionManager');
  const observabilityModule = require('@/observability/context/observabilityContext') as typeof import('@/observability/context/observabilityContext');

  cleanup = () => {
    bootstrap.resetShadowRideProjection();
    observabilityModule.resetObservabilityForTests();
  };

  return {
    ...bootstrap,
    rideShadowProjectionManager: shadowManager.rideShadowProjectionManager,
    observability: observabilityModule.observability,
  };
}

describe('bootstrap shadow ride projection', () => {
  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    environment.NODE_ENV = originalNodeEnv;
    jest.resetModules();
  });

  test('starts only when enabled', () => {
    const { bootstrapShadowRideProjection, observability, rideShadowProjectionManager } = loadShadowBootstrap('test');

    const snapshot = bootstrapShadowRideProjection();

    expect(snapshot.running).toBe(true);
    expect(rideShadowProjectionManager.getSnapshot().running).toBe(true);
    expect(rideShadowProjectionManager.getSnapshot().shadowRideHistory).toEqual([]);
    expect(rideShadowProjectionManager.getSnapshot().shadowDriverRequests).toEqual([]);
    expect(observability.logger.getLogs().map(log => log.message)).toEqual(expect.arrayContaining([
      'RideShadowProjectionStarted',
      'RideShadowProjectorRegistered',
    ]));
    expect(observability.metrics.getPoints().map(point => point.name)).toEqual(expect.arrayContaining([
      'ride.shadow_projection.started',
      'ride.shadow_projection.projector_registered',
    ]));
  });

  test('does not start in production', () => {
    const { bootstrapShadowRideProjection, observability, rideShadowProjectionManager } = loadShadowBootstrap('production');

    const snapshot = bootstrapShadowRideProjection();

    expect(snapshot.running).toBe(false);
    expect(rideShadowProjectionManager.getSnapshot().running).toBe(false);
    expect(rideShadowProjectionManager.getSnapshot().shadowRideHistory).toEqual([]);
    expect(observability.logger.getLogs()).toEqual([]);
    expect(observability.metrics.getPoints()).toEqual([]);
  });

  test('is idempotent and does not double-register on duplicate calls', () => {
    const { bootstrapShadowRideProjection, observability, rideShadowProjectionManager } = loadShadowBootstrap('test');

    bootstrapShadowRideProjection();
    bootstrapShadowRideProjection();

    expect(rideShadowProjectionManager.getSnapshot().running).toBe(true);
    expect(rideShadowProjectionManager.getSnapshot().enabled).toBe(true);
    expect(rideShadowProjectionManager.getSnapshot().shadowRideHistory).toEqual([]);
    expect(rideShadowProjectionManager.getSnapshot().shadowDriverRequests).toEqual([]);
    expect(observability.logger.getLogs().filter(log => log.message === 'RideShadowProjectionStarted')).toHaveLength(1);
    expect(observability.logger.getLogs().filter(log => log.message === 'RideShadowProjectorRegistered')).toHaveLength(3);
  });

  test('stop and reset clear the bootstrap state', () => {
    const {
      bootstrapShadowRideProjection,
      stopShadowRideProjection,
      resetShadowRideProjection,
      getShadowRideProjectionBootstrapState,
      observability,
      rideShadowProjectionManager,
    } = loadShadowBootstrap('test');

    bootstrapShadowRideProjection();
    expect(getShadowRideProjectionBootstrapState().started).toBe(true);

    stopShadowRideProjection();
    expect(rideShadowProjectionManager.getSnapshot().running).toBe(false);
    expect(observability.logger.getLogs().some(log => log.message === 'RideShadowProjectionStopped')).toBe(true);

    resetShadowRideProjection();
    expect(getShadowRideProjectionBootstrapState().started).toBe(false);
    expect(rideShadowProjectionManager.getSnapshot().running).toBe(false);
    expect(rideShadowProjectionManager.getSnapshot().shadowRideHistory).toEqual([]);
  });

  test('does not mutate RideProvider state or query cache', () => {
    const { bootstrapShadowRideProjection } = loadShadowBootstrap('test');
    const client = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => <RideProvider>{children}</RideProvider>;

    const { result } = renderHook(() => useRide(), { wrapper });
    const beforeRide = result.current.currentRide;
    const beforeHistory = result.current.rideHistory;
    const beforePending = result.current.pendingRequest;
    const beforeQueries = client.getQueryCache().getAll();

    bootstrapShadowRideProjection();

    expect(result.current.currentRide).toBe(beforeRide);
    expect(result.current.rideHistory).toBe(beforeHistory);
    expect(result.current.pendingRequest).toBe(beforePending);
    expect(client.getQueryCache().getAll()).toEqual(beforeQueries);
  });

  test('emits telemetry for replay, mismatch, and start lifecycle', () => {
    const { bootstrapShadowRideProjection, observability, rideShadowProjectionManager } = loadShadowBootstrap('test');

    bootstrapShadowRideProjection();
    rideShadowProjectionManager.processEvent(createRideRequestedEvent({
      rideId: 'ride-telemetry-1',
      customer: { userId: 'customer-1', role: 'customer' },
      pickup: { address: 'Pickup', latitude: -1.95, longitude: 30.06 },
      destination: { address: 'Destination', latitude: -1.96, longitude: 30.07 },
      requestedVehicleType: 'moto',
    }, {
      eventId: 'event-telemetry-1',
      correlationId: 'correlation-telemetry-1',
      causationId: 'command-telemetry-1',
      sequenceNumber: 1,
      timestamp: '2026-06-29T10:00:00.000Z',
      producer: 'test',
    }));
    rideShadowProjectionManager.compareWithProduction({
      activeRide: null,
      rideHistory: [],
      driverRequests: [],
    });
    rideShadowProjectionManager.replay({
      activeRide: null,
      rideHistory: [],
      driverRequests: [],
    });

    expect(observability.logger.getLogs().map(log => log.message)).toEqual(expect.arrayContaining([
      'RideShadowProjectionStarted',
      'RideShadowProjectorRegistered',
      'RideShadowReplayCompleted',
    ]));
    expect(observability.logger.getLogs().some(log => log.message === 'RideProjectionMismatch')).toBe(true);
    expect(observability.metrics.getPoints().map(point => point.name)).toEqual(expect.arrayContaining([
      'ride.shadow_projection.started',
      'ride.shadow_projection.projector_registered',
      'ride.shadow_projection.replay',
      'ride.shadow_projection.mismatch',
    ]));
  });
});
