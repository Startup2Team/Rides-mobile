import {
  acceptLatestCustomerOffer,
  acceptLatestDriverOffer,
  addCustomerCounterOffer,
  addCustomerTextMessage,
  addDriverOffer,
  addDriverTextMessage,
  respondToCustomerCounterOffer,
  setNegotiationMessageDeliveryStatus,
} from '../rideNegotiation';
import { createOffer, createRide } from './rideTestFactory';

describe('ride negotiation transitions', () => {
  test('adds a customer counter offer without mutating the existing ride', () => {
    const ride = createRide();

    const updated = addCustomerCounterOffer(ride, 1000);

    expect(updated).not.toBe(ride);
    expect(ride.negotiation).toHaveLength(0);
    expect(updated?.negotiation).toEqual([
      expect.objectContaining({ sender: 'customer', type: 'offer', amount: 1000 }),
    ]);
  });

  test('enforces the three-offer limit for both customer and driver', () => {
    const customerOffers = [1, 2, 3].map(index => createOffer('customer', 900 + index, `c-${index}`));
    const driverOffers = [1, 2, 3].map(index => createOffer('driver', 1200 + index, `d-${index}`));

    const customerLimitedRide = createRide({ negotiation: customerOffers });
    const driverLimitedRide = createRide({ negotiation: driverOffers });

    expect(addCustomerCounterOffer(customerLimitedRide, 1000)).toBe(customerLimitedRide);
    expect(addDriverOffer(driverLimitedRide, 1300)).toBe(driverLimitedRide);
  });

  test('accepts a qualifying customer counter offer and confirms the ride', () => {
    const ride = createRide({ suggestedFare: 1000 });

    const updated = respondToCustomerCounterOffer(ride, 850);

    expect(updated).toEqual(expect.objectContaining({
      status: 'confirmed',
      agreedFare: 850,
    }));
    expect(updated?.negotiation.at(-1)).toEqual(expect.objectContaining({
      sender: 'driver',
      amount: 850,
      isFinal: true,
    }));
  });

  test('creates a driver counter offer when the customer offer is not accepted', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.1);
    const ride = createRide({ suggestedFare: 1200 });

    const updated = respondToCustomerCounterOffer(ride, 700);

    expect(updated?.status).toBe('negotiating');
    expect(updated?.negotiation.at(-1)).toEqual(expect.objectContaining({
      sender: 'driver',
      amount: 800,
    }));
  });

  test('accepts the latest offer from either participant', () => {
    const ride = createRide({
      negotiation: [
        createOffer('driver', 1300, 'd-1'),
        createOffer('customer', 1100, 'c-1'),
        createOffer('driver', 1200, 'd-2'),
      ],
    });

    expect(acceptLatestDriverOffer(ride)).toEqual(expect.objectContaining({
      status: 'confirmed',
      agreedFare: 1200,
    }));
    expect(acceptLatestCustomerOffer(ride)).toEqual(expect.objectContaining({
      status: 'confirmed',
      agreedFare: 1100,
    }));
  });

  // NEG-1: customer text messaging during negotiation (was unwired in the UI).
  test('appends a customer text message while negotiating, tagged pending', () => {
    const ride = createRide();

    const updated = addCustomerTextMessage(ride, '  can you come to the gate?  ');

    expect(updated?.negotiation).toHaveLength(ride.negotiation.length + 1);
    const last = updated?.negotiation[updated.negotiation.length - 1];
    expect(last).toEqual(
      expect.objectContaining({
        sender: 'customer',
        type: 'text',
        text: 'can you come to the gate?',
        deliveryStatus: 'pending',
      }),
    );
  });

  test('does not append an empty/whitespace-only text message', () => {
    const ride = createRide();
    expect(addCustomerTextMessage(ride, '   ')).toBe(ride);
  });

  test('does not append a text message when the ride is not negotiating', () => {
    const ride = createRide({ status: 'confirmed' });
    expect(addCustomerTextMessage(ride, 'hi')).toBe(ride);
  });

  // Driver-side twin — was dead code before the driver input was wired up.
  test('appends a driver text message while negotiating, tagged pending', () => {
    const ride = createRide();

    const updated = addDriverTextMessage(ride, '  on my way to the pin  ');

    expect(updated?.negotiation).toHaveLength(ride.negotiation.length + 1);
    const last = updated?.negotiation[updated.negotiation.length - 1];
    expect(last).toEqual(
      expect.objectContaining({
        sender: 'driver',
        type: 'text',
        text: 'on my way to the pin',
        deliveryStatus: 'pending',
      }),
    );
  });

  test('does not append a driver text message when the ride is not negotiating', () => {
    const ride = createRide({ status: 'confirmed' });
    expect(addDriverTextMessage(ride, 'hi')).toBe(ride);
  });

  // Retry must reuse the SAME bubble, not append a second one (review finding
  // #3): passing the same id back in replaces the message in place.
  test('addCustomerTextMessage reuses an existing id in place instead of duplicating it', () => {
    const ride = createRide();
    const firstAttempt = addCustomerTextMessage(ride, 'are you close?', 'msg-1');
    expect(firstAttempt?.negotiation).toHaveLength(1);

    const failed = setNegotiationMessageDeliveryStatus(firstAttempt, 'msg-1', 'failed');
    const retried = addCustomerTextMessage(failed, 'are you close?', 'msg-1');

    expect(retried?.negotiation).toHaveLength(1);
    expect(retried?.negotiation[0]).toEqual(
      expect.objectContaining({ id: 'msg-1', deliveryStatus: 'pending', text: 'are you close?' }),
    );
  });

  test('setNegotiationMessageDeliveryStatus updates the matching message only', () => {
    const ride = addCustomerTextMessage(createRide(), 'hello', 'msg-1');

    const sent = setNegotiationMessageDeliveryStatus(ride, 'msg-1', 'sent');
    expect(sent?.negotiation[0]).toEqual(expect.objectContaining({ id: 'msg-1', deliveryStatus: 'sent' }));

    const failed = setNegotiationMessageDeliveryStatus(ride, 'msg-1', 'failed');
    expect(failed?.negotiation[0]).toEqual(expect.objectContaining({ id: 'msg-1', deliveryStatus: 'failed' }));

    // Unknown id: no-op, same reference back.
    expect(setNegotiationMessageDeliveryStatus(ride, 'does-not-exist', 'sent')).toBe(ride);
  });
});
