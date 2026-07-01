import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { renderHook } from '@testing-library/react-native';
import React from 'react';
import {
  createAcceptRideCommand,
  createCancelRideCommand,
  createCompleteRideCommand,
  createDeclineRideCommand,
  createRequestRideCommand,
  createStartRideCommand,
  createSubmitRatingCommand,
} from '../commandCreators';
import {
  createRideDriverAcceptedEvent,
  createRideDriverArrivedEvent,
  createRideDriverEnRouteEvent,
  createRideDriverOfferedEvent,
  createRideCancelledEvent,
  createRideCompletedEvent,
  createRideFareFinalizedEvent,
  createRideMatchingStartedEvent,
  createRidePaymentAuthorizedEvent,
  createRidePaymentCompletedEvent,
  createRideRatingSubmittedEvent,
  createRideRequestedEvent,
  createRideStartedEvent,
  createRideTimeoutEvent,
} from '../eventFactories';
import { rideEventTypes } from '../events';
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

const pickup = { address: 'Kimironko', latitude: -1.9, longitude: 30.1, locationType: 'precise' as const };
const destination = { address: 'Kigali', latitude: -1.95, longitude: 30.06, locationType: 'precise' as const };
const eventPickup = { address: 'Kimironko', latitude: -1.9, longitude: 30.1 };
const eventDestination = { address: 'Kigali', latitude: -1.95, longitude: 30.06 };
const customer = { userId: 'customer-1', role: 'customer' as const };
const driver = { userId: 'driver-1', role: 'driver' as const };

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <RideProvider>{children}</RideProvider>
);

function commandOptions(overrides = {}) {
  return {
    actorId: 'customer-1',
    actorRole: 'customer' as const,
    correlationId: 'correlation-1',
    timestamp: '2026-06-29T10:00:00.000Z',
    idFactory: jest.fn()
      .mockReturnValueOnce('command-1')
      .mockReturnValueOnce('command-2'),
    ...overrides,
  };
}

function eventOptions(overrides = {}) {
  return {
    sequenceNumber: 1,
    correlationId: 'correlation-1',
    causationId: 'command-1',
    timestamp: '2026-06-29T10:00:01.000Z',
    idFactory: () => 'event-1',
    producer: 'mobile-test',
    ...overrides,
  };
}

describe('ride command creators and event factories', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    (SecureStore as typeof SecureStore & { __clear: () => void }).__clear();
  });

  test('command ids are unique and commands include required metadata', () => {
    const options = commandOptions();
    const first = createRequestRideCommand({
      rideId: 'ride-1',
      pickup,
      destination,
      vehicleType: 'moto',
    }, options);
    const second = createCancelRideCommand({
      rideId: 'ride-1',
      reason: 'customer_before_acceptance',
    }, options);

    expect(first.commandId).toBe('command-1');
    expect(second.commandId).toBe('command-2');
    expect(first).toMatchObject({
      idempotencyKey: 'ride:ride-1:request:customer-1',
      correlationId: 'correlation-1',
      actorId: 'customer-1',
      actorRole: 'customer',
      timestamp: '2026-06-29T10:00:00.000Z',
    });
  });

  test('idempotency keys are stable for equivalent commands', () => {
    const first = createRequestRideCommand({
      rideId: 'ride-1',
      pickup,
      destination,
      vehicleType: 'moto',
    }, commandOptions({ idFactory: () => 'command-a' }));
    const second = createRequestRideCommand({
      rideId: 'ride-1',
      pickup,
      destination,
      vehicleType: 'moto',
    }, commandOptions({ idFactory: () => 'command-b' }));

    expect(first.commandId).not.toBe(second.commandId);
    expect(first.idempotencyKey).toBe(second.idempotencyKey);
  });

  test('actor role rules are enforced for command creators', () => {
    expect(() => createAcceptRideCommand({
      rideId: 'ride-1',
      driverId: 'driver-1',
    }, commandOptions())).toThrow('actorRole must be one of: driver');

    expect(createAcceptRideCommand({
      rideId: 'ride-1',
      driverId: 'driver-1',
    }, commandOptions({ actorId: 'driver-1', actorRole: 'driver', idFactory: () => 'command-driver' }))).toMatchObject({
      actorRole: 'driver',
      idempotencyKey: 'ride:ride-1:accept:driver-1',
    });
  });

  test('invalid command payloads fail safely', () => {
    expect(() => createRequestRideCommand({
      rideId: '',
      pickup,
      destination,
      vehicleType: 'moto',
    }, commandOptions())).toThrow('rideId is required');

    expect(() => createSubmitRatingCommand({
      rideId: 'ride-1',
      rating: 6,
    }, commandOptions())).toThrow('rating must be an integer from 1 to 5');
  });

  test('all command helpers construct valid command metadata', () => {
    expect(createDeclineRideCommand({ rideId: 'ride-1', driverId: 'driver-1' }, commandOptions({
      actorId: 'driver-1',
      actorRole: 'driver',
      idFactory: () => 'decline-command',
    }))).toMatchObject({ commandId: 'decline-command', actorRole: 'driver' });
    expect(createStartRideCommand({ rideId: 'ride-1', startedAt: '2026-06-29T10:05:00.000Z' }, commandOptions({
      actorId: 'driver-1',
      actorRole: 'driver',
      idFactory: () => 'start-command',
    }))).toMatchObject({ commandId: 'start-command' });
    expect(createCompleteRideCommand({ rideId: 'ride-1', completedAt: '2026-06-29T10:30:00.000Z' }, commandOptions({
      actorId: 'driver-1',
      actorRole: 'driver',
      idFactory: () => 'complete-command',
    }))).toMatchObject({ commandId: 'complete-command' });
    expect(createSubmitRatingCommand({ rideId: 'ride-1', rating: 5 }, commandOptions({
      actorId: 'driver-1',
      actorRole: 'driver',
      idFactory: () => 'rating-command',
    }))).toMatchObject({ commandId: 'rating-command' });
    expect(createStartRideCommand({ rideId: 'ride-1', startedAt: '2026-06-29T10:05:00.000Z' }, commandOptions({
      actorId: 'system',
      actorRole: 'system',
      idFactory: () => 'system-start-command',
    }))).toMatchObject({ commandId: 'system-start-command', actorRole: 'system' });
  });

  test('correlation IDs flow from command to event', () => {
    const command = createRequestRideCommand({
      rideId: 'ride-1',
      pickup,
      destination,
      vehicleType: 'moto',
    }, commandOptions({ idFactory: () => 'command-1' }));

    const event = createRideRequestedEvent({
      rideId: 'ride-1',
      customer,
      pickup: eventPickup,
      destination: eventDestination,
      requestedVehicleType: 'moto',
    }, eventOptions({ correlationId: command.correlationId, causationId: command.commandId }));

    expect(event).toMatchObject({
      eventId: 'event-1',
      aggregateId: 'ride-1',
      aggregateType: 'ride',
      eventType: rideEventTypes.requested,
      eventVersion: 1,
      sequenceNumber: 1,
      correlationId: command.correlationId,
      causationId: command.commandId,
      producer: 'mobile-test',
    });
  });

  test('event sequence is required and invalid payloads fail safely', () => {
    expect(() => createRideMatchingStartedEvent({
      rideId: 'ride-1',
      matchingStartedAt: '2026-06-29T10:00:00.000Z',
      requestedVehicleType: 'moto',
    }, eventOptions({ sequenceNumber: 0 }))).toThrow('sequenceNumber must be a positive integer');

    expect(() => createRideRequestedEvent({
      rideId: 'ride-1',
      customer,
      pickup: { address: '', latitude: -1.9, longitude: 30.1 },
      destination: eventDestination,
      requestedVehicleType: 'moto',
    }, eventOptions())).toThrow('pickup.address is required');
  });

  test('all event factories construct expected event types', () => {
    const base = eventOptions();
    const events = [
      createRideMatchingStartedEvent({ rideId: 'ride-1', matchingStartedAt: '2026-06-29T10:00:00.000Z', requestedVehicleType: 'moto' }, base),
      createRideDriverOfferedEvent({ rideId: 'ride-1', driver }, base),
      createRideDriverAcceptedEvent({ rideId: 'ride-1', driver }, base),
      createRideDriverEnRouteEvent({ rideId: 'ride-1', driverId: 'driver-1' }, base),
      createRideDriverArrivedEvent({ rideId: 'ride-1', driverId: 'driver-1', arrivedAt: '2026-06-29T10:10:00.000Z' }, base),
      createRideStartedEvent({ rideId: 'ride-1', startedAt: '2026-06-29T10:12:00.000Z' }, base),
      createRideCompletedEvent({ rideId: 'ride-1', completedAt: '2026-06-29T10:30:00.000Z' }, base),
      createRideCancelledEvent({ rideId: 'ride-1', cancelledBy: 'customer', reason: 'changed_mind', cancelledAt: '2026-06-29T10:01:00.000Z' }, base),
      createRideTimeoutEvent({ rideId: 'ride-1', reason: 'no_driver_found', timedOutAt: '2026-06-29T10:05:00.000Z' }, base),
      createRideFareFinalizedEvent({ rideId: 'ride-1', fare: { amount: 1500, currency: 'RWF', source: 'final' } }, base),
      createRidePaymentAuthorizedEvent({ rideId: 'ride-1', paymentId: 'payment-1', amount: 1500, currency: 'RWF' }, base),
      createRidePaymentCompletedEvent({ rideId: 'ride-1', paymentId: 'payment-1', amount: 1500, currency: 'RWF', completedAt: '2026-06-29T10:31:00.000Z' }, base),
      createRideRatingSubmittedEvent({ rideId: 'ride-1', rating: 5, submittedBy: 'customer', submittedAt: '2026-06-29T10:35:00.000Z' }, base),
    ];

    expect(events.map(event => event.eventType)).toEqual([
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
    expect(events.every(event => event.aggregateId === 'ride-1' && event.aggregateType === 'ride')).toBe(true);
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
