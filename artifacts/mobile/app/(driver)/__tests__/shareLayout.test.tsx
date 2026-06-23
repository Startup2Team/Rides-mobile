import React from 'react';
import { render } from '@testing-library/react-native';

const mockUseAuth = jest.fn();
const mockIsLiquidGlassAvailable = jest.fn(() => false);
const mockCapturedScreens: Array<string | undefined> = [];

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));
  return {
    Platform: { OS: 'ios' },
    StyleSheet: {
      absoluteFill: {},
      create: (styles: object) => styles,
    },
    View: host('View'),
    useColorScheme: () => 'light',
  };
});

jest.mock('expo-glass-effect', () => ({
  isLiquidGlassAvailable: () => mockIsLiquidGlassAvailable(),
}));

jest.mock('expo-blur', () => {
  const React = require('react');
  return { BlurView: (props: object) => React.createElement('BlurView', props) };
});

jest.mock('expo-router', () => {
  const React = require('react');
  const Tabs: any = ({ children }: { children?: React.ReactNode }) => {
    const screenNames = React.Children.toArray(children).map((child: React.ReactNode) => (child as React.ReactElement<{ name?: string }>).props.name);
    mockCapturedScreens.splice(0, mockCapturedScreens.length, ...screenNames);
    return React.createElement('View', null, children);
  };
  Tabs.Screen = () => null;
  return {
    Tabs,
    Redirect: () => null,
  };
});

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));
  return { Feather: host('Feather'), MaterialCommunityIcons: host('MaterialCommunityIcons') };
});

jest.mock('expo-symbols', () => ({
  SymbolView: (props: object) => null,
}));

jest.mock('expo-router/unstable-native-tabs', () => {
  const React = require('react');
  const NativeTabs: any = ({ children }: { children?: React.ReactNode }) => {
    const triggerNames = React.Children.toArray(children).map((child: React.ReactNode) => (child as React.ReactElement<{ name?: string }>).props.name);
    mockCapturedScreens.splice(0, mockCapturedScreens.length, ...triggerNames);
    return React.createElement('View', null, children);
  };
  NativeTabs.Trigger = () => null;
  return {
    NativeTabs,
    Icon: () => null,
    Label: () => null,
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/hooks/useColors', () => ({
  useColors: () => ({
    background: '#fff',
    border: '#eee',
    mutedForeground: '#888',
    primaryHex: '#007aff',
  }),
}));

import DriverTabLayout from '../_layout';

describe('driver tab layout', () => {
  beforeEach(() => {
    mockCapturedScreens.splice(0, mockCapturedScreens.length);
    mockUseAuth.mockReturnValue({ driverProfile: { isVerified: true, verificationStatus: 'approved' } });
  });

  test('excludes Share from the bottom navbar', () => {
    render(<DriverTabLayout />);

    expect(mockCapturedScreens).not.toContain('share');
  });
});
