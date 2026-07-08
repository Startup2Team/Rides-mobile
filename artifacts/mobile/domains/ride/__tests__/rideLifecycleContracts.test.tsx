import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { renderHook } from '@testing-library/react-native';
import React from 'react';
import type { RequestRideCommand } from '../commands';
import { rideCommandFlow } from '../commandHandlers';
import { rideEventTypes, type RideRequestedEvent } from '../events';
import {
  activeRideProjector,
  driverRequestProjector,
  rideHistoryProjector,
} from '../projectors';
import type { ActiveRideReadModel, DriverRideRequestReadModel, RideHistoryReadModel } from '../readModels';
import { RideProvider, useRide } from '@/context/ride/RideProvider';

jest.mock('@/utils/driverProfileImage', () => ({
  buildDriverWithUploadedPhoto: jest.fn(async driver => driver),
}));

jest.mock('@/context/AuthContext', () => ({
  useOptionalAuth: () => null,
}));

jest.mock('@/context/DriverEntitlementContext', () => ({
  useOptionalDriverEntitlement: () => null,
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <RideProvider>{children}</RideProvider>
);

describe('ride lifecycle contracts', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    (SecureStore as typeof SecureStore & { __clear: () => void }).__clear();
  });

  test('ride command shapes include required production metadata', () => {
    const command: RequestRideCommand = {
      commandId: 'command-1',
      idempotencyKey: 'request:ride-1',
      correlationId: 'correlation-1',
      actorId: 'customer-1',
      actorRole: 'customer',
      timestamp: '2026-06-29T10:00:00.000Z',
      payload: {
        rideId: 'ride-1',
        pickup: { address: 'Kimironko', latitude: -1.9, longitude: 30.1, locationType: 'precise' },
        destination: { address: 'Kigali', latitude: -1.95, longitude: 30.06, locationType: 'precise' },
        vehicleType: 'moto',
      },
    };

    expect(command).toMatchObject({
      commandId: 'command-1',
      idempotencyKey: 'request:ride-1',
      correlationId: 'correlation-1',
      actorRole: 'customer',
      payload: { rideId: 'ride-1' },
    });
  });

  test('ride event constants map to production event types', () => {
    expect(Object.values(rideEventTypes)).toEqual([
      'ride.requested',
      'ride.matching.started',
      'ride.driver.offered',
      'ride.driver.accepted',
      'ride.driver.en_route',
      'ride.driver.arrived',
      'ride.started',
      'ride.completed',
      'ride.cancelled',
      'ride.timeout',
      'ride.fare.finalized',
      'ride.payment.authorized',
      'ride.payment.completed',
      'ride.rating.submitted',
    ]);

    const event: RideRequestedEvent = {
      eventId: 'event-1',
      aggregateId: 'ride-1',
      aggregateType: 'ride',
      eventType: rideEventTypes.requested,
      eventVersion: 1,
      sequenceNumber: 1,
      timestamp: '2026-06-29T10:00:00.000Z',
      correlationId: 'correlation-1',
      causationId: 'command-1',
      producer: 'mobile',
      payload: {
        rideId: 'ride-1',
        customer: { userId: 'customer-1', role: 'customer' },
        pickup: { address: 'Kimironko', latitude: -1.9, longitude: 30.1 },
        destination: { address: 'Kigali', latitude: -1.95, longitude: 30.06 },
        requestedVehicleType: 'moto',
      },
    };

    expect(event).toMatchObject({ aggregateId: 'ride-1', aggregateType: 'ride', eventType: 'ride.requested' });
  });

  test('read model contracts are exportable', () => {
    const active: ActiveRideReadModel = {
      rideId: 'ride-1',
      status: 'requested',
      phase: 'pre_match',
      customer: { userId: 'customer-1', role: 'customer' },
      pickup: { address: 'Kimironko', latitude: -1.9, longitude: 30.1 },
      destination: { address: 'Kigali', latitude: -1.95, longitude: 30.06 },
      updatedAt: '2026-06-29T10:00:00.000Z',
      sequenceNumber: 1,
      projection: { appliedEventIds: ['event-1'] },
    };
    const history: RideHistoryReadModel = {
      ...active,
      status: 'completed',
      requestedAt: '2026-06-29T10:00:00.000Z',
    };
    const request: DriverRideRequestReadModel = {
      rideId: 'ride-1',
      status: 'offered',
      customer: active.customer,
      pickup: active.pickup,
      destination: active.destination,
      sequenceNumber: 2,
      projection: { appliedEventIds: ['event-2'] },
    };

    expect(active.rideId).toBe('ride-1');
    expect(history.status).toBe('completed');
    expect(request.status).toBe('offered');
  });

  test('projector and command handler blueprints are exported but not wired', () => {
    expect(activeRideProjector.id).toBe('ride.activeRideProjector');
    expect(rideHistoryProjector.eventTypes).toBe('*');
    expect(driverRequestProjector.eventTypes).toBe('*');
    expect(rideCommandFlow).toEqual([
      'ui',
      'command_creator',
      'offline_mutation_engine',
      'repository',
      'backend',
      'realtime_event',
      'domain_event_platform',
      'projector',
      'tanstack_query_cache',
      'ui',
    ]);
  });

  test('current RideProvider initial behavior remains unchanged', () => {
    const { result } = renderHook(() => useRide(), { wrapper });

    expect(result.current.currentRide).toBeNull();
    expect(result.current.rideHistory).toEqual([]);
    expect(result.current.driverLocation).toBeNull();
    expect(result.current.pendingRequest).toBeNull();
    expect(result.current.isMatchingPaused).toBe(false);
  });
});
