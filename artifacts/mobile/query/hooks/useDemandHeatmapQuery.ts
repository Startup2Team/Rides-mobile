import { useAuth } from '@/context/AuthContext';
import { fetchDemandHeatmap } from '@/services/demandHeatmap';
import { demandHeatmapKeys } from '../keys';
import { queryPolicies } from '../policies';
import { usePolicyQuery } from './shared';

export interface UseDemandHeatmapQueryOptions {
  latitude?: number | null;
  longitude?: number | null;
  radiusKm?: number;
  windowMin?: number;
  enabled?: boolean;
}

// Demand heatmap for the driver map (GET /driver/demand-heatmap). Scoped to the
// driver's location when coordinates are provided. Only runs for a signed-in
// driver and when explicitly enabled (e.g. the heatmap layer is toggled on).
export function useDemandHeatmapQuery(options: UseDemandHeatmapQueryOptions = {}) {
  const { user } = useAuth();
  const { latitude = null, longitude = null, radiusKm, windowMin, enabled = true } = options;

  return usePolicyQuery(queryPolicies.demandHeatmap, {
    queryKey: demandHeatmapKeys.scoped(latitude, longitude),
    queryFn: () =>
      fetchDemandHeatmap({
        latitude: latitude ?? undefined,
        longitude: longitude ?? undefined,
        radiusKm,
        windowMin,
      }),
    enabled: !!user && enabled,
  });
}
