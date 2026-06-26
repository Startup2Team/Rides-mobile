import { render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { typography } from '@/constants/typography';

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) =>
    React.forwardRef((props: object, ref: unknown) =>
      React.createElement(name, { ...props, ref }),
    );

  return {
    ActivityIndicator: host('ActivityIndicator'),
    StyleSheet: {
      create: (styles: object) => styles,
      flatten: (style: unknown) => (
        Array.isArray(style)
          ? Object.assign({}, ...style.flat(Number.POSITIVE_INFINITY).filter(Boolean))
          : style
      ),
    },
    Text: host('Text'),
    TouchableOpacity: host('TouchableOpacity'),
    View: host('View'),
  };
});

jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
}));

jest.mock('@/hooks/useColors', () => ({
  useColors: () => ({
    primary: '#007AFF',
    primaryForeground: '#FFFFFF',
    muted: '#F2F2F7',
    foreground: '#111111',
    destructive: '#FF3B30',
    destructiveForeground: '#FFFFFF',
    destructiveHex: '#FF3B30',
    call: '#34C759',
  }),
}));

describe('AppButton typography', () => {
  test('uses the button typography token for its label', () => {
    const { getByText } = render(
      <AppButton title="Find Driver" onPress={jest.fn()} />,
    );

    const style = StyleSheet.flatten(getByText('Find Driver').props.style);
    expect(style.fontFamily).toBe(typography.button.fontFamily);
    expect(style.lineHeight).toBe(typography.button.lineHeight);
    expect(style.fontSize).toBe(typography.button.fontSize);
  });
});
