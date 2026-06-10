import { Coords } from '@/types';
import { reportOperationalFailure } from '@/observability/monitoring';
import {
  fetchWithResilience,
  isAbortedNetworkRequest,
  NetworkRequestError,
  parseJsonResponse,
} from '@/services/networkRequest';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';
/** Required by OpenStreetMap Nominatim usage policy (https://operations.osmfoundation.org/policies/nominatim/). */
const NOMINATIM_USER_AGENT =
  process.env.EXPO_PUBLIC_NOMINATIM_USER_AGENT ?? 'RidesRwanda/1.0 (location search)';

const RWANDA_BBOX = '28.85,-2.84,30.90,-1.04';
/** Nominatim viewbox: left, top, right, bottom (lon/lat). */
const RWANDA_VIEWBOX = '28.85,-1.04,30.90,-2.84';
const RWANDA_CENTER: Coords = { latitude: -1.9441, longitude: 30.0619 };
export const GEOCODING_TIMEOUT_MS = 8_000;

/** Kigali grid / street codes (KG 185 ST, KK 123 AV, etc.). */
const KIGALI_GRID_CODE = /\b(KG|KK|KN|KC|KR|GF|NY|NYA)\b/i;
const KIGALI_STREET_LINE =
  /\b(\d+\s+)?(KG|KK|KN|KC|KR|GF|NY|NYA)\s+\d+\s*(ST|STREET|AV|AVE|AVENUE|RD|ROAD)\b/i;
const KIGALI_HOUSE_GRID = /^\d+\s+[A-Za-z]{2,3}\s+\d+/;
const KIGALI_GRID_STREET = /^[A-Za-z]{2,3}\s+\d+\s*(ST|AV|AVE|RD|STREET|AVENUE|ROAD)\b/i;

const GENERIC_CITY_TITLES = new Set(['KIGALI', 'RWANDA']);

let nominatimLastRequestAt = 0;

export interface GeocodeSuggestion {
  id: string;
  place_name: string;
  title: string;
  subtitle?: string;
  coords: Coords;
  featureType?: string;
  source?: 'nominatim' | 'mapbox';
}

interface SearchBoxFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    mapbox_id: string;
    name: string;
    name_preferred?: string;
    full_address?: string;
    place_formatted?: string;
    feature_type: string;
    poi_category?: string[];
    coordinates?: { latitude: number; longitude: number };
  };
}

interface LegacyGeocodeFeature {
  id: string;
  place_name: string;
  center: [number, number];
  place_type?: string[];
}

interface NominatimResult {
  place_id: number;
  osm_type: string;
  osm_id: number;
  display_name: string;
  lat: string;
  lon: string;
  class: string;
  type: string;
  name?: string;
  addresstype?: string;
}

interface GeocodeFetchOptions {
  types?: string;
  limit?: number;
  signal?: AbortSignal;
}

export function isMapboxConfigured(): boolean {
  return MAPBOX_TOKEN.length > 0;
}

/** True for Kigali-style codes like "1 KG 185 ST", "98 KG 8 AV", "KK 123 st". */
export function isStreetAddressQuery(query: string): boolean {
  const q = query.trim();
  if (q.length < 3) return false;
  return (
    KIGALI_STREET_LINE.test(q) ||
    KIGALI_HOUSE_GRID.test(q) ||
    KIGALI_GRID_STREET.test(q) ||
    (KIGALI_GRID_CODE.test(q) && /\d/.test(q))
  );
}

export function buildAddressSearchQueries(query: string): string[] {
  const trimmed = query.trim().replace(/\s+/g, ' ');
  const variants = new Set<string>([trimmed, trimmed.toUpperCase()]);

  const expanded = trimmed
    .toUpperCase()
    .replace(/\bST\b/g, 'Street')
    .replace(/\bAV\b/g, 'Avenue')
    .replace(/\bAVE\b/g, 'Avenue')
    .replace(/\bRD\b/g, 'Road');
  if (expanded !== trimmed.toUpperCase()) variants.add(expanded);

  const withContext: string[] = [];
  for (const v of variants) {
    withContext.push(v);
    if (!/kigali|rwanda/i.test(v)) {
      withContext.push(`${v}, Kigali`);
    }
  }

  return [...new Set(withContext)].slice(0, 4);
}

function normalizeForMatch(text: string): string {
  return text
    .toUpperCase()
    .replace(/\bSTREET\b/g, 'ST')
    .replace(/\bAVENUE\b/g, 'AV')
    .replace(/\bROAD\b/g, 'RD')
    .replace(/[^A-Z0-9]/g, ' ');
}

function tokenOverlapScore(query: string, candidate: string): number {
  const qTokens = new Set(
    normalizeForMatch(query)
      .split(/\s+/)
      .filter(t => t.length > 0),
  );
  if (qTokens.size === 0) return 0;

  const cTokens = normalizeForMatch(candidate).split(/\s+/).filter(Boolean);
  let hits = 0;
  for (const token of cTokens) {
    if (qTokens.has(token)) hits += 1;
  }
  return hits;
}

function isLowQualityMapboxHit(query: string, item: GeocodeSuggestion): boolean {
  const qWords = query.trim().split(/\s+/).filter(Boolean);
  if (qWords.length < 2) return false;
  const title = normalizeForMatch(item.title).trim();
  return GENERIC_CITY_TITLES.has(title) || title === normalizeForMatch(query);
}

function relevanceScore(query: string, item: GeocodeSuggestion): number {
  const qNorm = normalizeForMatch(query);
  const titleNorm = normalizeForMatch(item.title);
  const placeNorm = normalizeForMatch(item.place_name);
  let score = 0;

  if (item.source === 'nominatim') score += 50;
  if (item.featureType === 'address' || item.featureType === 'tourism' || item.featureType === 'amenity') {
    score += 35;
  } else if (item.featureType === 'poi') score += 30;
  else if (item.featureType === 'street') score += 38;

  if (titleNorm.includes(qNorm) || qNorm.includes(titleNorm)) score += 70;
  if (placeNorm.includes(qNorm)) score += 50;
  if (titleNorm === qNorm) score += 90;

  score += tokenOverlapScore(query, item.title) * 18;
  score += tokenOverlapScore(query, item.place_name) * 12;

  if (isStreetAddressQuery(query)) {
    const gridChunk = query.match(/\b(KG|KK|KN|KC|KR|GF|NY|NYA)\s*\d+/i)?.[0];
    if (gridChunk && placeNorm.includes(normalizeForMatch(gridChunk))) score += 40;
  }

  return score;
}

function rankForQuery(query: string, items: GeocodeSuggestion[]): GeocodeSuggestion[] {
  return [...items].sort((a, b) => relevanceScore(query, b) - relevanceScore(query, a));
}

function mapNominatimResult(item: NominatimResult): GeocodeSuggestion {
  const parts = item.display_name.split(',').map(p => p.trim());
  const title = item.name ?? parts[0] ?? item.display_name;
  const subtitle = parts.length > 1 ? parts.slice(1).join(', ') : 'Rwanda';

  const featureType =
    item.class === 'tourism' || item.class === 'amenity' || item.class === 'shop'
      ? 'poi'
      : item.addresstype ?? item.class;

  return {
    id: `osm-${item.osm_type}-${item.osm_id}`,
    place_name: item.display_name,
    title,
    subtitle,
    coords: { latitude: Number.parseFloat(item.lat), longitude: Number.parseFloat(item.lon) },
    featureType,
    source: 'nominatim',
  };
}

function mapSearchBoxFeature(feature: SearchBoxFeature): GeocodeSuggestion {
  const props = feature.properties;
  const title = props.name_preferred ?? props.name;
  const coords = props.coordinates
    ? { latitude: props.coordinates.latitude, longitude: props.coordinates.longitude }
    : {
        latitude: feature.geometry.coordinates[1],
        longitude: feature.geometry.coordinates[0],
      };

  const place_name =
    props.full_address ??
    (props.place_formatted ? `${title}, ${props.place_formatted}` : title);

  const subtitle =
    props.feature_type === 'poi'
      ? props.poi_category?.[0] ?? 'Business or place'
      : props.feature_type === 'address'
        ? 'Address'
        : props.place_formatted ?? 'Location';

  return {
    id: props.mapbox_id,
    place_name,
    title,
    subtitle,
    coords,
    featureType: props.feature_type,
    source: 'mapbox',
  };
}

function mapLegacyFeature(feature: LegacyGeocodeFeature): GeocodeSuggestion {
  const title = feature.place_name.split(',')[0]?.trim() || feature.place_name;
  const subtitle = feature.place_name.includes(',')
    ? feature.place_name.slice(feature.place_name.indexOf(',') + 1).trim()
    : 'Address';

  return {
    id: feature.id,
    place_name: feature.place_name,
    title,
    subtitle,
    coords: { latitude: feature.center[1], longitude: feature.center[0] },
    featureType: feature.place_type?.[0] ?? 'address',
    source: 'mapbox',
  };
}

function dedupeSuggestions(items: GeocodeSuggestion[]): GeocodeSuggestion[] {
  const seenIds = new Set<string>();
  const seenCoords = new Set<string>();

  return items.filter(item => {
    if (seenIds.has(item.id)) return false;
    const coordKey = `${item.coords.latitude.toFixed(4)},${item.coords.longitude.toFixed(4)}`;
    if (seenCoords.has(coordKey)) return false;
    seenIds.add(item.id);
    seenCoords.add(coordKey);
    return true;
  });
}

function waitWithSignal(delayMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(
        new NetworkRequestError({
          kind: 'aborted',
          service: 'nominatim',
          operation: 'geocoding',
        }),
      );
      return;
    }

    const finish = () => {
      signal?.removeEventListener('abort', abort);
      resolve();
    };
    const timer = setTimeout(finish, delayMs);
    const abort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      reject(
        new NetworkRequestError({
          kind: 'aborted',
          service: 'nominatim',
          operation: 'geocoding',
        }),
      );
    };
    signal?.addEventListener('abort', abort, { once: true });
  });
}

async function waitForNominatimSlot(signal?: AbortSignal): Promise<void> {
  const elapsed = Date.now() - nominatimLastRequestAt;
  const waitMs = Math.max(0, 1100 - elapsed);
  if (waitMs > 0) {
    await waitWithSignal(waitMs, signal);
  }
  nominatimLastRequestAt = Date.now();
}

/**
 * OpenStreetMap search — best coverage for Kigali hotels, cafés, and grid addresses.
 * Same data source as most labels on the Mapbox map style.
 */
async function fetchNominatimSearch(
  query: string,
  signal?: AbortSignal,
): Promise<GeocodeSuggestion[]> {
  await waitForNominatimSlot(signal);

  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '10',
    countrycodes: 'rw',
    viewbox: RWANDA_VIEWBOX,
    bounded: '1',
    addressdetails: '1',
  });

  const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
  const res = await fetchWithResilience(
    url,
    {
      headers: { 'User-Agent': NOMINATIM_USER_AGENT, Accept: 'application/json' },
      signal,
    },
    {
      service: 'nominatim',
      operation: 'geocoding',
      timeoutMs: GEOCODING_TIMEOUT_MS,
    },
  );

  const json = await parseJsonResponse<NominatimResult[]>(res, 'nominatim', 'geocoding');
  return json.map(mapNominatimResult);
}

async function fetchSearchBoxForward(
  query: string,
  proximity: Coords,
  options?: GeocodeFetchOptions,
): Promise<GeocodeSuggestion[]> {
  if (!MAPBOX_TOKEN) return [];

  const params = new URLSearchParams({
    access_token: MAPBOX_TOKEN,
    q: query,
    language: 'en',
    limit: String(options?.limit ?? 8),
    country: 'rw',
    auto_complete: 'true',
    proximity: `${proximity.longitude},${proximity.latitude}`,
  });
  if (options?.types) params.set('types', options.types);

  const url = `https://api.mapbox.com/search/searchbox/v1/forward?${params.toString()}`;
  const res = await fetchWithResilience(
    url,
    { signal: options?.signal },
    {
      service: 'mapbox',
      operation: 'searchbox-geocoding',
      timeoutMs: GEOCODING_TIMEOUT_MS,
      retries: 1,
    },
  );

  const json = await parseJsonResponse<{ features?: SearchBoxFeature[] }>(
    res,
    'mapbox',
    'searchbox-geocoding',
  );
  return (json.features ?? []).map(mapSearchBoxFeature);
}

async function fetchLegacyGeocode(
  query: string,
  proximity: Coords,
  options?: GeocodeFetchOptions,
): Promise<GeocodeSuggestion[]> {
  if (!MAPBOX_TOKEN) return [];

  const params = new URLSearchParams({
    access_token: MAPBOX_TOKEN,
    autocomplete: 'true',
    limit: String(options?.limit ?? 8),
    country: 'rw',
    bbox: RWANDA_BBOX,
    language: 'en',
    proximity: `${proximity.longitude},${proximity.latitude}`,
  });
  if (options?.types) params.set('types', options.types);

  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/` +
    `${encodeURIComponent(query)}.json` +
    `?${params.toString()}`;

  const res = await fetchWithResilience(
    url,
    { signal: options?.signal },
    {
      service: 'mapbox',
      operation: 'legacy-geocoding',
      timeoutMs: GEOCODING_TIMEOUT_MS,
      retries: 1,
    },
  );

  const json = await parseJsonResponse<{ features?: LegacyGeocodeFeature[] }>(
    res,
    'mapbox',
    'legacy-geocoding',
  );
  return (json.features ?? []).map(mapLegacyFeature);
}

/**
 * Location search for pickup/dropoff in Rwanda.
 * Primary: OpenStreetMap (hotels, businesses, KG addresses).
 * Supplement: Mapbox when token is configured.
 */
export async function geocodeAddress(
  query: string,
  proximity?: Coords,
  options?: { signal?: AbortSignal },
): Promise<GeocodeSuggestion[]> {
  if (!query || query.length < 2) return [];

  try {
    const nearby = proximity ?? RWANDA_CENTER;
    const trimmed = query.trim();
    const streetAddress = isStreetAddressQuery(trimmed);
    const providerFailures: unknown[] = [];

    const nominatimQueries = streetAddress
      ? buildAddressSearchQueries(trimmed)
      : [trimmed];

    const nominatimResults: GeocodeSuggestion[] = [];
    for (const q of nominatimQueries.slice(0, streetAddress ? 2 : 1)) {
      const batch = await fetchProviderFallback(
        () => fetchNominatimSearch(q, options?.signal),
        providerFailures,
      );
      nominatimResults.push(...batch);
    }

    const mapboxTasks: Promise<GeocodeSuggestion[]>[] = [];
    if (MAPBOX_TOKEN) {
      mapboxTasks.push(
        fetchProviderFallback(
          () => fetchSearchBoxForward(trimmed, nearby, { signal: options?.signal }),
          providerFailures,
        ),
        fetchProviderFallback(
          () => fetchLegacyGeocode(trimmed, nearby, { limit: 8, signal: options?.signal }),
          providerFailures,
        ),
      );
      if (streetAddress) {
        mapboxTasks.push(
          fetchProviderFallback(
            () =>
              fetchLegacyGeocode(`${trimmed}, Kigali`, nearby, {
                types: 'address,street,place',
                limit: 6,
                signal: options?.signal,
              }),
            providerFailures,
          ),
        );
      }
    }

    const mapboxBatches = mapboxTasks.length > 0 ? await Promise.all(mapboxTasks) : [];
    const mapboxFiltered = mapboxBatches
      .flat()
      .filter(item => !isLowQualityMapboxHit(trimmed, item));

    const merged = dedupeSuggestions([...nominatimResults, ...mapboxFiltered]);
    if (merged.length === 0 && providerFailures.length > 0) {
      reportSanitizedGeocodingFailure(providerFailures[0]);
    }
    return rankForQuery(trimmed, merged).slice(0, 12);
  } catch (error) {
    if (isAbortedNetworkRequest(error)) throw error;
    reportSanitizedGeocodingFailure(error);
    throw error;
  }
}

function reportSanitizedGeocodingFailure(error: unknown) {
  reportOperationalFailure('map.geocoding.search', error, {
    service: error instanceof NetworkRequestError ? error.service : 'unknown',
    operation: error instanceof NetworkRequestError ? error.operation : 'geocoding',
    kind: error instanceof NetworkRequestError ? error.kind : 'unknown',
    status: error instanceof NetworkRequestError ? error.status : undefined,
    attempt: error instanceof NetworkRequestError ? error.attempt : undefined,
  });
}

async function fetchProviderFallback(
  request: () => Promise<GeocodeSuggestion[]>,
  failures: unknown[],
): Promise<GeocodeSuggestion[]> {
  try {
    return await request();
  } catch (error) {
    if (isAbortedNetworkRequest(error)) throw error;
    failures.push(error);
    return [];
  }
}
