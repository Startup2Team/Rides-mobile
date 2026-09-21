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
  /**
   * The server's own per-account seat cap (`max_seats_per_booking`). The UI
   * uses it as the stepper ceiling so it can never offer a seat count the
   * server will refuse with SEAT_CAP_EXCEEDED. Null only when the payload
   * omits it, in which case the client mirrors the rule locally.
   */
  maxSeatsPerBooking: number | null;
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
  /**
   * Null whenever the API omits it — BookingView does NOT carry a created_at,
   * and typing it as always-present was a lie the type system could not catch.
   */
  createdAt: string | null;
  /** The server-computed total. Money has one source of truth, and it is the server. */
  totalRwf: number | null;
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

/**
 * The driver's manifest. It is NOT a trip: the backend returns seat counters
 * and passengers for one trip id, and nothing else. Anything the screen needs
 * about the route itself (origin, destination, price, staging address) comes
 * from the trip endpoint, not from here.
 */
export interface IntercityManifest {
  tripId: string;
  status: IntercityTripStatus;
  /** ISO-8601 departure instant — present on the manifest itself. */
  departAt: string;
  totalSeats: number;
  bookedSeats: number;
  heldSeats: number;
  /** total - booked - held, clamped to [0, total]. */
  remainingSeats: number;
  /** Seats actually sold (= booked). The cash-on-board base. */
  seatsSold: number;
  /**
   * The §9 PII tier decided by the SERVER: full numbers only from
   * `depart_at - 30min`. The client never unmasks and never infers.
   */
  phonesVisible: boolean;
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

// The DTOs below mirror intercity.TripView / BookingView / Manifest in
// internal/intercity/service.go FIELD FOR FIELD. They shipped once with
// invented names (`remaining_seats`, `vehicle_label`, `plate_number`,
// `driver_name`) that the server has never sent, which is silent: the object
// arrives, the fields read `undefined`, and the screen renders a lie. Every
// name here is pinned by a test against the real envelope.
export interface TripDto {
  id: string;
  corridor: string;
  origin_name: string;
  destination_name: string;
  operator_name?: string | null;
  vehicle_type?: string | null;
  vehicle_plate?: string | null;
  staging_address: string;
  staging_lat?: number | null;
  staging_lng?: number | null;
  depart_at: string;
  total_seats: number;
  /** Server-computed total - booked - held. The ONLY seat truth on the wire. */
  seats_available?: number | null;
  max_seats_per_booking?: number | null;
  price_per_seat_rwf: number;
  status: string;
  driver_first_name?: string | null;
  driver_phone?: string | null;
  cancel_reason?: string | null;
  completed_at?: string | null;
}

interface BookingDto {
  id: string;
  trip_id: string;
  seats: number;
  status: string;
  price_per_seat_rwf: number;
  total_rwf?: number | null;
  hold_expires_at?: string | null;
  boarded_at?: string | null;
  cancelled_at?: string | null;
  created_at?: string | null;
  trip?: TripDto | null;
}

interface ManifestPassengerDto {
  booking_id: string;
  first_name?: string | null;
  phone?: string | null;
  seats: number;
  status: string;
  boarded_at?: string | null;
  no_show_at?: string | null;
}

interface ManifestDto {
  trip_id: string;
  status: string;
  depart_at: string;
  total_seats: number;
  booked_seats?: number | null;
  held_seats?: number | null;
  phones_visible?: boolean | null;
  passengers?: ManifestPassengerDto[] | null;
}

/* The collection endpoints key their arrays — none returns a bare array. */

interface CorridorListDto {
  corridors?: CorridorDto[] | null;
}

interface TripListDto {
  trips?: TripDto[] | null;
  limit?: number;
  offset?: number;
}

interface BookingListDto {
  bookings?: BookingDto[] | null;
  limit?: number;
  offset?: number;
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
 * Remaining seats, clamped to [0, total].
 *
 * The wire field is `seats_available` — the server's own total - booked - held,
 * computed by the same conditional UPDATE that guards the oversell (§4). There
 * is no client-side derivation to fall back on: TripView carries no booked/held
 * counters. When the field is missing the answer is ZERO, not `total_seats`:
 * advertising a sold-out 18-seat Coaster as having 18 free seats sends 18
 * passengers to a full bus, whereas showing zero only under-sells a payload
 * that is already broken. `sellable_seats` is deliberately not consulted: it
 * encodes the operator's credit balance and is enforced server-side only.
 */
export function deriveRemainingSeats(dto: TripDto): number {
  const total = integerOrZero(dto.total_seats);
  return Math.max(0, Math.min(total, integerOrZero(dto.seats_available)));
}

/** The server's per-account seat cap, or null when the payload omits it. */
function deriveMaxSeatsPerBooking(dto: TripDto): number | null {
  const cap = dto.max_seats_per_booking;
  if (typeof cap !== 'number' || !Number.isFinite(cap)) return null;
  const truncated = Math.trunc(cap);
  return truncated > 0 ? truncated : null;
}

export function mapTrip(dto: TripDto): IntercityTrip {
  return {
    id: dto.id,
    corridor: dto.corridor,
    originName: dto.origin_name,
    destinationName: dto.destination_name,
    operatorName: dto.operator_name?.trim() ? dto.operator_name : null,
    vehicleLabel: dto.vehicle_type?.trim() ? dto.vehicle_type : null,
    plateNumber: dto.vehicle_plate?.trim() ? dto.vehicle_plate : null,
    stagingAddress: dto.staging_address,
    stagingPoint:
      typeof dto.staging_lat === 'number' && typeof dto.staging_lng === 'number'
        ? { lat: dto.staging_lat, lng: dto.staging_lng }
        : null,
    departAt: dto.depart_at,
    totalSeats: integerOrZero(dto.total_seats),
    remainingSeats: deriveRemainingSeats(dto),
    maxSeatsPerBooking: deriveMaxSeatsPerBooking(dto),
    pricePerSeatRwf: integerOrZero(dto.price_per_seat_rwf),
    status: toTripStatus(dto.status),
    driverName: dto.driver_first_name?.trim() ? dto.driver_first_name : null,
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
    createdAt: dto.created_at ?? null,
    // The server's own total. The client used to recompute seats x price and
    // ignore this, which is a second source of truth for money: identical today,
    // but the day pricing gains a fee or a rounding rule the app would quietly
    // show a different number from the one the driver collects.
    totalRwf: dto.total_rwf ?? null,
    trip: dto.trip ? mapTrip(dto.trip) : null,
  };
}

function mapPassenger(dto: ManifestPassengerDto, phonesVisible: boolean): IntercityManifestPassenger {
  const phone = dto.phone?.trim() ? dto.phone.trim() : null;
  return {
    bookingId: dto.booking_id,
    firstName: dto.first_name?.trim() || 'Passenger',
    phone,
    // `phones_visible` is the SERVER's §9 tier decision for the whole manifest.
    // A number that still carries a mask glyph is treated as masked even when
    // the tier says full, so the UI never labels an unusable number callable.
    phoneMasked: phone ? !phonesVisible || /[•*]/.test(phone) : false,
    seats: integerOrZero(dto.seats),
    status: toBookingStatus(dto.status),
    boardedAt: dto.boarded_at ?? null,
    noShowAt: dto.no_show_at ?? null,
  };
}

function mapManifest(dto: ManifestDto): IntercityManifest {
  const phonesVisible = dto.phones_visible === true;
  const totalSeats = integerOrZero(dto.total_seats);
  const bookedSeats = integerOrZero(dto.booked_seats);
  const heldSeats = integerOrZero(dto.held_seats);
  return {
    tripId: dto.trip_id,
    status: toTripStatus(dto.status),
    departAt: dto.depart_at,
    totalSeats,
    bookedSeats,
    heldSeats,
    remainingSeats: Math.max(0, Math.min(totalSeats, totalSeats - bookedSeats - heldSeats)),
    // Sold = booked. A held seat is not money: the sweeper can release it.
    seatsSold: bookedSeats,
    phonesVisible,
    passengers: (dto.passengers ?? []).map(passenger => mapPassenger(passenger, phonesVisible)),
  };
}

/* ------------------------------------------------------------------ */
/* Customer                                                            */
/* ------------------------------------------------------------------ */

export async function listCorridors(): Promise<IntercityCorridor[]> {
  const response = await getAppBackendClient().get<Envelope<CorridorListDto | null>>(
    '/v1/customer/intercity/corridors',
  );
  return (response.data.data?.corridors ?? []).map(dto => ({
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
  const response = await getAppBackendClient().get<Envelope<TripListDto | null>>(
    '/v1/customer/intercity/trips',
    { query: { corridor: input.corridor, date: input.date, seats: input.seats } },
  );
  return (response.data.data?.trips ?? []).map(mapTrip);
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
  const response = await getAppBackendClient().get<Envelope<BookingListDto | null>>(
    '/v1/customer/intercity/bookings',
  );
  return (response.data.data?.bookings ?? []).map(mapBooking);
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
  const response = await getAppBackendClient().get<Envelope<TripListDto | null>>(
    '/v1/driver/intercity/trips',
  );
  return (response.data.data?.trips ?? []).map(mapTrip);
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
