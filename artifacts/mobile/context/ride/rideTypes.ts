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
  completeRide: (source?: 'customer' | 'driver', driverIdentity?: {
    driverId?: string;
    driverName?: string;
    vehicleType?: VehicleType;
  }) => void;
  markArrived: () => void;
  startJourney: () => void;
  acceptRideRequest: () => void;
  declineRideRequest: () => void;
  riderAcceptWithFare: (amount: number) => void;
  loadHistory: (limit?: number) => Promise<void>;

  // ── Real-backend integration additions ───────────────────────────────────
  /** Connect the driver WS and recover any active ride. Call on the driver dashboard. */
  initDriverSession: () => void;
  /** Recover an in-progress customer ride after a restart. Call on the customer home. */
  initCustomerSession: () => Promise<void>;
  /** Push a live GPS position through the driver WS connection. */
  sendWsLocationUpdate: (lat: number, lng: number) => void;
  /** Clear ride state locally without an API call (e.g. customer rating screen). */
  clearCurrentRide: () => void;
  /** Re-fetch the current ride from the backend — WS-miss safety net. */
  refreshCurrentRide: () => Promise<void>;
}
