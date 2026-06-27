import { render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { AppInput } from '@/components/AppInput';
import { radius } from '@/constants/radius';
import { sizes } from '@/constants/sizes';
import { semanticSpacing } from '@/constants/spacing';
import { typography } from '@/constants/typography';

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) =>
    React.forwardRef((props: object, ref: unknown) =>
      React.createElement(name, { ...props, ref }),
    );

  return {
    StyleSheet: {
      create: (styles: object) => styles,
      flatten: (style: unknown) => (
        Array.isArray(style)
          ? Object.assign({}, ...style.flat(Number.POSITIVE_INFINITY).filter(Boolean))
          : style
      ),
    },
    Text: host('Text'),
    TextInput: host('TextInput'),
    TouchableOpacity: host('TouchableOpacity'),
    View: host('View'),
  };
});

jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
}));

jest.mock('@/hooks/useColors', () => ({
  useColors: () => ({
    background: '#FFFFFF',
    border: '#E5E7EB',
    destructive: '#FF3B30',
    foreground: '#111111',
    input: '#FFFFFF',
    mutedForeground: '#777777',
    primary: '#007AFF',
  }),
}));

describe('AppInput design tokens', () => {
  test('uses input size, radius, spacing, and typography tokens', () => {
    const { UNSAFE_getByType } = render(
      <AppInput label="Phone" placeholder="7xxxxxxxx" value="" onChangeText={jest.fn()} />,
    );

    const input = UNSAFE_getByType(TextInput);
    const inputStyle = StyleSheet.flatten(input.props.style);
    const containerStyle = StyleSheet.flatten(input.parent?.props.style);

    expect(inputStyle.fontFamily).toBe(typography.body.fontFamily);
    expect(inputStyle.fontSize).toBe(typography.body.fontSize);
    expect(containerStyle.height).toBe(sizes.input.lg);
    expect(containerStyle.borderRadius).toBe(radius.input);
    expect(containerStyle.paddingHorizontal).toBe(semanticSpacing.listItemPadding);
  });
});
