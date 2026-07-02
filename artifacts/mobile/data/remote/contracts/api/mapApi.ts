import type { ApiEnvelope, ApiErrorDto, ApiIdempotencyMetadata } from './shared';

export interface ReverseGeocodeRequestDto {
  latitude: number;
  longitude: number;
}

export interface ReverseGeocodeResponseDto extends ApiEnvelope<{ address: string; latitude: number; longitude: number } | null> {}

export interface RouteEstimateRequestDto {
  origin: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number };
}

export interface RouteEstimateResponseDto extends ApiEnvelope<{ distanceMeters: number; durationSeconds: number }> {}

export interface FareEstimateRequestDto {
  vehicleType: string;
  pickup: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number };
}

export interface FareEstimateResponseDto extends ApiEnvelope<{ amount: number; currency: string }> {}

export interface MapErrorDto extends ApiErrorDto {}

export interface MapApiContract {
  reverseGeocode: ReverseGeocodeRequestDto;
  routeEstimate: RouteEstimateRequestDto;
  fareEstimate: FareEstimateRequestDto;
}
