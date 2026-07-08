import type { RideLocation, VehicleType } from '@/types';

export type RideActorRole = 'customer' | 'driver' | 'system';

export interface RideCommand<TPayload> {
  commandId: string;
  idempotencyKey: string;
  correlationId: string;
  actorId: string;
  actorRole: RideActorRole;
  timestamp: string;
  payload: TPayload;
}

export interface RequestRidePayload {
  rideId: string;
  pickup: RideLocation;
  destination: RideLocation;
  vehicleType: VehicleType;
  requestedFare?: number | null;
}

export interface CancelRidePayload {
  rideId: string;
  reason: 'customer_before_acceptance' | 'customer_after_acceptance' | 'driver_cancelled' | 'system_cancelled';
  note?: string | null;
}

export interface AcceptRidePayload {
  rideId: string;
  driverId: string;
  vehicleId?: string | null;
  acceptedFare?: number | null;
}

export interface DeclineRidePayload {
  rideId: string;
  driverId: string;
  reason?: string | null;
}

export interface StartRidePayload {
  rideId: string;
  startedAt: string;
  location?: RideLocation | null;
}

export interface CompleteRidePayload {
  rideId: string;
  completedAt: string;
  location?: RideLocation | null;
  distanceKm?: number | null;
  durationSeconds?: number | null;
}

export interface SubmitRatingPayload {
  rideId: string;
  rating: number;
  comment?: string | null;
  ratedUserId?: string | null;
}

export type RequestRideCommand = RideCommand<RequestRidePayload>;
export type CancelRideCommand = RideCommand<CancelRidePayload>;
export type AcceptRideCommand = RideCommand<AcceptRidePayload>;
export type DeclineRideCommand = RideCommand<DeclineRidePayload>;
export type StartRideCommand = RideCommand<StartRidePayload>;
export type CompleteRideCommand = RideCommand<CompleteRidePayload>;
export type SubmitRatingCommand = RideCommand<SubmitRatingPayload>;

export type RideLifecycleCommand =
  | RequestRideCommand
  | CancelRideCommand
  | AcceptRideCommand
  | DeclineRideCommand
  | StartRideCommand
  | CompleteRideCommand
  | SubmitRatingCommand;
