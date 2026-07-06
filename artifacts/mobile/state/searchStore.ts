import type { GeocodeSuggestion } from '@/services/geocoding';
import type { RideLocation } from '@/types';
import { createListenerSet } from './storeUtils';

export type SearchTarget = 'pickup' | 'dropoff' | 'saved-place' | null;

export interface SearchState {
  target: SearchTarget;
  queryText: string;
  selectedSuggestion: GeocodeSuggestion | null;
  recentSessionId: string | null;
  openedAt: number | null;
}

const initialState: SearchState = {
  target: null,
  queryText: '',
  selectedSuggestion: null,
  recentSessionId: null,
  openedAt: null,
};

let state = { ...initialState };
const listeners = createListenerSet<SearchState>();

function emit() {
  listeners.notify(state);
}

function update(next: Partial<SearchState> | ((current: SearchState) => Partial<SearchState>)) {
  const patch = typeof next === 'function' ? next(state) : next;
  state = { ...state, ...patch };
  emit();
}

export function getSearchState() {
  return state;
}

export function getInitialSearchState() {
  return { ...initialState };
}

export function openSearchSession(target: SearchTarget, queryText = '', sessionId: string | null = null) {
  update({
    target,
    queryText,
    selectedSuggestion: null,
    recentSessionId: sessionId,
    openedAt: Date.now(),
  });
}

export function updateSearchQuery(queryText: string) {
  update({ queryText });
}

export function setSelectedSearchSuggestion(selectedSuggestion: GeocodeSuggestion | null) {
  update({ selectedSuggestion });
}

export function setRecentSearchSession(sessionId: string | null) {
  update({ recentSessionId: sessionId, openedAt: sessionId ? Date.now() : null });
}

export function clearSearchSession() {
  state = { ...initialState };
  emit();
}

export function resetSearchStore() {
  clearSearchSession();
}

export function subscribeSearchStore(listener: (state: SearchState) => void) {
  return listeners.add(listener);
}

export function toSearchLocation(suggestion: GeocodeSuggestion, fallbackAddress = ''): RideLocation {
  return {
    latitude: suggestion.coords.latitude,
    longitude: suggestion.coords.longitude,
    address: suggestion.place_name || suggestion.title || fallbackAddress,
    locationType: 'precise',
  };
}
