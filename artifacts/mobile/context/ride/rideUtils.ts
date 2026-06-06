import {
  BookingFormDraft,
  Coords,
  Ride,
  RideLocation,
  VEHICLE_BASE_FARE,
  VehicleType,
} from '@/types';

export function generateRideId() {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

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

export function buildMockRideRequest(): Ride {
  const pickup: RideLocation = {
    address: 'Kimironko Market',
    latitude: -1.9365,
    longitude: 30.1011,
    locationType: 'precise',
  };
  const destination: RideLocation = {
    address: 'Kigali City Tower',
    latitude: -1.9438,
    longitude: 30.0616,
    locationType: 'precise',
  };
  const distance = calcDistance(pickup, destination);

  return {
    id: generateRideId(),
    customerId: 'mock_customer',
    customerName: 'Amina K.',
    customerPhone: '+250788000000',
    vehicleType: 'moto',
    pickup,
    destination,
    status: 'searching',
    distance: parseFloat(distance.toFixed(2)),
    duration: Math.round(distance * 3 + 5),
    suggestedFare: calcFare('moto', distance),
    negotiation: [],
    createdAt: new Date().toISOString(),
  };
}

export function cloneBookingDraft(
  pickup: RideLocation,
  destination: RideLocation,
  vehicleType: VehicleType,
  destText: string,
): BookingFormDraft {
  return {
    pickup: { ...pickup },
    destination: { ...destination },
    destText,
    vehicleType,
  };
}
