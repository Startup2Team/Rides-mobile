import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import ChangePhoneNumberScreen from '../change-phone-number';

const mockBack = jest.fn();
const mockUpdateUser = jest.fn();
const mockShowToast = jest.fn();

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));
  return {
    ActivityIndicator: host('ActivityIndicator'),
    KeyboardAvoidingView: host('KeyboardAvoidingView'),
    Platform: { OS: 'android', select: (options: Record<string, unknown>) => options.android ?? options.default },
    StyleSheet: { create: (styles: object) => styles, flatten: (style: object) => style },
    Text: host('Text'),
    TextInput: host('TextInput'),
    TouchableOpacity: host('TouchableOpacity'),
    useColorScheme: () => 'light',
    View: host('View'),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('expo-router', () => ({ router: { back: (...args: unknown[]) => mockBack(...args) } }));
jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Error: 'error' },
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
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

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ updateUser: mockUpdateUser, user: { phone: '+250788000000' } }),
}));

jest.mock('@/context/ToastContext', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

describe('ChangePhoneNumberScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('requires a valid new phone number before showing verification', () => {
    render(<ChangePhoneNumberScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('0788 123 456'), '123');
    fireEvent.press(screen.getByText('Send Verification Code'));

    expect(screen.getByText('Enter a valid Rwanda phone number')).toBeTruthy();
    expect(screen.queryByText('Verify and Save')).toBeNull();
  });

  test('updates the number only after entering a complete verification code', async () => {
    render(<ChangePhoneNumberScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('0788 123 456'), '0788123456');
    fireEvent.press(screen.getByText('Send Verification Code'));

    const inputs = screen.getAllByDisplayValue('');
    inputs.forEach((input, index) => fireEvent.changeText(input, String(index + 1)));
    fireEvent.press(screen.getByText('Verify and Save'));

    await waitFor(() => expect(mockUpdateUser).toHaveBeenCalledWith({ phone: '+250788123456' }));
    expect(mockBack).toHaveBeenCalled();
  });
});
