import { renderHook } from '@testing-library/react-native';
import { useMarkerAppear } from '../useMarkerAppear';

let mockReducedMotion = false;
const mockWithTiming = jest.fn((toValue: number, _config?: object) => toValue);
const mockUseSharedValue = jest.fn((initial: number) => ({ value: initial }));

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  Easing: { out: (fn: unknown) => fn, quad: (v: number) => v },
  useReducedMotion: () => mockReducedMotion,
  useSharedValue: (initial: number) => mockUseSharedValue(initial),
  useAnimatedStyle: (factory: () => object) => factory(),
  withTiming: (...args: [number, object]) => mockWithTiming(...args),
}));

describe('useMarkerAppear', () => {
  beforeEach(() => {
    mockReducedMotion = false;
    mockWithTiming.mockClear();
    mockUseSharedValue.mockClear();
  });

  it('starts hidden/scaled-down and animates both opacity and scale in to fully visible', () => {
    renderHook(() => useMarkerAppear());
    // Initial shared-value state — hidden and slightly shrunk, not popped in at full size.
    expect(mockUseSharedValue).toHaveBeenNthCalledWith(1, 0); // opacity
    expect(mockUseSharedValue).toHaveBeenNthCalledWith(2, 0.85); // scale
    // Entrance animates both to their settled (visible) values.
    expect(mockWithTiming).toHaveBeenCalledTimes(2);
    expect(mockWithTiming).toHaveBeenCalledWith(1, expect.objectContaining({ duration: 220 }));
  });

  it('skips the animation entirely under reduced motion — starts at the final state, no withTiming call', () => {
    mockReducedMotion = true;
    renderHook(() => useMarkerAppear());
    expect(mockUseSharedValue).toHaveBeenNthCalledWith(1, 1); // opacity
    expect(mockUseSharedValue).toHaveBeenNthCalledWith(2, 1); // scale
    expect(mockWithTiming).not.toHaveBeenCalled();
  });
});
