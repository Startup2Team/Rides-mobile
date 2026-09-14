import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import RegisterScreen from '../register';
import { requestOtp } from '@/services/authSession';
import { replaceAuthBoundary } from '@/navigation/navigationPolicy';
import { ConflictError } from '@/data/remote/contracts/backendErrors';

// gender-at-register: gender is now sent inline in the register POST
// (/v1/auth/register), not as a separate post-verify PUT (see otp.test.tsx
// for that removal). It stays fully optional/skippable. Separately, the
// backend now answers a duplicate phone number with 409
// PHONE_ALREADY_REGISTERED (no OTP sent) — that must route the user to
// Login with the number prefilled, instead of the generic "couldn't send
// the code" failure.

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));
  return {
    Platform: { OS: 'ios', select: (options: Record<string, unknown>) => options.ios ?? options.default },
    StyleSheet: { create: (styles: object) => styles, flatten: (style: object) => style },
    Keyboard: {
      addListener: jest.fn(() => ({ remove: jest.fn() })),
      dismiss: jest.fn(),
    },
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
  router: { push: (...args: unknown[]) => mockPush(...args), replace: (...args: unknown[]) => mockReplace(...args), back: () => mockBack() },
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
  AppButton: ({ title, onPress, loading }: { title: string; onPress: () => void; loading?: boolean }) => {
    const React = require('react');
    const { Text, TouchableOpacity } = require('react-native');
    return React.createElement(
      TouchableOpacity,
      { onPress, accessibilityRole: 'button', accessibilityLabel: title },
      React.createElement(Text, null, loading ? 'Loading…' : title),
    );
  },
}));

jest.mock('@/components/AppInput', () => ({
  AppInput: ({ value, onChangeText, placeholder, ...rest }: { value?: string; onChangeText?: (t: string) => void; placeholder?: string }) => {
    const React = require('react');
    const { TextInput } = require('react-native');
    return React.createElement(TextInput, { value, onChangeText, placeholder, ...rest });
  },
}));

jest.mock('@/components/LanguageSelector', () => ({
  LanguageSelector: () => null,
}));

jest.mock('@/navigation/navigationPolicy', () => ({
  replaceAuthBoundary: jest.fn(),
}));

jest.mock('@/services/authSession', () => ({
  requestOtp: jest.fn(),
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
    primaryForeground: '#fff',
    destructive: '#f00',
  }),
}));

const mockedRequestOtp = requestOtp as jest.MockedFunction<typeof requestOtp>;
const mockedReplaceAuthBoundary = replaceAuthBoundary as jest.MockedFunction<typeof replaceAuthBoundary>;

function fillRequiredFields(phoneDigits = '788111222') {
  fireEvent.changeText(screen.getByPlaceholderText('Full name'), 'Bob Doe');
  fireEvent.changeText(screen.getByPlaceholderText('7XX XXX XXX'), phoneDigits);
}

describe('Register screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRequestOtp.mockResolvedValue({ requestId: '', maskedPhoneNumber: '+250••••00', expiresAt: new Date().toISOString() });
  });

  test('sends the selected gender inline in the register payload, and does not forward it as a route param', async () => {
    render(<RegisterScreen />);
    fillRequiredFields();
    fireEvent.press(screen.getByLabelText('Gender: female'));

    fireEvent.press(screen.getByLabelText('Continue'));

    await waitFor(() =>
      expect(mockedRequestOtp).toHaveBeenCalledWith({ phoneNumber: '+250788111222', fullName: 'Bob Doe', gender: 'female' }),
    );
    // gender also rides along in the OTP screen's route params — purely so
    // Resend (a full re-submission) can carry it too if the backend's OTP
    // stash has already expired by the time the user taps Resend.
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(auth)/otp',
      params: { phone: '+250788111222', name: 'Bob Doe', mode: 'register', gender: 'female' },
    });
  });

  test('gender stays fully skippable — omitted from the payload when never selected', async () => {
    render(<RegisterScreen />);
    fillRequiredFields();

    fireEvent.press(screen.getByLabelText('Continue'));

    await waitFor(() =>
      expect(mockedRequestOtp).toHaveBeenCalledWith({ phoneNumber: '+250788111222', fullName: 'Bob Doe', gender: undefined }),
    );
  });

  test('tapping the selected gender option again clears it', async () => {
    render(<RegisterScreen />);
    fillRequiredFields();
    fireEvent.press(screen.getByLabelText('Gender: male'));
    fireEvent.press(screen.getByLabelText('Gender: male'));

    fireEvent.press(screen.getByLabelText('Continue'));

    await waitFor(() =>
      expect(mockedRequestOtp).toHaveBeenCalledWith({ phoneNumber: '+250788111222', fullName: 'Bob Doe', gender: undefined }),
    );
  });

  test('a 409 PHONE_ALREADY_REGISTERED routes to Login with the number prefilled and the backend message, without sending an OTP request onward', async () => {
    mockedRequestOtp.mockRejectedValue(
      new ConflictError({
        status: 409,
        cause: { error: { code: 'PHONE_ALREADY_REGISTERED', message: 'This number already has an account. Sign in instead.' } },
      }),
    );

    render(<RegisterScreen />);
    fillRequiredFields();
    fireEvent.press(screen.getByLabelText('Continue'));

    // Uses replaceAuthBoundary — the same helper every other auth-boundary
    // transition on these screens goes through (observable, and it swaps
    // Register out of the stack instead of leaving a dead screen under
    // Login) — not a raw router.push.
    await waitFor(() =>
      expect(mockedReplaceAuthBoundary).toHaveBeenCalledWith(
        expect.anything(),
        {
          pathname: '/(auth)/login',
          params: { phone: '+250788111222', notice: 'This number already has an account. Sign in instead.' },
        },
      ),
    );
    // Never routed to the OTP screen — no code was sent for this number.
    expect(mockPush).not.toHaveBeenCalled();
  });

  test('every other failure keeps the existing generic message (no navigation)', async () => {
    mockedRequestOtp.mockRejectedValue(new Error('network down'));

    render(<RegisterScreen />);
    fillRequiredFields();
    fireEvent.press(screen.getByLabelText('Continue'));

    await screen.findByText("Couldn't send the code. Check the number and try again.");
    expect(mockPush).not.toHaveBeenCalled();
  });
});
