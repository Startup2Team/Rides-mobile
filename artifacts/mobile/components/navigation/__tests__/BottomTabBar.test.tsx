import { render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { icons } from '@/constants/icons';
import { typography } from '@/constants/typography';

let mockColorScheme: 'light' | 'dark' = 'light';

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) =>
    React.forwardRef((props: object, ref: unknown) =>
      React.createElement(name, { ...props, ref }),
    );
  class Value {
    value: number;
    constructor(value: number) {
      this.value = value;
    }
    interpolate() {
      return this;
    }
  }

  return {
    Animated: {
      Value,
      View: host('AnimatedView'),
      Text: host('Text'),
      timing: () => ({ start: jest.fn() }),
      multiply: () => new Value(0),
      sequence: () => ({ start: jest.fn() }),
    },
    Easing: {
      in: (fn: (t: number) => number) => fn,
      out: (fn: (t: number) => number) => fn,
      cubic: (t: number) => t,
      quad: (t: number) => t,
    },
    Platform: { OS: 'ios' },
    PlatformColor: (name: string) => name,
    Pressable: host('Pressable'),
    StyleSheet: {
      absoluteFill: {},
      create: (styles: object) => styles,
      flatten: (style: unknown) => (
        Array.isArray(style)
          ? Object.assign({}, ...style.flat(Number.POSITIVE_INFINITY).filter(Boolean))
          : style
      ),
      hairlineWidth: 1,
    },
    useColorScheme: () => mockColorScheme,
    View: host('View'),
  };
});

jest.mock('expo-blur', () => {
  const React = require('react');
  return {
    BlurView: (props: object) => React.createElement('BlurView', props),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
  MaterialCommunityIcons: () => null,
}));

jest.mock('expo-symbols', () => ({
  SymbolView: () => null,
}));

describe('BottomTabBar typography', () => {
  beforeEach(() => {
    mockColorScheme = 'light';
  });

  test('uses tab typography token for labels', () => {
    const homeIcon = jest.fn(() => null);
    const historyIcon = jest.fn(() => null);
    const state = {
      index: 0,
      routes: [
        { key: 'home-key', name: 'index' },
        { key: 'history-key', name: 'history' },
      ],
    };
    const descriptors = {
      'home-key': {
        options: {
          title: 'Home',
          tabBarIcon: homeIcon,
        },
      },
      'history-key': {
        options: {
          title: 'History',
          tabBarIcon: historyIcon,
        },
      },
    };
    const navigation = {
      emit: jest.fn(() => ({ defaultPrevented: false })),
      navigate: jest.fn(),
    };

    const { getByText } = render(
      <BottomTabBar
        state={state}
        descriptors={descriptors}
        navigation={navigation}
      />,
    );

    const inactiveStyle = StyleSheet.flatten(getByText('History').props.style);
    expect(inactiveStyle.fontSize).toBe(typography.tab.fontSize);
    expect(inactiveStyle.lineHeight).toBe(typography.tab.lineHeight);
    expect(inactiveStyle.fontFamily).toBe(typography.tab.fontFamily);

    const activeStyle = StyleSheet.flatten(getByText('Home').props.style);
    expect(activeStyle.fontSize).toBe(typography.tab.fontSize);
    expect(activeStyle.lineHeight).toBe(typography.tab.lineHeight);
    expect(activeStyle.fontFamily).toBe(typography.badge.fontFamily);
    expect(homeIcon).toHaveBeenCalledWith(expect.objectContaining({ size: icons.semantic.tab }));
    expect(historyIcon).toHaveBeenCalledWith(expect.objectContaining({ size: icons.semantic.tab }));
  });

  test('uses black inactive tab icons in light mode', () => {
    const homeIcon = jest.fn(() => null);
    const historyIcon = jest.fn(() => null);
    const state = {
      index: 0,
      routes: [
        { key: 'home-key', name: 'index' },
        { key: 'history-key', name: 'history' },
      ],
    };
    const descriptors = {
      'home-key': {
        options: {
          title: 'Home',
          tabBarIcon: homeIcon,
        },
      },
      'history-key': {
        options: {
          title: 'History',
          tabBarIcon: historyIcon,
        },
      },
    };
    const navigation = {
      emit: jest.fn(() => ({ defaultPrevented: false })),
      navigate: jest.fn(),
    };

    render(
      <BottomTabBar
        state={state}
        descriptors={descriptors}
        navigation={navigation}
      />,
    );

    expect(historyIcon).toHaveBeenCalledWith(expect.objectContaining({ color: '#000000' }));
  });

  test('uses white inactive tab icons in dark mode', () => {
    mockColorScheme = 'dark';
    const homeIcon = jest.fn(() => null);
    const historyIcon = jest.fn(() => null);
    const state = {
      index: 0,
      routes: [
        { key: 'home-key', name: 'index' },
        { key: 'history-key', name: 'history' },
      ],
    };
    const descriptors = {
      'home-key': {
        options: {
          title: 'Home',
          tabBarIcon: homeIcon,
        },
      },
      'history-key': {
        options: {
          title: 'History',
          tabBarIcon: historyIcon,
        },
      },
    };
    const navigation = {
      emit: jest.fn(() => ({ defaultPrevented: false })),
      navigate: jest.fn(),
    };

    render(
      <BottomTabBar
        state={state}
        descriptors={descriptors}
        navigation={navigation}
      />,
    );

    expect(historyIcon).toHaveBeenCalledWith(expect.objectContaining({ color: '#FFFFFF' }));
  });
});
