import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { LanguageSelector } from '../LanguageSelector';

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) =>
    React.forwardRef((props: object, ref: unknown) =>
      React.createElement(name, { ...props, ref }),
    );

  class Value {
    private value: number;

    constructor(value: number) {
      this.value = value;
    }

    setValue(value: number) {
      this.value = value;
    }

    interpolate() {
      return this;
    }
  }

  const animate = (value: Value, config: { toValue: number }) => ({
    start: (callback?: () => void) => {
      value.setValue(config.toValue);
      callback?.();
    },
  });

  return {
    Animated: {
      Value,
      View: host('AnimatedView'),
      timing: animate,
      spring: animate,
      parallel: (animations: Array<{ start: (callback?: () => void) => void }>) => ({
        start: (callback?: () => void) => {
          animations.forEach(animation => animation.start());
          callback?.();
        },
      }),
    },
    Keyboard: { dismiss: jest.fn() },
    Modal: ({ children, visible, ...props }: { children?: React.ReactNode; visible?: boolean }) =>
      visible ? React.createElement('Modal', props, children) : null,
    Pressable: host('Pressable'),
    StyleSheet: {
      create: (styles: object) => styles,
      hairlineWidth: 1,
    },
    Text: host('Text'),
    TouchableOpacity: host('TouchableOpacity'),
    View: host('View'),
  };
});

jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 24, left: 0, right: 0 }),
}));

jest.mock('@/hooks/useColors', () => ({
  useColors: () => ({
    card: '#fff',
    border: '#ddd',
    background: '#fff',
    foreground: '#111',
    mutedForeground: '#777',
    primary: '#007AFF',
    primaryHex: '#007AFF',
  }),
}));

jest.mock('../SheetBackdrop', () => ({
  SheetBackdrop: ({ onPress }: { onPress: () => void }) =>
    React.createElement('SheetBackdrop', { onPress }),
}));

describe('LanguageSelector', () => {
  test('opens and closes with an animated sheet shell', async () => {
    const { getByText, queryByText } = render(<LanguageSelector />);

    fireEvent.press(getByText('EN'));

    await waitFor(() => expect(getByText('Choose language')).toBeTruthy());

    fireEvent.press(getByText('English'));

    await waitFor(() => expect(queryByText('Choose language')).toBeNull());
  });
});
