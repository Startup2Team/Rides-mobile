import { getAppBackendClient } from '@/data/remote/client/appBackendClient';

// Driver demand heatmap: GET /api/v1/driver/demand-heatmap. The backend buckets
// recent ride pickups onto a ~110 m grid, busiest cells first. Read-only and
// safe to poll. lat+lng (with radius) scope it to the driver's area; omitting
// them returns the busiest cells platform-wide.

export interface DemandCell {
  latitude: number;
  longitude: number;
  count: number;
}

export interface DemandHeatmap {
  windowMinutes: number;
  radiusMeters: number;
  scoped: boolean;
  cells: DemandCell[];
}

interface CellDto {
  lat: number;
  lng: number;
  count: number;
}

interface HeatmapDto {
  window_minutes: number;
  radius_meters: number;
  scoped: boolean;
  points?: CellDto[] | null;
}

interface Envelope<T> {
  data: T;
}

export interface DemandHeatmapQuery {
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  windowMin?: number;
}

export async function fetchDemandHeatmap(params: DemandHeatmapQuery = {}): Promise<DemandHeatmap> {
  const search = new URLSearchParams();
  if (params.latitude != null && params.longitude != null) {
    search.set('lat', String(params.latitude));
    search.set('lng', String(params.longitude));
  }
  if (params.radiusKm != null) search.set('radius_km', String(params.radiusKm));
  if (params.windowMin != null) search.set('window_min', String(params.windowMin));
  const qs = search.toString();

  const response = await getAppBackendClient().get<Envelope<HeatmapDto>>(
    `/v1/driver/demand-heatmap${qs ? `?${qs}` : ''}`,
  );
  const dto = response.data.data;
  return {
    windowMinutes: dto.window_minutes,
    radiusMeters: dto.radius_meters,
    scoped: dto.scoped,
    cells: (dto.points ?? []).map(cell => ({
      latitude: cell.lat,
      longitude: cell.lng,
      count: cell.count,
    })),
  };
}
