import type { ApiEnvelope, ApiErrorDto, ApiIdempotencyMetadata, ApiPaginationRequest, ApiPaginationResponse } from './shared';
import type { RideActorRole } from '@/domains/ride/commands';
import type { RideLocationSnapshot, RideFareSnapshot, RideHistoryReadModel, ActiveRideReadModel, DriverRideRequestReadModel } from '@/domains/ride/readModels';

export interface RequestRideRequestDto extends ApiIdempotencyMetadata {
  rideId: string;
  pickup: RideLocationSnapshot;
  destination: RideLocationSnapshot;
  vehicleType: string;
  requestedFare?: number | null;
}

export interface RequestRideResponseDto extends ApiEnvelope<{ rideId: string; status: 'requested' }> {}

export interface CancelRideRequestDto extends ApiIdempotencyMetadata {
  rideId: string;
  reason: 'customer_before_acceptance' | 'customer_after_acceptance' | 'driver_cancelled' | 'system_cancelled';
  note?: string | null;
}

export interface CancelRideResponseDto extends ApiEnvelope<{ rideId: string; status: 'cancelled' }> {}

export interface AcceptRideRequestDto extends ApiIdempotencyMetadata {
  rideId: string;
  driverId: string;
  vehicleId?: string | null;
  acceptedFare?: number | null;
}

export interface AcceptRideResponseDto extends ApiEnvelope<{ rideId: string; status: 'accepted' }> {}

export interface DeclineRideRequestDto extends ApiIdempotencyMetadata {
  rideId: string;
  driverId: string;
  reason?: string | null;
}

export interface DeclineRideResponseDto extends ApiEnvelope<{ rideId: string; status: 'declined' }> {}

export interface StartRideRequestDto extends ApiIdempotencyMetadata {
  rideId: string;
  startedAt: string;
  location?: RideLocationSnapshot | null;
}

export interface StartRideResponseDto extends ApiEnvelope<{ rideId: string; status: 'started' }> {}

export interface CompleteRideRequestDto extends ApiIdempotencyMetadata {
  rideId: string;
  completedAt: string;
  location?: RideLocationSnapshot | null;
  distanceKm?: number | null;
  durationSeconds?: number | null;
}

export interface CompleteRideResponseDto extends ApiEnvelope<{ rideId: string; status: 'completed' }> {}

export interface ActiveRideRequestDto {
  rideId: string;
}

export interface ActiveRideResponseDto extends ApiEnvelope<ActiveRideReadModel | null> {}

export interface RideHistoryRequestDto extends ApiPaginationRequest {
  userId: string;
}

export interface RideHistoryResponseDto extends ApiEnvelope<{ items: RideHistoryReadModel[] } & ApiPaginationResponse> {}

export interface RideDetailRequestDto {
  rideId: string;
}

export interface RideDetailResponseDto extends ApiEnvelope<RideHistoryReadModel | ActiveRideReadModel | null> {}

export interface RideRatingRequestDto extends ApiIdempotencyMetadata {
  rideId: string;
  rating: number;
  comment?: string | null;
  ratedUserId?: string | null;
}

export interface RideRatingResponseDto extends ApiEnvelope<{ rideId: string; status: 'rating_submitted' }> {}

export interface RideErrorDto extends ApiErrorDto {}

export interface RideApiContract {
  requestRide: RequestRideRequestDto;
  cancelRide: CancelRideRequestDto;
  acceptRide: AcceptRideRequestDto;
  declineRide: DeclineRideRequestDto;
  startRide: StartRideRequestDto;
  completeRide: CompleteRideRequestDto;
  activeRide: ActiveRideRequestDto;
  rideHistory: RideHistoryRequestDto;
  rideDetail: RideDetailRequestDto;
  submitRating: RideRatingRequestDto;
}

export const RequestRideRequestDto = {} as RequestRideRequestDto;
