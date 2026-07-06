import { QueryClient } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import React from 'react';
import { RideProvider, useRide } from '@/context/RideContext';
import { observability, resetObservabilityForTests } from '@/observability/context/observabilityContext';
import type { Ride } from '@/types';
import { isReadyForActiveRideCanary, resetRideCanaryHealthForTests } from '../../canary/canaryHealth';
import {
  bootstrapActiveRideCanaryDiagnostics,
  getActiveRideCanaryDiagnosticsState,
  resetActiveRideCanaryDiagnosticsForTests,
  stopActiveRideCanaryDiagnostics,
} from '../bootstrapActiveRideCanary';

const originalNodeEnv = process.env.NODE_ENV;
const originalEnableProjectedActiveRideCanary = process.env.ENABLE_PROJECTED_ACTIVE_RIDE_CANARY;
const originalUseProjectedRideReadModel = process.env.USE_PROJECTED_RIDE_READ_MODEL;

const environment = process.env as Record<string, string | undefined>;

function setBootstrapEnvironment(
  nodeEnv: 'development' | 'test' | 'production',
  enabled: boolean,
  projectedReadModel: boolean,
) {
  environment.NODE_ENV = nodeEnv;
  environment.ENABLE_PROJECTED_ACTIVE_RIDE_CANARY = String(enabled);
  environment.USE_PROJECTED_RIDE_READ_MODEL = String(projectedReadModel);
}

function restoreBootstrapEnvironment() {
  if (originalNodeEnv === undefined) {
    delete environment.NODE_ENV;
  } else {
    environment.NODE_ENV = originalNodeEnv;
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
    id: 'ride-active-canary',
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

describe('bootstrap active ride canary diagnostics', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetActiveRideCanaryDiagnosticsForTests();
    resetRideCanaryHealthForTests();
    resetObservabilityForTests();
    setBootstrapEnvironment('test', false, false);
  });

  afterEach(() => {
    stopActiveRideCanaryDiagnostics();
    resetActiveRideCanaryDiagnosticsForTests();
    resetRideCanaryHealthForTests();
    resetObservabilityForTests();
    restoreBootstrapEnvironment();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('does not start in production', () => {
    setBootstrapEnvironment('production', true, true);

    const liveRide = createLiveRide();
    const snapshot = bootstrapActiveRideCanaryDiagnostics({
      liveRideGetter: () => liveRide,
      intervalMs: 1_000,
    });

    expect(snapshot.enabled).toBe(false);
    expect(snapshot.started).toBe(false);
    expect(snapshot.running).toBe(false);
    expect(observability.logger.getLogs()).toEqual([]);
    expect(observability.metrics.getPoints()).toEqual([]);
  });

  test('does not start when flags are disabled', () => {
    setBootstrapEnvironment('test', false, false);

    const liveRide = createLiveRide();
    const snapshot = bootstrapActiveRideCanaryDiagnostics({
      liveRideGetter: () => liveRide,
      intervalMs: 1_000,
    });

    expect(snapshot.enabled).toBe(false);
    expect(snapshot.started).toBe(false);
    expect(snapshot.running).toBe(false);
    expect(observability.logger.getLogs()).toEqual([]);
    expect(observability.metrics.getPoints()).toEqual([]);
  });

  test('starts when both flags are enabled in dev/test', () => {
    setBootstrapEnvironment('test', true, true);

    const liveRide = createLiveRide();
    const snapshot = bootstrapActiveRideCanaryDiagnostics({
      liveRideGetter: () => liveRide,
      intervalMs: 1_000,
    });

    expect(snapshot.enabled).toBe(true);
    expect(snapshot.started).toBe(true);
    expect(snapshot.running).toBe(true);
    expect(snapshot.lastResult?.source).toBe('live');
    expect(observability.logger.getLogs().map(log => log.message)).toEqual(expect.arrayContaining([
      'RideActiveRideCanaryDiagnosticsStarted',
      'RideActiveRideReadinessDenied',
      'RideActiveRideCanaryDiagnosticsTick',
      'RideActiveRideCanaryDiagnosticsFallback',
    ]));
  });

  test('is idempotent and does not duplicate timers during duplicate bootstrap calls', () => {
    setBootstrapEnvironment('test', true, true);
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const liveRide = createLiveRide();

    bootstrapActiveRideCanaryDiagnostics({
      liveRideGetter: () => liveRide,
      intervalMs: 1_000,
    });
    bootstrapActiveRideCanaryDiagnostics({
      liveRideGetter: () => liveRide,
      intervalMs: 1_000,
    });

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(observability.logger.getLogs().filter(log => log.message === 'RideActiveRideCanaryDiagnosticsStarted')).toHaveLength(1);
    expect(getActiveRideCanaryDiagnosticsState().running).toBe(true);
    setIntervalSpy.mockRestore();
  });

  test('stop and reset cleanup works', () => {
    setBootstrapEnvironment('test', true, true);
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    const liveRide = createLiveRide();

    bootstrapActiveRideCanaryDiagnostics({
      liveRideGetter: () => liveRide,
      intervalMs: 1_000,
    });
    expect(getActiveRideCanaryDiagnosticsState().running).toBe(true);

    stopActiveRideCanaryDiagnostics();
    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(getActiveRideCanaryDiagnosticsState().running).toBe(false);

    resetActiveRideCanaryDiagnosticsForTests();
    expect(getActiveRideCanaryDiagnosticsState().started).toBe(false);
    expect(getActiveRideCanaryDiagnosticsState().lastResult).toBeNull();
    clearIntervalSpy.mockRestore();
  });

  test('emits telemetry on diagnostics ticks and periodic comparison', () => {
    setBootstrapEnvironment('test', true, true);
    const liveRide = createLiveRide();

    bootstrapActiveRideCanaryDiagnostics({
      liveRideGetter: () => liveRide,
      intervalMs: 1_000,
    });

    expect(observability.logger.getLogs().map(log => log.message)).toEqual(expect.arrayContaining([
      'RideActiveRideCanaryDiagnosticsStarted',
      'RideActiveRideCanaryDiagnosticsTick',
      'RideActiveRideReadinessDenied',
      'RideActiveRideCanaryDiagnosticsFallback',
    ]));
    expect(getActiveRideCanaryDiagnosticsState().lastResult?.source).toBe('live');
    expect(getActiveRideCanaryDiagnosticsState().lastResult?.readinessDenied).toBe(true);

    act(() => {
      jest.advanceTimersByTime(1_000);
    });

    expect(observability.logger.getLogs().filter(log => log.message === 'RideActiveRideCanaryDiagnosticsTick')).toHaveLength(2);
    expect(observability.metrics.getPoints().map(point => point.name)).toEqual(expect.arrayContaining([
      'ride.active.canary.diagnostics_started',
      'ride.active.canary.diagnostics_tick',
      'ride.active.canary.diagnostics_fallback',
      'ride.active.canary.readiness_denied',
      'ride.active.source_selected',
      'ride.active.fallback',
    ]));
  });

  test('does not mutate RideProvider state or query cache', () => {
    setBootstrapEnvironment('test', true, true);
    const client = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => <RideProvider>{children}</RideProvider>;
    const { result } = renderHook(() => useRide(), { wrapper });

    const beforeRide = result.current.currentRide;
    const beforeHistory = result.current.rideHistory;
    const beforePending = result.current.pendingRequest;
    const beforeQueries = client.getQueryCache().getAll();

    bootstrapActiveRideCanaryDiagnostics({
      liveRideGetter: () => beforeRide,
      intervalMs: 1_000,
    });

    expect(result.current.currentRide).toBe(beforeRide);
    expect(result.current.rideHistory).toBe(beforeHistory);
    expect(result.current.pendingRequest).toBe(beforePending);
    expect(client.getQueryCache().getAll()).toEqual(beforeQueries);
  });

  test('readiness false keeps live fallback', () => {
    setBootstrapEnvironment('test', true, true);
    const liveRide = createLiveRide();

    const snapshot = bootstrapActiveRideCanaryDiagnostics({
      liveRideGetter: () => liveRide,
      intervalMs: 1_000,
    });

    expect(isReadyForActiveRideCanary()).toBe(false);
    expect(snapshot.lastResult?.source).toBe('live');
    expect(snapshot.lastResult?.activeRide).toBe(liveRide);
    expect(snapshot.lastResult?.fallback).toBe(true);
    expect(snapshot.lastResult?.readinessDenied).toBe(true);
  });
});
