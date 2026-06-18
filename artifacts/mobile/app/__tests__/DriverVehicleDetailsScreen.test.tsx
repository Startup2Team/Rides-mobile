import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import type { DriverProfile, DriverVehicleProfile } from '@/types';
import DriverVehicleDetailsScreen from '../driver-vehicle-details';

const mockBack = jest.fn();
const mockPush = jest.fn();
let mockDriverProfile: DriverProfile | null = null;
let mockParams: Record<string, string> = {};

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));
  return {
    Image: host('Image'),
    Modal: ({ visible, children }: { visible?: boolean; children?: React.ReactNode }) => (visible ? <>{children}</> : null),
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
  useLocalSearchParams: () => mockParams,
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    driverProfile: mockDriverProfile,
  }),
}));

jest.mock('@/components/GlassHeader', () => ({
  GlassHeader: () => null,
  useGlassHeaderMetrics: () => ({ contentTop: 0, indicatorTop: 0 }),
}));

jest.mock('@/components/AppButton', () => ({
  AppButton: ({ title, onPress }: { title: string; onPress: () => void }) => {
    const React = require('react');
    return React.createElement('TouchableOpacity', { onPress }, React.createElement('Text', null, title));
  },
}));

jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
}));

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
    muted: '#f4f4f5',
    card: '#fff',
  }),
}));

function makeVehicle(overrides: Partial<DriverVehicleProfile> = {}): DriverVehicleProfile {
  return {
    id: 'driver-vehicle:moto:rad-001-a',
    vehicleType: 'moto',
    status: 'approved',
    plateNumber: 'RAD 001 A',
    licenseNumber: '1234567890123456',
    brand: 'Yamaha',
    model: 'BWS',
    manufactureYear: 2020,
    submittedAt: '2026-06-08T09:00:00.000Z',
    approvedAt: '2026-06-08T10:00:00.000Z',
    photos: {
      outside: 'vehicle-outside://photo',
      inside: 'vehicle-inside://photo',
    },
    documents: {
      license: { key: 'license', faces: ['license-front://photo', 'license-back://photo'], reviewStatus: 'verified', submissionKind: 'initial', submittedAt: '2026-06-08T09:00:00.000Z', updatedAt: '2026-06-08T09:00:00.000Z' },
      nationalId: { key: 'nationalId', faces: ['national-front://photo', 'national-back://photo'], reviewStatus: 'verified', submissionKind: 'initial', submittedAt: '2026-06-08T09:00:00.000Z', updatedAt: '2026-06-08T09:00:00.000Z' },
      insurance: { key: 'insurance', faces: ['insurance-front://photo', null], reviewStatus: 'verified', submissionKind: 'initial', submittedAt: '2026-06-08T09:00:00.000Z', updatedAt: '2026-06-08T09:00:00.000Z' },
      authorization: { key: 'authorization', faces: ['authorization-front://photo', null], reviewStatus: 'verified', submissionKind: 'initial', submittedAt: '2026-06-08T09:00:00.000Z', updatedAt: '2026-06-08T09:00:00.000Z' },
    },
    reviewHistory: [
      { id: 'event-1', type: 'submitted', at: '2026-06-08T09:00:00.000Z' },
      { id: 'event-2', type: 'under_review', at: '2026-06-08T09:00:00.000Z' },
      { id: 'event-3', type: 'approved', at: '2026-06-08T10:00:00.000Z' },
    ],
    ...overrides,
  };
}

describe('DriverVehicleDetailsScreen', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockPush.mockClear();
    mockParams = { vehicleId: 'driver-vehicle:moto:rad-001-a' };
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
      vehicles: [makeVehicle()],
      activeVehicle: { vehicleId: 'driver-vehicle:moto:rad-001-a' },
    };
  });

  test('renders the approved vehicle state and opens document previews', () => {
    render(<DriverVehicleDetailsScreen />);

    expect(screen.getByText('Approval date: 2026-06-08T10:00:00.000Z')).toBeTruthy();
    expect(screen.getByText('Approved for rides')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Driver License front preview'));

    expect(screen.getByText('Driver License Front')).toBeTruthy();
  });

  test('shows the pending review state with submission date', () => {
    mockDriverProfile = {
      ...mockDriverProfile!,
      verificationStatus: 'pending_review',
      isVerified: false,
      vehicles: [makeVehicle({
        status: 'pending_review',
        approvedAt: undefined,
        reviewHistory: [
          { id: 'event-1', type: 'submitted', at: '2026-06-08T09:00:00.000Z' },
          { id: 'event-2', type: 'under_review', at: '2026-06-08T09:00:00.000Z' },
        ],
      })],
    };

    render(<DriverVehicleDetailsScreen />);

    expect(screen.getByText('Pending Review')).toBeTruthy();
    expect(screen.getByText('Submitted date: 2026-06-08T09:00:00.000Z')).toBeTruthy();
  });

  test('shows rejection reason and routes to update application', () => {
    mockDriverProfile = {
      ...mockDriverProfile!,
      verificationStatus: 'rejected',
      isVerified: false,
      rejectionReason: 'Insurance photo missing',
      vehicles: [makeVehicle({
        status: 'rejected',
        approvedAt: undefined,
        rejectedAt: '2026-06-09T12:00:00.000Z',
        rejectionReason: 'Insurance photo missing',
        reviewHistory: [
          { id: 'event-1', type: 'submitted', at: '2026-06-08T09:00:00.000Z' },
          { id: 'event-2', type: 'under_review', at: '2026-06-08T09:00:00.000Z' },
          { id: 'event-3', type: 'rejected', at: '2026-06-09T12:00:00.000Z', reason: 'Insurance photo missing' },
        ],
      })],
    };

    render(<DriverVehicleDetailsScreen />);

    expect(screen.getAllByText('Reason: Insurance photo missing')[0]).toBeTruthy();
    expect(screen.getByText('Rejected date: 2026-06-09T12:00:00.000Z')).toBeTruthy();
    expect(screen.getByText('Update Application')).toBeTruthy();
  });
});
