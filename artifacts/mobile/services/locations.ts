import { toBackendTransportType } from '@/constants/vehicles';
import { getAppBackendClient } from '@/data/remote/client/appBackendClient';
import { expectField } from '@/observability/monitoring';
import type { GeocodeSuggestion } from '@/services/geocoding';
import {
  toSavedLocationDomain,
  type SavedLocation,
  type SavedLocationDto,
} from '@/services/savedLocations';
import type { Coords, VehicleType } from '@/types';

// Real backend place data under /api/v1/locations. These endpoints replace paid
// Mapbox calls where they can (curated landmarks, the Rwanda admin hierarchy, a
// geohash-keyed route cache) and give recent destinations a home that survives a
// reinstall. Mapbox stays the fallback — see services/geocoding.ts.

export interface Landmark {
  id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  geohash6: string;
}

/** One node of the Rwanda province → district → sector → cell → village tree. */
export interface AdminUnit {
  id: string;
  parentId: string | null;
  level: string;
  name: string;
  /** Human-readable ancestry, e.g. "Kigali City / Gasabo / Remera". */
  path: string;
}

export interface RecentLocation {
  id: string;
  address: string;
  latitude: number;
  longitude: number;
  useCount: number;
  lastUsedAt: string;
}

/** A destination derived from the rider's completed rides (no id — not deletable). */
export interface RecentDestination {
  address: string;
  latitude: number;
  longitude: number;
}

export interface LocationSuggestions {
  savedLocations: SavedLocation[];
  recentLocations: RecentLocation[];
  recentDestinations: RecentDestination[];
  landmarks: Landmark[];
}

/** A distance/duration pair the platform already paid a routing provider for. */
export interface CachedRoute {
  cacheKey: string;
  distanceKm: number;
  durationMinutes: number;
  avgFareRwf: number | null;
  useCount: number;
}

interface LandmarkDto {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  geohash6: string;
}

interface AdminUnitDto {
  id: string;
  parent_id: string | null;
  level: string;
  name: string;
  path: string;
}

interface RecentLocationDto {
  id: string;
  address: string;
  lat: number;
  lng: number;
  use_count: number;
  last_used_at: string;
}

interface RecentDestinationDto {
  address: string;
  lat: number;
  lng: number;
}

interface SuggestionsDto {
  saved_locations: SavedLocationDto[] | null;
  recent_locations: RecentLocationDto[] | null;
  recent_destinations: RecentDestinationDto[] | null;
  landmarks: LandmarkDto[] | null;
}

interface RouteDto {
  cache_key: string;
  origin_geohash: string;
  dest_geohash: string;
  distance_km: number;
  duration_minutes: number;
  avg_fare_rwf?: number | null;
  use_count: number;
}

interface Envelope<T> {
  data: T;
}

function toLandmark(dto: LandmarkDto): Landmark {
  return {
    id: dto.id,
    name: dto.name,
    category: dto.category,
    latitude: dto.lat,
    longitude: dto.lng,
    geohash6: dto.geohash6,
  };
}

function toAdminUnit(dto: AdminUnitDto): AdminUnit {
  return {
    id: dto.id,
    parentId: dto.parent_id,
    level: dto.level,
    name: dto.name,
    path: dto.path,
  };
}

function toRecentLocation(dto: RecentLocationDto): RecentLocation {
  return {
    id: dto.id,
    address: dto.address,
    latitude: dto.lat,
    longitude: dto.lng,
    useCount: dto.use_count,
    lastUsedAt: dto.last_used_at,
  };
}

function toRecentDestination(dto: RecentDestinationDto): RecentDestination {
  return { address: dto.address, latitude: dto.lat, longitude: dto.lng };
}

function toCachedRoute(dto: RouteDto): CachedRoute {
  return {
    cacheKey: dto.cache_key,
    distanceKm: dto.distance_km,
    durationMinutes: dto.duration_minutes,
    avgFareRwf: dto.avg_fare_rwf ?? null,
    useCount: dto.use_count,
  };
}

// ── Landmarks & admin units (public reference data) ─────────────────────────

// Backend shape: { data: { landmarks: [ ... ] } }.
export async function listLandmarks(): Promise<Landmark[]> {
  const response = await getAppBackendClient().get<
    Envelope<{ landmarks: LandmarkDto[] | null } | null>
  >('/v1/locations/landmarks');
  const payload = response.data.data;
  expectField(payload, 'landmarks', 'locations.landmarks');
  return (payload?.landmarks ?? []).map(toLandmark);
}

/** Direct children of a node, or the five provinces when parentId is omitted. */
export async function listAdminUnits(parentId?: string | null): Promise<AdminUnit[]> {
  const search = new URLSearchParams();
  if (parentId) search.set('parent_id', parentId);
  const qs = search.toString();

  const response = await getAppBackendClient().get<
    Envelope<{ admin_units: AdminUnitDto[] | null } | null>
  >(`/v1/locations/admin-units${qs ? `?${qs}` : ''}`);
  const payload = response.data.data;
  expectField(payload, 'admin_units', 'locations.adminUnits');
  return (payload?.admin_units ?? []).map(toAdminUnit);
}

/** Autocomplete over unit names. The backend returns nothing below 2 chars. */
export async function searchAdminUnits(
  query: string,
  level?: string | null,
): Promise<AdminUnit[]> {
  const search = new URLSearchParams({ q: query });
  if (level) search.set('level', level);

  const response = await getAppBackendClient().get<
    Envelope<{ admin_units: AdminUnitDto[] | null } | null>
  >(`/v1/locations/admin-units/search?${search.toString()}`);
  const payload = response.data.data;
  expectField(payload, 'admin_units', 'locations.adminUnitSearch');
  return (payload?.admin_units ?? []).map(toAdminUnit);
}

// ── Personalised suggestions & recents ──────────────────────────────────────

// Backend shape: the four lists sit directly on the data envelope.
export async function fetchLocationSuggestions(): Promise<LocationSuggestions> {
  const response = await getAppBackendClient().get<Envelope<SuggestionsDto | null>>(
    '/v1/locations/suggestions',
  );
  const payload = response.data.data;
  expectField(payload, 'landmarks', 'locations.suggestions');
  return {
    savedLocations: (payload?.saved_locations ?? []).map(toSavedLocationDomain),
    recentLocations: (payload?.recent_locations ?? []).map(toRecentLocation),
    recentDestinations: (payload?.recent_destinations ?? []).map(toRecentDestination),
    landmarks: (payload?.landmarks ?? []).map(toLandmark),
  };
}

export async function listRecentLocations(): Promise<RecentLocation[]> {
  const response = await getAppBackendClient().get<
    Envelope<{ recent_locations: RecentLocationDto[] | null } | null>
  >('/v1/locations/recent');
  const payload = response.data.data;
  expectField(payload, 'recent_locations', 'locations.recent');
  return (payload?.recent_locations ?? []).map(toRecentLocation);
}

export interface RecentLocationInput {
  address: string;
  latitude: number;
  longitude: number;
}

/** Upsert — re-picking the same address bumps it instead of duplicating it. */
export async function recordRecentLocation(input: RecentLocationInput): Promise<void> {
  await getAppBackendClient().post('/v1/locations/recent', {
    body: { address: input.address, lat: input.latitude, lng: input.longitude },
  });
}

export async function deleteRecentLocation(id: string): Promise<void> {
  await getAppBackendClient().delete(`/v1/locations/recent/${id}`);
}

// ── Route cache ─────────────────────────────────────────────────────────────

export interface RouteCacheQuery {
  origin: Coords;
  destination: Coords;
  vehicleType: VehicleType;
}

function routeCacheParams(query: RouteCacheQuery): URLSearchParams {
  return new URLSearchParams({
    pickup_lat: String(query.origin.latitude),
    pickup_lng: String(query.origin.longitude),
    dest_lat: String(query.destination.latitude),
    dest_lng: String(query.destination.longitude),
    vehicle_type: toBackendTransportType(query.vehicleType),
  });
}

/**
 * Looks up a route the platform has already measured. The key is a geohash-6
 * pair (~1.2 km cells) plus the vehicle type, so nearby trips share an entry.
 * Resolves to null on a miss — the backend answers 200 with `route: null`.
 */
export async function fetchCachedRoute(query: RouteCacheQuery): Promise<CachedRoute | null> {
  const response = await getAppBackendClient().get<Envelope<{ route: RouteDto | null } | null>>(
    `/v1/locations/route?${routeCacheParams(query).toString()}`,
  );
  const route = response.data.data?.route;
  return route ? toCachedRoute(route) : null;
}

export interface RouteCacheEntry extends RouteCacheQuery {
  distanceKm: number;
  durationMinutes: number;
}

/**
 * Writes a freshly measured route back so the next rider on the same corridor —
 * and the server's fare estimator — get it without a provider call. The backend
 * rejects non-positive distance/duration, so callers must have a real reading.
 */
export async function recordRouteMetrics(entry: RouteCacheEntry): Promise<CachedRoute | null> {
  const response = await getAppBackendClient().post<
    Envelope<{ route: RouteDto | null } | null>
  >('/v1/locations/route', {
    body: {
      pickup_lat: entry.origin.latitude,
      pickup_lng: entry.origin.longitude,
      dest_lat: entry.destination.latitude,
      dest_lng: entry.destination.longitude,
      vehicle_type: toBackendTransportType(entry.vehicleType),
      distance_km: entry.distanceKm,
      duration_minutes: entry.durationMinutes,
    },
  });
  const route = response.data.data?.route;
  return route ? toCachedRoute(route) : null;
}

// ── Adapters into the search UI ─────────────────────────────────────────────

/**
 * Presents a curated landmark the way a geocoder result is presented, so the
 * destination list can mix free backend hits with paid Mapbox/OSM ones.
 */
export function landmarkToSuggestion(landmark: Landmark): GeocodeSuggestion {
  return {
    id: `landmark-${landmark.id}`,
    place_name: landmark.name,
    title: landmark.name,
    subtitle: landmark.category,
    coords: { latitude: landmark.latitude, longitude: landmark.longitude },
    featureType: 'poi',
  };
}

/**
 * Turns an admin unit into a geocoder query. The backend stores the path
 * broadest-first ("Kigali City > Gasabo > Remera"); geocoders want the opposite,
 * most specific first.
 */
export function adminUnitSearchText(unit: AdminUnit): string {
  const segments = unit.path.split('>').map(segment => segment.trim()).filter(Boolean);
  return (segments.length > 0 ? segments.reverse() : [unit.name]).join(', ');
}

/** Case-insensitive contains match on name or category, best-effort ranked. */
export function filterLandmarks(landmarks: Landmark[], query: string, limit = 5): Landmark[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return [];
  return landmarks
    .filter(
      landmark =>
        landmark.name.toLowerCase().includes(needle) ||
        landmark.category.toLowerCase().includes(needle),
    )
    .sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(needle) ? 0 : 1;
      const bStarts = b.name.toLowerCase().startsWith(needle) ? 0 : 1;
      return aStarts - bStarts || a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}
