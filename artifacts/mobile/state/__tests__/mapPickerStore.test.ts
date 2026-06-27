import {
  clearMapPickerResult,
  clearMapPickerSession,
  consumeMapPickerResult,
  createMapPickerSessionId,
  getInitialMapPickerState,
  getMapPickerState,
  resetMapPickerStore,
  setMapPickerResult,
  startMapPickerSession,
} from '../mapPickerStore';

describe('mapPickerStore', () => {
  afterEach(() => {
    resetMapPickerStore();
  });

  test('consumes matching results once and ignores stale entries', () => {
    const sessionId = createMapPickerSessionId();
    startMapPickerSession(sessionId);
    setMapPickerResult({
      sessionId,
      mode: 'saved-place-add',
      address: 'Kimironko',
      latitude: -1.93,
      longitude: 30.1,
      createdAt: Date.now(),
    });

    expect(consumeMapPickerResult(sessionId)).toMatchObject({ sessionId, address: 'Kimironko' });
    expect(consumeMapPickerResult(sessionId)).toBeNull();

    setMapPickerResult({
      sessionId: 'old-session',
      mode: 'saved-place-add',
      address: 'Old',
      latitude: -1,
      longitude: 30,
      createdAt: Date.now() - (10 * 60 * 1000),
    });
    expect(consumeMapPickerResult('old-session')).toBeNull();
    expect(getMapPickerState()).toMatchObject({
      activeSessionId: sessionId,
      selection: null,
      result: null,
    });

    clearMapPickerResult();
    clearMapPickerSession();
  });
});
