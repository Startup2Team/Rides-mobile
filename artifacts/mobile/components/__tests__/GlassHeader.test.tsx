let mockPathname = '/stats';
let mockPlatformOS: 'ios' | 'android' = 'ios';
let mockScheme: 'light' | 'dark' = 'light';

class MockAnimatedValue {
  _val: number;
  _listeners = new Set<(state: { value: number }) => void>();

  constructor(value = 0) {
    this._val = value;
  }

  setValue(value: number) {
    this._val = value;
    this._listeners.forEach(listener => listener({ value }));
  }

  addListener(listener: (state: { value: number }) => void) {
    this._listeners.add(listener);
    return String(this._listeners.size);
  }

  removeListener(_id: string) {}

  interpolate(config: { inputRange: number[]; outputRange: any[] }) {
    const { inputRange, outputRange } = config;
    return {
      get value() {
        const current = (this as any)._parent._val;
        if (current <= inputRange[0]) return outputRange[0];
        if (current >= inputRange[inputRange.length - 1]) return outputRange[outputRange.length - 1];
        for (let i = 0; i < inputRange.length - 1; i += 1) {
          const start = inputRange[i];
          const end = inputRange[i + 1];
          if (current >= start && current <= end) {
            const startOut = outputRange[i];
            const endOut = outputRange[i + 1];
            const t = (current - start) / (end - start);
            if (typeof startOut === 'string' || typeof endOut === 'string') return endOut;
            return startOut + (endOut - startOut) * t;
          }
        }
        return outputRange[0];
      },
      _parent: this,
      toJSON() {
        return (this as any).value;
      },
      valueOf() {
        return (this as any).value;
      },
    };
  }
}

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));
  class AnimatedValue {
    _val: number;
    _listeners = new Set<any>();

    constructor(value = 0) {
      this._val = value;
    }

    setValue(value: number) {
      this._val = value;
      this._listeners.forEach(listener => listener({ value }));
    }

    addListener(listener: any) {
      this._listeners.add(listener);
      return String(this._listeners.size);
    }

    removeListener(_id: string) {}

    interpolate(config: { inputRange: number[]; outputRange: any[] }) {
      const { inputRange, outputRange } = config;
      return {
        _parent: this,
        get value() {
          const current = (this as any)._parent._val;
          if (current <= inputRange[0]) return outputRange[0];
          if (current >= inputRange[inputRange.length - 1]) return outputRange[outputRange.length - 1];
          for (let i = 0; i < inputRange.length - 1; i += 1) {
            const start = inputRange[i];
            const end = inputRange[i + 1];
            if (current >= start && current <= end) {
              const startOut = outputRange[i];
              const endOut = outputRange[i + 1];
              const t = (current - start) / (end - start);
              if (typeof startOut === 'string' || typeof endOut === 'string') return endOut;
              return startOut + (endOut - startOut) * t;
            }
          }
          return outputRange[0];
        },
        toJSON() {
          return (this as any).value;
        },
        valueOf() {
          return (this as any).value;
        },
      };
    }
  }
    return {
      Animated: {
        Value: AnimatedValue,
        View: host('AnimatedView'),
        createAnimatedComponent: (Component: any) => Component,
        timing: () => ({ start: (cb?: () => void) => cb?.() }),
      },
    Platform: {
      OS: mockPlatformOS,
      select: (options: Record<string, unknown>) => (mockPlatformOS === 'ios' ? options.ios ?? options.default : options.android ?? options.default),
    },
    ActivityIndicator: host('ActivityIndicator'),
    StyleSheet: {
      create: (styles: object) => styles,
      flatten: (style: any) => (Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style),
      hairlineWidth: 1,
      absoluteFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
      },
      View: host('View'),
      useColorScheme: () => mockScheme,
      Easing: {
        out: (value: any) => value,
        quad: 'quad',
      },
    };
  });

jest.mock('expo-blur', () => ({
  BlurView: (props: object) => {
    const React = require('react');
    return React.createElement('BlurView', props);
  },
}));

jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
  usePathname: () => mockPathname,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('@/components/BackButton', () => ({
  BackButton: (props: object) => {
    const React = require('react');
    return React.createElement('BackButton', props);
  },
}));

jest.mock('@/components/AppText', () => ({
  AppText: (props: object) => {
    const React = require('react');
    return React.createElement('AppText', props);
  },
}));

jest.mock('@/hooks/useColors', () => ({
  useColors: () => ({
    background: '#fff',
    border: '#ddd',
    foreground: '#111',
    mutedForeground: '#666',
    primary: '#0057ff',
  }),
}));

import React from 'react';
import { act, render } from '@testing-library/react-native';
import { StyleSheet, View } from 'react-native';
import { GlassHeader } from '@/components/GlassHeader';
import { resolveGlassScrollViewLayout } from '@/components/GlassScrollView';

function readAnimatedValue(val: any) {
  if (val && typeof val === 'object' && 'value' in val) return (val as any).value;
  if (val && typeof val.toJSON === 'function') return val.toJSON();
  return val;
}

function readStyleOpacity(testElement: any) {
  const flat = StyleSheet.flatten(testElement.props.style);
  return readAnimatedValue(flat?.opacity);
}

describe('GlassHeader native scroll behavior', () => {
  beforeEach(() => {
    mockPathname = '/stats';
    mockPlatformOS = 'ios';
    mockScheme = 'light';
  });

  afterEach(() => {
    mockPlatformOS = 'ios';
    mockScheme = 'light';
    mockPathname = '/stats';
  });

  test('header uses a solid page background without an outline', () => {
    const { getByTestId } = render(<GlassHeader title="Stats" />);
    const headerStyle = StyleSheet.flatten(getByTestId('glass-header').props.style);

    expect(headerStyle.backgroundColor).toBe('#fff');
    expect(headerStyle.borderBottomWidth).toBeUndefined();
    expect(headerStyle.borderBottomColor).toBeUndefined();
  });

  test('header does not render glass layers', () => {
    const { getByTestId } = render(<GlassHeader title="Stats" />);

    expect(() => getByTestId('glass-header-blur')).toThrow();
    expect(() => getByTestId('glass-header-fallback')).toThrow();
    expect(() => getByTestId('glass-header-glass')).toThrow();
  });

  test('scroll view resolves the top inset and content offset needed for the header', () => {
    const layout = resolveGlassScrollViewLayout({
      defaultTop: 44,
      defaultIndicatorTop: 42,
      platformOS: 'ios',
    });

    expect(layout.finalContentInset?.top).toBe(44);
    expect(layout.finalContentOffset?.y).toBe(-44);
    expect(layout.finalScrollIndicatorInsets?.top).toBe(42);
  });

  test('scroll view does not double-space content when top padding is provided', () => {
    const layout = resolveGlassScrollViewLayout({
      defaultTop: 44,
      defaultIndicatorTop: 42,
      platformOS: 'ios',
      contentContainerStyle: { paddingTop: 44 },
    });

    expect(layout.finalContentInset?.top).toBe(0);
    expect(layout.finalContentOffset?.y).toBe(0);
    expect(layout.finalContentContainerStyle).toEqual([false, { paddingTop: 44 }]);
  });
});
