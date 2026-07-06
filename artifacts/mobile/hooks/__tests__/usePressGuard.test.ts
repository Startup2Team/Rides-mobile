import { act, renderHook } from '@testing-library/react-native';
import { usePressGuard } from '../usePressGuard';

describe('usePressGuard', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('blocks repeated presses during the guard window', () => {
    const action = jest.fn();
    const { result } = renderHook(() => usePressGuard(action, 500));

    act(() => {
      result.current();
      result.current();
    });

    expect(action).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(500);
      result.current();
    });

    expect(action).toHaveBeenCalledTimes(2);
  });
});
