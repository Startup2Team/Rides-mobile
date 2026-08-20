import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import OTPScreen from '../otp';
import { verifyOtp } from '@/services/authSession';
import { updateProfile } from '@/services/profile';
import { reportOperationalFailure } from '@/observability/monitoring';

// FEAT-onboarding-fields: after a successful OTP verify, the register flow's
// optional gender selection is sent best-effort via PUT /customer/profile.
// This must never block login/navigation, even when it fails.

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

jest.mock('@/services/profile', () => ({
  updateProfile: jest.fn(),
}));

jest.mock('@/observability/monitoring', () => ({
  reportOperationalFailure: jest.fn(),
}));

const mockedVerifyOtp = verifyOtp as jest.MockedFunction<typeof verifyOtp>;
const mockedUpdateProfile = updateProfile as jest.MockedFunction<typeof updateProfile>;
const mockedReport = reportOperationalFailure as jest.MockedFunction<typeof reportOperationalFailure>;

function typeCode(code: string) {
  code.split('').forEach((digit, i) => {
    fireEvent.changeText(screen.getByTestId(`otp-digit-${i}`), digit);
  });
}

describe('OTP screen — best-effort rider gender capture', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLogin.mockResolvedValue('customer');
    mockedVerifyOtp.mockResolvedValue({
      user: { id: 'user-1', name: 'Alice', phone: '+250788111000', mode: 'customer', isDriver: false, createdAt: '2026-01-01T00:00:00.000Z' },
    } as never);
  });

  test('sends the selected gender after a successful verify, without blocking login', async () => {
    mockParams = { phone: '+250788111000', name: 'Alice', mode: 'register', gender: 'female' };
    mockedUpdateProfile.mockResolvedValue(undefined);

    render(<OTPScreen />);
    typeCode('123456');

    await waitFor(() => expect(mockLogin).toHaveBeenCalled());
    expect(mockedUpdateProfile).toHaveBeenCalledWith({ gender: 'female' });
  });

  test('never sends a request when gender was skipped', async () => {
    mockParams = { phone: '+250788111000', name: 'Alice', mode: 'register', gender: '' };

    render(<OTPScreen />);
    typeCode('123456');

    await waitFor(() => expect(mockLogin).toHaveBeenCalled());
    expect(mockedUpdateProfile).not.toHaveBeenCalled();
  });

  test('a failed gender update is reported but does not stop the user from landing on home', async () => {
    mockParams = { phone: '+250788111000', name: 'Alice', mode: 'register', gender: 'male' };
    mockedUpdateProfile.mockRejectedValue(new Error('network down'));

    render(<OTPScreen />);
    typeCode('123456');

    await waitFor(() => expect(mockLogin).toHaveBeenCalled());
    await waitFor(() => expect(mockedReport).toHaveBeenCalledWith('auth.register.gender', expect.any(Error)));
    // Login/navigation still proceeded despite the gender PUT failing.
    expect(mockLogin).toHaveBeenCalledTimes(1);
  });
});
