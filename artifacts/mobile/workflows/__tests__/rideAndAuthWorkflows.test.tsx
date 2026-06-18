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

let mockRideDriverProfile: any = null;
let mockRideEntitlement: any = null;

jest.mock('@/context/AuthContext', () => {
  const actual = jest.requireActual('@/context/AuthContext');
  return {
    ...actual,
    useOptionalAuth: () => mockRideDriverProfile ? { driverProfile: mockRideDriverProfile } : null,
  };
});

jest.mock('@/context/DriverEntitlementContext', () => {
  const actual = jest.requireActual('@/context/DriverEntitlementContext');
  return {
    ...actual,
    useOptionalDriverEntitlement: () => mockRideEntitlement,
  };
});

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
        visible
        height={500}
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

function DriverRideWorkflow() {
  const ride = useRide();
  return (
    <View>
      <Text testID="pending-request">{ride.pendingRequest ? 'pending' : 'none'}</Text>
      <Text testID="driver-ride-status">{ride.currentRide?.status ?? 'none'}</Text>
      <Text testID="history-count">{ride.rideHistory.length}</Text>
      <Pressable onPress={ride.simulateIncomingRideRequest}><Text>Receive request</Text></Pressable>
      <Pressable onPress={ride.acceptRideRequest}><Text>Accept request</Text></Pressable>
      <Pressable onPress={() => ride.riderAcceptWithFare(5_000)}><Text>Accept fare</Text></Pressable>
      <Pressable onPress={ride.markArrived}><Text>Mark arrived</Text></Pressable>
      <Pressable onPress={ride.startJourney}><Text>Start journey</Text></Pressable>
      <Pressable onPress={() => ride.completeRide('driver')}><Text>Complete ride</Text></Pressable>
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
    mockRideDriverProfile = null;
    mockRideEntitlement = null;
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

  test('driver receives, accepts, starts, and completes a ride request', async () => {
    mockRideDriverProfile = {
      vehicleType: 'moto',
      plateNumber: 'RAD 001 A',
      licenseNumber: 'LIC001',
      province: 'Kigali',
      district: 'Gasabo',
      sector: 'Kimironko',
      momoCode: '0781234567',
      momoProvider: 'mtn',
      dob: '1990-01-01',
      isOnline: true,
      isVerified: true,
      acceptanceRate: 100,
      completedRides: 0,
      dailyRides: 0,
      dailyDeclines: 0,
      policyAccepted: true,
      earningsTotal: 0,
      onlineVehicleSession: {
        vehicleId: 'driver-vehicle:moto:rad-001-a',
        vehicleType: 'moto',
        startedAt: '2026-06-08T09:00:00.000Z',
      },
      activeVehicle: { vehicleId: 'driver-vehicle:moto:rad-001-a' },
      vehicles: [{
        id: 'driver-vehicle:moto:rad-001-a',
        vehicleType: 'moto',
        status: 'approved',
        plateNumber: 'RAD 001 A',
        licenseNumber: 'LIC001',
        submittedAt: '2026-06-08T09:00:00.000Z',
      }],
    };
    mockRideEntitlement = {
      entitlement: {
        vehicleId: 'driver-vehicle:moto:rad-001-a',
        vehicleType: 'moto',
        activePackageId: null,
        remainingRideCredits: 30,
        remainingBonusRides: 5,
        activations: [],
        creditTransactions: [],
        purchaseHistory: [],
        vehicleEntitlements: [{
          vehicleId: 'driver-vehicle:moto:rad-001-a',
          vehicleType: 'moto',
          activePackageId: null,
          remainingRideCredits: 30,
          remainingBonusRides: 5,
          activations: [],
          creditTransactions: [],
          purchaseHistory: [],
          updatedAt: '2026-06-08T09:00:00.000Z',
          authority: 'local_prototype',
        }],
        updatedAt: '2026-06-08T09:00:00.000Z',
        authority: 'local_prototype',
      },
      deductCreditForCompletedRide: jest.fn(async () => true),
    };
    render(
      <RideProvider>
        <DriverRideWorkflow />
      </RideProvider>,
    );

    fireEvent.press(screen.getByText('Receive request'));
    expect(screen.getByTestId('pending-request').props.children).toBe('pending');

    fireEvent.press(screen.getByText('Accept request'));
    expect(screen.getByTestId('driver-ride-status').props.children).toBe('negotiating');

    fireEvent.press(screen.getByText('Accept fare'));
    expect(screen.getByTestId('driver-ride-status').props.children).toBe('confirmed');

    fireEvent.press(screen.getByText('Mark arrived'));
    expect(screen.getByTestId('driver-ride-status').props.children).toBe('arrived');

    fireEvent.press(screen.getByText('Start journey'));
    expect(screen.getByTestId('driver-ride-status').props.children).toBe('in_progress');

    fireEvent.press(screen.getByText('Complete ride'));
    expect(screen.getByTestId('driver-ride-status').props.children).toBe('none');
    expect(screen.getByTestId('history-count').props.children).toBe(1);
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
