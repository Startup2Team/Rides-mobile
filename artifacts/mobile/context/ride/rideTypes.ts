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
  // Driver-side only: the customer's live position during an active ride
  // (from `customer_location` WS events / the ride_state replay's
  // customer_lat/customer_lng). Always null on the customer's own context.
  customerLocation: Coords | null;
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
  // Free-text negotiation messages (as opposed to a fare offer). Awaited so
  // the input dock can surface a failed-to-send state; reject on backend
  // failure, resolve once the message call succeeds (or is a no-op with no
  // backend ride yet). `messageId` lets a retry reuse the same optimistic
  // bubble instead of appending a duplicate — omit it on a first send.
  // Resolves with the id the message was (or will be) tracked under.
  sendNegotiationMessage: (text: string, messageId?: string) => Promise<string>;
  sendDriverNegotiationMessage: (text: string, messageId?: string) => Promise<string>;
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
