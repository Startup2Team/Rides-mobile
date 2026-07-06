import type { ApiEnvelope, ApiErrorDto, ApiIdempotencyMetadata, ApiPaginationRequest } from './shared';

export interface SavedLocationDto {
  id: string;
  label: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface ListSavedLocationsResponseDto extends ApiEnvelope<{ items: SavedLocationDto[] }> {}

export interface CreateSavedLocationRequestDto extends ApiIdempotencyMetadata {
  label: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface CreateSavedLocationResponseDto extends ApiEnvelope<SavedLocationDto> {}

export interface UpdateSavedLocationRequestDto extends ApiIdempotencyMetadata {
  id: string;
  label?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface UpdateSavedLocationResponseDto extends ApiEnvelope<SavedLocationDto> {}

export interface DeleteSavedLocationRequestDto extends ApiIdempotencyMetadata {
  id: string;
}

export interface DeleteSavedLocationResponseDto extends ApiEnvelope<{ deleted: true }> {}

export interface SavedLocationsErrorDto extends ApiErrorDto {}

export interface SavedLocationsApiContract {
  listSavedLocations: ApiPaginationRequest | undefined;
  createSavedLocation: CreateSavedLocationRequestDto;
  updateSavedLocation: UpdateSavedLocationRequestDto;
  deleteSavedLocation: DeleteSavedLocationRequestDto;
}
