import { useEffect, useState } from 'react';
import type { VehicleType } from '@/types';
import { getMinFares } from '@/services/pricing';
import { LEGACY_TO_API_VEHICLE, type LegacyVehicleType } from '@/services/vehicleTypes';

/**
 * Resolves the minimum fare (RWF) for a ride's vehicle type from the backend
 * pricing, so negotiation offers can be validated before they're sent. Returns
 * 0 until loaded (callers should treat 0 as "no floor yet").
 */
export function useMinFare(vehicleType: VehicleType | undefined): number {
  const [minFare, setMinFare] = useState(0);

  useEffect(() => {
    if (!vehicleType) return;
    let active = true;
    const apiCode = LEGACY_TO_API_VEHICLE[vehicleType as LegacyVehicleType];
    getMinFares()
      .then(map => {
        if (active && apiCode) setMinFare(map[apiCode] ?? 0);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [vehicleType]);

  return minFare;
}
