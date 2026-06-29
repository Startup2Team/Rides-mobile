import type { AppMode } from '@/types';
import { createListenerSet } from './storeUtils';

export interface AppModeState {
  mode: AppMode;
  lastMode: AppMode;
  switching: boolean;
  requestedMode: AppMode | null;
  updatedAt: string | null;
}

const initialState: AppModeState = {
  mode: 'customer',
  lastMode: 'customer',
  switching: false,
  requestedMode: null,
  updatedAt: null,
};

let state = { ...initialState };
const listeners = createListenerSet<AppModeState>();

function emit() {
  listeners.notify(state);
}

function update(next: Partial<AppModeState> | ((current: AppModeState) => Partial<AppModeState>)) {
  const patch = typeof next === 'function' ? next(state) : next;
  state = { ...state, ...patch };
  emit();
}

export function getAppModeState() {
  return state;
}

export function getInitialAppModeState() {
  return { ...initialState };
}

export function canSwitchMode(targetMode: AppMode, hasDriverAccess: boolean) {
  return targetMode === 'customer' || hasDriverAccess;
}

export function requestModeSwitch(targetMode: AppMode) {
  update({
    switching: true,
    requestedMode: targetMode,
  });
}

export function completeModeSwitch(nextMode: AppMode) {
  update({
    mode: nextMode,
    lastMode: state.mode,
    switching: false,
    requestedMode: null,
    updatedAt: new Date().toISOString(),
  });
}

export function cancelModeSwitch() {
  update({
    switching: false,
    requestedMode: null,
  });
}

export function resetAppModeStore() {
  state = { ...initialState };
  emit();
}

export function resetAppModeForLogout() {
  state = { ...initialState };
  emit();
}

export function subscribeAppModeStore(listener: (state: AppModeState) => void) {
  return listeners.add(listener);
}
