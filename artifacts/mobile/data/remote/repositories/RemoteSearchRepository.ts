import type { SearchRepository } from '@/data/repositories/interfaces';
import { searchRepository as localSearchRepository } from '@/data/repositories';
import type { GeocodeSuggestion } from '@/services/geocoding';
import type { Coords, RideLocation } from '@/types';
import { observability } from '@/observability/context/observabilityContext';
import { BackendClient } from '../client/backendClient';
import type {
  AutocompletePlacesResponseDto,
  PlaceDetailResponseDto,
  SearchResponseDto,
  SearchReverseGeocodeResponseDto,
} from '../contracts/api';
import { BackendError, createBackendUnavailableError } from '../contracts/backendErrors';
import {
  domainToSearchRequestDto,
  domainToSearchReverseGeocodeDto,
  dtoListToDomainSearchResults,
  dtoToDomainPlaceDetail,
  dtoToDomainReverseGeocode,
  errorToRepositoryFailureSearch,
  type SearchPlacesInput,
} from '../mappers/searchMapper';
import {
  compareLocation,
  compareSearchResults,
  defaultSearchComparisonPolicy,
  type SearchComparisonPolicy,
} from './searchMapComparisonPolicy';

export interface RemoteSearchRepositoryOptions {
  client?: BackendClient;
  transportLabel?: 'remote' | 'shadow_remote' | 'hybrid';
}

export interface SearchPlacesRepository extends SearchRepository {
  searchPlaces(input: SearchPlacesInput): Promise<GeocodeSuggestion[]>;
  autocompletePlaces(input: SearchPlacesInput): Promise<GeocodeSuggestion[]>;
  getPlaceDetail(placeId: string, options?: { sessionId?: string | null; correlationId?: string | null }): Promise<GeocodeSuggestion | null>;
  reverseGeocode(coords: Coords): Promise<RideLocation | null>;
}

type SearchShadowLocalRepository = SearchRepository & Partial<SearchPlacesRepository>;

function summarizeShape(value: unknown) {
  if (Array.isArray(value)) return `array:${value.length}`;
  if (value === null) return 'null';
  if (typeof value === 'object') return `object:${Object.keys(value as Record<string, unknown>).length}`;
  return typeof value;
}

function safeQueryMetadata(query?: string | null) {
  return {
    queryLength: query?.trim().length ?? 0,
    hasQuery: Boolean(query?.trim()),
  };
}

function recordTelemetry(
  event: 'search remote shadow request' | 'search remote shadow success' | 'search remote shadow failure',
  context: {
    method: string;
    latencyMs: number;
    responseShape: string;
    transport: 'remote' | 'shadow_remote' | 'hybrid';
    query?: string | null;
    resultCount?: number;
    error?: unknown;
  },
) {
  observability.metrics.counter('search.remote.shadow', 1, {
    method: context.method,
    transport: context.transport,
    event,
  });
  observability.metrics.histogram('search.remote.latency_ms', context.latencyMs, {
    method: context.method,
    transport: context.transport,
  });
  observability.logger.info('SearchRemoteShadow', {
    event,
    method: context.method,
    transport: context.transport,
    latencyMs: context.latencyMs,
    responseShape: context.responseShape,
    resultCount: context.resultCount,
    ...safeQueryMetadata(context.query),
    error: context.error instanceof Error ? context.error.name : undefined,
  });
}

function recordMismatch(method: string, category: string, metadata: Record<string, unknown>) {
  observability.metrics.counter('search.remote.semantic_mismatch', 1, { method, category });
  observability.logger.warn('SearchRemoteShadowMismatch', {
    method,
    category,
    ...metadata,
  });
}

function resolveClient(method: string, client?: BackendClient) {
  if (!client) throw createBackendUnavailableError('search', method, 'remote');
  return client;
}

function toRepositoryFailure(error: unknown): BackendError {
  return errorToRepositoryFailureSearch(error);
}

export class RemoteSearchRepository implements SearchPlacesRepository {
  private readonly client?: BackendClient;
  private readonly transportLabel: 'remote' | 'shadow_remote' | 'hybrid';

  constructor(options: RemoteSearchRepositoryOptions = {}) {
    this.client = options.client;
    this.transportLabel = options.transportLabel ?? 'remote';
  }

  private async shadow<T>(method: string, query: string | null, execute: () => Promise<T>): Promise<T> {
    const startedAt = Date.now();
    recordTelemetry('search remote shadow request', {
      method,
      latencyMs: 0,
      responseShape: 'pending',
      transport: this.transportLabel,
      query,
    });
    try {
      const value = await execute();
      recordTelemetry('search remote shadow success', {
        method,
        latencyMs: Date.now() - startedAt,
        responseShape: summarizeShape(value),
        transport: this.transportLabel,
        query,
        resultCount: Array.isArray(value) ? value.length : undefined,
      });
      return value;
    } catch (error) {
      recordTelemetry('search remote shadow failure', {
        method,
        latencyMs: Date.now() - startedAt,
        responseShape: summarizeShape(error),
        transport: this.transportLabel,
        query,
        error,
      });
      throw toRepositoryFailure(error);
    }
  }

  async search(query: string, options?: { near?: Coords; limit?: number }): Promise<GeocodeSuggestion[]> {
    return this.searchPlaces({ query, ...options });
  }

  async searchPlaces(input: SearchPlacesInput): Promise<GeocodeSuggestion[]> {
    return this.shadow('searchPlaces', input.query, async () => {
      const client = resolveClient('searchPlaces', this.client);
      const response = await client.post<SearchResponseDto>('/v1/search/places', {
        body: domainToSearchRequestDto(input),
      });
      return dtoListToDomainSearchResults(response.data.data.items);
    });
  }

  async autocompletePlaces(input: SearchPlacesInput): Promise<GeocodeSuggestion[]> {
    return this.shadow('autocompletePlaces', input.query, async () => {
      const client = resolveClient('autocompletePlaces', this.client);
      const response = await client.post<AutocompletePlacesResponseDto>('/v1/search/autocomplete', {
        body: domainToSearchRequestDto(input),
      });
      return dtoListToDomainSearchResults(response.data.data.items);
    });
  }

  async getPlaceDetail(placeId: string, options: { sessionId?: string | null; correlationId?: string | null } = {}): Promise<GeocodeSuggestion | null> {
    return this.shadow('getPlaceDetail', null, async () => {
      const client = resolveClient('getPlaceDetail', this.client);
      const response = await client.get<PlaceDetailResponseDto>(`/v1/search/places/${placeId}`, {
        body: options,
      });
      return dtoToDomainPlaceDetail(response.data.data);
    });
  }

  async reverseGeocode(coords: Coords): Promise<RideLocation | null> {
    return this.shadow('reverseGeocode', null, async () => {
      const client = resolveClient('reverseGeocode', this.client);
      const response = await client.post<SearchReverseGeocodeResponseDto>('/v1/search/reverse-geocode', {
        body: domainToSearchReverseGeocodeDto(coords),
      });
      return dtoToDomainReverseGeocode(response.data.data);
    });
  }

  async saveRecentQuery(_query: string): Promise<void> {
    throw createBackendUnavailableError('search', 'saveRecentQuery', this.transportLabel);
  }

  async loadRecentQueries(): Promise<string[]> {
    throw createBackendUnavailableError('search', 'loadRecentQueries', this.transportLabel);
  }

  async clearRecentQueries(): Promise<void> {
    throw createBackendUnavailableError('search', 'clearRecentQueries', this.transportLabel);
  }
}

export function createRemoteSearchRepositoryPrototype(options: RemoteSearchRepositoryOptions = {}) {
  return new RemoteSearchRepository(options);
}

export function createSearchShadowRepository(options: {
  localRepository?: SearchShadowLocalRepository;
  remoteRepository: RemoteSearchRepository;
  enableRemoteDiagnostics?: boolean;
  comparisonPolicy?: Partial<SearchComparisonPolicy>;
}): SearchPlacesRepository {
  const localRepository: SearchShadowLocalRepository = options.localRepository ?? localSearchRepository;
  const { remoteRepository } = options;
  const enableRemoteDiagnostics = options.enableRemoteDiagnostics === true;
  const comparisonPolicy = { ...defaultSearchComparisonPolicy, ...options.comparisonPolicy };

  async function runRemote<T>(method: string, remote: () => Promise<T>, compare?: (remoteValue: T) => void) {
    if (!enableRemoteDiagnostics) return;
    try {
      const remoteValue = await remote();
      compare?.(remoteValue);
    } catch (error) {
      observability.logger.warn('SearchRemoteShadowFailure', {
        method,
        error: error instanceof Error ? error.name : 'unknown',
      });
    }
  }

  return {
    async search(query: string, options?: { near?: Coords; limit?: number }) {
      return this.searchPlaces({ query, ...options });
    },
    async searchPlaces(input: SearchPlacesInput) {
      const local = localRepository.searchPlaces
        ? await localRepository.searchPlaces(input)
        : await localRepository.search(input.query, { near: input.near, limit: input.limit });
      await runRemote('searchPlaces', () => remoteRepository.searchPlaces(input), remote => {
        const comparison = compareSearchResults(local, remote, comparisonPolicy);
        if (comparison.mismatch) recordMismatch('searchPlaces', comparison.category, comparison);
      });
      return local;
    },
    async autocompletePlaces(input: SearchPlacesInput) {
      const local = localRepository.autocompletePlaces
        ? await localRepository.autocompletePlaces(input)
        : await localRepository.search(input.query, { near: input.near, limit: input.limit });
      await runRemote('autocompletePlaces', () => remoteRepository.autocompletePlaces(input), remote => {
        const comparison = compareSearchResults(local, remote, comparisonPolicy);
        if (comparison.mismatch) recordMismatch('autocompletePlaces', comparison.category, comparison);
      });
      return local;
    },
    async getPlaceDetail(placeId: string, detailOptions?: { sessionId?: string | null; correlationId?: string | null }) {
      const local = localRepository.getPlaceDetail ? await localRepository.getPlaceDetail(placeId, detailOptions) : null;
      await runRemote('getPlaceDetail', () => remoteRepository.getPlaceDetail(placeId, detailOptions), remote => {
        const comparison = compareSearchResults(local ? [local] : [], remote ? [remote] : [], comparisonPolicy);
        if (comparison.mismatch) recordMismatch('getPlaceDetail', comparison.category, comparison);
      });
      return local;
    },
    async reverseGeocode(coords: Coords) {
      const local = localRepository.reverseGeocode ? await localRepository.reverseGeocode(coords) : null;
      await runRemote('reverseGeocode', () => remoteRepository.reverseGeocode(coords), remote => {
        const comparison = compareLocation(local, remote, comparisonPolicy);
        if (comparison.mismatch) recordMismatch('reverseGeocode', comparison.category, comparison);
      });
      return local;
    },
    async saveRecentQuery(query: string) {
      await localRepository.saveRecentQuery(query);
    },
    async loadRecentQueries() {
      return localRepository.loadRecentQueries();
    },
    async clearRecentQueries() {
      await localRepository.clearRecentQueries();
    },
  };
}
