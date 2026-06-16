import type { DriverProfile, Ride } from '@/types';
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

export function formatRwf(amount: number) {
  return `${Math.max(0, Math.round(amount)).toLocaleString('en-RW')} RWF`;
}

export function getDriverActivitySummary({
  driverId,
  driverProfile,
  entitlement,
  rideHistory,
  now = new Date(),
}: {
  driverId?: string | null;
  driverProfile: DriverProfile | null | undefined;
  entitlement: DriverEntitlement | null | undefined;
  rideHistory: Ride[];
  now?: Date;
}) {
  const completedToday = driverId
    ? rideHistory.filter(ride =>
        ride.driverId === driverId &&
        isCompletedRide(ride) &&
        isSameLocalDay(ride.completedAt, now),
      )
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
