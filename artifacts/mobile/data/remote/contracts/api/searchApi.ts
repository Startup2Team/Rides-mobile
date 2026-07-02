import type { ApiEnvelope, ApiErrorDto, ApiIdempotencyMetadata, ApiPaginationRequest, ApiPaginationResponse } from './shared';

export interface SearchSuggestionDto {
  id: string;
  label: string;
  subtitle?: string | null;
  latitude: number;
  longitude: number;
}

export interface SearchRequestDto {
  query: string;
  near?: { latitude: number; longitude: number } | null;
  limit?: number;
}

export interface SearchResponseDto extends ApiEnvelope<{ items: SearchSuggestionDto[] } & ApiPaginationResponse> {}

export interface SaveRecentSearchRequestDto extends ApiIdempotencyMetadata {
  query: string;
}

export interface LoadRecentSearchResponseDto extends ApiEnvelope<{ queries: string[] }> {}

export interface SearchErrorDto extends ApiErrorDto {}

export interface SearchApiContract {
  search: SearchRequestDto;
  saveRecentSearch: SaveRecentSearchRequestDto;
  loadRecentSearches: undefined;
  clearRecentSearches: ApiIdempotencyMetadata;
}
