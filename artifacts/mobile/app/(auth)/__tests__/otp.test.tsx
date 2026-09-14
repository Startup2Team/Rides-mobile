import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import OTPScreen from '../otp';
import { requestOtp, verifyOtp } from '@/services/authSession';

// FEAT-onboarding-fields / gender-at-register: gender used to be sent here,
// after a successful verify, as a fire-and-forget PUT /customer/profile —
// that raced navigation and could overwrite an EXISTING account's stored
// gender if the phone number already belonged to someone else. Gender now
// rides along in the register-time POST /auth/register payload instead (see
// register.test.tsx), so this screen no longer knows about gender at all:
// no gender param, no post-verify profile call. These tests cover what's
// left — verifying a code, and the resend path, which still calls
// requestOtp and must keep working.

const mockLogin = jest.fn(async () => 'customer');
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockParams: Record<string, string | undefined> = {};

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));
  return {
    Platform: { OS: 'ios', select: (options: Record<string, unknown>) => options.ios ?? options.default },
    StyleSheet: { create: (styles: object) => styles, flatten: (style: object) => style },
    Text: host('Text'),
    TextInput: host('TextInput'),
    TouchableOpacity: host('TouchableOpacity'),
    View: host('View'),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args), replace: (...args: unknown[]) => mockReplace(...args), back: () => mockBack() },
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

jest.mock('@/hooks/useColors', () => ({
  useColors: () => ({
    background: '#fff',
    foreground: '#000',
    mutedForeground: '#888',
    card: '#eee',
    border: '#ddd',
    primary: '#00f',
    destructive: '#f00',
  }),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
}));

jest.mock('@/navigation/navigationPolicy', () => ({
  navigateToCustomerHomeAfterCompletion: jest.fn(),
  navigateToDriverHomeAfterCompletion: jest.fn(),
}));

jest.mock('@/services/authSession', () => ({
  requestOtp: jest.fn(),
  verifyOtp: jest.fn(),
}));

const mockedRequestOtp = requestOtp as jest.MockedFunction<typeof requestOtp>;
const mockedVerifyOtp = verifyOtp as jest.MockedFunction<typeof verifyOtp>;

function typeCode(code: string) {
  code.split('').forEach((digit, i) => {
    fireEvent.changeText(screen.getByTestId(`otp-digit-${i}`), digit);
  });
}

describe('OTP screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { phone: '+250788111000', name: 'Alice', mode: 'register' };
    mockLogin.mockResolvedValue('customer');
    mockedVerifyOtp.mockResolvedValue({
      user: { id: 'user-1', name: 'Alice', phone: '+250788111000', mode: 'customer', isDriver: false, createdAt: '2026-01-01T00:00:00.000Z' },
    } as never);
  });

  test('verifying a full code logs the user in and never touches gender/profile', async () => {
    render(<OTPScreen />);
    typeCode('123456');

    await waitFor(() => expect(mockLogin).toHaveBeenCalled());
    // No gender param is read from the route anymore, and nothing here calls
    // a profile-update endpoint — this screen's job ends at verifyOtp+login.
    expect(mockedVerifyOtp).toHaveBeenCalledWith({ phoneNumber: '+250788111000', otp: '123456' });
  });

  test('resend, once its cooldown elapses, re-requests the OTP for the same number', async () => {
    // Resend only ever fires for a number that does NOT yet have an account
    // (that's how the user got to this screen in the first place), so it can
    // never hit the register endpoint's 409 — no duplicate-phone handling
    // belongs on this path.
    jest.useFakeTimers();
    try {
      mockedRequestOtp.mockResolvedValue({ requestId: '', maskedPhoneNumber: '+250••••00', expiresAt: new Date().toISOString() });

      render(<OTPScreen />);
      expect(screen.getByLabelText('Resend verification code').props.accessibilityState.disabled).toBe(true);

      await act(async () => {
        jest.advanceTimersByTime(30_000);
      });
      expect(screen.getByLabelText('Resend verification code').props.accessibilityState.disabled).toBe(false);

      fireEvent.press(screen.getByLabelText('Resend verification code'));
      await act(async () => {
        await Promise.resolve();
      });

      expect(mockedRequestOtp).toHaveBeenCalledWith({ phoneNumber: '+250788111000', fullName: 'Alice' });
    } finally {
      jest.useRealTimers();
    }
  });
});
