import { getAppBackendClient } from '@/data/remote/client/appBackendClient';
import { generateIdempotencyKey } from '@/utils/idempotencyKey';

// Rides Intercity — scheduled multi-seat trips on a corridor (Kigali -> Musanze
// etc). Contract: INTERCITY_DESIGN.md §7. Payment is CASH ON BOARD; the app
// never moves money, so nothing here touches a payment endpoint.
//
// Two rules are enforced in THIS file because it is the only place the raw API
// shape is visible:
//
//  1. `sellable_seats` (the seat count clamped by the operator's credit
//     balance, §11 D3) is NEVER mapped into the domain model. Publishing it to
//     a passenger is an exact live oracle of a rival operator's credit balance.
//     Customers see `total_seats - booked - held` and nothing else.
//  2. Prices are integer RWF (`price_per_seat_rwf`). RWF has no minor unit, so
//     totals are integer multiplications, never float money.

export type IntercityTripStatus =
  | 'OPEN'
  | 'BOARDING'
  | 'IN_TRANSIT'
  | 'COMPLETED'
  | 'CANCELLED';

export type IntercityBookingStatus =
  | 'HELD'
  | 'CONFIRMED'
  | 'BOARDED'
  | 'COMPLETED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'NO_SHOW';

export interface IntercityCorridor {
  code: string;
  originName: string;
  destinationName: string;
}

export interface IntercityTrip {
  id: string;
  corridor: string;
  originName: string;
  destinationName: string;
  /** Operator display name (§15) — the bus company, or the individual. */
  operatorName: string | null;
  vehicleLabel: string | null;
  plateNumber: string | null;
  stagingAddress: string;
  stagingPoint: { lat: number; lng: number } | null;
  /** ISO-8601 instant. Formatted for display in the Africa/Kigali locale. */
  departAt: string;
  totalSeats: number;
  /** total - booked - held. The headline number; never the sellable clamp. */
  remainingSeats: number;
  pricePerSeatRwf: number;
  status: IntercityTripStatus;
  /** Only ever populated for a confirmed passenger or the assigned driver. */
  driverName: string | null;
  driverPhone: string | null;
  cancelReason: string | null;
}

export interface IntercityBooking {
  id: string;
  tripId: string;
  seats: number;
  status: IntercityBookingStatus;
  pricePerSeatRwf: number;
  /** ISO-8601; only set while the booking is HELD. */
  holdExpiresAt: string | null;
  boardedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  /** Embedded trip when the API returns it (booking detail + list). */
  trip: IntercityTrip | null;
}

export interface IntercityManifestPassenger {
  bookingId: string;
  firstName: string;
  /** Masked (`07•• ••• •42`) or full — the SERVER decides per the §9 tier. */
  phone: string | null;
  phoneMasked: boolean;
  seats: number;
  status: IntercityBookingStatus;
  boardedAt: string | null;
  noShowAt: string | null;
}

export interface IntercityManifest {
  trip: IntercityTrip;
  seatsSold: number;
  passengers: IntercityManifestPassenger[];
}

interface Envelope<T> {
  data: T;
}

interface CorridorDto {
  code: string;
  origin_name: string;
  destination_name: string;
}

export interface TripDto {
  id: string;
  corridor: string;
  origin_name: string;
  destination_name: string;
  operator_name?: string | null;
  operator_display_name?: string | null;
  vehicle_label?: string | null;
  vehicle_type_code?: string | null;
  plate_number?: string | null;
  staging_address: string;
  staging_lat?: number | null;
  staging_lng?: number | null;
  depart_at: string;
  total_seats: number;
  booked_seats?: number | null;
  held_seats?: number | null;
  remaining_seats?: number | null;
  price_per_seat_rwf: number;
  status: string;
  driver_name?: string | null;
  driver_phone?: string | null;
  cancel_reason?: string | null;
}

interface BookingDto {
  id: string;
  trip_id: string;
  seats: number;
  status: string;
  price_per_seat_rwf: number;
  hold_expires_at?: string | null;
  boarded_at?: string | null;
  cancelled_at?: string | null;
  created_at: string;
  trip?: TripDto | null;
}

interface ManifestPassengerDto {
  booking_id: string;
  first_name?: string | null;
  phone?: string | null;
  phone_masked?: boolean | null;
  seats: number;
  status: string;
  boarded_at?: string | null;
  no_show_at?: string | null;
}

interface ManifestDto {
  trip: TripDto;
  seats_sold?: number | null;
  passengers?: ManifestPassengerDto[] | null;
}

const TRIP_STATUSES: readonly IntercityTripStatus[] = [
  'OPEN',
  'BOARDING',
  'IN_TRANSIT',
  'COMPLETED',
  'CANCELLED',
];

const BOOKING_STATUSES: readonly IntercityBookingStatus[] = [
  'HELD',
  'CONFIRMED',
  'BOARDED',
  'COMPLETED',
  'EXPIRED',
  'CANCELLED',
  'NO_SHOW',
];

function toTripStatus(raw: string): IntercityTripStatus {
  return TRIP_STATUSES.includes(raw as IntercityTripStatus)
    ? (raw as IntercityTripStatus)
    : 'OPEN';
}

function toBookingStatus(raw: string): IntercityBookingStatus {
  return BOOKING_STATUSES.includes(raw as IntercityBookingStatus)
    ? (raw as IntercityBookingStatus)
    : 'HELD';
}

function integerOrZero(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : 0;
}

/**
 * Remaining seats = total - booked - held, clamped to [0, total].
 *
 * Prefers the server's own `remaining_seats` when present (it is computed by
 * the same conditional UPDATE that guards the oversell, §4) and otherwise
 * derives it. `sellable_seats` is deliberately not consulted: it encodes the
 * operator's credit balance and is enforced server-side only.
 */
export function deriveRemainingSeats(dto: TripDto): number {
  const total = integerOrZero(dto.total_seats);
  const explicit = dto.remaining_seats;
  const remaining =
    typeof explicit === 'number' && Number.isFinite(explicit)
      ? Math.trunc(explicit)
      : total - integerOrZero(dto.booked_seats) - integerOrZero(dto.held_seats);
  return Math.max(0, Math.min(total, remaining));
}

export function mapTrip(dto: TripDto): IntercityTrip {
  return {
    id: dto.id,
    corridor: dto.corridor,
    originName: dto.origin_name,
    destinationName: dto.destination_name,
    operatorName: dto.operator_display_name ?? dto.operator_name ?? null,
    vehicleLabel: dto.vehicle_label ?? dto.vehicle_type_code ?? null,
    plateNumber: dto.plate_number ?? null,
    stagingAddress: dto.staging_address,
    stagingPoint:
      typeof dto.staging_lat === 'number' && typeof dto.staging_lng === 'number'
        ? { lat: dto.staging_lat, lng: dto.staging_lng }
        : null,
    departAt: dto.depart_at,
    totalSeats: integerOrZero(dto.total_seats),
    remainingSeats: deriveRemainingSeats(dto),
    pricePerSeatRwf: integerOrZero(dto.price_per_seat_rwf),
    status: toTripStatus(dto.status),
    driverName: dto.driver_name ?? null,
    driverPhone: dto.driver_phone ?? null,
    cancelReason: dto.cancel_reason ?? null,
  };
}

export function mapBooking(dto: BookingDto): IntercityBooking {
  return {
    id: dto.id,
    tripId: dto.trip_id,
    seats: integerOrZero(dto.seats),
    status: toBookingStatus(dto.status),
    pricePerSeatRwf: integerOrZero(dto.price_per_seat_rwf),
    holdExpiresAt: dto.hold_expires_at ?? null,
    boardedAt: dto.boarded_at ?? null,
    cancelledAt: dto.cancelled_at ?? null,
    createdAt: dto.created_at,
    trip: dto.trip ? mapTrip(dto.trip) : null,
  };
}

function mapPassenger(dto: ManifestPassengerDto): IntercityManifestPassenger {
  const phone = dto.phone?.trim() ? dto.phone.trim() : null;
  return {
    bookingId: dto.booking_id,
    firstName: dto.first_name?.trim() || 'Passenger',
    phone,
    // The server masks per the §9 tier. Treat an unflagged number containing a
    // mask glyph as masked so the UI never labels it as callable.
    phoneMasked: dto.phone_masked ?? (phone ? /[•*]/.test(phone) : false),
    seats: integerOrZero(dto.seats),
    status: toBookingStatus(dto.status),
    boardedAt: dto.boarded_at ?? null,
    noShowAt: dto.no_show_at ?? null,
  };
}

function mapManifest(dto: ManifestDto): IntercityManifest {
  const passengers = (dto.passengers ?? []).map(mapPassenger);
  const seatsSold =
    typeof dto.seats_sold === 'number' && Number.isFinite(dto.seats_sold)
      ? Math.trunc(dto.seats_sold)
      : passengers
          .filter(passenger => passenger.status !== 'CANCELLED' && passenger.status !== 'EXPIRED')
          .reduce((total, passenger) => total + passenger.seats, 0);
  return { trip: mapTrip(dto.trip), seatsSold, passengers };
}

/* ------------------------------------------------------------------ */
/* Customer                                                            */
/* ------------------------------------------------------------------ */

export async function listCorridors(): Promise<IntercityCorridor[]> {
  const response = await getAppBackendClient().get<Envelope<CorridorDto[] | null>>(
    '/v1/customer/intercity/corridors',
  );
  return (response.data.data ?? []).map(dto => ({
    code: dto.code,
    originName: dto.origin_name,
    destinationName: dto.destination_name,
  }));
}

export interface SearchIntercityTripsInput {
  corridor: string;
  /** Kigali-local calendar date, `YYYY-MM-DD`. The server ranges it. */
  date: string;
  seats: number;
}

export async function searchTrips(input: SearchIntercityTripsInput): Promise<IntercityTrip[]> {
  const response = await getAppBackendClient().get<Envelope<TripDto[] | null>>(
    '/v1/customer/intercity/trips',
    { query: { corridor: input.corridor, date: input.date, seats: input.seats } },
  );
  return (response.data.data ?? []).map(mapTrip);
}

export async function getTrip(tripId: string): Promise<IntercityTrip> {
  const response = await getAppBackendClient().get<Envelope<TripDto>>(
    `/v1/customer/intercity/trips/${tripId}`,
  );
  return mapTrip(response.data.data);
}

export interface HoldSeatsInput {
  tripId: string;
  seats: number;
  /** Stable across retries of the SAME attempt — the server dedupes on it. */
  idempotencyKey?: string;
}

export async function holdSeats(input: HoldSeatsInput): Promise<IntercityBooking> {
  const response = await getAppBackendClient().post<Envelope<BookingDto>>(
    `/v1/customer/intercity/trips/${input.tripId}/hold`,
    {
      body: {
        seats: input.seats,
        idempotency_key: input.idempotencyKey ?? generateIdempotencyKey('intercity-hold'),
      },
    },
  );
  return mapBooking(response.data.data);
}

export async function confirmBooking(bookingId: string): Promise<IntercityBooking> {
  const response = await getAppBackendClient().post<Envelope<BookingDto>>(
    `/v1/customer/intercity/bookings/${bookingId}/confirm`,
    { body: {} },
  );
  return mapBooking(response.data.data);
}

export async function listBookings(): Promise<IntercityBooking[]> {
  const response = await getAppBackendClient().get<Envelope<BookingDto[] | null>>(
    '/v1/customer/intercity/bookings',
  );
  return (response.data.data ?? []).map(mapBooking);
}

export async function getBooking(bookingId: string): Promise<IntercityBooking> {
  const response = await getAppBackendClient().get<Envelope<BookingDto>>(
    `/v1/customer/intercity/bookings/${bookingId}`,
  );
  return mapBooking(response.data.data);
}

export async function cancelBooking(bookingId: string): Promise<void> {
  await getAppBackendClient().delete(`/v1/customer/intercity/bookings/${bookingId}`);
}

/* ------------------------------------------------------------------ */
/* Driver / operator                                                   */
/* ------------------------------------------------------------------ */

export interface PublishIntercityTripInput {
  corridor: string;
  vehicleId: string;
  /** ISO-8601 instant. Must be within NOW .. NOW + 7 days (§3). */
  departAt: string;
  totalSeats: number;
  pricePerSeatRwf: number;
  stagingAddress: string;
}

export async function publishTrip(input: PublishIntercityTripInput): Promise<IntercityTrip> {
  const response = await getAppBackendClient().post<Envelope<TripDto>>(
    '/v1/driver/intercity/trips',
    {
      body: {
        corridor: input.corridor,
        vehicle_id: input.vehicleId,
        depart_at: input.departAt,
        total_seats: Math.trunc(input.totalSeats),
        price_per_seat_rwf: Math.trunc(input.pricePerSeatRwf),
        staging_address: input.stagingAddress.trim(),
        idempotency_key: generateIdempotencyKey('intercity-publish'),
      },
    },
  );
  return mapTrip(response.data.data);
}

export async function listDriverTrips(): Promise<IntercityTrip[]> {
  const response = await getAppBackendClient().get<Envelope<TripDto[] | null>>(
    '/v1/driver/intercity/trips',
  );
  return (response.data.data ?? []).map(mapTrip);
}

export async function getManifest(tripId: string): Promise<IntercityManifest> {
  const response = await getAppBackendClient().get<Envelope<ManifestDto>>(
    `/v1/driver/intercity/trips/${tripId}/manifest`,
  );
  return mapManifest(response.data.data);
}

export async function boardPassenger(tripId: string, bookingId: string): Promise<void> {
  await getAppBackendClient().post(`/v1/driver/intercity/trips/${tripId}/board`, {
    body: { booking_id: bookingId },
  });
}

export async function markNoShow(tripId: string, bookingId: string): Promise<void> {
  await getAppBackendClient().post(`/v1/driver/intercity/trips/${tripId}/no-show`, {
    body: { booking_id: bookingId },
  });
}

export async function startTrip(tripId: string): Promise<void> {
  await getAppBackendClient().post(`/v1/driver/intercity/trips/${tripId}/start`, { body: {} });
}

export async function completeTrip(tripId: string): Promise<void> {
  await getAppBackendClient().post(`/v1/driver/intercity/trips/${tripId}/complete`, { body: {} });
}

export async function cancelTrip(tripId: string, reason: string): Promise<void> {
  await getAppBackendClient().delete(`/v1/driver/intercity/trips/${tripId}`, {
    body: { cancel_reason: reason.trim() },
  });
}
