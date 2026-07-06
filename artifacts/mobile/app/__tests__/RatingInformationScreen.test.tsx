import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

let mockModeParam: string | undefined = undefined;
let mockAuthMode: 'customer' | 'driver' = 'customer';

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));
  return {
    Image: host('Image'),
    Platform: { OS: 'android', select: (options: Record<string, unknown>) => options.android ?? options.default },
    StyleSheet: { create: (styles: object) => styles, flatten: (style: object) => style },
    Text: host('Text'),
    Pressable: host('Pressable'),
    View: host('View'),
    ScrollView: host('ScrollView'),
    TouchableOpacity: host('TouchableOpacity'),
    useColorScheme: () => 'light',
  };
});

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
  },
  useLocalSearchParams: () => ({ mode: mockModeParam }),
}));

jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/components/AppText', () => ({
  AppText: ({ children }: { children?: React.ReactNode }) => {
    const React = require('react');
    const { Text } = require('react-native');
    return <Text>{children}</Text>;
  },
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', mode: mockAuthMode },
  }),
}));

jest.mock('@/hooks/useColors', () => ({
  useColors: () => ({
    background: '#fff',
    card: '#fff',
    foreground: '#111',
    mutedForeground: '#666',
    primary: '#2563eb',
    primaryHex: '#2563eb',
  }),
}));

describe('RatingInformationScreen', () => {
  beforeEach(() => {
    mockModeParam = undefined;
    mockAuthMode = 'customer';
    jest.clearAllMocks();
  });

  test('shows customer education when auth mode is customer', () => {
    const RatingInformationScreen = require('../rating-information').default;

    render(<RatingInformationScreen />);

    expect(screen.getByText('Short wait times.')).toBeTruthy();
    expect(screen.getAllByText(/seatbelt/i).length).toBeGreaterThan(0);
  });

  test('shows driver education when the navigation mode is driver', () => {
    mockModeParam = 'driver';
    const RatingInformationScreen = require('../rating-information').default;

    render(<RatingInformationScreen />);

    expect(screen.getByText('Navigation and wait times.')).toBeTruthy();
    expect(screen.getAllByText(/buckled up/i).length).toBeGreaterThan(0);
  });

  test('back button closes the page', () => {
    const RatingInformationScreen = require('../rating-information').default;

    render(<RatingInformationScreen />);
    fireEvent.press(screen.getByLabelText('Go back'));

    const { router } = require('expo-router');
    expect(router.back).toHaveBeenCalledTimes(1);
  });
});
