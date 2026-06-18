import { getActiveRideCredits, getVehicleEntitlement, type DriverEntitlement } from '@/domain/driverRidePackages';
import { getDriverVehicleForSession } from '@/domain/driverVehicles';
import type { DriverProfile, DriverVehicleProfile, VehicleType } from '@/types';

export function getEligibleOnlineSessionVehicle(
  profile: DriverProfile | null | undefined,
  entitlement: DriverEntitlement | null | undefined,
  requestedVehicleType?: VehicleType | null,
): DriverVehicleProfile | null {
  if (!profile?.isOnline || profile.isVerified !== true) return null;
  const vehicle = getDriverVehicleForSession(profile);
  if (!vehicle || vehicle.status !== 'approved') return null;
  if (requestedVehicleType && vehicle.vehicleType !== requestedVehicleType) return null;
  if (getActiveRideCredits(getVehicleEntitlement(entitlement, vehicle)) <= 0) return null;
  return vehicle;
}
