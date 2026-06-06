import { Coords, VEHICLE_BASE_FARE, VehicleType } from '@/types';

export function calcDistance(a: Coords, b: Coords): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((a.latitude * Math.PI) / 180) *
    Math.cos((b.latitude * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export function calcFare(vehicleType: VehicleType, distanceKm: number): number {
  const base = VEHICLE_BASE_FARE[vehicleType];
  const perKm =
    vehicleType === 'moto' || vehicleType === 'rifani'
      ? 200
      : vehicleType === 'cab'
        ? 400
        : vehicleType === 'hilux'
          ? 600
          : 800;
  return Math.round((base + distanceKm * perKm) / 100) * 100;
}
