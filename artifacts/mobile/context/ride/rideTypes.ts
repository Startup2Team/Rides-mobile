import type {
  BookingFormDraft,
  Coords,
  Ride,
  RideLocation,
  VehicleType,
} from '@/types';

export interface RideContextType {
  currentRide: Ride | null;
  rideHistory: Ride[];
  driverLocation: Coords | null;
  pendingRequest: Ride | null;
  createRide: (
    pickup: RideLocation,
    destination: RideLocation,
    vehicleType: VehicleType,
    destText?: string,
  ) => Promise<void>;
  cancelledSearchDraft: BookingFormDraft | null;
  restoreBookingOnHomeFocus: boolean;
  clearCancelledSearchDraft: () => void;
  clearRestoreBookingOnHomeFocus: () => void;
  cancelRide: () => void;
  pauseDriverMatching: () => void;
  resumeDriverMatching: () => void;
  isMatchingPaused: boolean;
  counterOffer: (amount: number) => void;
  sendDriverOffer: (amount: number) => void;
  acceptDriverOffer: () => void;
  acceptCustomerOffer: () => void;
  declineDriverOffer: () => void;
  completeRide: () => void;
  markArrived: () => void;
  startJourney: () => void;
  acceptRideRequest: () => void;
  declineRideRequest: () => void;
  simulateIncomingRideRequest: () => void;
  riderAcceptWithFare: (amount: number) => void;
  loadHistory: () => Promise<void>;
}
