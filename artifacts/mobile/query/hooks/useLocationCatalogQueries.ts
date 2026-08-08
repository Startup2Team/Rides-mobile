import { listAdminUnits, listLandmarks, searchAdminUnits } from '@/services/locations';
import { locationKeys } from '../keys';
import { queryPolicies } from '../policies';
import { usePolicyQuery } from './shared';

// Public reference data from /locations (no auth): curated landmarks and the
// Rwanda admin hierarchy. Both are free to read and effectively static, so they
// are cached hard and used ahead of the paid geocoder wherever they can answer.

/** Curated Rwanda landmarks (GET /locations/landmarks). */
export function useLandmarksQuery(options: { enabled?: boolean } = {}) {
  return usePolicyQuery(queryPolicies.landmarks, {
    queryKey: locationKeys.landmarks(),
    queryFn: () => listLandmarks(),
    enabled: options.enabled ?? true,
  });
}

/**
 * Children of an admin unit, or the provinces when parentId is null
 * (GET /locations/admin-units). Drives the drill-down in the area picker.
 */
export function useAdminUnitsQuery(parentId: string | null, options: { enabled?: boolean } = {}) {
  return usePolicyQuery(queryPolicies.adminUnits, {
    queryKey: locationKeys.adminUnits(parentId),
    queryFn: () => listAdminUnits(parentId),
    enabled: options.enabled ?? true,
  });
}

/**
 * Name autocomplete over the hierarchy (GET /locations/admin-units/search).
 * The backend ignores queries shorter than two characters, so does the hook.
 */
export function useAdminUnitSearchQuery(
  query: string,
  options: { level?: string | null; enabled?: boolean } = {},
) {
  const trimmed = query.trim();
  const level = options.level ?? null;

  return usePolicyQuery(queryPolicies.adminUnitSearch, {
    queryKey: locationKeys.adminUnitSearch(trimmed, level),
    queryFn: () => searchAdminUnits(trimmed, level),
    enabled: (options.enabled ?? true) && trimmed.length >= 2,
  });
}
