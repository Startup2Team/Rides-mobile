import type {
  BookingFormDraft,
  Coords,
  Ride,
  RideLocation,
  VehicleType,
} from '@/types';

export interface RideContextType {
  pickup: RideLocation;
  destination: RideLocation | null;
  destText: string;
  setPickup: React.Dispatch<React.SetStateAction<RideLocation>>;
  setDestination: React.Dispatch<React.SetStateAction<RideLocation | null>>;
  setDestText: React.Dispatch<React.SetStateAction<string>>;
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
  completeRide: (source?: 'customer' | 'driver', driverIdentity?: {
    driverId?: string;
    driverName?: string;
    vehicleId?: string;
    vehicleType?: VehicleType;
  }) => void;
  markArrived: () => void;
  startJourney: () => void;
  acceptRideRequest: () => void;
  declineRideRequest: () => void;
  simulateIncomingRideRequest: () => void;
  riderAcceptWithFare: (amount: number) => void;
  loadHistory: () => Promise<void>;
}
