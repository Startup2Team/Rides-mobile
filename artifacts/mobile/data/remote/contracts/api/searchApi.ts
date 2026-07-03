import type { ApiEnvelope, ApiErrorDto, ApiIdempotencyMetadata, ApiPaginationRequest, ApiPaginationResponse } from './shared';

export interface SearchSuggestionDto {
  id: string;
  label: string;
  subtitle?: string | null;
  displayName?: string | null;
  shortName?: string | null;
  address?: string | null;
  latitude: number;
  longitude: number;
  category?: string | null;
  type?: string | null;
  country?: string | null;
  city?: string | null;
  district?: string | null;
  confidence?: number | null;
  relevance?: number | null;
}

export interface SearchRequestDto {
  query: string;
  near?: { latitude: number; longitude: number } | null;
  limit?: number;
  sessionId?: string | null;
  correlationId?: string | null;
}

export interface SearchResponseDto extends ApiEnvelope<{ items: SearchSuggestionDto[] } & ApiPaginationResponse> {}

export interface AutocompletePlacesRequestDto extends SearchRequestDto {}

export interface AutocompletePlacesResponseDto extends ApiEnvelope<{ items: SearchSuggestionDto[] } & ApiPaginationResponse> {}

export interface PlaceDetailRequestDto {
  placeId: string;
  sessionId?: string | null;
  correlationId?: string | null;
}

export interface PlaceDetailResponseDto extends ApiEnvelope<SearchSuggestionDto | null> {}

export interface SearchReverseGeocodeRequestDto {
  latitude: number;
  longitude: number;
  correlationId?: string | null;
}

export interface SearchReverseGeocodeResponseDto extends ApiEnvelope<SearchSuggestionDto | null> {}

export interface SaveRecentSearchRequestDto extends ApiIdempotencyMetadata {
  query: string;
}

export interface LoadRecentSearchResponseDto extends ApiEnvelope<{ queries: string[] }> {}

export interface SearchErrorDto extends ApiErrorDto {}

export interface SearchApiContract {
  search: SearchRequestDto;
  autocomplete: AutocompletePlacesRequestDto;
  placeDetail: PlaceDetailRequestDto;
  reverseGeocode: SearchReverseGeocodeRequestDto;
  saveRecentSearch: SaveRecentSearchRequestDto;
  loadRecentSearches: undefined;
  clearRecentSearches: ApiIdempotencyMetadata;
}

export const SearchSuggestionDto = {} as SearchSuggestionDto;
export const SearchRequestDto = {} as SearchRequestDto;
export const SearchResponseDto = {} as SearchResponseDto;
export const AutocompletePlacesRequestDto = {} as AutocompletePlacesRequestDto;
export const AutocompletePlacesResponseDto = {} as AutocompletePlacesResponseDto;
export const PlaceDetailRequestDto = {} as PlaceDetailRequestDto;
export const PlaceDetailResponseDto = {} as PlaceDetailResponseDto;
export const SearchReverseGeocodeRequestDto = {} as SearchReverseGeocodeRequestDto;
export const SearchReverseGeocodeResponseDto = {} as SearchReverseGeocodeResponseDto;
export const SaveRecentSearchRequestDto = {} as SaveRecentSearchRequestDto;
export const LoadRecentSearchResponseDto = {} as LoadRecentSearchResponseDto;
