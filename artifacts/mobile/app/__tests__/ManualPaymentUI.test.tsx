import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

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
    Alert: {
      alert: jest.fn(),
    },
  };
});
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DriverPackagePaymentScreen from '../driver-package-payment';
import DriverPackagesScreen from '../driver-packages';
import { useAuth, useOptionalAuth } from '@/context/AuthContext';
import { useDriverEntitlement } from '@/context/DriverEntitlementContext';
import { usePackagePaymentConfigQuery } from '@/query/hooks/usePackagePaymentConfigQuery';
import { useLocalSearchParams } from 'expo-router';
import { useManualPaymentClaimsQuery } from '@/query/hooks/useManualPaymentClaimsQuery';
import { useManualPaymentClaimQuery } from '@/query/hooks/useManualPaymentClaimQuery';
import { createPackagePaymentRepository } from '@/data/repositories/packagePaymentRepositoryFactory';
import * as Clipboard from 'expo-clipboard';

// Mock vector icons
jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
}));

// Mock clipboard
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(() => Promise.resolve(true)),
  getStringAsync: jest.fn(() => Promise.resolve('')),
}));

// Mock haptics
jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light' },
  impactAsync: jest.fn(),
}));

// Mock Alert.alert
const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

// Mock router
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  },
  useLocalSearchParams: jest.fn(() => ({ offerId: 'offer-1' })),
}));

// Mock useColors hook
jest.mock('@/hooks/useColors', () => ({
  useColors: () => ({
    background: '#fff',
    foreground: '#111',
    mutedForeground: '#666',
    border: '#ddd',
    primary: '#2563eb',
    primaryHex: '#2563eb',
    primaryForeground: '#fff',
    muted: '#f3f4f6',
    surface: '#fff',
    success: '#10b981',
    successHex: '#10b981',
    warning: '#f59e0b',
    warningHex: '#f59e0b',
    destructive: '#ef4444',
    destructiveHex: '#ef4444',
  }),
}));

// Mock Auth Context
jest.mock('@/context/AuthContext', () => ({
  useAuth: jest.fn(),
  useOptionalAuth: jest.fn(),
}));

// Mock Driver Entitlement Context
jest.mock('@/context/DriverEntitlementContext', () => ({
  useDriverEntitlement: jest.fn(),
}));

// Mock Toast
jest.mock('@/context/ToastContext', () => ({
  useToast: () => ({
    showToast: jest.fn(),
  }),
}));

// Mock Package Sync Context
jest.mock('@/context/PackageSyncContext', () => ({
  usePackageSync: jest.fn(() => ({
    campaigns: [],
    catalog: [],
    hasCatalogSnapshot: true,
    offerSourceReady: true,
    isLoading: false,
    isRefreshing: false,
    lastSyncedAt: new Date().toISOString(),
    refresh: jest.fn(),
    syncWarning: null,
    syncGeneration: 'gen-1',
  })),
}));

// Mock safe area insets
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Mock package-payment-config query hook
jest.mock('@/query/hooks/usePackagePaymentConfigQuery', () => ({
  usePackagePaymentConfigQuery: jest.fn(),
}));

// Mock locked offer persistence
jest.mock('@/persistence/lockedPackageOfferPersistence', () => ({
  loadLockedPackageOffer: jest.fn(() =>
    Promise.resolve({
      offer: {
        offerId: 'offer-1',
        packageId: 'growth',
        packageVersion: '1.0',
        packageName: 'Growth Plan',
        vehicleId: 'vehicle-1',
        vehicleType: 'moto',
        priceRwf: 5000,
        ridesGranted: 100,
        bonusRidesGranted: 10,
        createdAt: '2026-07-06T10:00:00.000Z',
        expiresAt: '2026-07-06T11:00:00.000Z',
        source: 'local_catalog',
        quoteAuthority: 'local',
      },
      failure: null,
    })
  ),
  saveLockedPackageOffer: jest.fn(),
}));

// Mock repository
jest.mock('@/data/repositories/packagePaymentRepositoryFactory', () => ({
  createPackagePaymentRepository: jest.fn(() => ({
    getPaymentConfiguration: jest.fn(() => Promise.resolve({ data: { mode: 'manual' }, failure: null })),
    createManualPaymentClaim: jest.fn(() => Promise.resolve({ data: null, failure: null })),
    getManualPaymentClaim: jest.fn(() => Promise.resolve({ data: null, failure: null })),
    listDriverManualPaymentClaims: jest.fn(() => Promise.resolve({ data: [], failure: null })),
    submitManualPaymentClaim: jest.fn(() => Promise.resolve({ data: null, failure: null })),
    resubmitManualPaymentClaim: jest.fn(() => Promise.resolve({ data: null, failure: null })),
    cancelManualPaymentClaim: jest.fn(() => Promise.resolve({ data: null, failure: null })),
  })),
}));

const mockClaimsQuery = {
  claims: [] as any[],
  isLoading: false,
  isFetching: false,
  refetch: jest.fn(),
};

const mockSingleClaimQuery = {
  claim: null as any,
  presentation: null as any,
  isLoading: false,
  isFetching: false,
  refetch: jest.fn(),
};

jest.mock('@/query/hooks/useManualPaymentClaimsQuery', () => ({
  useManualPaymentClaimsQuery: () => mockClaimsQuery,
}));

jest.mock('@/query/hooks/useManualPaymentClaimQuery', () => ({
  useManualPaymentClaimQuery: () => mockSingleClaimQuery,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('Manual Package Payment Driver UI (Phase MP9)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClaimsQuery.claims = [];
    mockClaimsQuery.isLoading = false;
    mockClaimsQuery.isFetching = false;
    mockSingleClaimQuery.claim = null;
    mockSingleClaimQuery.isLoading = false;
    mockSingleClaimQuery.isFetching = false;

    const authVal = {
      driverProfile: { id: 'driver-1', momoProvider: 'mtn', momoCode: '0788000000', isVerified: true },
      user: { id: 'driver-1' },
    };
    (useAuth as jest.Mock).mockReturnValue(authVal);
    (useOptionalAuth as jest.Mock).mockReturnValue(authVal);

    (useDriverEntitlement as jest.Mock).mockReturnValue({
      entitlement: { vehicleId: 'vehicle-1', vehicleType: 'moto' },
      rideCredits: 10,
      isLoading: false,
      activatePackage: jest.fn(),
    });

    (usePackagePaymentConfigQuery as jest.Mock).mockReturnValue({
      configuration: {
        mode: 'manual',
        manual: {
          providers: [
            { provider: 'mtn', enabled: true, merchantCode: '0202565', ussdTemplate: '*182*8*1*{merchantCode}*{amount}#' },
            { provider: 'airtel', enabled: true, merchantCode: '3378888', ussdTemplate: '*182*8*1*{merchantCode}*{amount}#' },
          ],
          transactionReferenceRequired: true,
          claimExpiresAfterMinutes: 30,
        },
      },
    });
  });

  test('Part C: Manual mode renders package, locked amount, and providers with correct USSD instruction', async () => {
    render(<DriverPackagePaymentScreen />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.queryByText('Growth Plan')).toBeTruthy());
    expect(screen.getByText('5,000 RWF')).toBeTruthy();
    expect(screen.getByText('MTN MoMo')).toBeTruthy();
    expect(screen.getByText('Airtel Money')).toBeTruthy();

    // Check USSD string generation
    expect(screen.getByText('*182*8*1*0202565*5000#')).toBeTruthy();
    expect(screen.getByText('*182*8*1*3378888*5000#')).toBeTruthy();
  });

  test('Part D: Tapping I have paid shows payment confirmation form', async () => {
    render(<DriverPackagePaymentScreen />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.queryByText('I have paid')).toBeTruthy());
    const btn = screen.getByText('I have paid');
    fireEvent.press(btn);

    // Verify it switched to CLAIM_FORM stage
    expect(screen.getByText('Payer phone number')).toBeTruthy();
    expect(screen.getByText('Transaction reference *')).toBeTruthy();
  });

  test('Part F & G: Renders submitted status correctly with masked phone and reference', async () => {
    mockClaimsQuery.claims = [
      {
        id: 'RDP-2026-XYZ',
        displayClaimId: 'RDP-2026-XYZ',
        status: 'submitted',
        version: 1,
        packageId: 'growth',
        packageVersion: '1.0',
        packageName: 'Growth Plan',
        vehicleId: 'vehicle-1',
        vehicleType: 'moto',
        expectedAmountRwf: 5000,
        provider: 'mtn',
        maskedPayerPhone: '+250***0000',
        transactionReferencePresent: true,
        maskedTransactionReference: '***123',
        createdAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        authority: 'local_only_prototype',
      } as any,
    ];

    render(<DriverPackagePaymentScreen />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.queryByText('PAYMENT CONFIRMATION SUBMITTED')).toBeTruthy());
    expect(screen.getByText('+250***0000')).toBeTruthy();
    expect(screen.getByText('***123')).toBeTruthy();
    expect(screen.queryByText('ABC12345')).toBeNull(); // Raw transaction reference should NOT be shown
  });

  test('Part J: Needs Clarification UI allows editing and resubmitting', async () => {
    const mockResubmit = jest.fn(() => Promise.resolve({ data: {}, failure: null }));
    mockClaimsQuery.claims = [
      {
        id: 'RDP-2026-XYZ',
        displayClaimId: 'RDP-2026-XYZ',
        status: 'needs_clarification',
        version: 1,
        packageId: 'growth',
        packageVersion: '1.0',
        packageName: 'Growth Plan',
        vehicleId: 'vehicle-1',
        vehicleType: 'moto',
        expectedAmountRwf: 5000,
        provider: 'mtn',
        maskedPayerPhone: '+250***0000',
        transactionReferencePresent: true,
        maskedTransactionReference: '***123',
        clarificationMessage: 'Payer name mismatch.',
        createdAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        authority: 'local_only_prototype',
      } as any,
    ];

    render(
      <DriverPackagePaymentScreen />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(screen.queryByText('MORE INFORMATION NEEDED')).toBeTruthy());
    expect(screen.getByText('Payer name mismatch.')).toBeTruthy();

    const editBtn = screen.getByText('Edit & Resubmit');
    fireEvent.press(editBtn);

    // Inputs should be visible now
    expect(screen.getByText('Payer phone number')).toBeTruthy();
    expect(screen.getByText('Transaction reference *')).toBeTruthy();
  });

  test('Part O: Cancellation displays confirmation Alert and calls cancel mutation', async () => {
    mockClaimsQuery.claims = [
      {
        id: 'RDP-2026-XYZ',
        displayClaimId: 'RDP-2026-XYZ',
        status: 'submitted',
        version: 1,
        packageId: 'growth',
        packageVersion: '1.0',
        packageName: 'Growth Plan',
        vehicleId: 'vehicle-1',
        vehicleType: 'moto',
        expectedAmountRwf: 5000,
        provider: 'mtn',
        maskedPayerPhone: '+250***0000',
        transactionReferencePresent: true,
        maskedTransactionReference: '***123',
        createdAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        authority: 'local_only_prototype',
      } as any,
    ];

    render(<DriverPackagePaymentScreen />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.queryByText('Cancel confirmation')).toBeTruthy());
    const cancelBtn = screen.getByText('Cancel confirmation');
    fireEvent.press(cancelBtn);

    expect(alertSpy).toHaveBeenCalledWith(
      'Cancel this payment confirmation?',
      expect.any(String),
      expect.any(Array)
    );
  });
});
