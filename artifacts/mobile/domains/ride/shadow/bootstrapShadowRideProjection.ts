import { observability } from '@/observability/context/observabilityContext';
import { rideShadowProjectionManager } from './shadowProjectionManager';
import { ENABLE_SHADOW_RIDE_PROJECTION } from './shadowTypes';

declare global {
  // eslint-disable-next-line no-var
  var __ridesMobileShadowRideProjectionBootstrap__: {
    started: boolean;
  } | undefined;
}

function getBootstrapState() {
  if (!globalThis.__ridesMobileShadowRideProjectionBootstrap__) {
    globalThis.__ridesMobileShadowRideProjectionBootstrap__ = {
      started: false,
    };
  }

  return globalThis.__ridesMobileShadowRideProjectionBootstrap__;
}

function recordProjectorRegistration(projectorId: string) {
  observability.logger.info('RideShadowProjectorRegistered', { projectorId });
  observability.metrics.counter('ride.shadow_projection.projector_registered', 1, {
    projectorId,
  });
}

export function bootstrapShadowRideProjection() {
  const state = getBootstrapState();
  const snapshot = rideShadowProjectionManager.getSnapshot();

  if (process.env.NODE_ENV === 'production' || !ENABLE_SHADOW_RIDE_PROJECTION) {
    state.started = false;
    return snapshot;
  }

  if (state.started || snapshot.running) {
    state.started = true;
    return snapshot;
  }

  state.started = true;
  const startedSnapshot = rideShadowProjectionManager.start();

  observability.logger.info('RideShadowProjectionStarted', {
    enabled: startedSnapshot.enabled,
    running: startedSnapshot.running,
  });
  observability.metrics.counter('ride.shadow_projection.started');
  recordProjectorRegistration('ride.shadow.activeRideProjector');
  recordProjectorRegistration('ride.shadow.rideHistoryProjector');
  recordProjectorRegistration('ride.shadow.driverRequestProjector');

  return startedSnapshot;
}

export function stopShadowRideProjection() {
  const state = getBootstrapState();
  state.started = false;

  const stoppedSnapshot = rideShadowProjectionManager.stop();

  if (process.env.NODE_ENV !== 'production') {
    observability.logger.info('RideShadowProjectionStopped', {
      running: stoppedSnapshot.running,
    });
    observability.metrics.counter('ride.shadow_projection.stopped');
  }

  return stoppedSnapshot;
}

export function resetShadowRideProjection() {
  const state = getBootstrapState();
  state.started = false;

  const stoppedSnapshot = rideShadowProjectionManager.stop();
  const resetSnapshot = rideShadowProjectionManager.reset();

  if (process.env.NODE_ENV !== 'production') {
    observability.logger.info('RideShadowProjectionReset', {
      running: stoppedSnapshot.running,
    });
  }

  return resetSnapshot;
}

export function getShadowRideProjectionBootstrapState() {
  return {
    ...getBootstrapState(),
    running: rideShadowProjectionManager.getSnapshot().running,
  };
}
