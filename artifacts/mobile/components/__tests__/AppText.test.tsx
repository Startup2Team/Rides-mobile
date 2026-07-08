import { render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { AppText } from '@/components/AppText';
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
  };
});

describe('AppText', () => {
  test('renders the requested typography variant', () => {
    const { getByText } = render(<AppText variant="title">Book a Ride</AppText>);

    const style = StyleSheet.flatten(getByText('Book a Ride').props.style);
    expect(style).toMatchObject(typography.title);
  });

  test('applies color and style overrides after the token', () => {
    const { getByText } = render(
      <AppText variant="caption" color="#123456" style={{ fontSize: 13 }}>
        Arriving soon
      </AppText>,
    );

    const style = StyleSheet.flatten(getByText('Arriving soon').props.style);
    expect(style.fontFamily).toBe(typography.caption.fontFamily);
    expect(style.lineHeight).toBe(typography.caption.lineHeight);
    expect(style.color).toBe('#123456');
    expect(style.fontSize).toBe(13);
  });
});
