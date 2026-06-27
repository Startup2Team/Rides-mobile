import { act, renderHook } from '@testing-library/react-native';
import React from 'react';
import {
  MAP_PICKER_RESULT_TTL_MS,
  MapPickerProvider,
  useMapPicker,
  type MapPickerSavedPlaceResult,
} from '../MapPickerContext';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MapPickerProvider>{children}</MapPickerProvider>
);

function createResult(overrides: Partial<MapPickerSavedPlaceResult> = {}): MapPickerSavedPlaceResult {
  return {
    sessionId: 'session-1',
    mode: 'saved-place-add' as const,
    address: 'Map selected location',
    latitude: -1.95,
    longitude: 30.07,
    createdAt: Date.now(),
    target: 'saved-place' as const,
    ...overrides,
  };
}

describe('MapPickerContext saved-place result lifecycle', () => {
  test('consumes a matching result once', () => {
    const { result } = renderHook(() => useMapPicker(), { wrapper });
    const savedResult = createResult();
    let consumed: ReturnType<typeof result.current.consumeResult> | null = null;

    act(() => {
      result.current.setResult(savedResult);
      consumed = result.current.consumeResult('session-1');
    });

    expect(consumed).toEqual(savedResult);
    expect(result.current.consumeResult('session-1')).toBeNull();
  });

  test('ignores and clears a mismatched session result', () => {
    const { result } = renderHook(() => useMapPicker(), { wrapper });

    act(() => {
      result.current.setResult(createResult({ sessionId: 'session-1' }));
    });

    let consumed: ReturnType<typeof result.current.consumeResult> | null = null;
    act(() => {
      consumed = result.current.consumeResult('session-2');
    });

    expect(consumed).toBeNull();
    expect(result.current.result).toBeNull();
  });

  test('ignores stale results older than the TTL', () => {
    const { result } = renderHook(() => useMapPicker(), { wrapper });

    act(() => {
      result.current.setResult(createResult({
        createdAt: Date.now() - MAP_PICKER_RESULT_TTL_MS - 1,
      }));
    });

    let consumed: ReturnType<typeof result.current.consumeResult> | null = null;
    act(() => {
      consumed = result.current.consumeResult('session-1');
    });

    expect(consumed).toBeNull();
    expect(result.current.result).toBeNull();
  });

  test('clearResult only clears the matching session and clearAll clears everything', () => {
    const { result } = renderHook(() => useMapPicker(), { wrapper });

    act(() => {
      result.current.setResult(createResult());
    });

    act(() => {
      result.current.clearResult('session-2');
    });
    expect(result.current.result).toEqual(expect.objectContaining({ sessionId: 'session-1' }));

    act(() => {
      result.current.clearResult('session-1');
    });
    expect(result.current.result).toBeNull();

    act(() => {
      result.current.setResult(createResult());
    });
    act(() => {
      result.current.clearAll();
    });
    expect(result.current.result).toBeNull();
  });
});
