import {
  canSwitchMode,
  cancelModeSwitch,
  completeModeSwitch,
  getAppModeState,
  getInitialAppModeState,
  requestModeSwitch,
  resetAppModeForLogout,
  resetAppModeStore,
} from '../appModeStore';

describe('appModeStore', () => {
  afterEach(() => {
    resetAppModeStore();
  });

  test('tracks mode switching without affecting shared identity assumptions', () => {
    expect(canSwitchMode('customer', false)).toBe(true);
    expect(canSwitchMode('driver', false)).toBe(false);
    expect(canSwitchMode('driver', true)).toBe(true);

    requestModeSwitch('driver');
    expect(getAppModeState().switching).toBe(true);
    expect(getAppModeState().requestedMode).toBe('driver');

    completeModeSwitch('driver');
    expect(getAppModeState().mode).toBe('driver');
    expect(getAppModeState().lastMode).toBe('customer');
    expect(getAppModeState().switching).toBe(false);

    cancelModeSwitch();
    expect(getAppModeState().requestedMode).toBeNull();

    resetAppModeForLogout();
    expect(getAppModeState()).toEqual(getInitialAppModeState());
  });
});

