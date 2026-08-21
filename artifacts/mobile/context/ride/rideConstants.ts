import type { RideStatus, VehicleType } from '@/types';

// Last-resort reaper for the customer search. Ordering matters — three layers:
// 1. Backend give-up (MATCH_GIVE_UP_SECONDS) → ride_cancelled event, which
//    RideProvider turns into the in-place "no drivers" state on /searching.
// 2. The searching screen's own countdown + grace (server-granted budget, or
//    SEARCH_DEADLINE fallback in app/searching.tsx) when that event never
//    arrives.
// 3. This reaper, well behind both: frees the backend active_ride pointer for
//    searches abandoned off-screen, then flips the ride into the SAME in-place
//    "no drivers" state (never an Alert + pop) so a customer who returns later
//    still gets the Try-again screen.
export const CUSTOMER_SEARCH_TIMEOUT_MS = 120_000;
export const DRIVER_OFFER_DELAY_MS = 2500;
export const DRIVER_MATCH_MIN_DELAY_MS = 4000;
export const DRIVER_MATCH_RANDOM_DELAY_MS = 2000;
export const DRIVER_MATCH_RESUME_DELAY_MS = 2000;
export const CANCELLED_RIDE_CLEAR_DELAY_MS = 2000;
export const NEGOTIATION_RESPONSE_DELAY_MS = 2000;
export const NEGOTIATION_OFFER_LIMIT = 3;
export const CONFIRMED_RIDE_START_DELAY_MS = 1000;
export const ARRIVING_TRACKING_INTERVAL_MS = 2000;
export const ARRIVING_TRACKING_STEPS = 10;
export const ARRIVING_TRACKING_NOISE = 0.002;
export const JOURNEY_TRACKING_INTERVAL_MS = 3000;
export const JOURNEY_TRACKING_NOISE = 0.001;
export const RIDE_HISTORY_LIMIT = 50;

// How often the customer streams their real GPS to the driver while a ride is
// active (see RideProvider's customer-location publish effect) — matches the
// driver's own reporting cadence in app/(driver)/index.tsx.
export const CUSTOMER_LOCATION_PUBLISH_INTERVAL_MS = 10_000;

// The ride is "active" for location-publish purposes from the fare being
// locked in through the trip itself — not while still negotiating, and never
// once the ride is completed/cancelled (product decision: whole-trip
// tracking, but nothing before acceptance and nothing after the ride ends).
export const CUSTOMER_LOCATION_ACTIVE_STATUSES: ReadonlySet<RideStatus> = new Set([
  'confirmed',
  'arriving',
  'arrived',
  'in_progress',
]);

// ── Negotiation fare guardrails ──────────────────────────────────────────────
// Client-side mirror of the backend hard per-vehicle floor/cap in
// internal/negotiation/fare_bounds.go. Keep in lockstep with the server so an
// out-of-range offer is blocked with an inline message before it round-trips to
// the 400 VALIDATION response. Unknown types fall back to the permissive bound.
export interface FareBounds {
  min: number;
  max: number;
}

export const VEHICLE_FARE_BOUNDS: Record<VehicleType, FareBounds> = {
  moto: { min: 500, max: 4000 }, // MOTO_BIKE
  rifani: { min: 700, max: 5000 }, // TUK_TUK
  cab: { min: 2000, max: 15000 }, // CAB_TAXI
  hilux: { min: 3000, max: 25000 }, // LIGHT_HILUX
  fuso: { min: 10000, max: 80000 }, // HEAVY_FUSO
};

export const PERMISSIVE_FARE_BOUNDS: FareBounds = { min: 500, max: 100000 };

export function getFareBounds(vehicleType?: VehicleType | null): FareBounds {
  if (vehicleType && VEHICLE_FARE_BOUNDS[vehicleType]) return VEHICLE_FARE_BOUNDS[vehicleType];
  return PERMISSIVE_FARE_BOUNDS;
}

/**
 * Returns an inline error message when `amount` is outside the vehicle's hard
 * fare bounds, or null when it is valid. The message mirrors the backend's
 * 400 VALIDATION copy so the customer sees a consistent explanation.
 */
export function validateFareAmount(
  vehicleType: VehicleType | null | undefined,
  amount: number,
): string | null {
  const { min, max } = getFareBounds(vehicleType);
  if (!Number.isFinite(amount) || amount < min || amount > max) {
    return `Fare must be between ${min.toLocaleString()} and ${max.toLocaleString()} RWF`;
  }
  return null;
}
