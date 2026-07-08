import type { DriverProfile, Ride, VehicleType } from '@/types';
import { getRideBalance, type DriverEntitlement } from './driverRidePackages';

function isSameLocalDay(value: string | undefined, now: Date) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
}

function isCompletedRide(ride: Ride) {
  return ride.status === 'completed' && Boolean(ride.completedAt);
}

function realFare(ride: Ride) {
  return typeof ride.agreedFare === 'number' && Number.isFinite(ride.agreedFare)
    ? Math.max(0, ride.agreedFare)
    : 0;
}

function matchesVehicle(ride: Ride, vehicleId?: string | null, vehicleType?: VehicleType | null) {
  if (!vehicleId && !vehicleType) return true;
  const rideVehicleId = ride.vehicleId ?? ride.matchedVehicleId;
  const rideVehicleType = ride.matchedVehicleType ?? ride.vehicleType;
  if (vehicleId && rideVehicleId !== vehicleId) return false;
  if (vehicleType && rideVehicleType !== vehicleType) return false;
  return true;
}

export function formatRwf(amount: number) {
  return `${Math.max(0, Math.round(amount)).toLocaleString('en-US')} RWF`;
}

export function getDriverActivitySummary({
  driverId,
  driverProfile,
  entitlement,
  rideHistory,
  now = new Date(),
  vehicleId,
  vehicleType,
}: {
  driverId?: string | null;
  driverProfile: DriverProfile | null | undefined;
  entitlement: DriverEntitlement | null | undefined;
  rideHistory: Ride[];
  now?: Date;
  vehicleId?: string | null;
  vehicleType?: VehicleType | null;
}) {
  const completedToday = driverId
    ? rideHistory
        .filter(ride =>
          ride.driverId === driverId &&
          isCompletedRide(ride) &&
          isSameLocalDay(ride.completedAt, now),
        )
        .filter(ride => matchesVehicle(ride, vehicleId, vehicleType))
    : [];
  const completedRidesToday = completedToday.length;

  return {
    todayEarningsRwf: completedToday.reduce((total, ride) => total + realFare(ride), 0),
    completedRidesToday,
    remainingRideCredits: getRideBalance(entitlement),
    allTimeCompletedRides: Math.max(0, driverProfile?.completedRides ?? 0),
    allTimeEarningsRwf: Math.max(0, driverProfile?.earningsTotal ?? 0),
  };
}
