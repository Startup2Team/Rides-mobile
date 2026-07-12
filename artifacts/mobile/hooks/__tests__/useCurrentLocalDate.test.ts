import { act, renderHook } from '@testing-library/react-native';
import { useCurrentLocalDate } from '../useCurrentLocalDate';

const mockRemoveAppStateListener = jest.fn();
let mockHookAppStateHandler: undefined | ((state: string) => void);

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn((_event, handler) => {
      mockHookAppStateHandler = handler;
      return { remove: mockRemoveAppStateListener };
    }),
  },
}));

describe('useCurrentLocalDate', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date(2026, 6, 8, 23, 59, 59) });
    mockRemoveAppStateListener.mockClear();
    mockHookAppStateHandler = undefined;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('updates at local midnight and reschedules one next-midnight timer', () => {
    const { result, unmount } = renderHook(() => useCurrentLocalDate());
    expect(result.current.currentLocalDate).toBe('2026-07-08');
    expect(jest.getTimerCount()).toBe(1);

    act(() => jest.advanceTimersByTime(1_000));

    expect(result.current.currentLocalDate).toBe('2026-07-09');
    expect(jest.getTimerCount()).toBe(1);
    unmount();
    expect(jest.getTimerCount()).toBe(0);
    expect(mockRemoveAppStateListener).toHaveBeenCalledTimes(1);
  });

  test('refreshes on foreground without creating multiple timers', () => {
    const { result } = renderHook(() => useCurrentLocalDate());
    jest.setSystemTime(new Date(2026, 6, 9, 8, 0, 0));

    act(() => mockHookAppStateHandler?.('active'));

    expect(result.current.currentLocalDate).toBe('2026-07-09');
    expect(jest.getTimerCount()).toBe(1);
  });
});
