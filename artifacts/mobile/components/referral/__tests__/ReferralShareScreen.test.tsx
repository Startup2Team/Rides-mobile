const mockShare = jest.fn();
const mockOpenURL = jest.fn();
const mockClipboardWriteText = jest.fn();
const mockAppendEvent = jest.fn();
let mockAuthUser: { id: string; name: string } | null = { id: 'driver-123', name: 'Test Driver' };

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));
  return {
    Alert: { alert: jest.fn() },
    Linking: { openURL: (...args: unknown[]) => mockOpenURL(...args) },
    Platform: { OS: 'ios' },
    Pressable: host('Pressable'),
    Share: { share: (...args: unknown[]) => mockShare(...args) },
    StyleSheet: { create: (styles: object) => styles, hairlineWidth: 1, flatten: (style: object) => style },
    Text: host('Text'),
    TouchableOpacity: host('TouchableOpacity'),
    View: host('View'),
  };
});

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));
  return { Feather: host('Feather') };
});

jest.mock('react-native-svg', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));
  return {
    __esModule: true,
    default: host('Svg'),
    Rect: host('Rect'),
  };
});

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: mockAuthUser }),
}));

jest.mock('@/hooks/useColors', () => ({
  useColors: () => ({
    background: '#fff',
    border: '#eee',
    card: '#fff',
    foreground: '#111',
    mutedForeground: '#666',
    primary: '#007aff',
  }),
}));

jest.mock('@/persistence/referralEventsPersistence', () => ({
  appendStoredReferralEvent: (...args: unknown[]) => mockAppendEvent(...args),
}));

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ReferralShareScreen from '../ReferralShareScreen';

describe('ReferralShareScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUser = { id: 'driver-123', name: 'Test Driver' };
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText: mockClipboardWriteText } },
      configurable: true,
      writable: true,
    });
    mockClipboardWriteText.mockResolvedValue(undefined);
  });

  test('renders the invite link and QR code', async () => {
    render(<ReferralShareScreen />);

    expect(screen.getByText('Share App')).toBeTruthy();
    expect(screen.getByTestId('referral-qr')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('https://rides.rw/invite?ref=driver-123')).toBeTruthy());
    expect(mockAppendEvent).toHaveBeenCalledWith(expect.objectContaining({ name: 'referral_link_created' }));
    expect(mockAppendEvent).toHaveBeenCalledWith(expect.objectContaining({ name: 'referral_qr_displayed' }));
  });

  test('copies the link when copy is available', async () => {
    render(<ReferralShareScreen />);

    fireEvent.press(screen.getByText('Copy link'));

    await waitFor(() => expect(mockClipboardWriteText).toHaveBeenCalledWith('https://rides.rw/invite?ref=driver-123'));
    expect(mockAppendEvent).toHaveBeenCalledWith(expect.objectContaining({ name: 'referral_link_shared' }));
  });

  test('shares the invite link natively', async () => {
    render(<ReferralShareScreen />);

    fireEvent.press(screen.getByText('Share'));

    await waitFor(() => expect(mockShare).toHaveBeenCalled());
    expect(mockShare).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://rides.rw/invite?ref=driver-123',
    }));
  });

  test('opens the link when pressed', async () => {
    render(<ReferralShareScreen />);

    fireEvent.press(screen.getByLabelText('Open invite link'));

    await waitFor(() => expect(mockOpenURL).toHaveBeenCalledWith('https://rides.rw/invite?ref=driver-123'));
    expect(mockAppendEvent).toHaveBeenCalledWith(expect.objectContaining({ name: 'referral_link_opened' }));
  });

  test('falls back when no auth user exists', () => {
    mockAuthUser = null;

    render(<ReferralShareScreen />);

    expect(screen.getByText('No referral account is available.')).toBeTruthy();
  });
});
