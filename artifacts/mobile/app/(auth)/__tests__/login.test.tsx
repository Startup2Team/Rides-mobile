import React from 'react';
import { render, screen } from '@testing-library/react-native';
import LoginScreen from '../login';

// Register redirects here on a 409 PHONE_ALREADY_REGISTERED with the number
// already dialed (e.g. "+250788111000", built as `${dialCode}${digits}` —
// see register.test.tsx for the sending side). These tests lock in the
// receiving side: splitPrefillPhone (login.tsx) must render that number
// exactly as if the user had typed it themselves, for every reachable dial
// code, and must not disturb a normal (no-param) cold entry to the screen.

const mockBack = jest.fn();
let mockParams: Record<string, string | undefined> = {};

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));
  return {
    Platform: { OS: 'ios', select: (options: Record<string, unknown>) => options.ios ?? options.default },
    StyleSheet: { create: (styles: object) => styles, flatten: (style: object) => style },
    Keyboard: { dismiss: jest.fn() },
    KeyboardAvoidingView: host('KeyboardAvoidingView'),
    ScrollView: host('ScrollView'),
    Modal: host('Modal'),
    Pressable: host('Pressable'),
    Text: host('Text'),
    TextInput: host('TextInput'),
    TouchableOpacity: host('TouchableOpacity'),
    View: host('View'),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
}));

jest.mock('expo-router', () => ({
  router: { back: (...args: unknown[]) => mockBack(...args) },
  useLocalSearchParams: () => mockParams,
}));

jest.mock('@/components/BackButton', () => ({
  BackButton: () => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, null, 'back');
  },
}));

jest.mock('@/components/AppText', () => ({
  AppText: ({ children }: { children?: React.ReactNode }) => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, null, children);
  },
}));

jest.mock('@/components/AppButton', () => ({
  AppButton: ({ title, onPress }: { title: string; onPress: () => void }) => {
    const React = require('react');
    const { Text, TouchableOpacity } = require('react-native');
    return React.createElement(TouchableOpacity, { onPress, accessibilityRole: 'button', accessibilityLabel: title }, React.createElement(Text, null, title));
  },
}));

jest.mock('@/components/LanguageSelector', () => ({
  LanguageSelector: () => null,
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ login: jest.fn() }),
}));

jest.mock('@/navigation/navigationPolicy', () => ({
  navigateToCustomerHomeAfterCompletion: jest.fn(),
  navigateToDriverHomeAfterCompletion: jest.fn(),
  replaceAuthBoundary: jest.fn(),
}));

jest.mock('@/services/authSession', () => ({
  loginWithPhone: jest.fn(),
}));

jest.mock('@/hooks/useColors', () => ({
  useColors: () => ({
    background: '#fff',
    foreground: '#000',
    mutedForeground: '#888',
    card: '#eee',
    border: '#ddd',
    input: '#f5f5f5',
    primary: '#00f',
    primaryHex: '#00f',
    destructive: '#f00',
  }),
}));

describe('Login screen — prefill from Register\'s 409 redirect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = {};
  });

  test('a +250 (Rwanda) number renders split into the Rwanda country code and the local digits', () => {
    mockParams = { phone: '+250788111000', notice: 'This number already has an account. Sign in instead.' };
    render(<LoginScreen />);

    expect(screen.getByText('+250')).toBeTruthy();
    expect(screen.getByPlaceholderText('7XX XXX XXX').props.value).toBe('788111000');
    expect(screen.getByText('This number already has an account. Sign in instead.')).toBeTruthy();
  });

  test('a +256 (Uganda) number renders split into the Uganda country code and the local digits', () => {
    mockParams = { phone: '+256701222333' };
    render(<LoginScreen />);

    expect(screen.getByText('+256')).toBeTruthy();
    expect(screen.getByPlaceholderText('7XX XXX XXX').props.value).toBe('701222333');
  });

  test('cold entry (no params) falls back to the default country and an empty field, with no notice banner', () => {
    render(<LoginScreen />);

    expect(screen.getByText('+250')).toBeTruthy();
    expect(screen.getByPlaceholderText('7XX XXX XXX').props.value).toBe('');
    expect(screen.queryByText(/already has an account/)).toBeNull();
  });
});
