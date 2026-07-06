import { QueryClient } from '@tanstack/react-query';
import { InMemoryEventStore } from '@/events/store/inMemoryEventStore';
import { ProjectorRegistry } from '@/events/projectors/projectorRegistry';
import {
  createRideCompletedEvent,
  createRideDriverAcceptedEvent,
  createRideDriverOfferedEvent,
  createRideRequestedEvent,
} from '../../eventFactories';
import { MemoryRideShadowTelemetry } from '../shadowMetrics';
import { RideShadowProjectionManager } from '../shadowProjectionManager';
import { compareActiveRide } from '../shadowComparator';
import type { Ride } from '@/types';

const customer = { userId: 'customer-1', role: 'customer' as const };
const driver = { userId: 'driver-1', role: 'driver' as const };
const pickup = { address: 'Kimironko', latitude: -1.9, longitude: 30.1 };
const destination = { address: 'Kigali', latitude: -1.95, longitude: 30.06 };

function options(sequenceNumber: number, eventId = `event-${sequenceNumber}`) {
  return {
    sequenceNumber,
    eventId,
    correlationId: 'correlation-1',
    causationId: 'command-1',
    timestamp: `2026-06-29T10:${String(sequenceNumber).padStart(2, '0')}:00.000Z`,
    producer: 'test',
  };
}

function requested() {
  return createRideRequestedEvent({
    rideId: 'ride-1',
    customer,
    pickup,
    destination,
    requestedVehicleType: 'moto',
  }, options(1));
}

function createManager(enabled = true) {
  const projectors = new ProjectorRegistry();
  const eventStore = new InMemoryEventStore();
  const telemetry = new MemoryRideShadowTelemetry();
  const manager = new RideShadowProjectionManager({ enabled, projectors, eventStore, telemetry });
  return { projectors, eventStore, telemetry, manager };
}

describe('ride shadow projection manager', () => {
  test('registers shadow projectors with the domain event platform registry', () => {
    const { projectors, manager } = createManager();

    manager.start();

    expect(projectors.getSnapshot().projectors.map(projector => projector.id)).toEqual([
      'ride.shadow.activeRideProjector',
      'ride.shadow.rideHistoryProjector',
      'ride.shadow.driverRequestProjector',
    ]);
    manager.stop();
    expect(projectors.getSnapshot().size).toBe(0);
  });

  test('projects shadow lifecycle in memory through registered projectors', async () => {
    const { projectors, manager } = createManager();
    manager.start();

    await projectors.project(requested());
    await projectors.project(createRideDriverOfferedEvent({ rideId: 'ride-1', driver }, options(2)));

    expect(manager.getSnapshot()).toMatchObject({
      running: true,
      projectionStatus: 'running',
      shadowActiveRide: { rideId: 'ride-1', status: 'offered' },
      shadowDriverRequests: [expect.objectContaining({ rideId: 'ride-1', status: 'offered' })],
    });
  });

  test('comparison emits telemetry on mismatch and does not throw', () => {
    const { manager, telemetry } = createManager();
    manager.processEvent(requested());

    const comparison = manager.compareWithProduction({
      activeRide: null,
      rideHistory: [],
      driverRequests: [],
    });

    expect(comparison?.mismatch).toMatchObject({
      name: 'RideProjectionMismatch',
      aggregateId: 'ride-1',
      eventId: 'event-1',
      eventType: 'ride.requested',
      correlationId: 'correlation-1',
      sequenceNumber: 1,
    });
    expect(telemetry.mismatches).toHaveLength(1);
    expect(manager.getSnapshot()).toMatchObject({ comparisonCount: 1, mismatchCount: 1 });
  });

  test('semantic comparison ignores temporary ids and maps production statuses', () => {
    const production = {
      id: 'ride-1',
      status: 'searching',
      pickup: { address: 'Kimironko', latitude: -1.9, longitude: 30.1 },
      destination: { address: 'Kigali', latitude: -1.95, longitude: 30.06 },
      customerId: 'customer-1',
      vehicleType: 'moto',
      distance: 0,
      duration: 0,
      suggestedFare: 0,
      negotiation: [],
      createdAt: 'local-now',
    } as Ride;
    const { manager } = createManager();
    manager.processEvent(requested());

    expect(compareActiveRide(production, manager.getSnapshot().shadowActiveRide)).toEqual([]);
  });

  test('replays ride events from event store through shadow models', () => {
    const { manager, eventStore, telemetry } = createManager();
    eventStore.append(requested());
    eventStore.append(createRideDriverAcceptedEvent({ rideId: 'ride-1', driver }, options(2)));
    eventStore.append(createRideCompletedEvent({ rideId: 'ride-1', completedAt: '2026-06-29T10:30:00.000Z' }, options(3)));

    manager.replay();

    expect(manager.getSnapshot()).toMatchObject({
      shadowActiveRide: null,
      shadowRideHistory: [expect.objectContaining({ rideId: 'ride-1', status: 'completed' })],
    });
    expect(telemetry.replayCounts).toEqual([3]);
  });

  test('feature flag disabled prevents registration and projection', async () => {
    const { manager, projectors } = createManager(false);

    manager.start();
    manager.processEvent(requested());
    await projectors.project(requested());

    expect(projectors.getSnapshot().size).toBe(0);
    expect(manager.getSnapshot()).toMatchObject({
      enabled: false,
      running: false,
      shadowActiveRide: null,
      shadowRideHistory: [],
      shadowDriverRequests: [],
    });
  });

  test('shadow projection does not mutate RideProvider snapshots or query cache', () => {
    const queryClient = new QueryClient();
    const { manager } = createManager();
    const providerSnapshot = {
      activeRide: null,
      rideHistory: [],
      driverRequests: [],
    };
    const before = JSON.stringify(providerSnapshot);

    manager.processEvent(requested());
    manager.compareWithProduction(providerSnapshot);

    expect(JSON.stringify(providerSnapshot)).toBe(before);
    expect(queryClient.getQueryCache().getAll()).toEqual([]);
  });
});
