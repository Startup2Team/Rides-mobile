import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import type { DriverPackageOfferSnapshot } from '@/domain/driverRidePackages';
import DriverPackagePaymentScreen from '../driver-package-payment';

const mockCreatePackagePurchase = jest.fn();
const mockActivatePackage = jest.fn();
const mockUpdatePackagePurchaseStatus = jest.fn();
const mockShowToast = jest.fn();
const mockCopyToClipboard = jest.fn();
const mockReportOperationalWarning = jest.fn();
const mockCreateManualPaymentClaim = jest.fn();
const mockSubmitManualPaymentClaim = jest.fn();
const mockCreatePackagePaymentRepository = jest.fn();
let mockParams: { offerId?: string; priceRwf?: string; ridesGranted?: string } = {};
const mockLoadLockedPackageOffer = jest.fn();
const mockUsePackagePaymentConfigQuery = jest.fn();

const lockedOffer: DriverPackageOfferSnapshot = {
  offerId: 'package-offer:vehicle-moto-1:growth:v1:1',
  packageId: 'growth',
  packageVersion: 'v1',
  packageName: 'Locked Growth',
  vehicleId: 'vehicle-moto-1',
  vehicleType: 'moto',
  priceRwf: 1_250,
  ridesGranted: 44,
  bonusRidesGranted: 6,
  campaignId: 'locked-campaign',
  campaignName: 'Locked Campaign',
  campaignType: 'global',
  createdAt: '2026-06-19T10:00:00.000Z',
  expiresAt: '2099-06-19T10:15:00.000Z',
  source: 'local_catalog',
  quoteAuthority: 'local',
};

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));
  class Value {
    value: number;
    constructor(initialValue: number) {
      this.value = initialValue;
    }
    interpolate() {
      return this.value;
    }
    setValue(nextValue: number) {
      this.value = nextValue;
    }
    stopAnimation(callback?: () => void) {
      callback?.();
    }
  }
  const animation = () => ({ start: (callback?: () => void) => callback?.() });
  return {
    ActivityIndicator: host('ActivityIndicator'),
    Animated: {
      Value,
      View: host('AnimatedView'),
      parallel: jest.fn(animation),
      spring: jest.fn(animation),
      timing: jest.fn(animation),
    },
    Easing: {
      cubic: jest.fn(),
      in: jest.fn((value: unknown) => value),
      out: jest.fn((value: unknown) => value),
    },
    Image: host('Image'),
    Platform: { OS: 'android', select: (options: Record<string, unknown>) => options.android ?? options.default },
    PlatformColor: (name: string) => name,
    ScrollView: host('ScrollView'),
    StyleSheet: { create: (styles: object) => styles, flatten: (style: object) => style, hairlineWidth: 1 },
    Text: host('Text'),
    TextInput: host('TextInput'),
    TouchableOpacity: host('TouchableOpacity'),
    useColorScheme: () => 'light',
    View: host('View'),
  };
});

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light' },
  impactAsync: jest.fn(),
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: (...args: unknown[]) => mockCopyToClipboard(...args),
}));

jest.mock('expo-blur', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { BlurView: (props: object) => <View {...props} /> };
});

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { LinearGradient: (props: object) => <View {...props} /> };
});

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { Feather: ({ name }: { name: string }) => <Text>{name}</Text> };
});

jest.mock('@/context/ToastContext', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

jest.mock('@/context/AuthContext', () => {
  const auth = {
    user: { id: 'driver-user-1' },
    driverProfile: {
      activeVehicle: { vehicleId: 'vehicle-moto-1' },
      vehicles: [{
        id: 'vehicle-moto-1',
        vehicleType: 'moto',
        status: 'approved',
        plateNumber: 'RAD 001 A',
      }],
      momoCode: '+250788000000',
      momoProvider: 'mtn',
    },
  };
  return {
    useAuth: () => auth,
    useOptionalAuth: () => auth,
  };
});

jest.mock('@/context/DriverEntitlementContext', () => ({
  useDriverEntitlement: () => ({
    activatePackage: mockActivatePackage,
    createPackagePurchase: mockCreatePackagePurchase,
    entitlement: {
      vehicleId: null,
      vehicleType: null,
    },
    updatePackagePurchaseStatus: mockUpdatePackagePurchaseStatus,
  }),
}));

jest.mock('@/observability/monitoring', () => ({
  reportOperationalWarning: (...args: unknown[]) => mockReportOperationalWarning(...args),
}));

jest.mock('@/query/hooks/usePackagePaymentConfigQuery', () => ({
  usePackagePaymentConfigQuery: (...args: unknown[]) => mockUsePackagePaymentConfigQuery(...args),
}));

let mockClaims: any[] = [];

jest.mock('@/query/hooks/useManualPaymentClaimsQuery', () => ({
  useManualPaymentClaimsQuery: () => ({
    claims: mockClaims,
    isLoading: false,
    isFetching: false,
    refetch: jest.fn(),
  }),
}));

jest.mock('@/query/hooks/useManualPaymentClaimQuery', () => ({
  useManualPaymentClaimQuery: () => ({
    claim: null,
    presentation: null,
    isLoading: false,
    isFetching: false,
    refetch: jest.fn(),
  }),
}));

jest.mock('@/query/hooks/useManualPaymentClaimMutations', () => ({
  useCreateManualPaymentClaimMutation: () => ({
    mutateAsync: mockCreateManualPaymentClaim,
  }),
  useSubmitManualPaymentClaimMutation: () => ({
    mutateAsync: mockSubmitManualPaymentClaim,
  }),
  useResubmitManualPaymentClaimMutation: () => ({
    mutateAsync: jest.fn(() => Promise.resolve({ data: {}, failure: null })),
  }),
  useCancelManualPaymentClaimMutation: () => ({
    mutateAsync: jest.fn(() => Promise.resolve({ data: {}, failure: null })),
  }),
}));

jest.mock('@/persistence/lockedPackageOfferPersistence', () => ({
  loadLockedPackageOffer: (...args: unknown[]) => mockLoadLockedPackageOffer(...args),
}));

jest.mock('@/data/repositories/packagePaymentRepositoryFactory', () => ({
  createPackagePaymentRepository: (...args: unknown[]) => mockCreatePackagePaymentRepository(...args),
}));

describe('DriverPackagePaymentScreen offer lock', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClaims = [];
    mockParams = { offerId: lockedOffer.offerId };
    mockLoadLockedPackageOffer.mockResolvedValue({ offer: lockedOffer, failure: null });
    mockUsePackagePaymentConfigQuery.mockReturnValue({
      configuration: {
        mode: 'automatic',
        version: '2026-07-06',
        updatedAt: '2026-07-06T10:00:00.000Z',
      },
      fallbackConfiguration: {
        mode: 'automatic',
        version: 'fallback-automatic',
        updatedAt: '1970-01-01T00:00:00.000Z',
      },
      rawConfiguration: {
        mode: 'automatic',
        version: '2026-07-06',
        updatedAt: '2026-07-06T10:00:00.000Z',
      },
      failure: null,
      error: null,
      isFallbackUsed: false,
      isLoading: false,
      isFetching: false,
      refetch: jest.fn(),
    });
    mockCreatePackagePurchase.mockResolvedValue({
      ...lockedOffer,
      amount: lockedOffer.priceRwf,
      provider: 'mtn',
      phoneNumber: '+250788000000',
      transactionId: 'purchase-1',
      status: 'pending',
    });
    mockCreateManualPaymentClaim.mockResolvedValue({
      data: {
        id: 'RDP-2026-ABC12',
        driverId: 'driver-user-1',
        vehicleId: 'vehicle-moto-1',
        vehicleType: 'moto',
        offerId: lockedOffer.offerId,
        packageId: lockedOffer.packageId,
        packageVersion: lockedOffer.packageVersion,
        packageName: lockedOffer.packageName,
        expectedAmountRwf: lockedOffer.priceRwf,
        provider: 'mtn',
        merchantCodeSnapshot: '0202565',
        payerPhoneNumber: '+250788000000',
        transactionReference: 'MP123',
        status: 'draft',
        createdAt: '2026-07-06T10:00:00.000Z',
        expiresAt: '2026-07-06T10:30:00.000Z',
        idempotencyKey: 'manual-payment-claim:RDP-2026-ABC12',
        auditLog: [],
      },
      failure: null,
    });
    mockSubmitManualPaymentClaim.mockImplementation(async () => {
      const claim = {
        id: 'RDP-2026-ABC12',
        driverId: 'driver-user-1',
        vehicleId: 'vehicle-moto-1',
        vehicleType: 'moto',
        offerId: lockedOffer.offerId,
        packageId: lockedOffer.packageId,
        packageVersion: lockedOffer.packageVersion,
        packageName: lockedOffer.packageName,
        expectedAmountRwf: lockedOffer.priceRwf,
        provider: 'mtn',
        merchantCodeSnapshot: '0202565',
        payerPhoneNumber: '+250788000000',
        transactionReference: 'MP123',
        status: 'submitted',
        createdAt: '2026-07-06T10:00:00.000Z',
        submittedAt: '2026-07-06T10:01:00.000Z',
        expiresAt: '2026-07-06T10:30:00.000Z',
        idempotencyKey: 'manual-payment-claim:RDP-2026-ABC12',
        auditLog: [],
      };
      mockClaims = [claim];
      return {
        data: claim,
        failure: null,
      };
    });
    mockCreatePackagePaymentRepository.mockReturnValue({
      getPaymentConfiguration: jest.fn(),
      createManualPaymentClaim: mockCreateManualPaymentClaim,
      getManualPaymentClaim: jest.fn(),
      listDriverManualPaymentClaims: jest.fn(),
      submitManualPaymentClaim: mockSubmitManualPaymentClaim,
      resubmitManualPaymentClaim: jest.fn(),
      cancelManualPaymentClaim: jest.fn(),
    });
  });

  test('displays and purchases the locked offer without resolving current campaign values', async () => {
    render(<DriverPackagePaymentScreen />);

    expect(await screen.findByText('Locked Growth')).toBeTruthy();
    expect(screen.getByText('Locked Campaign')).toBeTruthy();
    expect(screen.getByText('44')).toBeTruthy();
    expect(screen.getByText('+6')).toBeTruthy();
    expect(screen.getByText('1,250 RWF')).toBeTruthy();

    fireEvent.press(screen.getByText('Send Payment Prompt'));

    expect(mockCreatePackagePurchase).toHaveBeenCalledWith({
      offer: lockedOffer,
      provider: 'mtn',
      phoneNumber: '+250788000000',
    });
  });

  test('expired offer blocks confirmation and returns to packages', async () => {
    mockLoadLockedPackageOffer.mockResolvedValue({ offer: null, failure: 'expired' });

    render(<DriverPackagePaymentScreen />);

    expect(await screen.findByText('This package offer expired. Please refresh packages.')).toBeTruthy();
    expect(screen.queryByText('Send Payment Prompt')).toBeNull();
    fireEvent.press(screen.getByText('Return to Packages'));
    expect(require('expo-router').router.replace).toHaveBeenCalledWith('/driver-packages');
    expect(mockCreatePackagePurchase).not.toHaveBeenCalled();
  });

  test('missing or invalid offer shows a safe state and cannot purchase', async () => {
    mockParams = {};
    mockLoadLockedPackageOffer.mockResolvedValue({ offer: null, failure: 'missing' });

    render(<DriverPackagePaymentScreen />);

    expect(await screen.findByText('Package offer unavailable')).toBeTruthy();
    expect(screen.queryByText('Send Payment Prompt')).toBeNull();
    expect(mockCreatePackagePurchase).not.toHaveBeenCalled();
  });

  test('ignores tampered route values and purchases the stored offer', async () => {
    mockParams = {
      offerId: lockedOffer.offerId,
      priceRwf: '1',
      ridesGranted: '999999',
    };

    render(<DriverPackagePaymentScreen />);
    await screen.findByText('Locked Growth');
    fireEvent.press(screen.getByText('Send Payment Prompt'));

    await waitFor(() => expect(mockCreatePackagePurchase).toHaveBeenCalledWith({
      offer: lockedOffer,
      provider: 'mtn',
      phoneNumber: '+250788000000',
    }));
  });

  test('renders manual instructions and copies generated USSD without creating a purchase', async () => {
    mockUsePackagePaymentConfigQuery.mockReturnValue({
      configuration: {
        mode: 'manual',
        version: '2026-07-06',
        updatedAt: '2026-07-06T10:00:00.000Z',
        manual: {
          providers: [
            { provider: 'mtn', merchantCode: '0202565', ussdTemplate: '*182*8*1*{merchantCode}*{amount}#', enabled: true },
            { provider: 'airtel', merchantCode: '3378888', ussdTemplate: '*182*8*1*{merchantCode}*{amount}#', enabled: true },
          ],
          claimExpiresAfterMinutes: 30,
          transactionReferenceRequired: true,
          proofImageEnabled: true,
        },
      },
      fallbackConfiguration: {
        mode: 'automatic',
        version: 'fallback-automatic',
        updatedAt: '1970-01-01T00:00:00.000Z',
      },
      rawConfiguration: null,
      failure: null,
      error: null,
      isFallbackUsed: false,
      isLoading: false,
      isFetching: false,
      refetch: jest.fn(),
    });

    render(<DriverPackagePaymentScreen />);

    expect(await screen.findByText('Manual payment')).toBeTruthy();
    expect(screen.getByText('Locked Growth')).toBeTruthy();
    expect(screen.getByText('1,250 RWF')).toBeTruthy();
    expect(screen.getByText('*182*8*1*0202565*1250#')).toBeTruthy();
    expect(screen.getByText('*182*8*1*3378888*1250#')).toBeTruthy();

    fireEvent.press(screen.getAllByText('Copy')[0]);

    await waitFor(() => expect(mockCopyToClipboard).toHaveBeenCalledWith('*182*8*1*0202565*1250#'));
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('USSD copied', 'success'));
    expect(mockCreatePackagePurchase).not.toHaveBeenCalled();
    expect(mockActivatePackage).not.toHaveBeenCalled();
  });

  test('renders manual form, submits a claim, and shows pending review without activating the package', async () => {
    mockUsePackagePaymentConfigQuery.mockReturnValue({
      configuration: {
        mode: 'manual',
        version: '2026-07-06',
        updatedAt: '2026-07-06T10:00:00.000Z',
        manual: {
          providers: [
            { provider: 'mtn', merchantCode: '0202565', ussdTemplate: '*182*8*1*{merchantCode}*{amount}#', enabled: true },
            { provider: 'airtel', merchantCode: '3378888', ussdTemplate: '*182*8*1*{merchantCode}*{amount}#', enabled: true },
          ],
          claimExpiresAfterMinutes: 30,
          transactionReferenceRequired: true,
          proofImageEnabled: true,
        },
      },
      fallbackConfiguration: {
        mode: 'automatic',
        version: 'fallback-automatic',
        updatedAt: '1970-01-01T00:00:00.000Z',
      },
      rawConfiguration: null,
      failure: null,
      error: null,
      isFallbackUsed: false,
      isLoading: false,
      isFetching: false,
      refetch: jest.fn(),
    });

    render(<DriverPackagePaymentScreen />);

    expect(await screen.findByText('Locked Growth')).toBeTruthy();
    expect(screen.getByText('1,250 RWF')).toBeTruthy();
    expect(screen.queryByLabelText('Amount')).toBeNull();

    fireEvent.press(screen.getByLabelText('I have paid'));
    fireEvent.changeText(screen.getByLabelText('Payer phone number'), '+250788000000');
    fireEvent.changeText(screen.getByLabelText('Transaction reference'), 'MP123');
    fireEvent.press(screen.getByLabelText('Submit payment'));

    await waitFor(() => expect(mockCreateManualPaymentClaim).toHaveBeenCalled());
    await waitFor(() => expect(mockSubmitManualPaymentClaim).toHaveBeenCalled());

    expect(await screen.findByText('PAYMENT CONFIRMATION SUBMITTED')).toBeTruthy();
    expect(screen.getByText('Your payment claim is waiting for review.')).toBeTruthy();
    expect(mockActivatePackage).not.toHaveBeenCalled();
    expect(mockUpdatePackagePurchaseStatus).not.toHaveBeenCalled();
    expect(mockCreatePackagePurchase).not.toHaveBeenCalled();

    const telemetry = JSON.stringify((mockReportOperationalWarning as jest.Mock).mock.calls.map(call => call[1]));
    expect(telemetry).not.toContain('+250788000000');
    expect(telemetry).not.toContain('MP123');
    expect(telemetry).toContain('submitted');
  });

  test('rejects invalid phone numbers before submission', async () => {
    mockUsePackagePaymentConfigQuery.mockReturnValue({
      configuration: {
        mode: 'manual',
        version: '2026-07-06',
        updatedAt: '2026-07-06T10:00:00.000Z',
        manual: {
          providers: [
            { provider: 'mtn', merchantCode: '0202565', ussdTemplate: '*182*8*1*{merchantCode}*{amount}#', enabled: true },
          ],
          claimExpiresAfterMinutes: 30,
          transactionReferenceRequired: true,
          proofImageEnabled: true,
        },
      },
      fallbackConfiguration: {
        mode: 'automatic',
        version: 'fallback-automatic',
        updatedAt: '1970-01-01T00:00:00.000Z',
      },
      rawConfiguration: null,
      failure: null,
      error: null,
      isFallbackUsed: false,
      isLoading: false,
      isFetching: false,
      refetch: jest.fn(),
    });

    render(<DriverPackagePaymentScreen />);

    expect(await screen.findByText('Locked Growth')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('I have paid'));
    fireEvent.changeText(screen.getByLabelText('Payer phone number'), '123');
    fireEvent.changeText(screen.getByLabelText('Transaction reference'), 'MP123');
    fireEvent.press(screen.getByLabelText('Submit payment'));

    expect(await screen.findByText('Manual payment claim is invalid.')).toBeTruthy();
    expect(mockCreateManualPaymentClaim).not.toHaveBeenCalled();
    expect(mockSubmitManualPaymentClaim).not.toHaveBeenCalled();
    expect(mockActivatePackage).not.toHaveBeenCalled();
  });

  test('requires a transaction reference when the configuration says so', async () => {
    mockUsePackagePaymentConfigQuery.mockReturnValue({
      configuration: {
        mode: 'manual',
        version: '2026-07-06',
        updatedAt: '2026-07-06T10:00:00.000Z',
        manual: {
          providers: [
            { provider: 'mtn', merchantCode: '0202565', ussdTemplate: '*182*8*1*{merchantCode}*{amount}#', enabled: true },
          ],
          claimExpiresAfterMinutes: 30,
          transactionReferenceRequired: true,
          proofImageEnabled: true,
        },
      },
      fallbackConfiguration: {
        mode: 'automatic',
        version: 'fallback-automatic',
        updatedAt: '1970-01-01T00:00:00.000Z',
      },
      rawConfiguration: null,
      failure: null,
      error: null,
      isFallbackUsed: false,
      isLoading: false,
      isFetching: false,
      refetch: jest.fn(),
    });

    render(<DriverPackagePaymentScreen />);

    expect(await screen.findByText('Locked Growth')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('I have paid'));
    fireEvent.changeText(screen.getByLabelText('Payer phone number'), '+250788000000');
    fireEvent.press(screen.getByLabelText('Submit payment'));

    expect(await screen.findByText('A transaction reference is required.')).toBeTruthy();
    expect(mockCreateManualPaymentClaim).not.toHaveBeenCalled();
    expect(mockSubmitManualPaymentClaim).not.toHaveBeenCalled();
  });

  test('rejects duplicate references from the repository without exposing the raw value', async () => {
    mockCreateManualPaymentClaim.mockResolvedValueOnce({
      data: null,
      failure: {
        code: 'duplicate_transaction_reference',
        message: 'A manual payment claim with this provider transaction reference already exists.',
        details: { provider: 'mtn', duplicateDetected: true },
      },
    });

    mockUsePackagePaymentConfigQuery.mockReturnValue({
      configuration: {
        mode: 'manual',
        version: '2026-07-06',
        updatedAt: '2026-07-06T10:00:00.000Z',
        manual: {
          providers: [
            { provider: 'mtn', merchantCode: '0202565', ussdTemplate: '*182*8*1*{merchantCode}*{amount}#', enabled: true },
          ],
          claimExpiresAfterMinutes: 30,
          transactionReferenceRequired: true,
          proofImageEnabled: true,
        },
      },
      fallbackConfiguration: {
        mode: 'automatic',
        version: 'fallback-automatic',
        updatedAt: '1970-01-01T00:00:00.000Z',
      },
      rawConfiguration: null,
      failure: null,
      error: null,
      isFallbackUsed: false,
      isLoading: false,
      isFetching: false,
      refetch: jest.fn(),
    });

    render(<DriverPackagePaymentScreen />);

    expect(await screen.findByText('Locked Growth')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('I have paid'));
    fireEvent.changeText(screen.getByLabelText('Payer phone number'), '+250788000000');
    fireEvent.changeText(screen.getByLabelText('Transaction reference'), 'DUP-REF-123');
    fireEvent.press(screen.getByLabelText('Submit payment'));

    expect(await screen.findByText('A manual payment claim with this provider transaction reference already exists.')).toBeTruthy();
    expect(JSON.stringify((mockReportOperationalWarning as jest.Mock).mock.calls.map(call => call[1]))).not.toContain('DUP-REF-123');
    expect(mockSubmitManualPaymentClaim).not.toHaveBeenCalled();
  });

  test('renders unavailable shell in disabled mode without creating a purchase', async () => {
    mockUsePackagePaymentConfigQuery.mockReturnValue({
      configuration: {
        mode: 'disabled',
        version: '2026-07-06',
        updatedAt: '2026-07-06T10:00:00.000Z',
      },
      fallbackConfiguration: {
        mode: 'automatic',
        version: 'fallback-automatic',
        updatedAt: '1970-01-01T00:00:00.000Z',
      },
      rawConfiguration: null,
      failure: null,
      error: null,
      isFallbackUsed: false,
      isLoading: false,
      isFetching: false,
      refetch: jest.fn(),
    });

    render(<DriverPackagePaymentScreen />);

    expect(await screen.findByText('Payment unavailable')).toBeTruthy();
    expect(screen.getByText('Package payments are temporarily unavailable. Please try again later.')).toBeTruthy();
    expect(screen.getByText('Locked Growth')).toBeTruthy();
    expect(screen.getByText('1,250 RWF')).toBeTruthy();
    fireEvent.press(screen.getByText('Return to Packages'));

    expect(mockCreatePackagePurchase).not.toHaveBeenCalled();
    expect(mockActivatePackage).not.toHaveBeenCalled();
    expect(mockUpdatePackagePurchaseStatus).not.toHaveBeenCalled();
    expect(require('expo-router').router.replace).toHaveBeenCalledWith('/driver-packages');
  });
});
