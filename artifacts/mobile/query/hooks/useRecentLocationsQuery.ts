import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import {
  deleteRecentLocation,
  listRecentLocations,
  recordRecentLocation,
  type RecentLocation,
  type RecentLocationInput,
} from '@/services/locations';
import { locationKeys } from '../keys';
import { queryPolicies } from '../policies';
import { usePolicyQuery } from './shared';

// Server-side recent destinations (/locations/recent). They used to live only on
// the device, so a reinstall wiped them; the local ride history now acts as the
// offline fallback rather than the source of truth.

export interface RecentLocationMutationContext {
  key: ReturnType<typeof locationKeys.recent>;
  previous: RecentLocation[];
}

/** Cap mirrors the backend's own recent_locations limit. */
const MAX_RECENT_LOCATIONS = 15;

function normalizeAddress(address: string) {
  return address.trim().toLowerCase();
}

function upsertRecent(list: RecentLocation[], next: RecentLocation) {
  const existing = list.find(item => normalizeAddress(item.address) === normalizeAddress(next.address));
  const bumped: RecentLocation = existing
    ? { ...existing, ...next, id: existing.id, useCount: existing.useCount + 1 }
    : next;
  return [bumped, ...list.filter(item => normalizeAddress(item.address) !== normalizeAddress(next.address))]
    .slice(0, MAX_RECENT_LOCATIONS);
}

export function useRecentLocationsQuery(options: { enabled?: boolean } = {}) {
  const { user } = useAuth();

  return usePolicyQuery(queryPolicies.recentLocations, {
    queryKey: locationKeys.recent(),
    queryFn: () => listRecentLocations(),
    enabled: !!user && (options.enabled ?? true),
  });
}

/**
 * Records a place the rider picked for a booking. Best-effort by design — the
 * caller must never block a booking on it, so failures only roll the optimistic
 * entry back.
 */
export function useRecordRecentLocationMutation() {
  const queryClient = useQueryClient();
  const key = locationKeys.recent();

  return useMutation({
    mutationFn: async (input: RecentLocationInput) => {
      await recordRecentLocation(input);
    },
    onMutate: async input => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<RecentLocation[]>(key) ?? [];
      const optimistic: RecentLocation = {
        id: `pending-${Date.now()}`,
        address: input.address,
        latitude: input.latitude,
        longitude: input.longitude,
        useCount: 1,
        lastUsedAt: new Date().toISOString(),
      };
      queryClient.setQueryData<RecentLocation[]>(key, current => upsertRecent(current ?? previous, optimistic));
      return { key, previous } satisfies RecentLocationMutationContext;
    },
    onError: (_error, _input, context) => {
      if (!context) return;
      queryClient.setQueryData(context.key, context.previous);
    },
    onSettled: async () => {
      // The server also busts its cached suggestions payload on a write.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: key }),
        queryClient.invalidateQueries({ queryKey: locationKeys.suggestions() }),
      ]);
    },
  });
}

export function useDeleteRecentLocationMutation() {
  const queryClient = useQueryClient();
  const key = locationKeys.recent();

  return useMutation({
    mutationFn: async (id: string) => {
      await deleteRecentLocation(id);
    },
    onMutate: async id => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<RecentLocation[]>(key) ?? [];
      queryClient.setQueryData<RecentLocation[]>(key, current => (current ?? previous).filter(item => item.id !== id));
      return { key, previous } satisfies RecentLocationMutationContext;
    },
    onError: (_error, _id, context) => {
      if (!context) return;
      queryClient.setQueryData(context.key, context.previous);
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: key }),
        queryClient.invalidateQueries({ queryKey: locationKeys.suggestions() }),
      ]);
    },
  });
}
