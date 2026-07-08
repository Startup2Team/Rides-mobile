import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MAX_SAVED_LOCATIONS } from '@/constants/savedLocations';
import type { RideLocation } from '@/types';
import { savedLocationsRepository } from '@/domains/saved-locations/repository';
import type { SavedLocation } from '@/domains/saved-locations';
import { savedLocationKeys } from '../keys';
import { queryPolicies } from '../policies';
import { usePolicyQuery } from './shared';

export interface SavedLocationMutationContext {
  key: ReturnType<typeof savedLocationKeys.list>;
  previous: SavedLocation[];
}

export interface AddSavedLocationInput {
  location: RideLocation;
  label: string;
}

export interface EditSavedLocationInput {
  id: string;
  location: RideLocation;
  label: string;
}

export interface DeleteSavedLocationInput {
  id: string;
}

function normalizeLabel(label: string) {
  return label.trim().toLowerCase();
}

function createSavedLocation(location: RideLocation, label: string, id = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`): SavedLocation {
  return {
    ...location,
    id,
    label: label.trim(),
  };
}

function upsertLocation(list: SavedLocation[], next: SavedLocation) {
  return [next, ...list.filter(place => normalizeLabel(place.label) !== normalizeLabel(next.label) || place.id === next.id)]
    .slice(0, MAX_SAVED_LOCATIONS);
}

function replaceLocation(list: SavedLocation[], next: SavedLocation) {
  return [next, ...list.filter(place => place.id !== next.id && normalizeLabel(place.label) !== normalizeLabel(next.label))]
    .slice(0, MAX_SAVED_LOCATIONS);
}

export function useSavedLocationsQuery(userId: string | null | undefined) {
  return usePolicyQuery(queryPolicies.savedLocations, {
    queryKey: savedLocationKeys.list(userId ?? 'current'),
    queryFn: async () => savedLocationsRepository.listSavedLocations(),
  });
}

export function useAddSavedLocationMutation(userId: string | null | undefined) {
  const queryClient = useQueryClient();
  const key = savedLocationKeys.list(userId ?? 'current');

  return useMutation({
    mutationFn: async (input: AddSavedLocationInput) => {
      const saved = await savedLocationsRepository.saveLocation(input.location, input.label);
      if (!saved) {
        throw new Error('Unable to save location.');
      }
      return saved;
    },
    onMutate: async input => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<SavedLocation[]>(key) ?? [];
      const optimistic = createSavedLocation(input.location, input.label);
      queryClient.setQueryData<SavedLocation[]>(key, current => upsertLocation(current ?? previous, optimistic));
      return { key, previous } satisfies SavedLocationMutationContext;
    },
    onError: (_error, _input, context) => {
      if (!context) return;
      queryClient.setQueryData(context.key, context.previous);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useEditSavedLocationMutation(userId: string | null | undefined) {
  const queryClient = useQueryClient();
  const key = savedLocationKeys.list(userId ?? 'current');

  return useMutation({
    mutationFn: async (input: EditSavedLocationInput) => {
      const current = await savedLocationsRepository.listSavedLocations();
      const next = replaceLocation(
        current.filter(place => place.id !== input.id),
        createSavedLocation(input.location, input.label, input.id),
      );
      await savedLocationsRepository.replaceSavedLocations(next);
      return next;
    },
    onMutate: async input => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<SavedLocation[]>(key) ?? [];
      const optimistic = createSavedLocation(input.location, input.label, input.id);
      queryClient.setQueryData<SavedLocation[]>(key, current => {
        const list = (current ?? previous).filter(place => place.id !== input.id);
        return replaceLocation(list, optimistic);
      });
      return { key, previous } satisfies SavedLocationMutationContext;
    },
    onError: (_error, _input, context) => {
      if (!context) return;
      queryClient.setQueryData(context.key, context.previous);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useDeleteSavedLocationMutation(userId: string | null | undefined) {
  const queryClient = useQueryClient();
  const key = savedLocationKeys.list(userId ?? 'current');

  return useMutation({
    mutationFn: async (input: DeleteSavedLocationInput) => {
      await savedLocationsRepository.removeSavedLocation(input.id);
    },
    onMutate: async input => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<SavedLocation[]>(key) ?? [];
      queryClient.setQueryData<SavedLocation[]>(key, current => (current ?? previous).filter(place => place.id !== input.id));
      return { key, previous } satisfies SavedLocationMutationContext;
    },
    onError: (_error, _input, context) => {
      if (!context) return;
      queryClient.setQueryData(context.key, context.previous);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
