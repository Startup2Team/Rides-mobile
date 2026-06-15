import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import SettingsScreen from '../settings';

const mockPush = jest.fn();
const mockOpenUrl = jest.fn();

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));
  return {
    Alert: { alert: jest.fn() },
    Linking: { openURL: (...args: unknown[]) => mockOpenUrl(...args) },
    Platform: { OS: 'android', select: (options: Record<string, unknown>) => options.android ?? options.default },
    StyleSheet: { create: (styles: object) => styles, flatten: (style: object) => style, hairlineWidth: 1 },
    Text: host('Text'),
    TouchableOpacity: host('TouchableOpacity'),
    useColorScheme: () => 'light',
    View: host('View'),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: (...args: unknown[]) => mockPush(...args) },
}));

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light' },
  impactAsync: jest.fn(),
}));

jest.mock('expo-blur', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { BlurView: (props: object) => <View {...props} /> };
});

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { LinearGradient: (props: object) => <View {...props} /> };
});

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { Feather: ({ name }: { name: string }) => <Text>{name}</Text> };
});

jest.mock('@/components/GlassScrollView', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { GlassScrollView: (props: { children: React.ReactNode }) => <View>{props.children}</View> };
});

jest.mock('@/components/GlassHeader', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    GlassHeader: ({ title }: { title: string }) => <Text>{title}</Text>,
    useGlassHeaderMetrics: () => ({ contentTop: 0, indicatorTop: 0 }),
  };
});

jest.mock('@/components/LanguageSelector', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { LanguageSelector: () => <Text>EN</Text> };
});

jest.mock('@/context/SavedLocationsContext', () => ({
  useSavedLocations: () => ({
    savedPlaces: [{ id: 'home', label: 'Home', address: 'KG 10 Street', latitude: 0, longitude: 0 }],
  }),
}));

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows preferences, saved places, support, and danger zone', () => {
    render(<SettingsScreen />);

    expect(screen.getByText('Preferences')).toBeTruthy();
    expect(screen.getByText('KG 10 Street')).toBeTruthy();
    expect(screen.getByText('Add work address')).toBeTruthy();
    expect(screen.getByText('Visit Our Website')).toBeTruthy();
    expect(screen.getByText('Delete Account')).toBeTruthy();
  });

  test('opens the dedicated home saved-place selector', () => {
    render(<SettingsScreen />);

    fireEvent.press(screen.getByLabelText('Home Address'));

    expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({
      pathname: '/saved-place-selector',
      params: expect.objectContaining({ label: 'Home' }),
    }));
  });
});
