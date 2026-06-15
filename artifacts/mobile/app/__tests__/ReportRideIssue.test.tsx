import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import ReportRideIssueScreen from '../report-ride-issue';

const mockOpenUrl = jest.fn();

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));
  return {
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

describe('ReportRideIssueScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('offers common customer ride issue categories', () => {
    render(<ReportRideIssueScreen />);

    expect(screen.getByText('Driver Behavior')).toBeTruthy();
    expect(screen.getByText('Lost Item')).toBeTruthy();
    expect(screen.getByText('Fare or Payment Issue')).toBeTruthy();
    expect(screen.getByText('Safety Concern')).toBeTruthy();
  });

  test('opens a prefilled lost item report', () => {
    render(<ReportRideIssueScreen />);

    fireEvent.press(screen.getByLabelText('Lost Item'));

    expect(mockOpenUrl).toHaveBeenCalledWith(expect.stringContaining('mailto:'));
    expect(mockOpenUrl).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent('Rides ride issue: Lost Item')));
    expect(mockOpenUrl).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent('I need help with: Lost Item')));
  });
});
