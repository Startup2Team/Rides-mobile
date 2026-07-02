import type { Ride } from '@/types';
import type { RideCanaryParityAnalysis, RideCanaryParityDiff, RideCanarySemanticFields } from './canaryTypes';

function addDiff(diffs: RideCanaryParityDiff[], field: string, live: unknown, projected: unknown) {
  if (live !== projected) {
    diffs.push({ field, live, projected });
  }
}

function normalizeLocation(location: { address?: string; latitude: number; longitude: number } | null | undefined) {
  if (!location) return null;
  return {
    address: location.address ?? '',
    latitude: location.latitude,
    longitude: location.longitude,
  };
}

function normalizeRideSemanticFields(ride: Ride): RideCanarySemanticFields {
  return {
    rideId: ride.id,
    status: ride.status,
    customerId: ride.customerId,
    customerName: ride.customerName ?? null,
    driverId: ride.driverId ?? null,
    driverName: ride.driverName ?? null,
    vehicleType: ride.vehicleType,
    requestedVehicleType: ride.requestedVehicleType ?? null,
    matchedVehicleType: ride.matchedVehicleType ?? null,
    matchedVehicleId: ride.matchedVehicleId ?? null,
    pickup: normalizeLocation(ride.pickup)!,
    destination: normalizeLocation(ride.destination)!,
    distance: ride.distance,
    duration: ride.duration,
    suggestedFare: ride.suggestedFare,
    agreedFare: ride.agreedFare ?? null,
    createdAt: ride.createdAt,
    completedAt: ride.completedAt ?? null,
    arrivedAt: ride.arrivedAt ?? null,
    waitStartedAt: ride.waitStartedAt ?? null,
  };
}

function compareSemanticFields(
  live: RideCanarySemanticFields | null,
  projected: RideCanarySemanticFields | null,
  prefix: string,
): RideCanaryParityDiff[] {
  const diffs: RideCanaryParityDiff[] = [];
  addDiff(diffs, `${prefix}.exists`, Boolean(live), Boolean(projected));
  if (!live || !projected) return diffs;

  addDiff(diffs, `${prefix}.rideId`, live.rideId, projected.rideId);
  addDiff(diffs, `${prefix}.status`, live.status, projected.status);
  addDiff(diffs, `${prefix}.customerId`, live.customerId, projected.customerId);
  addDiff(diffs, `${prefix}.customerName`, live.customerName, projected.customerName);
  addDiff(diffs, `${prefix}.driverId`, live.driverId, projected.driverId);
  addDiff(diffs, `${prefix}.driverName`, live.driverName, projected.driverName);
  addDiff(diffs, `${prefix}.vehicleType`, live.vehicleType, projected.vehicleType);
  addDiff(diffs, `${prefix}.requestedVehicleType`, live.requestedVehicleType, projected.requestedVehicleType);
  addDiff(diffs, `${prefix}.matchedVehicleType`, live.matchedVehicleType, projected.matchedVehicleType);
  addDiff(diffs, `${prefix}.matchedVehicleId`, live.matchedVehicleId, projected.matchedVehicleId);
  addDiff(diffs, `${prefix}.pickup.address`, live.pickup.address, projected.pickup.address);
  addDiff(diffs, `${prefix}.pickup.latitude`, live.pickup.latitude, projected.pickup.latitude);
  addDiff(diffs, `${prefix}.pickup.longitude`, live.pickup.longitude, projected.pickup.longitude);
  addDiff(diffs, `${prefix}.destination.address`, live.destination.address, projected.destination.address);
  addDiff(diffs, `${prefix}.destination.latitude`, live.destination.latitude, projected.destination.latitude);
  addDiff(diffs, `${prefix}.destination.longitude`, live.destination.longitude, projected.destination.longitude);
  addDiff(diffs, `${prefix}.distance`, live.distance, projected.distance);
  addDiff(diffs, `${prefix}.duration`, live.duration, projected.duration);
  addDiff(diffs, `${prefix}.suggestedFare`, live.suggestedFare, projected.suggestedFare);
  addDiff(diffs, `${prefix}.agreedFare`, live.agreedFare, projected.agreedFare);
  addDiff(diffs, `${prefix}.createdAt`, live.createdAt, projected.createdAt);
  addDiff(diffs, `${prefix}.completedAt`, live.completedAt, projected.completedAt);
  addDiff(diffs, `${prefix}.arrivedAt`, live.arrivedAt, projected.arrivedAt);
  addDiff(diffs, `${prefix}.waitStartedAt`, live.waitStartedAt, projected.waitStartedAt);
  return diffs;
}

function compareRideHistorySemantics(live: Ride[], projected: Ride[]) {
  const diffs: RideCanaryParityDiff[] = [];
  addDiff(diffs, 'history.count', live.length, projected.length);
  const projectedById = new Map(projected.map(ride => [ride.id, ride]));

  live.forEach((ride, index) => {
    const projectedRide = projectedById.get(ride.id) ?? null;
    const itemDiffs = compareSemanticFields(normalizeRideSemanticFields(ride), projectedRide ? normalizeRideSemanticFields(projectedRide) : null, `history.${index}`);
    diffs.push(...itemDiffs);
  });

  projected.forEach((ride, index) => {
    const liveRide = live[index];
    if (!liveRide || liveRide.id !== ride.id) {
      diffs.push({
        field: `history.projected.${index}.rideId`,
        live: liveRide?.id ?? null,
        projected: ride.id,
      });
    }
  });

  return diffs;
}

export function analyzeRideHistoryParity(liveHistory: Ride[], projectedHistory: Ride[]): RideCanaryParityAnalysis {
  const fieldDiff = compareRideHistorySemantics(liveHistory, projectedHistory);
  return {
    canaryName: 'history',
    matched: fieldDiff.length === 0,
    fieldDiff,
    comparisonTimestamp: new Date().toISOString(),
  };
}

export function analyzeRideDetailParity(liveRide: Ride | null, projectedRide: Ride | null): RideCanaryParityAnalysis {
  const fieldDiff = compareSemanticFields(liveRide ? normalizeRideSemanticFields(liveRide) : null, projectedRide ? normalizeRideSemanticFields(projectedRide) : null, 'detail');
  return {
    canaryName: 'detail',
    matched: fieldDiff.length === 0,
    fieldDiff,
    comparisonTimestamp: new Date().toISOString(),
  };
}
