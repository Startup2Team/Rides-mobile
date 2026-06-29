export type RideStatus =
  | 'draft'
  | 'requested'
  | 'matching'
  | 'offered'
  | 'accepted'
  | 'driver_en_route'
  | 'driver_arrived'
  | 'started'
  | 'completed'
  | 'fare_finalized'
  | 'payment_authorized'
  | 'payment_completed'
  | 'rating_submitted'
  | 'cancelled'
  | 'timeout';

export type RidePhase = 'pre_match' | 'matching' | 'accepted' | 'active' | 'settlement' | 'closed';

export interface RideParticipant {
  userId: string;
  role: 'customer' | 'driver' | 'system';
  displayName?: string | null;
}

export interface RideLocationSnapshot {
  address: string;
  latitude: number;
  longitude: number;
  capturedAt?: string | null;
}

export interface RideFareSnapshot {
  amount: number;
  currency: string;
  source: 'estimate' | 'negotiated' | 'metered' | 'adjusted' | 'final';
  finalizedAt?: string | null;
}

export interface ActiveRideReadModel {
  rideId: string;
  status: RideStatus;
  phase: RidePhase;
  customer: RideParticipant;
  driver?: RideParticipant | null;
  pickup: RideLocationSnapshot;
  destination: RideLocationSnapshot;
  fare?: RideFareSnapshot | null;
  updatedAt: string;
  sequenceNumber: number;
}

export interface RideHistoryReadModel {
  rideId: string;
  status: Extract<RideStatus, 'completed' | 'cancelled' | 'timeout' | 'rating_submitted'>;
  customer: RideParticipant;
  driver?: RideParticipant | null;
  pickup: RideLocationSnapshot;
  destination: RideLocationSnapshot;
  fare?: RideFareSnapshot | null;
  requestedAt: string;
  completedAt?: string | null;
  cancelledAt?: string | null;
  sequenceNumber: number;
}

export interface DriverRideRequestReadModel {
  rideId: string;
  status: Extract<RideStatus, 'requested' | 'matching' | 'offered' | 'accepted' | 'cancelled' | 'timeout'>;
  customer: RideParticipant;
  pickup: RideLocationSnapshot;
  destination: RideLocationSnapshot;
  offeredFare?: RideFareSnapshot | null;
  expiresAt?: string | null;
  sequenceNumber: number;
}
