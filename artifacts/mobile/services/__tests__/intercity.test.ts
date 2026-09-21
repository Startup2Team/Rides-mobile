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

// A VERBATIM intercity.TripView (internal/intercity/service.go). Every name
// here is the name the server actually sends; the client once invented
// `remaining_seats` / `vehicle_label` / `plate_number` / `driver_name`, which
// read `undefined` in silence. This fixture is the pin.
const TRIP_DTO = {
  id: 'trip-1',
  corridor: 'KGL_MUS',
  origin_name: 'Kigali',
  destination_name: 'Musanze',
  staging_address: 'Nyabugogo gate 3',
  depart_at: '2026-09-22T06:30:00.000Z',
  price_per_seat_rwf: 4500,
  total_seats: 18,
  seats_available: 5,
  max_seats_per_booking: 4,
  status: 'OPEN',
  driver_first_name: 'Jean',
  operator_name: 'Volcano Express',
  vehicle_type: 'COASTER',
  vehicle_plate: 'RAC 123 A',
};

// A VERBATIM intercity.BookingView — note there is no created_at, no
// boarded_at and no cancelled_at on the wire.
const BOOKING_DTO = {
  id: 'b1',
  trip_id: 'trip-1',
  seats: 2,
  status: 'HELD',
  price_per_seat_rwf: 4500,
  total_rwf: 9000,
  hold_expires_at: '2026-09-22T06:05:00.000Z',
};

beforeEach(() => {
  mockCalls.length = 0;
  mockNextResponse = { data: { data: {} } };
});

describe('intercity trip mapping', () => {
  test('remaining seats come from seats_available, the field the server sends', () => {
    expect(intercity.mapTrip(TRIP_DTO).remainingSeats).toBe(5);
  });

  // The bug that shipped: the client read `remaining_seats`, which the server
  // has never sent, and fell back to `total_seats` — so a SOLD OUT 18-seat
  // Coaster advertised 18 free seats.
  test('a sold-out coaster reads as sold out, never as a full vehicle', () => {
    expect(intercity.mapTrip({ ...TRIP_DTO, seats_available: 0 }).remainingSeats).toBe(0);
  });

  test('a missing seats_available degrades to zero, never to total_seats', () => {
    const { seats_available: _dropped, ...withoutSeats } = TRIP_DTO;
    expect(intercity.mapTrip(withoutSeats).remainingSeats).toBe(0);
  });

  test('the invented remaining_seats field is ignored entirely', () => {
    const legacy = { ...TRIP_DTO, seats_available: 2, remaining_seats: 17 } as typeof TRIP_DTO;
    expect(intercity.mapTrip(legacy).remainingSeats).toBe(2);
  });

  test('operator, vehicle, plate and driver come from the real field names', () => {
    const trip = intercity.mapTrip(TRIP_DTO);
    expect(trip.operatorName).toBe('Volcano Express');
    expect(trip.vehicleLabel).toBe('COASTER');
    expect(trip.plateNumber).toBe('RAC 123 A');
    expect(trip.driverName).toBe('Jean');
  });

  test('the server seat cap is carried through verbatim', () => {
    expect(intercity.mapTrip(TRIP_DTO).maxSeatsPerBooking).toBe(4);
    expect(intercity.mapTrip({ ...TRIP_DTO, max_seats_per_booking: 2 }).maxSeatsPerBooking).toBe(2);
    const { max_seats_per_booking: _dropped, ...withoutCap } = TRIP_DTO;
    expect(intercity.mapTrip(withoutCap).maxSeatsPerBooking).toBeNull();
  });

  test('sellable_seats is NEVER read — it would leak a rival operator credit balance', () => {
    const leaky = { ...TRIP_DTO, sellable_seats: 1 } as typeof TRIP_DTO;
    const trip = intercity.mapTrip(leaky);
    expect(trip.remainingSeats).toBe(5);
    expect(JSON.stringify(trip)).not.toMatch(/sellable/i);
    expect(Object.keys(trip)).not.toContain('sellableSeats');
  });

  test('remaining seats can never be negative or exceed capacity, whatever the server sends', () => {
    expect(intercity.deriveRemainingSeats({ ...TRIP_DTO, seats_available: 99 })).toBe(18);
    expect(intercity.deriveRemainingSeats({ ...TRIP_DTO, seats_available: -4 })).toBe(0);
  });

  test('an unknown status degrades to OPEN instead of rendering a raw enum', () => {
    expect(intercity.mapTrip({ ...TRIP_DTO, status: 'WAT' }).status).toBe('OPEN');
  });

  test('prices are truncated to integer RWF', () => {
    expect(intercity.mapTrip({ ...TRIP_DTO, price_per_seat_rwf: 4500.9 }).pricePerSeatRwf).toBe(4500);
  });

  test('a booking without created_at maps to null rather than undefined', () => {
    expect(intercity.mapBooking(BOOKING_DTO).createdAt).toBeNull();
  });
});

describe('intercity customer endpoints', () => {
  // Every collection endpoint on this API keys its array. Reading
  // `response.data.data` as a bare array made `.map` throw, React Query
  // recorded a failure, and the screen rendered its EMPTY state — which is why
  // a hard client bug looked like "the backend has no data".
  test('search reads the keyed {trips, limit, offset} envelope', async () => {
    mockNextResponse = { data: { data: { trips: [TRIP_DTO], limit: 20, offset: 0 } } };
    const trips = await intercity.searchTrips({ corridor: 'KGL_MUS', date: '2026-09-22', seats: 2 });
    expect(mockCalls[0]).toMatchObject({ method: 'GET', path: '/v1/customer/intercity/trips' });
    expect(mockCalls[0].options?.query).toEqual({ corridor: 'KGL_MUS', date: '2026-09-22', seats: 2 });
    expect(trips).toHaveLength(1);
    expect(trips[0].remainingSeats).toBe(5);
  });

  test('corridors read the keyed {corridors} envelope', async () => {
    mockNextResponse = {
      data: { data: { corridors: [{ code: 'KGL_MUS', origin_name: 'Kigali', destination_name: 'Musanze' }] } },
    };
    const corridors = await intercity.listCorridors();
    expect(mockCalls[0]).toMatchObject({ method: 'GET', path: '/v1/customer/intercity/corridors' });
    expect(corridors).toEqual([{ code: 'KGL_MUS', originName: 'Kigali', destinationName: 'Musanze' }]);
  });

  test('bookings read the keyed {bookings, limit, offset} envelope', async () => {
    mockNextResponse = { data: { data: { bookings: [BOOKING_DTO], limit: 20, offset: 0 } } };
    const bookings = await intercity.listBookings();
    expect(mockCalls[0]).toMatchObject({ method: 'GET', path: '/v1/customer/intercity/bookings' });
    expect(bookings).toHaveLength(1);
    expect(bookings[0].id).toBe('b1');
  });

  test('an empty keyed envelope is an empty list, not a crash', async () => {
    mockNextResponse = { data: { data: { trips: null, bookings: null, corridors: null } } };
    await expect(intercity.searchTrips({ corridor: 'c', date: 'd', seats: 1 })).resolves.toEqual([]);
    await expect(intercity.listBookings()).resolves.toEqual([]);
    await expect(intercity.listCorridors()).resolves.toEqual([]);
    await expect(intercity.listDriverTrips()).resolves.toEqual([]);
  });

  test('a null envelope is an empty list, not a crash', async () => {
    mockNextResponse = { data: { data: null } };
    await expect(intercity.searchTrips({ corridor: 'c', date: 'd', seats: 1 })).resolves.toEqual([]);
    await expect(intercity.listBookings()).resolves.toEqual([]);
    await expect(intercity.listCorridors()).resolves.toEqual([]);
    await expect(intercity.listDriverTrips()).resolves.toEqual([]);
  });

  test('hold sends an idempotency key so a replayed request cannot take seats twice', async () => {
    mockNextResponse = { data: { data: BOOKING_DTO } };
    const booking = await intercity.holdSeats({ tripId: 'trip-1', seats: 2 });
    expect(mockCalls[0]).toMatchObject({ method: 'POST', path: '/v1/customer/intercity/trips/trip-1/hold' });
    expect(mockCalls[0].options?.body).toMatchObject({ seats: 2 });
    expect(typeof mockCalls[0].options?.body?.idempotency_key).toBe('string');
    expect(booking.status).toBe('HELD');
    expect(booking.holdExpiresAt).toBe('2026-09-22T06:05:00.000Z');
  });

  test('a caller-supplied idempotency key is used verbatim', async () => {
    mockNextResponse = { data: { data: BOOKING_DTO } };
    await intercity.holdSeats({ tripId: 't', seats: 1, idempotencyKey: 'attempt-42' });
    expect(mockCalls[0].options?.body?.idempotency_key).toBe('attempt-42');
  });

  test('confirm and cancel address the booking, never the trip', async () => {
    mockNextResponse = { data: { data: { ...BOOKING_DTO, status: 'CONFIRMED' } } };
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
    // The corridor is the contract: the server derives origin, destination and
    // every coordinate from it. A client that sends its own can disagree with
    // the corridor it just named.
    ['origin_name', 'destination_name', 'origin_lat', 'origin_lng', 'dest_lat', 'dest_lng'].forEach(
      field => expect(body).not.toHaveProperty(field),
    );
    expect(typeof body.idempotency_key).toBe('string');
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

  test('driver trips read the keyed {trips} envelope', async () => {
    mockNextResponse = { data: { data: { trips: [TRIP_DTO], limit: 20, offset: 0 } } };
    const trips = await intercity.listDriverTrips();
    expect(mockCalls[0]).toMatchObject({ method: 'GET', path: '/v1/driver/intercity/trips' });
    expect(trips).toHaveLength(1);
    expect(trips[0].plateNumber).toBe('RAC 123 A');
  });

  // The manifest is NOT a trip. It used to be read as { trip, seats_sold },
  // neither of which exists, so mapTrip(undefined) threw and the screen could
  // never render. This is the real intercity.Manifest, verbatim.
  test('the manifest reads the real {trip_id, counters, passengers} payload', async () => {
    mockNextResponse = {
      data: {
        data: {
          trip_id: 'trip-1',
          status: 'BOARDING',
          depart_at: '2026-09-22T06:30:00.000Z',
          total_seats: 18,
          booked_seats: 11,
          held_seats: 2,
          phones_visible: true,
          passengers: [
            { booking_id: 'b1', first_name: 'Alice', phone: '+250788000042', seats: 2, status: 'CONFIRMED' },
            { booking_id: 'b2', first_name: 'Bob', phone: '+250788000043', seats: 1, status: 'BOARDED' },
          ],
        },
      },
    };
    const manifest = await intercity.getManifest('trip-1');
    expect(mockCalls[0]).toMatchObject({ method: 'GET', path: '/v1/driver/intercity/trips/trip-1/manifest' });
    expect(manifest.tripId).toBe('trip-1');
    expect(manifest.status).toBe('BOARDING');
    expect(manifest.departAt).toBe('2026-09-22T06:30:00.000Z');
    expect(manifest.totalSeats).toBe(18);
    expect(manifest.bookedSeats).toBe(11);
    expect(manifest.heldSeats).toBe(2);
    expect(manifest.remainingSeats).toBe(5);
    expect(manifest.seatsSold).toBe(11);
    expect(manifest.passengers).toHaveLength(2);
  });

  test('phones_visible is the ONLY thing that unmasks a passenger number', async () => {
    const payload = (phonesVisible: boolean) => ({
      data: {
        data: {
          trip_id: 'trip-1',
          status: 'OPEN',
          depart_at: '2026-09-22T06:30:00.000Z',
          total_seats: 4,
          booked_seats: 1,
          held_seats: 0,
          phones_visible: phonesVisible,
          passengers: [
            { booking_id: 'b1', first_name: 'Alice', phone: '07•• ••• •42', seats: 1, status: 'CONFIRMED' },
            { booking_id: 'b2', first_name: 'Bob', phone: '+250788000043', seats: 1, status: 'CONFIRMED' },
            { booking_id: 'b3', seats: 1, status: 'CANCELLED' },
          ],
        },
      },
    });

    mockNextResponse = payload(false);
    const masked = await intercity.getManifest('trip-1');
    expect(masked.phonesVisible).toBe(false);
    expect(masked.passengers.every(passenger => !passenger.phone || passenger.phoneMasked)).toBe(true);

    mockCalls.length = 0;
    mockNextResponse = payload(true);
    const full = await intercity.getManifest('trip-1');
    expect(full.phonesVisible).toBe(true);
    // Still masked when the string itself is masked — the UI must never offer
    // an unusable number as callable.
    expect(full.passengers[0].phoneMasked).toBe(true);
    expect(full.passengers[1].phoneMasked).toBe(false);
    expect(full.passengers[2].phone).toBeNull();
    expect(full.passengers[2].firstName).toBe('Passenger');
  });

  test('a manifest with no counters clamps to zero rather than NaN', async () => {
    mockNextResponse = {
      data: {
        data: {
          trip_id: 'trip-1',
          status: 'OPEN',
          depart_at: '2026-09-22T06:30:00.000Z',
          total_seats: 4,
        },
      },
    };
    const manifest = await intercity.getManifest('trip-1');
    expect(manifest.seatsSold).toBe(0);
    expect(manifest.remainingSeats).toBe(4);
    expect(manifest.passengers).toEqual([]);
    expect(manifest.phonesVisible).toBe(false);
  });
});
