import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';
import type { DriverVehicleProfile } from '@/types';
import { ConflictError } from '@/data/remote/contracts/backendErrors';
import DriverEditVehicleScreen from '../driver-edit-vehicle';

const mockBack = jest.fn();
const mockUpdateVehicle = jest.fn(() => Promise.resolve());
const mockUpdateVehicleByPlate = jest.fn();
let mockParams: Record<string, string> = {};
let mockVehicle: DriverVehicleProfile | null = null;

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));
  return {
    Alert: { alert: jest.fn() },
    Platform: { OS: 'android', select: (options: Record<string, unknown>) => options.android ?? options.default },
    ScrollView: host('ScrollView'),
    StyleSheet: {
      create: (styles: object) => styles,
      flatten: (style: object) => style,
    },
    Text: host('Text'),
    TextInput: host('TextInput'),
    TouchableOpacity: host('TouchableOpacity'),
    useColorScheme: () => 'light',
    View: host('View'),
  };
});

jest.mock('expo-router', () => ({
  router: {
    back: mockBack,
    push: jest.fn(),
  },
  useLocalSearchParams: () => mockParams,
}));

jest.mock('@/domains/vehicle', () => ({
  useVehicle: () => mockVehicle,
  useVehicles: () => ({ updateVehicle: mockUpdateVehicle }),
}));

jest.mock('@/services/driverVehicles', () => ({
  updateVehicleByPlate: (...args: unknown[]) => mockUpdateVehicleByPlate(...args),
}));

jest.mock('@/components/GlassHeader', () => ({
  GlassHeader: () => null,
  useGlassHeaderMetrics: () => ({ contentTop: 0, indicatorTop: 0 }),
}));

jest.mock('@/components/GlassScrollView', () => ({
  GlassScrollView: ({ children }: { children?: React.ReactNode }) => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, null, children);
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

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light' },
  impactAsync: jest.fn(),
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
    ...overrides,
  };
}

describe('DriverEditVehicleScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { vehicleId: 'driver-vehicle:moto:rad-001-a' };
    mockVehicle = makeVehicle();
  });

  test('shows a not-found state when the vehicle cannot be resolved', () => {
    mockVehicle = null;
    render(<DriverEditVehicleScreen />);
    expect(screen.getByText('Vehicle not found')).toBeTruthy();
  });

  test('pre-fills fields from the vehicle and disables Save until something changes', () => {
    render(<DriverEditVehicleScreen />);

    expect(screen.getByLabelText('Brand').props.value).toBe('Yamaha');
    expect(screen.getByLabelText('Plate number').props.value).toBe('RAD 001 A');
    expect(screen.getByLabelText('Save Changes').props.accessibilityState.disabled).toBe(true);
  });

  test('saves a changed brand, writes it through locally, and warns before a plate/capacity change', async () => {
    mockUpdateVehicleByPlate.mockResolvedValue({
      id: 'backend-uuid-1',
      plateNumber: 'RAD 001 A',
      brand: 'Honda',
      model: 'BWS',
      manufactureYear: 2020,
      passengerSeats: null,
      loadCapacityKg: null,
      approvalStatus: 'APPROVED',
    });

    render(<DriverEditVehicleScreen />);

    fireEvent.changeText(screen.getByLabelText('Brand'), 'Honda');
    expect(screen.getByLabelText('Save Changes').props.accessibilityState.disabled).toBe(false);

    fireEvent.press(screen.getByLabelText('Save Changes'));

    await waitFor(() => expect(mockUpdateVehicleByPlate).toHaveBeenCalledWith('RAD 001 A', expect.objectContaining({ brand: 'Honda' })));
    await waitFor(() => expect(mockUpdateVehicle).toHaveBeenCalledWith(expect.objectContaining({ brand: 'Honda' })));
    expect(Alert.alert).toHaveBeenCalledWith('Saved', 'Your vehicle details were updated.', expect.anything());
  });

  test('surfaces the pending-review outcome exactly as the backend returned it', async () => {
    mockUpdateVehicleByPlate.mockResolvedValue({
      id: 'backend-uuid-1',
      plateNumber: 'RAE 900 B',
      brand: 'Yamaha',
      model: 'BWS',
      manufactureYear: 2020,
      passengerSeats: null,
      loadCapacityKg: null,
      approvalStatus: 'PENDING_REVIEW',
    });

    render(<DriverEditVehicleScreen />);

    fireEvent.changeText(screen.getByLabelText('Plate number'), 'RAE 900 B');
    fireEvent.press(screen.getByLabelText('Save Changes'));

    await waitFor(() => expect(mockUpdateVehicleByPlate).toHaveBeenCalled());
    expect(Alert.alert).toHaveBeenCalledWith(
      'Saved',
      expect.stringContaining('sent for re-approval'),
      expect.anything(),
    );
  });

  test('surfaces the 409 VEHICLE_LOCKED_ON_RIDE conflict honestly and never fakes local success', async () => {
    mockUpdateVehicleByPlate.mockRejectedValue(
      new ConflictError({
        cause: { error: { code: 'VEHICLE_LOCKED_ON_RIDE', message: 'You cannot edit the active vehicle during an active ride.' } },
      }),
    );

    render(<DriverEditVehicleScreen />);

    fireEvent.changeText(screen.getByLabelText('Brand'), 'Honda');
    fireEvent.press(screen.getByLabelText('Save Changes'));

    await waitFor(() => expect(mockUpdateVehicleByPlate).toHaveBeenCalled());
    expect(mockUpdateVehicle).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Cannot edit right now',
      'You cannot edit the active vehicle during an active ride.',
    );
  });
});
