import type { BackendDriverVehicle } from '@/services/driverVehicles';

// Which vehicles may run a corridor.
//
// Intercity needs a vehicle seating at least four: a cab, Hilux, Hiace or bus.
// A moto or tuk-tuk cannot. The rule lives on the SERVER — every vehicle in
// `GET /driver/vehicles` (and `session.active_vehicle`) carries the derived
// `intercity_eligible` boolean, and `POST /driver/intercity/trips` enforces the
// same predicate with 422 VEHICLE_NOT_INTERCITY_ELIGIBLE. Nothing here
// re-derives it from seat counts: a second copy of the rule is a second thing
// to drift.

/** Shown wherever we have to explain why intercity is unavailable. */
export const INTERCITY_VEHICLE_REQUIREMENT =
  'Intercity needs a vehicle seating at least 4 — a cab, Hilux, Hiace or bus. A moto or tuk-tuk cannot run intercity.';

export type IntercityVehicleEligibility =
  /** The vehicle list has not resolved yet (cold start, offline, error). */
  | 'unknown'
  /** No vehicle registered at all. */
  | 'no-vehicle'
  /** At least one registered vehicle may publish. */
  | 'eligible'
  /** Vehicles exist, none of them may publish. */
  | 'ineligible';

/** Every vehicle that may publish an intercity trip, active one first. */
export function eligibleIntercityVehicles(
  vehicles: readonly BackendDriverVehicle[] | undefined,
): BackendDriverVehicle[] {
  return (vehicles ?? [])
    .filter(vehicle => vehicle.intercityEligible)
    .sort((a, b) => Number(b.isActive) - Number(a.isActive));
}

/**
 * `undefined` means "not loaded" and resolves to `unknown`, NOT `ineligible`:
 * an offline driver keeps the entry point and gets the screen's own designed
 * state, instead of watching the menu item vanish because a request failed.
 */
export function intercityVehicleEligibility(
  vehicles: readonly BackendDriverVehicle[] | undefined,
): IntercityVehicleEligibility {
  if (!vehicles) return 'unknown';
  if (vehicles.length === 0) return 'no-vehicle';
  return vehicles.some(vehicle => vehicle.intercityEligible) ? 'eligible' : 'ineligible';
}

/**
 * Should the driver see an Intercity entry point at all?
 *
 * Only a known-ineligible fleet hides it. `no-vehicle` keeps it: that driver
 * has a real next step ("add a vehicle"), which the intercity screen already
 * offers, so hiding it would hide the instruction too.
 */
export function showsIntercityEntryPoint(eligibility: IntercityVehicleEligibility): boolean {
  return eligibility !== 'ineligible';
}
