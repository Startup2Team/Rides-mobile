import {
  acceptLatestCustomerOffer,
  acceptLatestDriverOffer,
  addCustomerCounterOffer,
  addCustomerTextMessage,
  addDriverOffer,
  respondToCustomerCounterOffer,
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
  test('appends a customer text message while negotiating', () => {
    const ride = createRide();

    const updated = addCustomerTextMessage(ride, '  can you come to the gate?  ');

    expect(updated?.negotiation).toHaveLength(ride.negotiation.length + 1);
    const last = updated?.negotiation[updated.negotiation.length - 1];
    expect(last).toEqual(
      expect.objectContaining({ sender: 'customer', type: 'text', text: 'can you come to the gate?' }),
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
});
