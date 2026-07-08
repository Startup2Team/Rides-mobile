import type { ApiEnvelope, ApiErrorDto, ApiIdempotencyMetadata } from './shared';

export interface ReverseGeocodeRequestDto {
  latitude: number;
  longitude: number;
  correlationId?: string | null;
}

export interface ReverseGeocodeResponseDto extends ApiEnvelope<{ address: string; latitude: number; longitude: number } | null> {}

export interface RouteCoordinateDto {
  latitude: number;
  longitude: number;
}

export interface RouteBoundsDto {
  southwest: RouteCoordinateDto;
  northeast: RouteCoordinateDto;
}

export interface RouteStepSummaryDto {
  instruction?: string | null;
  distanceMeters: number;
  durationSeconds: number;
}

export interface RoutePreviewDto {
  routeId?: string | null;
  geometry?: RouteCoordinateDto[] | null;
  geometryReference?: string | null;
  distanceMeters: number;
  durationSeconds: number;
  bounds?: RouteBoundsDto | null;
  steps?: RouteStepSummaryDto[];
  transportType?: string | null;
  estimatedAt?: string | null;
  expiresAt?: string | null;
}

export interface RouteEstimateRequestDto {
  origin: RouteCoordinateDto;
  destination: RouteCoordinateDto;
  transportType?: string | null;
  correlationId?: string | null;
}

export interface RouteEstimateResponseDto extends ApiEnvelope<RoutePreviewDto> {}

export interface RoutePreviewRequestDto extends RouteEstimateRequestDto {
  includeGeometry?: boolean;
  includeSteps?: boolean;
}

export interface RoutePreviewResponseDto extends ApiEnvelope<RoutePreviewDto> {}

export interface DistanceEstimateResponseDto extends ApiEnvelope<{ distanceMeters: number; estimatedAt?: string | null }> {}

export interface DurationEstimateResponseDto extends ApiEnvelope<{ durationSeconds: number; estimatedAt?: string | null }> {}

export interface FareEstimateRequestDto {
  vehicleType: string;
  pickup: RouteCoordinateDto;
  destination: RouteCoordinateDto;
  distanceMeters?: number | null;
  durationSeconds?: number | null;
  correlationId?: string | null;
}

export interface FareEstimateResponseDto extends ApiEnvelope<{
  estimatedAmount: number;
  currency: string;
  estimateType: 'preview';
  distanceMeters?: number | null;
  durationSeconds?: number | null;
  transportType?: string | null;
  pricingVersion?: string | null;
  expiresAt?: string | null;
  estimatedAt?: string | null;
}> {}

export interface MapErrorDto extends ApiErrorDto {}

export interface MapApiContract {
  reverseGeocode: ReverseGeocodeRequestDto;
  routeEstimate: RouteEstimateRequestDto;
  routePreview: RoutePreviewRequestDto;
  distanceEstimate: RouteEstimateRequestDto;
  durationEstimate: RouteEstimateRequestDto;
  fareEstimate: FareEstimateRequestDto;
}

export const ReverseGeocodeRequestDto = {} as ReverseGeocodeRequestDto;
export const ReverseGeocodeResponseDto = {} as ReverseGeocodeResponseDto;
export const RouteCoordinateDto = {} as RouteCoordinateDto;
export const RouteBoundsDto = {} as RouteBoundsDto;
export const RoutePreviewDto = {} as RoutePreviewDto;
export const RouteEstimateRequestDto = {} as RouteEstimateRequestDto;
export const RouteEstimateResponseDto = {} as RouteEstimateResponseDto;
export const RoutePreviewRequestDto = {} as RoutePreviewRequestDto;
export const RoutePreviewResponseDto = {} as RoutePreviewResponseDto;
export const DistanceEstimateResponseDto = {} as DistanceEstimateResponseDto;
export const DurationEstimateResponseDto = {} as DurationEstimateResponseDto;
export const FareEstimateRequestDto = {} as FareEstimateRequestDto;
export const FareEstimateResponseDto = {} as FareEstimateResponseDto;
