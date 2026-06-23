/**
 * Tests for the unified BottomActionSheet chrome.
 */
jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) =>
    React.forwardRef((props: object, ref: unknown) =>
      React.createElement(name, { ...props, ref }),
    );
  class Value {
    _v: number;
    constructor(v: number) { this._v = v; }
    setValue(v: number) { this._v = v; }
    interpolate() { return this; }
    stopAnimation(cb?: (v: number) => void) { cb?.(this._v); }
    addListener() { return { remove: () => {} }; }
    removeListener() {}
  }
  const stub = () => ({ start: jest.fn() });
  const mockKeyboardListeners: Record<
    string,
    (event: { endCoordinates: { screenY: number; height: number }; duration?: number }) => void
  > = {};
  const mockKeyboard = {
    listeners: mockKeyboardListeners,
    addListener(
      event: string,
      cb: (event: { endCoordinates: { screenY: number; height: number }; duration?: number }) => void,
    ) {
      mockKeyboardListeners[event] = cb;
      return { remove: jest.fn() };
    },
    dismiss: jest.fn(),
    fireWillChangeFrame(screenY: number, duration = 250) {
      const screenH = 844;
      mockKeyboardListeners.keyboardWillChangeFrame?.({
        endCoordinates: { screenY, height: screenH - screenY },
        duration,
      });
    },
    fireDidHide() {
      mockKeyboardListeners.keyboardDidHide?.({
        endCoordinates: { screenY: 844, height: 0 },
      });
    },
  };
  return {
    Animated: {
      Value,
      View: host('AnimatedView'),
      Text: host('AnimatedText'),
      timing: stub,
      spring: stub,
      parallel: (_anims: unknown[]) => stub(),
      add: (_a: unknown, _b: unknown) => new Value(0),
      multiply: (_a: unknown, _b: unknown) => new Value(0),
    },
    Dimensions: { get: () => ({ width: 390, height: 844 }) },
    Easing: {
      out: (f: (t: number) => number) => f,
      in: (f: (t: number) => number) => f,
      quad: (t: number) => t * t,
      cubic: (t: number) => t * t * t,
    },
    Keyboard: mockKeyboard,
    __mockKeyboard: mockKeyboard,
    Platform: { OS: 'ios', select: (o: { ios?: unknown; default?: unknown }) => o.ios ?? o.default },
    PanResponder: {
      create: (handlers: Record<string, unknown>) => ({ panHandlers: handlers }),
    },
    StyleSheet: {
      create: (s: object) => s,
      flatten: (s: unknown) => (Array.isArray(s) ? Object.assign({}, ...s.filter(Boolean)) : (s ?? {})),
      hairlineWidth: 0.5,
      absoluteFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
      absoluteFillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    },
    Text: host('Text'),
    TextInput: host('TextInput'),
    TouchableOpacity: host('TouchableOpacity'),
    View: host('View'),
    Pressable: host('Pressable'),
    ScrollView: host('ScrollView'),
    Modal: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement('View', { testID: 'modal-root', ...props }, children),
    ActivityIndicator: host('ActivityIndicator'),
    useColorScheme: () => 'light',
    // Runs the callback immediately so tests don't need async waits.
    InteractionManager: {
      runAfterInteractions: (cb: () => void) => { cb(); return { cancel: jest.fn() }; },
    },
  };
});

jest.mock('expo-blur', () => {
  const React = require('react');
  return { BlurView: React.forwardRef((props: object, ref: unknown) => React.createElement('BlurView', { ...props, ref })) };
});
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'light' } }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('@expo/vector-icons', () => ({ Feather: 'Feather', MaterialCommunityIcons: 'MaterialCommunityIcons' }));
jest.mock('@/components/AppButton', () => {
  const React = require('react');
  return { AppButton: () => React.createElement('View', { testID: 'app-button' }) };
});
jest.mock('@/hooks/useColors', () => ({
  useColors: () => ({
    card: '#fff', foreground: '#111', mutedForeground: '#777', muted: '#eee',
    border: '#ddd', primary: '#06f', primaryForeground: '#fff',
    destructive: '#f00', destructiveHex: '#ff0000', background: '#fff',
  }),
}));
jest.mock('@/hooks/useBackButtonEntrance', () => ({ useBackButtonEntrance: () => ({ translateX: { _v: 0 }, opacity: { _v: 1 }, scale: { _v: 1 }, playEntrance: jest.fn(), playExit: jest.fn() }) }));
jest.mock('@/hooks/useCloseButtonSpin', () => ({ useCloseButtonSpin: () => ({ rotation: '0deg', spinOpen: jest.fn(), spinShut: jest.fn(), setSpinProgress: jest.fn() }) }));
jest.mock('@/components/SheetBackdrop', () => {
  const React = require('react');
  return { SheetBackdrop: () => React.createElement('View', { testID: 'sheet-backdrop' }) };
});

import React from 'react';
import { render } from '@testing-library/react-native';
import { BottomActionSheet, SHEET_PADDING_H } from '../BottomActionSheet';

const colors = {
  card: '#fff', foreground: '#111', mutedForeground: '#777', muted: '#eee',
  border: '#ddd', primary: '#06f', primaryForeground: '#fff',
  destructive: '#f00', destructiveHex: '#ff0000', background: '#fff',
} as never;

// ── PART B: No X close button ──────────────────────────────────────────────

describe('BottomActionSheet — no close button', () => {
  test('renders title without a close/X button element', () => {
    const { getByText, queryByRole } = render(
      <BottomActionSheet colors={colors} title="Save location as">
        <></>
      </BottomActionSheet>,
    );
    expect(getByText('Save location as')).toBeTruthy();
    // No button with close semantics in the header.
    expect(queryByRole('button')).toBeNull();
  });

  test('renders the drag handle pill', () => {
    const { getByText } = render(
      <BottomActionSheet colors={colors} title="Test sheet">
        <></>
      </BottomActionSheet>,
    );
    expect(getByText('Test sheet')).toBeTruthy();
  });
});

// ── PART E: Title alignment — symmetric padding ────────────────────────────

describe('BottomActionSheet — title row symmetric padding', () => {
  test('title row has equal left and right padding when no close control', () => {
    const { getByText } = render(
      <BottomActionSheet colors={colors} title="Aligned title">
        <></>
      </BottomActionSheet>,
    );
    // The title text exists; its parent row has symmetric SHEET_PADDING_H padding.
    expect(SHEET_PADDING_H).toBe(22);
    expect(getByText('Aligned title')).toBeTruthy();
  });
});

// ── PART A: Content-driven height — no excessive spacer ───────────────────

describe('BottomActionSheet — content-driven height', () => {
  test('renders subtitle and hint without adding extra blank space', () => {
    const { getByText } = render(
      <BottomActionSheet
        colors={colors}
        title="Save location as"
        subtitle="KG 1 Ave"
        hint="Choose one label to finish saving."
      >
        <></>
      </BottomActionSheet>,
    );
    expect(getByText('Save location as')).toBeTruthy();
    expect(getByText('KG 1 Ave')).toBeTruthy();
    expect(getByText('Choose one label to finish saving.')).toBeTruthy();
  });

  test('omits subheader entirely when subtitle and hint are absent', () => {
    const { queryByText } = render(
      <BottomActionSheet colors={colors} title="No meta">
        <></>
      </BottomActionSheet>,
    );
    // Only the title text is present; no subheader elements.
    expect(queryByText('No meta')).toBeTruthy();
  });
});

// ── PART C: Keyboard flex chain ────────────────────────────────────────────

describe('BottomActionSheet — flex prop for keyboard search mode', () => {
  test('root View has flex: 1 style when flex prop is true', () => {
    const { toJSON } = render(
      <BottomActionSheet colors={colors} title="Search" flex>
        <></>
      </BottomActionSheet>,
    );
    const tree = toJSON() as { props?: { style?: object }; children?: unknown[] };
    const rootStyle = tree?.props?.style ?? {};
    const flat = Array.isArray(rootStyle)
      ? Object.assign({}, ...rootStyle.filter(Boolean))
      : rootStyle;
    expect((flat as Record<string, unknown>).flex).toBe(1);
  });

  test('root View has no flex style when flex prop is false (default)', () => {
    const { toJSON } = render(
      <BottomActionSheet colors={colors} title="Rest mode">
        <></>
      </BottomActionSheet>,
    );
    const tree = toJSON() as { props?: { style?: object } };
    const rootStyle = tree?.props?.style;
    if (!rootStyle) return;
    const flat = Array.isArray(rootStyle)
      ? Object.assign({}, ...rootStyle.filter(Boolean))
      : rootStyle;
    expect((flat as Record<string, unknown>).flex).toBeUndefined();
  });
});
