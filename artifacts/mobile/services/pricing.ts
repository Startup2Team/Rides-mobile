import { api } from './api';
import type { VehicleTypeCode } from './vehicleTypes';

interface PricingEntry {
  code: VehicleTypeCode;
  min_fare_rwf: number;
}

// Min fares rarely change, so cache them for the app session.
let minFareCache: Record<string, number> | null = null;

/**
 * Returns a map of backend vehicle-type code → minimum fare (RWF), from the
 * public GET /pricing endpoint. Cached after the first call.
 */
export async function getMinFares(): Promise<Record<string, number>> {
  if (minFareCache) return minFareCache;
  const { data } = await api.get('/pricing');
  const types: PricingEntry[] = Array.isArray(data?.vehicle_types) ? data.vehicle_types : [];
  minFareCache = Object.fromEntries(types.map(t => [t.code, Number(t.min_fare_rwf) || 0]));
  return minFareCache;
}
