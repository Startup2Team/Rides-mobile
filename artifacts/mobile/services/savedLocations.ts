import { getAppBackendClient } from '@/data/remote/client/appBackendClient';
import { expectField } from '@/observability/monitoring';

// Real backend saved locations under /api/v1/users/me/saved-locations.

export interface SavedLocation {
  id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
  createdAt: string;
  updatedAt: string;
}

interface SavedLocationDto {
  id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
  created_at: string;
  updated_at: string;
}

interface Envelope<T> {
  data: T;
}

function toDomain(dto: SavedLocationDto): SavedLocation {
  return {
    id: dto.id,
    label: dto.label,
    address: dto.address,
    lat: dto.lat,
    lng: dto.lng,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

export interface SavedLocationInput {
  label: string;
  address: string;
  lat: number;
  lng: number;
}

// Backend shape: { data: { saved_locations: [ ... ] } } — the array is nested
// under `saved_locations`, not the top-level data envelope.
export async function listSavedLocations(): Promise<SavedLocation[]> {
  const response = await getAppBackendClient().get<
    Envelope<{ saved_locations: SavedLocationDto[] | null } | null>
  >('/v1/users/me/saved-locations');
  const payload = response.data.data;
  expectField(payload, 'saved_locations', 'savedLocations.list');
  return (payload?.saved_locations ?? []).map(toDomain);
}

export async function createSavedLocation(input: SavedLocationInput): Promise<SavedLocation> {
  const response = await getAppBackendClient().post<Envelope<SavedLocationDto>>(
    '/v1/users/me/saved-locations',
    { body: input },
  );
  return toDomain(response.data.data);
}

export async function updateSavedLocation(
  id: string,
  input: SavedLocationInput,
): Promise<void> {
  await getAppBackendClient().put(`/v1/users/me/saved-locations/${id}`, { body: input });
}

export async function deleteSavedLocation(id: string): Promise<void> {
  await getAppBackendClient().delete(`/v1/users/me/saved-locations/${id}`);
}
