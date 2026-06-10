import {
  BookingFormDraft,
  RideLocation,
  VehicleType,
} from '@/types';

export function generateRideId() {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
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
