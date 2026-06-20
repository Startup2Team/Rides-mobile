import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { View } from 'react-native';
import DriverOnboarding from '../driver-onboarding';

const mockSaveDriverProfile = jest.fn(() => Promise.resolve());
const mockSwitchMode = jest.fn(() => Promise.resolve());
const mockSetForm = jest.fn();
const mockSetDocs = jest.fn();
const mockSetSelfieUri = jest.fn();
const mockSetErrors = jest.fn();
const mockTakeSelfie = jest.fn();
const mockTakeDocumentPhoto = jest.fn();
const mockSaveDocuments = jest.fn(() => Promise.resolve());
const mockSaveProfileImage = jest.fn(() => Promise.resolve());
const mockSubmitApplication = jest.fn(() => Promise.resolve());
const mockImageGalleryPreview = jest.fn(({ visible }: { visible?: boolean }) => (
  <View testID={visible ? 'image-gallery-preview-visible' : 'image-gallery-preview-hidden'} />
));

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));
  return {
    Image: host('Image'),
    KeyboardAvoidingView: host('KeyboardAvoidingView'),
    Platform: { OS: 'android', select: (options: Record<string, unknown>) => options.android ?? options.default },
    ScrollView: host('ScrollView'),
    StyleSheet: {
      create: (styles: object) => styles,
      flatten: (style: unknown) => style,
    },
    Text: host('Text'),
    TouchableOpacity: host('TouchableOpacity'),
    useColorScheme: () => 'light',
    View: host('View'),
  };
});

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
  },
}));

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    driverProfile: null,
    saveDriverProfile: mockSaveDriverProfile,
    switchMode: mockSwitchMode,
    user: { id: 'user-1', name: 'Driver User', phone: '250788000000' },
  }),
}));

jest.mock('@/hooks/useColors', () => ({
  useColors: () => ({
    background: '#fff',
    foreground: '#111',
    mutedForeground: '#666',
    border: '#ddd',
    primary: '#2563eb',
    primaryHex: '#2563eb',
    primaryForeground: '#fff',
    destructive: '#dc2626',
    destructiveHex: '#dc2626',
    destructiveForeground: '#fff',
    muted: '#f4f4f5',
    card: '#fff',
    successHex: '#16a34a',
    warningHex: '#d97706',
    call: '#16a34a',
  }),
}));

jest.mock('@/hooks/driver-onboarding/useDriverOnboardingForm', () => ({
  useDriverOnboardingForm: () => ({
    errors: {},
    form: {
      vehicleType: 'cab',
      brand: 'Toyota',
      model: 'Corolla',
      manufactureYear: '2020',
      plateNumber: 'RAC 002 A',
      licenseNumber: '1234567890123456',
      nationalId: '1990010112345678',
      licenseExpiryDate: '01/01/2027',
      insuranceExpiryDate: '01/01/2027',
      authorizationExpiryDate: '01/01/2027',
      dob: '01/01/1990',
      province: 'City of Kigali',
      district: 'Gasabo',
      sector: 'Kacyiru',
      cell: 'Cell A',
      village: 'Village B',
      momoProvider: 'mtn',
      momoCode: '250788000000',
      merchantCode: '',
      passengerSeats: '4',
      loadCapacityKg: '',
    },
    handlePlateChange: jest.fn(),
    maxDobDate: '2027-01-01',
    plateWarning: '',
    setErrors: mockSetErrors,
    setForm: mockSetForm,
    update: jest.fn(),
    updateCascade: jest.fn(),
  }),
}));

jest.mock('@/hooks/driver-onboarding/useDriverDocumentUpload', () => ({
  useDriverDocumentUpload: () => ({
    docs: {
      license: ['license-front://photo', 'license-back://photo'],
      nationalId: ['national-front://photo', 'national-back://photo'],
      insurance: ['insurance-front://photo', null],
      authorization: ['authorization-front://photo', null],
    },
    selfieUri: 'selfie://photo',
    setDocs: mockSetDocs,
    setSelfieUri: mockSetSelfieUri,
    takeDocumentPhoto: mockTakeDocumentPhoto,
    takeSelfie: mockTakeSelfie,
  }),
}));

jest.mock('@/hooks/driver-onboarding/useDriverOnboardingValidation', () => ({
  useDriverOnboardingValidation: () => () => ({}),
}));

jest.mock('@/persistence/driverOnboardingPersistence', () => ({
  loadStoredDriverOnboardingDraft: jest.fn(() => Promise.resolve({ data: null })),
  removeStoredDriverOnboardingDraft: jest.fn(() => Promise.resolve()),
  saveStoredDriverOnboardingDraft: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/persistence/profilePersistence', () => ({
  saveStoredProfileImage: mockSaveProfileImage,
}));

jest.mock('@/persistence/driverDocumentsPersistence', () => ({
  saveStoredDriverDocuments: mockSaveDocuments,
}));

jest.mock('@/domain/verificationSubmissions', () => ({
  submitDriverApplication: mockSubmitApplication,
}));

jest.mock('@/components/driver-onboarding/ProgressHeader', () => ({
  ProgressHeader: () => null,
}));

jest.mock('@/components/driver-onboarding/PersonalInformationSection', () => ({
  PersonalInformationSection: () => null,
}));

jest.mock('@/components/driver-onboarding/VehicleInformationSection', () => ({
  VehicleInformationSection: () => null,
}));

jest.mock('@/components/driver-onboarding/DocumentUploadSection', () => ({
  DocumentUploadSection: () => null,
}));

jest.mock('@/components/driver-onboarding/RequirementsSection', () => ({
  RequirementsSection: ({ setAcceptedTerms }: { setAcceptedTerms: (value: boolean) => void }) => {
    const React = require('react');
    React.useEffect(() => {
      setAcceptedTerms(true);
    }, [setAcceptedTerms]);
    return null;
  },
}));

jest.mock('@/components/ImageGalleryPreview', () => ({
  ImageGalleryPreview: (props: { visible?: boolean }) => mockImageGalleryPreview(props),
}));

jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
}));

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light' },
  impactAsync: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

describe('DriverOnboarding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('opens the submitted image gallery from the review step', async () => {
    render(<DriverOnboarding />);

    for (let i = 0; i < 3; i += 1) {
      fireEvent.press(screen.getByLabelText('Continue'));
    }
    await waitFor(() => expect(screen.getByLabelText('Continue').props.accessibilityState.disabled).toBe(false));
    fireEvent.press(screen.getByLabelText('Continue'));
    await waitFor(() => expect(screen.getByText('Review Your Application')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('Preview Driver\'s Licence - Back'));

    const lastCall = mockImageGalleryPreview.mock.calls.at(-1)?.[0];
    expect(lastCall).toEqual(expect.objectContaining({
      visible: true,
      initialIndex: 2,
      images: expect.arrayContaining([
        expect.objectContaining({ id: 'selfie', uri: 'selfie://photo' }),
        expect.objectContaining({ id: 'license-front', uri: 'license-front://photo' }),
        expect.objectContaining({ id: 'license-back', uri: 'license-back://photo' }),
      ]),
    }));
  });
});
