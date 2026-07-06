import type { RideLocation, SavedLocation } from '@/types';
import type { SavedLocationsRepository } from '@/data/repositories/interfaces';
import {
  listSavedLocations as apiList,
  createSavedLocation as apiCreate,
  updateSavedLocation as apiUpdate,
  deleteSavedLocation as apiDelete,
  type SavedLocation as BackendSavedLocation,
  type SavedLocationInput,
} from '@/services/savedLocations';

export type { SavedLocationsRepository } from '@/data/repositories/interfaces';
export {
  createRemoteSavedLocationsRepository,
  createSavedLocationsShadowRepository,
} from '@/data/remote/repositories/RemoteSavedLocationsRepository';

function toMobile(b: BackendSavedLocation): SavedLocation {
  return { id: b.id, label: b.label, address: b.address, latitude: b.lat, longitude: b.lng };
}

function toInput(location: RideLocation, label: string): SavedLocationInput {
  return {
    label: label.trim(),
    // Backend requires a non-empty address; fall back to the label.
    address: location.address?.trim() || label.trim(),
    lat: location.latitude,
    lng: location.longitude,
  };
}

// Real backend saved locations (/api/v1/users/me/saved-locations). The mobile
// repository interface exposes a bulk replace + granular ops; here bulk replace
// is reconciled against the server list via create/update/delete.
export const savedLocationsRepository: SavedLocationsRepository = {
  async listSavedLocations() {
    return (await apiList()).map(toMobile);
  },

  async saveLocation(location, label) {
    await apiCreate(toInput(location, label));
    return true;
  },

  async removeSavedLocation(id) {
    await apiDelete(id);
  },

  async replaceSavedLocations(next) {
    const current = await apiList();
    const nextIds = new Set(next.map(n => n.id));
    const currentIds = new Set(current.map(c => c.id));
    // Delete anything the caller dropped.
    for (const existing of current) {
      if (!nextIds.has(existing.id)) await apiDelete(existing.id);
    }
    // Upsert the desired list (known id → update, otherwise create).
    for (const item of next) {
      const input = toInput(item, item.label);
      if (currentIds.has(item.id)) await apiUpdate(item.id, input);
      else await apiCreate(input);
    }
  },

  async clearSavedLocations() {
    const current = await apiList();
    for (const existing of current) await apiDelete(existing.id);
  },
};
