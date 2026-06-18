import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Alert, Text } from 'react-native';
import type { DriverProfile, DriverVehicleProfile } from '@/types';
import type { DocFaces, DocumentKey } from '@/hooks/driver-onboarding/onboardingTypes';
import { formatRwandaPlateInput } from '@/utils/rwandaValidation';
import DriverAddVehicleScreen from '../driver-add-vehicle';

const mockSaveDriverProfile = jest.fn(() => Promise.resolve());
const mockSetForm = jest.fn();
const mockSetDocs = jest.fn();
const mockUpdate = jest.fn();
const mockPickDocument = jest.fn();
const mockTakeDocumentPhoto = jest.fn();
let mockDriverProfile: DriverProfile | null = null;
let mockParams: Record<string, string> = {};
let mockDocs: Record<DocumentKey, DocFaces> = {
  license: ['license-front://photo', 'license-back://photo'],
  nationalId: ['national-front://photo', 'national-back://photo'],
  insurance: ['insurance-front://photo', null],
  authorization: ['authorization-front://photo', null],
};

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));
  return {
    Alert: { alert: jest.fn() },
    Image: host('Image'),
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
    back: jest.fn(),
    replace: jest.fn(),
  },
  useLocalSearchParams: () => mockParams,
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    driverProfile: mockDriverProfile,
    saveDriverProfile: mockSaveDriverProfile,
  }),
}));

jest.mock('@/hooks/driver-onboarding/useDriverOnboardingForm', () => ({
  useDriverOnboardingForm: () => ({
    form: {
      vehicleType: 'cab',
      plateNumber: 'RAC 002 A',
      licenseNumber: '1234567890123456',
      nationalId: '1990010112345678',
      licenseExpiryDate: '01/01/2027',
      insuranceExpiryDate: '01/01/2027',
      authorizationExpiryDate: '01/01/2027',
      dob: '',
      province: '',
      district: '',
      sector: '',
      cell: '',
      village: '',
      momoProvider: 'mtn',
      momoCode: '',
      merchantCode: '',
      passengerSeats: '4',
      loadCapacityKg: '',
    },
    setForm: mockSetForm,
    update: mockUpdate,
  }),
}));

jest.mock('@/hooks/driver-onboarding/useDriverDocumentUpload', () => ({
  useDriverDocumentUpload: () => ({
    docs: mockDocs,
    pickDocument: mockPickDocument,
    setDocs: mockSetDocs,
    takeDocumentPhoto: mockTakeDocumentPhoto,
  }),
}));

jest.mock('@/components/driver-onboarding/DocumentUploadSection', () => ({
  DocumentUploadSection: () => null,
}));

jest.mock('@/components/DatePickerField', () => ({
  DatePickerField: () => null,
}));

jest.mock('@/components/GlassHeader', () => ({
  GlassHeader: () => null,
  useGlassHeaderMetrics: () => ({ contentTop: 0, indicatorTop: 0 }),
}));

jest.mock('@expo/vector-icons', () => {
  return { Feather: () => null };
});

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
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

function makeApprovedVehicle(): DriverVehicleProfile {
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
  };
}

describe('DriverAddVehicleScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = {};
    mockDocs = {
      license: ['license-front://photo', 'license-back://photo'],
      nationalId: ['national-front://photo', 'national-back://photo'],
      insurance: ['insurance-front://photo', null],
      authorization: ['authorization-front://photo', null],
    };
    mockDriverProfile = {
      vehicleType: 'moto',
      plateNumber: 'RAD 001 A',
      licenseNumber: '1234567890123456',
      nationalId: '1990010112345678',
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
      vehicles: [makeApprovedVehicle()],
      activeVehicle: { vehicleId: 'driver-vehicle:moto:rad-001-a' },
    };
  });

  test('submits a pending vehicle and stores the required vehicle photos', async () => {
    const useStateSpy = jest.spyOn(React, 'useState') as any;
    useStateSpy
      .mockImplementationOnce(() => ['Toyota', jest.fn()] as any)
      .mockImplementationOnce(() => ['Corolla', jest.fn()] as any)
      .mockImplementationOnce(() => ['2020', jest.fn()] as any)
      .mockImplementationOnce(() => ([{
        outside: 'vehicle-outside://photo',
        inside: 'vehicle-inside://photo',
      }, jest.fn()] as any))
      .mockImplementationOnce(() => [false, jest.fn()] as any)
      .mockImplementation((initial: unknown) => [initial, jest.fn()] as any);

    render(<DriverAddVehicleScreen />);

    screen.getByLabelText('Submit Vehicle').props.onPress();

    await waitFor(() => expect(mockSaveDriverProfile).toHaveBeenCalled());

    const savedProfile = ((mockSaveDriverProfile as unknown as jest.Mock).mock.calls[0]?.[0]) as DriverProfile;
    expect(savedProfile.vehicles).toHaveLength(2);
    expect(savedProfile.vehicles?.[0].status).toBe('approved');
    expect(savedProfile.vehicles?.[1]).toMatchObject({
      status: 'pending_review',
      plateNumber: 'RAC 002 A',
      photos: {
        outside: 'vehicle-outside://photo',
        inside: 'vehicle-inside://photo',
      },
    });
    useStateSpy.mockRestore();
  });

  test('blocks submission when required documents are missing and shows the missing list', async () => {
    mockDocs = {
      license: ['license-front://photo', null],
      nationalId: ['national-front://photo', null],
      insurance: [null, null],
      authorization: [null, null],
    };

    render(<DriverAddVehicleScreen />);

    expect(screen.getByText(/Missing/)).toBeTruthy();
    expect(screen.getByText(/Driver License Back/)).toBeTruthy();
    expect(screen.getByText(/Vehicle Outside Photo/)).toBeTruthy();
    expect(screen.getByLabelText('Submit Vehicle').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByLabelText('Submit Vehicle'));

    expect(mockSaveDriverProfile).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  test('formats Rwanda plates as RAD 852 B during input', () => {
    expect(formatRwandaPlateInput('RAD852B')).toBe('RAD 852 B');
  });

  test('resubmits a rejected vehicle without changing the vehicle identity', async () => {
    const sourceVehicle = {
      id: 'driver-vehicle:cab:rac-002-a',
      vehicleType: 'cab',
      status: 'rejected',
      plateNumber: 'RAC 002 A',
      licenseNumber: '1234567890123456',
      brand: 'Toyota',
      model: 'Corolla',
      manufactureYear: 2020,
      rejectedAt: '2026-06-17T10:00:00.000Z',
      rejectionReason: 'Missing insurance photo',
      reviewHistory: [
        { id: 'history-1', type: 'submitted', at: '2026-06-16T10:00:00.000Z' },
        { id: 'history-2', type: 'under_review', at: '2026-06-16T10:00:00.000Z' },
        { id: 'history-3', type: 'rejected', at: '2026-06-17T10:00:00.000Z', reason: 'Missing insurance photo' },
      ],
      documents: {
        license: { key: 'license', faces: ['license-front://photo', 'license-back://photo'], documentNumber: '1234567890123456', reviewStatus: 'rejected', submissionKind: 'replacement', submittedAt: '2026-06-16T10:00:00.000Z', updatedAt: '2026-06-17T10:00:00.000Z' },
        nationalId: { key: 'nationalId', faces: ['national-front://photo', 'national-back://photo'], documentNumber: '1990010112345678', reviewStatus: 'rejected', submissionKind: 'replacement', submittedAt: '2026-06-16T10:00:00.000Z', updatedAt: '2026-06-17T10:00:00.000Z' },
        insurance: { key: 'insurance', faces: ['insurance-front://photo', null], reviewStatus: 'rejected', submissionKind: 'replacement', submittedAt: '2026-06-16T10:00:00.000Z', updatedAt: '2026-06-17T10:00:00.000Z' },
        authorization: { key: 'authorization', faces: ['authorization-front://photo', null], reviewStatus: 'rejected', submissionKind: 'replacement', submittedAt: '2026-06-16T10:00:00.000Z', updatedAt: '2026-06-17T10:00:00.000Z' },
      },
    } satisfies DriverVehicleProfile;

    mockDriverProfile = {
      vehicleType: 'cab',
      plateNumber: sourceVehicle.plateNumber,
      licenseNumber: sourceVehicle.licenseNumber,
      province: 'City of Kigali',
      district: 'Gasabo',
      sector: 'Kacyiru',
      momoCode: '250788000000',
      momoProvider: 'mtn',
      dob: '01/01/1990',
      verificationStatus: 'rejected',
      rejectionReason: sourceVehicle.rejectionReason,
      isOnline: false,
      isVerified: false,
      acceptanceRate: 100,
      completedRides: 0,
      dailyRides: 0,
      dailyDeclines: 0,
      policyAccepted: true,
      earningsTotal: 0,
      vehicles: [sourceVehicle],
      activeVehicle: { vehicleId: null },
    };
    mockParams = { sourceVehicleId: sourceVehicle.id };

    const useStateSpy = jest.spyOn(React, 'useState') as any;
    useStateSpy
      .mockImplementationOnce(() => ['Toyota', jest.fn()] as any)
      .mockImplementationOnce(() => ['Corolla', jest.fn()] as any)
      .mockImplementationOnce(() => ['2020', jest.fn()] as any)
      .mockImplementationOnce(() => ([{
        outside: 'vehicle-outside://photo',
        inside: 'vehicle-inside://photo',
      }, jest.fn()] as any))
      .mockImplementationOnce(() => [false, jest.fn()] as any)
      .mockImplementation((initial: unknown) => [initial, jest.fn()] as any);

    render(<DriverAddVehicleScreen />);
    fireEvent.press(screen.getByLabelText('Submit Vehicle'));

    await waitFor(() => expect(mockSaveDriverProfile).toHaveBeenCalled());

    const savedProfile = ((mockSaveDriverProfile as unknown as jest.Mock).mock.calls[0]?.[0]) as DriverProfile;
    expect(savedProfile.vehicles).toHaveLength(1);
    expect(savedProfile.vehicles?.[0].id).toBe(sourceVehicle.id);
    expect(savedProfile.vehicles?.[0].status).toBe('pending_review');
    expect(savedProfile.vehicles?.[0].reviewHistory?.slice(-2)).toEqual([
      expect.objectContaining({ type: 'submitted' }),
      expect.objectContaining({ type: 'under_review' }),
    ]);
    useStateSpy.mockRestore();
  });
});
