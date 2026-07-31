import type { VehicleType } from '@/types';

// Last-resort reaper for the customer search. Ordering matters — three layers:
// 1. Backend give-up (MATCH_GIVE_UP_SECONDS, 60s) → ride_cancelled event.
// 2. The searching screen's in-place terminal state + Retry at ~65s
//    (SEARCH_DEADLINE in app/searching.tsx) when that event never arrives.
// 3. This reaper, well behind both: frees the backend active_ride pointer and
//    ends rides abandoned off-screen. It must NOT fire while the user could
//    still be reading the screen's Retry state — keep it comfortably above
//    the screen deadline.
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
