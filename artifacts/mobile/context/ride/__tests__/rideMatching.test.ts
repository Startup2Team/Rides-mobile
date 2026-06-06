import {
  buildInitialDriverOffer,
  buildInitialNegotiationMessages,
  buildMockRideRequest,
  pickMockDriver,
} from '../rideMatching';

describe('mock ride matching', () => {
  test('selects a mock driver matching the requested vehicle type', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);

    expect(pickMockDriver('cab').vehicleType).toBe('cab');
  });

  test('adds the generic destination prompt only when a location is generic', () => {
    const precise = { latitude: -1.94, longitude: 30.06, address: 'Precise', locationType: 'precise' as const };
    const generic = { latitude: -1.95, longitude: 30.08, address: 'Kigali', locationType: 'generic' as const };

    expect(buildInitialNegotiationMessages(precise, precise)).toEqual([]);
    expect(buildInitialNegotiationMessages(precise, generic)[0]).toEqual(expect.objectContaining({
      sender: 'system',
      text: 'My destination is Kigali. Please let me know your price.',
    }));
  });

  test('builds the existing mock incoming ride request values', () => {
    const request = buildMockRideRequest();

    expect(request).toEqual(expect.objectContaining({
      customerId: 'mock_customer',
      vehicleType: 'moto',
      status: 'searching',
    }));
    expect(request.suggestedFare).toBeGreaterThan(0);
  });

  test('builds a deterministic initial driver offer when randomness is fixed', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);

    expect(buildInitialDriverOffer('moto', 2)).toEqual(expect.objectContaining({
      sender: 'driver',
      amount: 900,
    }));
  });
});
