jest.mock('react-native', () => {
  const React = require('react');
  return {
    Dimensions: { get: () => ({ width: 390, height: 844 }) },
    Platform: { OS: 'ios', select: (o: { ios?: unknown; default?: unknown }) => o.ios ?? o.default },
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));

const mockKeyboardControllerState = { isVisible: false, height: 0 };

jest.mock('react-native-keyboard-controller', () => ({
  useKeyboardState: (selector?: (state: typeof mockKeyboardControllerState) => unknown) =>
    selector ? selector(mockKeyboardControllerState) : mockKeyboardControllerState,
  __setMockKeyboardState: (next: Partial<typeof mockKeyboardControllerState>) => {
    Object.assign(mockKeyboardControllerState, next);
  },
  __resetMockKeyboardState: () => {
    mockKeyboardControllerState.isVisible = false;
    mockKeyboardControllerState.height = 0;
  },
}));

import { renderHook } from '@testing-library/react-native';
import {
  FORM_SHEET_CHROME_HEIGHT,
  FORM_SHEET_CONTENT_PADDING,
  useFormSheetKeyboardLayout,
} from '@/hooks/useFormSheetKeyboardLayout';

const keyboardMock = jest.requireMock('react-native-keyboard-controller') as {
  __setMockKeyboardState: (next: { isVisible?: boolean; height?: number }) => void;
  __resetMockKeyboardState: () => void;
};

describe('useFormSheetKeyboardLayout', () => {
  beforeEach(() => {
    keyboardMock.__resetMockKeyboardState();
  });

  test('keyboard closed: safe-area padding, no height cap', () => {
    const { result } = renderHook(() => useFormSheetKeyboardLayout(true));
    expect(result.current.isKeyboardOpen).toBe(false);
    expect(result.current.paddingBottom).toBe(34 + FORM_SHEET_CONTENT_PADDING);
    expect(result.current.maxSheetHeight).toBeUndefined();
    expect(result.current.maxBodyScrollHeight).toBeUndefined();
  });

  test('keyboard open when scrollable: tight padding + capped heights', () => {
    keyboardMock.__setMockKeyboardState({ isVisible: true, height: 291 });
    const { result } = renderHook(() => useFormSheetKeyboardLayout(true));
    expect(result.current.isKeyboardOpen).toBe(true);
    expect(result.current.paddingBottom).toBe(FORM_SHEET_CONTENT_PADDING);
    expect(result.current.maxSheetHeight).toBe(844 - 291 - 47);
    expect(result.current.maxBodyScrollHeight).toBe(
      844 - 291 - 47 - FORM_SHEET_CHROME_HEIGHT - FORM_SHEET_CONTENT_PADDING,
    );
  });

  test('disabled hook ignores keyboard even when visible', () => {
    keyboardMock.__setMockKeyboardState({ isVisible: true, height: 291 });
    const { result } = renderHook(() => useFormSheetKeyboardLayout(false));
    expect(result.current.isKeyboardOpen).toBe(false);
    expect(result.current.paddingBottom).toBe(34 + FORM_SHEET_CONTENT_PADDING);
    expect(result.current.maxSheetHeight).toBeUndefined();
  });
});
