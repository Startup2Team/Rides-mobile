import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import { EMPTY_DRIVER_ENTITLEMENT } from '@/domain/driverRidePackages';
import type { DriverProfile, DriverVehicleProfile, VehicleType } from '@/types';
import DriverVehiclesScreen from '../driver-vehicles';

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockSetPrimaryVehicle = jest.fn(() => Promise.resolve());
let mockDriverProfile: DriverProfile | null = null;
let mockEntitlement = EMPTY_DRIVER_ENTITLEMENT;
let mockVehicles: DriverVehicleProfile[] = [];

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));
  return {
    Platform: { OS: 'android', select: (options: Record<string, unknown>) => options.android ?? options.default },
    ScrollView: host('ScrollView'),
    StyleSheet: {
      create: (styles: object) => styles,
      flatten: (style: object) => style,
    },
    Text: host('Text'),
    TouchableOpacity: host('TouchableOpacity'),
    useColorScheme: () => 'light',
    View: host('View'),
  };
});

jest.mock('expo-router', () => ({
  router: {
    back: mockBack,
    push: mockPush,
  },
  useLocalSearchParams: () => ({}),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    driverProfile: mockDriverProfile,
  }),
}));

jest.mock('@/domains/vehicle', () => ({
  useVehicles: () => ({
    vehicles: mockVehicles,
    setPrimaryVehicle: mockSetPrimaryVehicle,
    isLoading: false,
    isRefreshing: false,
    refreshVehicles: jest.fn(),
  }),
}));

jest.mock('@/context/DriverEntitlementContext', () => ({
  useDriverEntitlement: () => ({
    entitlement: mockEntitlement,
    isLoading: false,
  }),
}));

jest.mock('@/components/GlassHeader', () => ({
  GlassHeader: () => null,
  useGlassHeaderMetrics: () => ({ contentTop: 0, indicatorTop: 0 }),
}));

jest.mock('@/components/GlassScrollView', () => ({
  GlassScrollView: ({ children }: { children?: React.ReactNode }) => {
    const React = require('react');
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
}));

jest.mock('@expo/vector-icons', () => {
  return { Feather: () => null };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('@/hooks/useColors', () => ({
  useColors: () => ({
    foreground: '#111',
    mutedForeground: '#666',
    border: '#ddd',
    primary: '#3b82f6',
    primaryHex: '#3b82f6',
    successHex: '#16a34a',
    warningHex: '#d97706',
    destructiveHex: '#dc2626',
    destructive: '#dc2626',
    card: '#fff',
  }),
}));

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light' },
  impactAsync: jest.fn(),
}));

function makeVehicle(id: string, vehicleType: VehicleType, plateNumber: string, status: DriverVehicleProfile['status'] = 'approved') {
  return {
    id,
    vehicleType,
    status,
    plateNumber,
    licenseNumber: '1234567890123456',
    brand: vehicleType === 'cab' ? 'Toyota' : 'Yamaha',
    model: vehicleType === 'cab' ? 'Corolla' : 'BWS',
    manufactureYear: 2020,
    submittedAt: '2026-06-08T09:00:00.000Z',
  } satisfies DriverVehicleProfile;
}

function makeVehicleEntitlement(vehicle: DriverVehicleProfile, rides: number, bonusRides = 0) {
  return {
    vehicleId: vehicle.id,
    vehicleType: vehicle.vehicleType,
    activePackageId: null,
    remainingRideCredits: rides,
    remainingBonusRides: bonusRides,
    activations: [],
    creditTransactions: [],
    purchaseHistory: [],
    updatedAt: '2026-06-08T09:00:00.000Z',
    authority: 'local_prototype' as const,
  };
}

describe('DriverVehiclesScreen', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockPush.mockClear();
    mockSetPrimaryVehicle.mockClear();
    mockDriverProfile = null;
    mockEntitlement = EMPTY_DRIVER_ENTITLEMENT;
    mockVehicles = [];
  });

  test('shows one migrated vehicle for a legacy approved driver', async () => {
    mockDriverProfile = {
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
    };
    const vehicle = makeVehicle('driver-vehicle:moto:rad-001-a', 'moto', 'RAD 001 A');
    mockVehicles = [vehicle];
    mockEntitlement = {
      ...EMPTY_DRIVER_ENTITLEMENT,
      vehicleEntitlements: [makeVehicleEntitlement(vehicle, 8, 2)],
      updatedAt: '2026-06-08T10:00:00.000Z',
      authority: 'local_prototype',
    };

    render(<DriverVehiclesScreen />);

    expect(screen.getByText('1 linked vehicle')).toBeTruthy();
    expect(screen.getByText('Approved 1 • Pending 0 • Rejected 0')).toBeTruthy();
    expect(screen.getByText('Moto')).toBeTruthy();
    expect(screen.getByText('Plate RAD 001 A')).toBeTruthy();
    expect(screen.getByText(/8 rides left/)).toBeTruthy();
    expect(screen.getByText(/2 bonus rides/)).toBeTruthy();
    expect(screen.getByText('Use for session')).toBeTruthy();
    expect(screen.getByText('View details')).toBeTruthy();
  });

  test('pending and rejected vehicles cannot be selected and approved vehicles remain usable', async () => {
    const approved = makeVehicle('driver-vehicle:moto:rad-001-a', 'moto', 'RAD 001 A');
    const secondary = makeVehicle('driver-vehicle:cab:rac-002-a', 'cab', 'RAC 002 A');
    const pending = makeVehicle('driver-vehicle:hilux:raa-003-a', 'hilux', 'RAA 003 A', 'pending_review');
    const rejected = makeVehicle('driver-vehicle:fuso:rab-004-a', 'fuso', 'RAB 004 A', 'rejected');

    mockDriverProfile = {
      vehicleType: 'moto',
      plateNumber: approved.plateNumber,
      licenseNumber: approved.licenseNumber,
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
      activeVehicle: { vehicleId: approved.id },
      vehicles: [approved, secondary, pending, rejected],
    };
    mockVehicles = [approved, secondary, pending, rejected];
    mockEntitlement = {
      ...EMPTY_DRIVER_ENTITLEMENT,
      vehicleEntitlements: [
        makeVehicleEntitlement(approved, 12, 1),
        makeVehicleEntitlement(secondary, 4, 2),
        makeVehicleEntitlement(pending, 0, 0),
        makeVehicleEntitlement(rejected, 0, 0),
      ],
      updatedAt: '2026-06-08T10:00:00.000Z',
      authority: 'local_prototype',
    };

    render(<DriverVehiclesScreen />);

    expect(screen.getAllByText('Selected').length).toBeGreaterThan(0);
    expect(screen.getByText('Use for session')).toBeTruthy();
    expect(screen.getByText('View')).toBeTruthy();
    expect(screen.getByText('Update Application')).toBeTruthy();
    expect(screen.getByText('Not selectable')).toBeTruthy();
    expect(screen.getByText('Approved 2 • Pending 1 • Rejected 1')).toBeTruthy();

    fireEvent.press(screen.getByText('Use for session'));

    await waitFor(() => expect(mockSetPrimaryVehicle).toHaveBeenCalledWith(secondary.id));
  });

  test('does not allow switching active vehicle while online', async () => {
    const approved = makeVehicle('driver-vehicle:moto:rad-001-a', 'moto', 'RAD 001 A');
    const secondary = makeVehicle('driver-vehicle:cab:rac-002-a', 'cab', 'RAC 002 A');

    mockDriverProfile = {
      vehicleType: 'moto',
      plateNumber: approved.plateNumber,
      licenseNumber: approved.licenseNumber,
      province: 'City of Kigali',
      district: 'Gasabo',
      sector: 'Kacyiru',
      momoCode: '250788000000',
      momoProvider: 'mtn',
      dob: '01/01/1990',
      verificationStatus: 'approved',
      isOnline: true,
      isVerified: true,
      acceptanceRate: 100,
      completedRides: 0,
      dailyRides: 0,
      dailyDeclines: 0,
      policyAccepted: true,
      earningsTotal: 0,
      activeVehicle: { vehicleId: approved.id },
      vehicles: [approved, secondary],
    };
    mockVehicles = [approved, secondary];
    mockEntitlement = {
      ...EMPTY_DRIVER_ENTITLEMENT,
      vehicleEntitlements: [
        makeVehicleEntitlement(approved, 12, 1),
        makeVehicleEntitlement(secondary, 4, 2),
      ],
      updatedAt: '2026-06-08T10:00:00.000Z',
      authority: 'local_prototype',
    };

    render(<DriverVehiclesScreen />);

    expect(screen.getByText('Go offline to switch')).toBeTruthy();
    fireEvent.press(screen.getByText('Use for session'));

    expect(mockSetPrimaryVehicle).not.toHaveBeenCalled();
  });

});
