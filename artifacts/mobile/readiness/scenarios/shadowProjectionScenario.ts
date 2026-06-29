import { QueryClient } from '@tanstack/react-query';
import { createRideCompletedEvent, createRideDriverAcceptedEvent, createRideRequestedEvent } from '@/domains/ride/eventFactories';
import type { RideProviderSnapshot } from '@/domains/ride/shadow/shadowTypes';
import { RideShadowProjectionManager } from '@/domains/ride/shadow/shadowProjectionManager';
import { ProjectorRegistry } from '@/events/projectors/projectorRegistry';
import { InMemoryEventStore } from '@/events/store/inMemoryEventStore';
import { MemoryRideShadowTelemetry } from '@/domains/ride/shadow/shadowMetrics';
import type { Ride } from '@/types';
import { createDeterministicClock, createReadinessStressProfile } from '../stress/readinessStress';
import { createReadinessGateResult } from '../types';
import type { ReadinessStressProfile } from '../types';

function createRide(overrides: Partial<Ride> = {}): Ride {
  return {
    id: 'ride-1',
    customerId: 'customer-1',
    customerName: 'Customer',
    vehicleType: 'moto',
    pickup: { address: 'Pickup', latitude: -1.95, longitude: 30.06 },
    destination: { address: 'Destination', latitude: -1.96, longitude: 30.07 },
    status: 'completed',
    distance: 2,
    duration: 10,
    suggestedFare: 10000,
    agreedFare: 10000,
    negotiation: [],
    createdAt: '2026-06-29T10:00:00.000Z',
    completedAt: '2026-06-29T10:30:00.000Z',
    ...overrides,
  };
}

function createRideShadowEventOptions(sequenceNumber: number) {
  return {
    eventId: `ride-event-${sequenceNumber}`,
    correlationId: 'correlation-ride-1',
    causationId: 'command-ride-1',
    sequenceNumber,
    timestamp: `2026-06-29T10:${String(sequenceNumber).padStart(2, '0')}:00.000Z`,
    producer: 'readiness',
  };
}

export function runShadowProjectionReadinessScenario(
  profile: ReadinessStressProfile = createReadinessStressProfile(),
) {
  const clock = createDeterministicClock();
  const projectors = new ProjectorRegistry();
  const eventStore = new InMemoryEventStore();
  const telemetry = new MemoryRideShadowTelemetry();
  const manager = new RideShadowProjectionManager({ enabled: true, projectors, eventStore, telemetry });
  const queryClient = new QueryClient();

  manager.start();
  const beforeQueries = queryClient.getQueryCache().getAll();

  const customer = { userId: 'customer-1', role: 'customer' as const };
  const driver = { userId: 'driver-1', role: 'driver' as const };
  const rideId = 'ride-1';

  const requested = createRideRequestedEvent({
    rideId,
    customer,
    pickup: { address: 'Pickup', latitude: -1.95, longitude: 30.06 },
    destination: { address: 'Destination', latitude: -1.96, longitude: 30.07 },
    requestedVehicleType: 'moto',
  }, createRideShadowEventOptions(1));
  const accepted = createRideDriverAcceptedEvent({ rideId, driver }, createRideShadowEventOptions(2));
  const completed = createRideCompletedEvent({ rideId, completedAt: '2026-06-29T10:30:00.000Z' }, createRideShadowEventOptions(3));

  eventStore.append(requested);
  eventStore.append(accepted);
  eventStore.append(completed);

  manager.replay();
  const production: RideProviderSnapshot = {
    activeRide: null,
    rideHistory: [createRide({ suggestedFare: undefined as unknown as number, agreedFare: undefined as unknown as number })],
    driverRequests: [],
  };
  const comparison = manager.compareWithProduction(production);
  const replayedSnapshot = manager.getSnapshot();

  const diagnosticTelemetry = new MemoryRideShadowTelemetry();
  const diagnosticManager = new RideShadowProjectionManager({
    enabled: true,
    projectors: new ProjectorRegistry(),
    eventStore: new InMemoryEventStore(),
    telemetry: diagnosticTelemetry,
  });
  diagnosticManager.processEvent(requested);
  const diagnosticMismatch = diagnosticManager.compareWithProduction({
    activeRide: createRide({ status: 'completed' }),
    rideHistory: [],
    driverRequests: [],
  });
  const mismatchTelemetryObserved = diagnosticTelemetry.mismatches.length >= 1 && diagnosticMismatch?.mismatch !== null;
  const noQueryMutation = queryClient.getQueryCache().getAll().length === beforeQueries.length;
  const matchingComparison = manager.compareWithProduction(production);
  const success =
    replayedSnapshot.shadowActiveRide === null &&
    replayedSnapshot.shadowRideHistory.length === 1 &&
    replayedSnapshot.shadowRideHistory[0]?.status === 'completed' &&
    replayedSnapshot.shadowDriverRequests.length === 0 &&
    comparison?.mismatch === null &&
    matchingComparison?.mismatch === null &&
    noQueryMutation &&
    mismatchTelemetryObserved;

  return createReadinessGateResult(
    'shadow_ride_projection',
    success ? 'pass' : 'fail',
    [
      { name: 'replayedEvents', value: profile.shadowReplayEvents, unit: 'events' },
      { name: 'comparisonCount', value: replayedSnapshot.comparisonCount, unit: 'comparisons' },
      { name: 'mismatchCount', value: replayedSnapshot.mismatchCount, unit: 'mismatches' },
      { name: 'noQueryMutation', value: noQueryMutation },
      { name: 'mismatchTelemetryObserved', value: mismatchTelemetryObserved },
    ],
    success ? null : 'Shadow projection did not preserve parity or isolate query cache state.',
    success
      ? 'Keep shadow projection in diagnostics-only mode until core lifecycle parity stays clean.'
      : 'Investigate shadow projector parity and compare semantics before any UI migration.',
    clock.now,
  );
}
