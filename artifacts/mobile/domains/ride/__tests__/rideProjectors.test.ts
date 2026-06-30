import {
  projectActiveRideEvent,
  projectDriverRequestEvent,
  projectRideHistoryEvent,
} from '../projectors';
import {
  createRideCancelledEvent,
  createRideCompletedEvent,
  createRideDriverAcceptedEvent,
  createRideDriverArrivedEvent,
  createRideDriverEnRouteEvent,
  createRideDriverOfferedEvent,
  createRideFareFinalizedEvent,
  createRideMatchingStartedEvent,
  createRidePaymentAuthorizedEvent,
  createRidePaymentCompletedEvent,
  createRideRatingSubmittedEvent,
  createRideRequestedEvent,
  createRideStartedEvent,
  createRideTimeoutEvent,
} from '../eventFactories';
import type { ActiveRideReadModel, DriverRideRequestReadModel, RideHistoryReadModel } from '../readModels';

const customer = { userId: 'customer-1', role: 'customer' as const };
const driver = { userId: 'driver-1', role: 'driver' as const };
const pickup = { address: 'Kimironko', latitude: -1.9, longitude: 30.1 };
const destination = { address: 'Kigali', latitude: -1.95, longitude: 30.06 };
const fare = { amount: 1500, currency: 'RWF', source: 'final' as const, finalizedAt: '2026-06-29T10:31:00.000Z' };

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

function requested(sequenceNumber = 1, rideId = 'ride-1') {
  return createRideRequestedEvent({
    rideId,
    customer,
    pickup,
    destination,
    requestedVehicleType: 'moto',
  }, options(sequenceNumber));
}

describe('ride projectors', () => {
  test('projects full happy path active ride lifecycle until completion clears active ride', () => {
    let active: ActiveRideReadModel | null = null;

    active = projectActiveRideEvent(active, requested());
    active = projectActiveRideEvent(active, createRideMatchingStartedEvent({
      rideId: 'ride-1',
      matchingStartedAt: '2026-06-29T10:02:00.000Z',
      requestedVehicleType: 'moto',
    }, options(2)));
    active = projectActiveRideEvent(active, createRideDriverOfferedEvent({ rideId: 'ride-1', driver }, options(3)));
    active = projectActiveRideEvent(active, createRideDriverAcceptedEvent({ rideId: 'ride-1', driver }, options(4)));
    active = projectActiveRideEvent(active, createRideDriverEnRouteEvent({ rideId: 'ride-1', driverId: 'driver-1' }, options(5)));
    active = projectActiveRideEvent(active, createRideDriverArrivedEvent({
      rideId: 'ride-1',
      driverId: 'driver-1',
      arrivedAt: '2026-06-29T10:06:00.000Z',
    }, options(6)));
    active = projectActiveRideEvent(active, createRideStartedEvent({ rideId: 'ride-1', startedAt: '2026-06-29T10:07:00.000Z' }, options(7)));

    expect(active).toMatchObject({
      rideId: 'ride-1',
      status: 'started',
      phase: 'active',
      driver,
      sequenceNumber: 7,
    });

    active = projectActiveRideEvent(active, createRideCompletedEvent({ rideId: 'ride-1', completedAt: '2026-06-29T10:30:00.000Z' }, options(8)));
    expect(active).toBeNull();
  });

  test('projects cancellations before and after driver acceptance as terminal active states', () => {
    const beforeAccepted = projectActiveRideEvent(
      projectActiveRideEvent(null, requested()),
      createRideCancelledEvent({
        rideId: 'ride-1',
        cancelledBy: 'customer',
        reason: 'customer_before_acceptance',
        cancelledAt: '2026-06-29T10:02:00.000Z',
      }, options(2)),
    );
    expect(beforeAccepted).toBeNull();

    let afterAccepted = projectActiveRideEvent(null, requested());
    afterAccepted = projectActiveRideEvent(afterAccepted, createRideDriverAcceptedEvent({ rideId: 'ride-1', driver }, options(2)));
    afterAccepted = projectActiveRideEvent(afterAccepted, createRideCancelledEvent({
      rideId: 'ride-1',
      cancelledBy: 'customer',
      reason: 'customer_after_acceptance',
      cancelledAt: '2026-06-29T10:03:00.000Z',
    }, options(3)));
    expect(afterAccepted).toBeNull();
  });

  test('projects timeout/no driver found as terminal active state', () => {
    const active = projectActiveRideEvent(
      projectActiveRideEvent(null, requested()),
      createRideTimeoutEvent({
        rideId: 'ride-1',
        reason: 'no_driver_found',
        timedOutAt: '2026-06-29T10:05:00.000Z',
      }, options(2)),
    );

    expect(active).toBeNull();
  });

  test('history projects completion, fare, payment, and rating without mutating input', () => {
    const original: RideHistoryReadModel[] = [];
    let history = projectRideHistoryEvent(original, requested());
    history = projectRideHistoryEvent(history, createRideDriverAcceptedEvent({ rideId: 'ride-1', driver }, options(2)));
    history = projectRideHistoryEvent(history, createRideCompletedEvent({
      rideId: 'ride-1',
      completedAt: '2026-06-29T10:30:00.000Z',
    }, options(3)));
    history = projectRideHistoryEvent(history, createRideFareFinalizedEvent({ rideId: 'ride-1', fare }, options(4)));
    history = projectRideHistoryEvent(history, createRidePaymentAuthorizedEvent({
      rideId: 'ride-1',
      paymentId: 'payment-1',
      amount: 1500,
      currency: 'RWF',
    }, options(5)));
    history = projectRideHistoryEvent(history, createRidePaymentCompletedEvent({
      rideId: 'ride-1',
      paymentId: 'payment-1',
      amount: 1500,
      currency: 'RWF',
      completedAt: '2026-06-29T10:31:00.000Z',
    }, options(6)));
    history = projectRideHistoryEvent(history, createRideRatingSubmittedEvent({
      rideId: 'ride-1',
      rating: 5,
      submittedBy: 'customer',
      submittedAt: '2026-06-29T10:32:00.000Z',
    }, options(7)));

    expect(original).toEqual([]);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      status: 'rating_submitted',
      driver,
      fare,
      paymentId: 'payment-1',
      paymentCompletedAt: '2026-06-29T10:31:00.000Z',
      rating: 5,
      sequenceNumber: 7,
    });
  });

  test('history creates item on completion and avoids duplicate events', () => {
    const completed = createRideCompletedEvent({
      rideId: 'ride-1',
      completedAt: '2026-06-29T10:30:00.000Z',
    }, options(1, 'completion-event'));
    const history = projectRideHistoryEvent([], completed);
    const duplicate = projectRideHistoryEvent(history, completed);

    expect(history).toHaveLength(1);
    expect(duplicate).toBe(history);
    expect(duplicate).toHaveLength(1);
  });

  test('stale sequence is ignored and input object is not mutated', () => {
    const active = projectActiveRideEvent(null, requested());
    const snapshot = JSON.stringify(active);
    const stale = createRideMatchingStartedEvent({
      rideId: 'ride-1',
      matchingStartedAt: '2026-06-29T10:00:00.000Z',
      requestedVehicleType: 'moto',
    }, options(1, 'stale-event'));

    const next = projectActiveRideEvent(active, stale);

    expect(next).toBe(active);
    expect(JSON.stringify(active)).toBe(snapshot);
  });

  test('driver request is created on offer and removed after accepted, cancelled, or timeout', () => {
    const offered = createRideDriverOfferedEvent({ rideId: 'ride-1', driver, offeredFare: fare }, options(1));
    let requests: DriverRideRequestReadModel[] = projectDriverRequestEvent([], offered);

    expect(requests).toEqual([
      expect.objectContaining({ rideId: 'ride-1', status: 'offered', offeredFare: fare }),
    ]);

    requests = projectDriverRequestEvent(requests, createRideDriverAcceptedEvent({ rideId: 'ride-1', driver }, options(2)));
    expect(requests).toEqual([]);

    const cancelled = projectDriverRequestEvent(
      projectDriverRequestEvent([], createRideDriverOfferedEvent({ rideId: 'ride-2', driver }, options(1, 'offer-2'))),
      createRideCancelledEvent({
        rideId: 'ride-2',
        cancelledBy: 'customer',
        reason: 'customer_before_acceptance',
        cancelledAt: '2026-06-29T10:02:00.000Z',
      }, options(2, 'cancel-2')),
    );
    expect(cancelled).toEqual([]);

    const timedOut = projectDriverRequestEvent(
      projectDriverRequestEvent([], createRideDriverOfferedEvent({ rideId: 'ride-3', driver }, options(1, 'offer-3'))),
      createRideTimeoutEvent({ rideId: 'ride-3', reason: 'no_driver_found', timedOutAt: '2026-06-29T10:05:00.000Z' }, options(2, 'timeout-3')),
    );
    expect(timedOut).toEqual([]);
  });

  test('driver request preserves route and customer summary when later offer omits them', () => {
    let requests = projectDriverRequestEvent([], requested());
    requests = projectDriverRequestEvent(requests, createRideDriverOfferedEvent({ rideId: 'ride-1', driver, offeredFare: fare }, options(2)));

    expect(requests[0]).toMatchObject({
      customer,
      pickup,
      destination,
      offeredFare: fare,
      status: 'offered',
    });
  });
});
