import type { RideLocation } from '@/types';
import { createListenerSet } from './storeUtils';

export type MapPickerBookingTarget = 'pickup' | 'dropoff';
export type MapPickerSavedPlaceMode = 'saved-place-add' | 'saved-place-edit';
export type MapPickerMode = 'booking' | MapPickerSavedPlaceMode;
export type MapPickerTarget = 'pickup' | 'dropoff' | 'saved-place';

export const MAP_PICKER_RESULT_TTL_MS = 5 * 60 * 1000;

export function createMapPickerSessionId() {
  return `map-picker-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export type MapPickerSelection =
  | {
      flow: 'booking';
      target: MapPickerBookingTarget;
      location: RideLocation;
    }
  | {
      flow: 'saved-place';
      mode: MapPickerSavedPlaceMode;
      savedPlaceId?: string;
      label?: string;
      location: RideLocation;
    };

export type MapPickerSavedPlaceResult = {
  sessionId: string;
  mode: MapPickerSavedPlaceMode;
  savedPlaceId?: string;
  address: string;
  latitude: number;
  longitude: number;
  createdAt: number;
  target?: 'saved-place';
};

export interface MapPickerState {
  activeSessionId: string | null;
  sessionStartedAt: number | null;
  selection: MapPickerSelection | null;
  result: MapPickerSavedPlaceResult | null;
}

const initialState: MapPickerState = {
  activeSessionId: null,
  sessionStartedAt: null,
  selection: null,
  result: null,
};

let state = { ...initialState };
const listeners = createListenerSet<MapPickerState>();

function emit() {
  listeners.notify(state);
}

function update(next: Partial<MapPickerState> | ((current: MapPickerState) => Partial<MapPickerState>)) {
  const patch = typeof next === 'function' ? next(state) : next;
  state = { ...state, ...patch };
  emit();
}

export function getMapPickerState() {
  return state;
}

export function getInitialMapPickerState() {
  return { ...initialState };
}

export function startMapPickerSession(sessionId: string) {
  update({
    activeSessionId: sessionId,
    sessionStartedAt: Date.now(),
    selection: null,
    result: null,
  });
}

export function setMapPickerSelection(selection: MapPickerSelection) {
  update({ selection });
}

export function clearMapPickerSelection() {
  update({ selection: null });
}

export function setMapPickerResult(result: MapPickerSavedPlaceResult) {
  update({ result });
}

export function consumeMapPickerResult(sessionId: string) {
  const current = state.result;
  if (!current) return null;

  const fresh = Date.now() - current.createdAt <= MAP_PICKER_RESULT_TTL_MS;
  if (!fresh || current.sessionId !== sessionId) {
    update({ result: null });
    return null;
  }

  update({ result: null });
  return current;
}

export function clearMapPickerResult(sessionId?: string) {
  const current = state.result;
  if (!current) return;
  if (sessionId && current.sessionId !== sessionId) return;
  update({ result: null });
}

export function clearMapPickerSession() {
  state = { ...initialState };
  emit();
}

export function resetMapPickerStore() {
  clearMapPickerSession();
}

export function subscribeMapPickerStore(listener: (state: MapPickerState) => void) {
  return listeners.add(listener);
}
