import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { RideActionsSection } from '../RideActionsSection';

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));
  return {
    Pressable: host('Pressable'),
    StyleSheet: { create: (styles: object) => styles, flatten: (style: object) => style },
    Text: host('Text'),
    TouchableOpacity: host('TouchableOpacity'),
    View: host('View'),
  };
});

jest.mock('@/components/AppButton', () => ({
  AppButton: ({ accessibilityLabel, title }: { accessibilityLabel?: string; title: string }) => {
    const React = require('react');
    const { Text, TouchableOpacity } = require('react-native');
    return (
      <TouchableOpacity accessibilityLabel={accessibilityLabel}>
        <Text>{title}</Text>
      </TouchableOpacity>
    );
  },
}));

const colors = {
  destructive: '#ff0000',
} as never;

const baseProps = {
  colors,
  onCall: jest.fn(),
  onCancelArrived: jest.fn(),
  onCancelArriving: jest.fn(),
  onEmergency: jest.fn(),
  onSOS: jest.fn(),
};

describe('RideActionsSection', () => {
  beforeEach(() => {
    const originalConsoleError = console.error;
    jest.spyOn(console, 'error').mockImplementation((...args) => {
      if (String(args[0]).includes('react-test-renderer is deprecated')) return;
      originalConsoleError(...args);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('does not render customer start journey control after driver arrival', () => {
    render(
      <RideActionsSection
        {...baseProps}
        isArrived
        isArriving={false}
        isInProgress={false}
      />,
    );

    expect(screen.queryByText('Start Journey')).toBeNull();
    expect(screen.getByText('Call')).toBeTruthy();
  });

  test('does not render customer complete ride control during an active journey', () => {
    render(
      <RideActionsSection
        {...baseProps}
        isArrived={false}
        isArriving={false}
        isInProgress
      />,
    );

    expect(screen.queryByText('Complete Ride')).toBeNull();
    expect(screen.getByLabelText('Emergency SOS')).toBeTruthy();
  });
});
