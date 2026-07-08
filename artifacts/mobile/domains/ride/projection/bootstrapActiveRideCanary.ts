import React, { useEffect, useRef } from 'react';
import { useRide } from '@/context/RideContext';
import { observability } from '@/observability/context/observabilityContext';
import type { Ride } from '@/types';
import { resolveProjectedActiveRide } from './activeRideCanary';
import type { RideShadowSnapshot } from '../shadow/shadowTypes';

const DEFAULT_DIAGNOSTICS_INTERVAL_MS = 30_000;

type ActiveRideGetter = () => Ride | null;
type ShadowSnapshotGetter = () => RideShadowSnapshot | null;

interface ActiveRideCanaryDiagnosticsBootstrapState {
  started: boolean;
  timer: ReturnType<typeof setInterval> | null;
  intervalMs: number;
  liveRideGetter: ActiveRideGetter | null;
  shadowSnapshotGetter: ShadowSnapshotGetter | null;
  lastTickAt: string | null;
  lastResult: ReturnType<typeof resolveProjectedActiveRide> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __ridesMobileActiveRideCanaryDiagnosticsBootstrap__: ActiveRideCanaryDiagnosticsBootstrapState | undefined;
}

export interface ActiveRideCanaryDiagnosticsOptions {
  liveRideGetter?: ActiveRideGetter;
  shadowSnapshotGetter?: ShadowSnapshotGetter;
  intervalMs?: number;
}

export interface ActiveRideCanaryDiagnosticsSnapshot {
  enabled: boolean;
  started: boolean;
  running: boolean;
  intervalMs: number;
  lastTickAt: string | null;
  lastResult: ReturnType<typeof resolveProjectedActiveRide> | null;
}

function getBootstrapState(): ActiveRideCanaryDiagnosticsBootstrapState {
  if (!globalThis.__ridesMobileActiveRideCanaryDiagnosticsBootstrap__) {
    globalThis.__ridesMobileActiveRideCanaryDiagnosticsBootstrap__ = {
      started: false,
      timer: null,
      intervalMs: DEFAULT_DIAGNOSTICS_INTERVAL_MS,
      liveRideGetter: null,
      shadowSnapshotGetter: null,
      lastTickAt: null,
      lastResult: null,
    };
  }

  return globalThis.__ridesMobileActiveRideCanaryDiagnosticsBootstrap__;
}

function isDiagnosticsAllowed() {
  return process.env.NODE_ENV !== 'production'
    && process.env.ENABLE_PROJECTED_ACTIVE_RIDE_CANARY === 'true'
    && process.env.USE_PROJECTED_RIDE_READ_MODEL === 'true';
}

function clearTimer(state: ActiveRideCanaryDiagnosticsBootstrapState) {
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
}

function recordDiagnosticsTick(result: ReturnType<typeof resolveProjectedActiveRide>) {
  observability.metrics.counter('ride.active.canary.diagnostics_tick', 1, {
    source: result.source,
    fallback: String(result.fallback),
    stale: String(result.stale),
    readinessDenied: String(result.readinessDenied),
  });
  observability.logger.info('RideActiveRideCanaryDiagnosticsTick', {
    source: result.source,
    fallback: result.fallback,
    stale: result.stale,
    readinessDenied: result.readinessDenied,
  });

  if (result.readinessDenied) {
    observability.metrics.counter('ride.active.canary.diagnostics_fallback', 1, {
      reason: 'readiness-denied',
    });
    observability.logger.info('RideActiveRideCanaryDiagnosticsFallback', {
      reason: 'readiness-denied',
    });
  }
}

function runDiagnosticsTick(state: ActiveRideCanaryDiagnosticsBootstrapState) {
  if (!isDiagnosticsAllowed()) return null;

  const liveRide = state.liveRideGetter?.() ?? null;
  if (!liveRide) {
    observability.metrics.counter('ride.active.canary.diagnostics_skipped', 1, {
      reason: 'live-ride-unavailable',
    });
    observability.logger.info('RideActiveRideCanaryDiagnosticsSkipped', {
      reason: 'live-ride-unavailable',
    });
    return null;
  }

  try {
    const result = resolveProjectedActiveRide(liveRide, {
      canaryEnabled: process.env.ENABLE_PROJECTED_ACTIVE_RIDE_CANARY === 'true',
      useProjectedRideReadModel: process.env.USE_PROJECTED_RIDE_READ_MODEL === 'true',
      shadowSnapshot: state.shadowSnapshotGetter?.() ?? undefined,
    });

    state.lastTickAt = new Date().toISOString();
    state.lastResult = result;
    recordDiagnosticsTick(result);
    return result;
  } catch (error) {
    observability.metrics.counter('ride.active.canary.diagnostics_failed', 1, {
      reason: 'unexpected-error',
    });
    observability.logger.warn('RideActiveRideCanaryDiagnosticsFailed', {
      reason: 'unexpected-error',
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export function bootstrapActiveRideCanaryDiagnostics(options: ActiveRideCanaryDiagnosticsOptions = {}): ActiveRideCanaryDiagnosticsSnapshot {
  const state = getBootstrapState();

  if (!isDiagnosticsAllowed()) {
    clearTimer(state);
    state.started = false;
    return getActiveRideCanaryDiagnosticsState();
  }

  state.intervalMs = options.intervalMs ?? state.intervalMs ?? DEFAULT_DIAGNOSTICS_INTERVAL_MS;
  if (options.liveRideGetter) {
    state.liveRideGetter = options.liveRideGetter;
  }
  if (options.shadowSnapshotGetter) {
    state.shadowSnapshotGetter = options.shadowSnapshotGetter;
  }

  if (!state.started) {
    state.started = true;
    observability.metrics.counter('ride.active.canary.diagnostics_started', 1);
    observability.logger.info('RideActiveRideCanaryDiagnosticsStarted', {
      intervalMs: state.intervalMs,
    });
  }

  if (!state.timer) {
    runDiagnosticsTick(state);
    state.timer = setInterval(() => {
      runDiagnosticsTick(state);
    }, state.intervalMs);
  }

  return getActiveRideCanaryDiagnosticsState();
}

export function stopActiveRideCanaryDiagnostics() {
  const state = getBootstrapState();
  clearTimer(state);
  state.started = false;
  observability.metrics.counter('ride.active.canary.diagnostics_stopped', 1);
  observability.logger.info('RideActiveRideCanaryDiagnosticsStopped', {});
  return getActiveRideCanaryDiagnosticsState();
}

export function resetActiveRideCanaryDiagnosticsForTests() {
  const state = getBootstrapState();
  clearTimer(state);
  state.started = false;
  state.liveRideGetter = null;
  state.shadowSnapshotGetter = null;
  state.lastTickAt = null;
  state.lastResult = null;
  observability.metrics.counter('ride.active.canary.diagnostics_reset', 1);
  observability.logger.info('RideActiveRideCanaryDiagnosticsReset', {});
  return getActiveRideCanaryDiagnosticsState();
}

export function getActiveRideCanaryDiagnosticsState(): ActiveRideCanaryDiagnosticsSnapshot {
  const state = getBootstrapState();
  return {
    enabled: isDiagnosticsAllowed(),
    started: state.started,
    running: state.timer !== null,
    intervalMs: state.intervalMs,
    lastTickAt: state.lastTickAt,
    lastResult: state.lastResult,
  };
}

function ActiveRideCanaryDiagnosticsBridge() {
  const { currentRide } = useRide();
  const liveRideRef = useRef<Ride | null>(currentRide);

  useEffect(() => {
    liveRideRef.current = currentRide;
  }, [currentRide]);

  useEffect(() => {
    bootstrapActiveRideCanaryDiagnostics({
      liveRideGetter: () => liveRideRef.current,
    });

    return () => {
      stopActiveRideCanaryDiagnostics();
    };
  }, []);

  return null;
}

export function ActiveRideCanaryDiagnosticsBootstrapper() {
  if (!isDiagnosticsAllowed()) return null;
  return React.createElement(ActiveRideCanaryDiagnosticsBridge);
}
