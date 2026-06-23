import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import React, { createRef } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  Text,
  View,
} from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { BookingSheet } from '@/components/home/BookingSheet';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { RideProvider, useRide } from '@/context/ride/RideProvider';
import type { CloseButtonHandle } from '@/components/BackButton';
import type { RideLocation, User } from '@/types';

// The RideProvider is backend-backed; stub the network layer so the rendered
// workflow exercises real provider logic without a live server.
jest.mock('@/services/rides', () => ({
  createRide: jest.fn().mockResolvedValue({ ride_id: 'ride-test-1' }),
  getActiveCustomerRide: jest.fn().mockResolvedValue(null),
  getRide: jest.fn().mockResolvedValue(null),
  listRides: jest.fn().mockResolvedValue({ rides: [] }),
  cancelRide: jest.fn().mockResolvedValue(undefined),
  proposeNegotiation: jest.fn().mockResolvedValue(undefined),
  acceptNegotiation: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/services/websocket', () => ({
  RideWebSocket: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    on: jest.fn().mockReturnThis(),
    send: jest.fn(),
    disconnect: jest.fn(),
  })),
}));

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));
  class Value {
    value: number;
    constructor(initialValue: number) {
      this.value = initialValue;
    }
  }
  return {
    Animated: { Value, View: host('AnimatedView') },
    Keyboard: { dismiss: jest.fn() },
    KeyboardAvoidingView: host('KeyboardAvoidingView'),
    PanResponder: { create: () => ({ panHandlers: {} }) },
    Platform: { OS: 'android' },
    Pressable: host('Pressable'),
    StyleSheet: { create: (styles: object) => styles, flatten: (style: object) => style },
    Text: host('Text'),
    TouchableOpacity: host('TouchableOpacity'),
    View: host('View'),
  };
});

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const Icon = ({ name }: { name: string }) => <Text>{name}</Text>;
  return { Feather: Icon, MaterialCommunityIcons: Icon };
});

jest.mock('@/components/home/homeStyles', () => ({
  styles: {},
}));

jest.mock('@/components/AppButton', () => ({
  AppButton: ({ disabled, loading, onPress, title }: {
    disabled?: boolean;
    loading?: boolean;
    onPress: () => void;
    title: string;
  }) => {
    const React = require('react');
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable accessibilityRole="button" disabled={disabled || loading} onPress={onPress}>
        <Text>{title}</Text>
      </Pressable>
    );
  },
}));

jest.mock('@/components/BackButton', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    CloseButton: React.forwardRef(({ accessibilityLabel, onPress }: {
      accessibilityLabel: string;
      onPress: () => void;
    }, _ref: unknown) => (
      <Pressable accessibilityLabel={accessibilityLabel} onPress={onPress}>
        <Text>Close</Text>
      </Pressable>
    )),
  };
});

jest.mock('@/utils/driverProfileImage', () => ({
  buildDriverWithUploadedPhoto: jest.fn(async driver => driver),
}));

const pickup: RideLocation = {
  address: 'Kimironko Market',
  latitude: -1.9365,
  longitude: 30.1011,
  locationType: 'precise',
};

const destination: RideLocation = {
  address: 'Kigali City Tower',
  latitude: -1.9438,
  longitude: 30.0616,
  locationType: 'precise',
};

const colors = {
  background: '#ffffff',
  border: '#dddddd',
  card: '#ffffff',
  destructive: '#ff0000',
  foreground: '#111111',
  muted: '#eeeeee',
  mutedForeground: '#777777',
  primary: '#0066ff',
} as never;

function CustomerBookingWorkflow() {
  const { createRide, currentRide } = useRide();
  return (
    <View>
      <Text testID="customer-ride-status">{currentRide?.status ?? 'none'}</Text>
      <BookingSheet
        {...({} as any) /* test scaffold: BookingSheet gained props after the feat/packages merge */}
        visible
        height={500}
        bottomOffset={0}
        bottomPadding={0}
        colors={colors}
        animation={new Animated.Value(0)}
        panResponder={PanResponder.create({})}
        closeButtonRef={createRef<CloseButtonHandle>()}
        onClose={jest.fn()}
        pickup={pickup}
        destination={destination}
        destinationText={destination.address ?? ''}
        focusedField="dropoff"
        userLocation={pickup}
        onOpenLocationSearch={jest.fn()}
        onUseMap={jest.fn()}
        onUseGpsPickup={jest.fn()}
        onUseGpsDestination={jest.fn()}
        route={{ distanceMeters: 3_400, durationSeconds: 720 }}
        routeLoading={false}
        distance={3.4}
        onBook={() => void createRide(pickup, destination, 'moto', destination.address)}
        booking={false}
      />
    </View>
  );
}

const user: User = {
  id: 'customer-1',
  name: 'Test Customer',
  phone: '+250788000000',
  mode: 'customer',
  isDriver: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

function AuthWorkflow() {
  const auth = useAuth();
  return (
    <View>
      <Text testID="auth-loading">{String(auth.isLoading)}</Text>
      <Text testID="auth-user">{auth.user?.name ?? 'signed-out'}</Text>
      <Text testID="auth-mode">{auth.user?.mode ?? 'none'}</Text>
      <Pressable onPress={() => void auth.login(user)}><Text>Login</Text></Pressable>
      <Pressable onPress={() => void auth.saveDriverProfile({
        vehicleType: 'moto',
        plateNumber: 'RAD 001 A',
        licenseNumber: '1234567890123456',
        province: 'City of Kigali',
        district: 'Gasabo',
        sector: 'Kacyiru',
        momoCode: '250788000000',
        momoProvider: 'mtn',
        dob: '01/01/1990',
        verificationStatus: 'approved',
        isOnline: false,
        isVerified: true,
        acceptanceRate: 100,
        completedRides: 0,
        dailyRides: 0,
        dailyDeclines: 0,
        policyAccepted: true,
        earningsTotal: 0,
      })}><Text>Approve driver</Text></Pressable>
      <Pressable onPress={() => void auth.switchMode('driver')}><Text>Switch driver</Text></Pressable>
      <Pressable onPress={() => void auth.switchMode('customer')}><Text>Switch customer</Text></Pressable>
      <Pressable onPress={() => void auth.logout()}><Text>Logout</Text></Pressable>
    </View>
  );
}

describe('critical rendered ride and auth workflows', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    (SecureStore as typeof SecureStore & { __clear: () => void }).__clear();
    const originalConsoleError = console.error;
    jest.spyOn(console, 'error').mockImplementation((...args) => {
      if (String(args[0]).includes('react-test-renderer is deprecated')) return;
      originalConsoleError(...args);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('customer books a configured route and creates a searching ride', async () => {
    render(
      <RideProvider>
        <CustomerBookingWorkflow />
      </RideProvider>,
    );

    expect(screen.getByText('Kimironko Market')).toBeTruthy();
    expect(screen.getByText('Kigali City Tower')).toBeTruthy();
    fireEvent.press(screen.getByText('Find Driver'));

    await waitFor(() => expect(screen.getByTestId('customer-ride-status').props.children).toBe('searching'));
  });


  test('user logs in, switches modes, and logs out', async () => {
    render(
      <AuthProvider>
        <AuthWorkflow />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('auth-loading').props.children).toBe('false'));
    fireEvent.press(screen.getByText('Login'));
    await waitFor(() => expect(screen.getByTestId('auth-user').props.children).toBe('Test Customer'));
    expect(screen.getByTestId('auth-mode').props.children).toBe('customer');

    fireEvent.press(screen.getByText('Approve driver'));
    fireEvent.press(screen.getByText('Switch driver'));
    await waitFor(() => expect(screen.getByTestId('auth-mode').props.children).toBe('driver'));

    fireEvent.press(screen.getByText('Switch customer'));
    await waitFor(() => expect(screen.getByTestId('auth-mode').props.children).toBe('customer'));

    fireEvent.press(screen.getByText('Logout'));
    await waitFor(() => expect(screen.getByTestId('auth-user').props.children).toBe('signed-out'));
    expect(screen.getByTestId('auth-mode').props.children).toBe('none');
  });
});
