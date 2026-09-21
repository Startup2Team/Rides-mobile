import * as intercity from '../intercity';

interface RecordedCall {
  method: string;
  path: string;
  options?: { body?: Record<string, unknown>; query?: Record<string, unknown> };
}

const mockCalls: RecordedCall[] = [];
let mockNextResponse: { data: { data: unknown } } = { data: { data: {} } };

jest.mock('@/data/remote/client/appBackendClient', () => ({
  getAppBackendClient: () => ({
    get: (path: string, options?: RecordedCall['options']) => {
      mockCalls.push({ method: 'GET', path, options });
      return Promise.resolve(mockNextResponse);
    },
    post: (path: string, options?: RecordedCall['options']) => {
      mockCalls.push({ method: 'POST', path, options });
      return Promise.resolve(mockNextResponse);
    },
    delete: (path: string, options?: RecordedCall['options']) => {
      mockCalls.push({ method: 'DELETE', path, options });
      return Promise.resolve(mockNextResponse);
    },
  }),
}));

const TRIP_DTO = {
  id: 'trip-1',
  corridor: 'KGL_MUS',
  origin_name: 'Kigali',
  destination_name: 'Musanze',
  operator_display_name: 'Volcano Express',
  vehicle_label: 'Coaster',
  plate_number: 'RAC 123 A',
  staging_address: 'Nyabugogo gate 3',
  depart_at: '2026-09-22T06:30:00.000Z',
  total_seats: 18,
  booked_seats: 11,
  held_seats: 2,
  price_per_seat_rwf: 4500,
  status: 'OPEN',
};

beforeEach(() => {
  mockCalls.length = 0;
  mockNextResponse = { data: { data: {} } };
});

describe('intercity trip mapping', () => {
  test('remaining seats are total minus booked minus held', () => {
    expect(intercity.mapTrip(TRIP_DTO).remainingSeats).toBe(5);
  });

  test('a server-computed remaining_seats wins over the derivation', () => {
    expect(intercity.mapTrip({ ...TRIP_DTO, remaining_seats: 3 }).remainingSeats).toBe(3);
  });

  test('sellable_seats is NEVER read — it would leak a rival operator credit balance', () => {
    const leaky = { ...TRIP_DTO, sellable_seats: 1 } as typeof TRIP_DTO;
    const trip = intercity.mapTrip(leaky);
    expect(trip.remainingSeats).toBe(5);
    expect(JSON.stringify(trip)).not.toMatch(/sellable/i);
    expect(Object.keys(trip)).not.toContain('sellableSeats');
  });

  test('remaining seats can never be negative or exceed capacity, whatever the server sends', () => {
    expect(intercity.deriveRemainingSeats({ ...TRIP_DTO, booked_seats: 30 })).toBe(0);
    expect(intercity.deriveRemainingSeats({ ...TRIP_DTO, remaining_seats: 99 })).toBe(18);
    expect(intercity.deriveRemainingSeats({ ...TRIP_DTO, remaining_seats: -4 })).toBe(0);
  });

  test('missing counters degrade to a full vehicle rather than NaN', () => {
    const sparse = {
      id: 't',
      corridor: 'c',
      origin_name: 'a',
      destination_name: 'b',
      staging_address: 's',
      depart_at: '2026-09-22T06:30:00.000Z',
      total_seats: 4,
      price_per_seat_rwf: 2000,
      status: 'OPEN',
    };
    expect(intercity.mapTrip(sparse).remainingSeats).toBe(4);
  });

  test('an unknown status degrades to OPEN instead of rendering a raw enum', () => {
    expect(intercity.mapTrip({ ...TRIP_DTO, status: 'WAT' }).status).toBe('OPEN');
  });

  test('prices are truncated to integer RWF', () => {
    expect(intercity.mapTrip({ ...TRIP_DTO, price_per_seat_rwf: 4500.9 }).pricePerSeatRwf).toBe(4500);
  });
});

describe('intercity customer endpoints', () => {
  test('search sends corridor, date and seats as query params', async () => {
    mockNextResponse = { data: { data: [TRIP_DTO] } };
    const trips = await intercity.searchTrips({ corridor: 'KGL_MUS', date: '2026-09-22', seats: 2 });
    expect(mockCalls[0]).toMatchObject({ method: 'GET', path: '/v1/customer/intercity/trips' });
    expect(mockCalls[0].options?.query).toEqual({ corridor: 'KGL_MUS', date: '2026-09-22', seats: 2 });
    expect(trips).toHaveLength(1);
    expect(trips[0].remainingSeats).toBe(5);
  });

  test('a null list is an empty list, not a crash', async () => {
    mockNextResponse = { data: { data: null } };
    await expect(intercity.searchTrips({ corridor: 'c', date: 'd', seats: 1 })).resolves.toEqual([]);
    await expect(intercity.listBookings()).resolves.toEqual([]);
    await expect(intercity.listCorridors()).resolves.toEqual([]);
  });

  test('hold sends an idempotency key so a replayed request cannot take seats twice', async () => {
    mockNextResponse = {
      data: {
        data: {
          id: 'b1',
          trip_id: 'trip-1',
          seats: 2,
          status: 'HELD',
          price_per_seat_rwf: 4500,
          hold_expires_at: '2026-09-22T06:05:00.000Z',
          created_at: '2026-09-22T06:00:00.000Z',
        },
      },
    };
    const booking = await intercity.holdSeats({ tripId: 'trip-1', seats: 2 });
    expect(mockCalls[0]).toMatchObject({ method: 'POST', path: '/v1/customer/intercity/trips/trip-1/hold' });
    expect(mockCalls[0].options?.body).toMatchObject({ seats: 2 });
    expect(typeof mockCalls[0].options?.body?.idempotency_key).toBe('string');
    expect(booking.status).toBe('HELD');
    expect(booking.holdExpiresAt).toBe('2026-09-22T06:05:00.000Z');
  });

  test('a caller-supplied idempotency key is used verbatim', async () => {
    mockNextResponse = {
      data: { data: { id: 'b1', trip_id: 't', seats: 1, status: 'HELD', price_per_seat_rwf: 1, created_at: 'x' } },
    };
    await intercity.holdSeats({ tripId: 't', seats: 1, idempotencyKey: 'attempt-42' });
    expect(mockCalls[0].options?.body?.idempotency_key).toBe('attempt-42');
  });

  test('confirm and cancel address the booking, never the trip', async () => {
    mockNextResponse = {
      data: { data: { id: 'b1', trip_id: 't', seats: 1, status: 'CONFIRMED', price_per_seat_rwf: 1, created_at: 'x' } },
    };
    await intercity.confirmBooking('b1');
    await intercity.cancelBooking('b1');
    expect(mockCalls[0]).toMatchObject({ method: 'POST', path: '/v1/customer/intercity/bookings/b1/confirm' });
    expect(mockCalls[1]).toMatchObject({ method: 'DELETE', path: '/v1/customer/intercity/bookings/b1' });
  });
});

describe('intercity driver endpoints', () => {
  test('publish sends integer seats and price and never a driver id from the client', async () => {
    mockNextResponse = { data: { data: TRIP_DTO } };
    await intercity.publishTrip({
      corridor: 'KGL_MUS',
      vehicleId: 'veh-1',
      departAt: '2026-09-22T06:30:00.000Z',
      totalSeats: 18.7,
      pricePerSeatRwf: 4500.4,
      stagingAddress: '  Nyabugogo gate 3  ',
    });
    const body = mockCalls[0].options?.body ?? {};
    expect(mockCalls[0]).toMatchObject({ method: 'POST', path: '/v1/driver/intercity/trips' });
    expect(body).toMatchObject({
      corridor: 'KGL_MUS',
      vehicle_id: 'veh-1',
      total_seats: 18,
      price_per_seat_rwf: 4500,
      staging_address: 'Nyabugogo gate 3',
    });
    expect(body).not.toHaveProperty('driver_id');
    expect(body).not.toHaveProperty('operator_id');
  });

  test('board and no-show scope the booking to the trip in the path', async () => {
    mockNextResponse = { data: { data: {} } };
    await intercity.boardPassenger('trip-1', 'b1');
    await intercity.markNoShow('trip-1', 'b1');
    expect(mockCalls[0]).toMatchObject({ method: 'POST', path: '/v1/driver/intercity/trips/trip-1/board' });
    expect(mockCalls[0].options?.body).toEqual({ booking_id: 'b1' });
    expect(mockCalls[1]).toMatchObject({ method: 'POST', path: '/v1/driver/intercity/trips/trip-1/no-show' });
  });

  test('cancelling a trip always carries a reason', async () => {
    mockNextResponse = { data: { data: {} } };
    await intercity.cancelTrip('trip-1', '  breakdown  ');
    expect(mockCalls[0]).toMatchObject({ method: 'DELETE', path: '/v1/driver/intercity/trips/trip-1' });
    expect(mockCalls[0].options?.body).toEqual({ cancel_reason: 'breakdown' });
  });

  test('the manifest derives seats sold from live bookings when the server omits it', async () => {
    mockNextResponse = {
      data: {
        data: {
          trip: TRIP_DTO,
          passengers: [
            { booking_id: 'b1', first_name: 'Alice', phone: '07•• ••• •42', seats: 2, status: 'CONFIRMED' },
            { booking_id: 'b2', first_name: 'Bob', phone: '+250788000042', phone_masked: false, seats: 1, status: 'BOARDED' },
            { booking_id: 'b3', first_name: 'Eve', seats: 3, status: 'CANCELLED' },
          ],
        },
      },
    };
    const manifest = await intercity.getManifest('trip-1');
    expect(mockCalls[0]).toMatchObject({ method: 'GET', path: '/v1/driver/intercity/trips/trip-1/manifest' });
    expect(manifest.seatsSold).toBe(3);
    // A masked number is flagged masked even when the server forgets the flag,
    // so the UI never offers it as a callable number.
    expect(manifest.passengers[0].phoneMasked).toBe(true);
    expect(manifest.passengers[1].phoneMasked).toBe(false);
    expect(manifest.passengers[2].phone).toBeNull();
  });

  test('a passenger with no name still renders a row', async () => {
    mockNextResponse = {
      data: { data: { trip: TRIP_DTO, seats_sold: 1, passengers: [{ booking_id: 'b9', seats: 1, status: 'CONFIRMED' }] } },
    };
    const manifest = await intercity.getManifest('trip-1');
    expect(manifest.passengers[0].firstName).toBe('Passenger');
  });
});
