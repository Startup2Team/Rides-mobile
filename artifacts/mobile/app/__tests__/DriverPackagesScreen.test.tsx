import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import type { DriverEntitlement, DriverPackagePurchase } from '@/domain/driverRidePackages';
import { EMPTY_DRIVER_ENTITLEMENT } from '@/domain/driverRidePackages';
import * as campaignModule from '@/domain/driverRideCampaigns';
import {
  DRIVER_RIDE_PACKAGE_CATALOG,
  type DriverRidePackageCatalogEntry,
} from '@/domain/driverRidePackageCatalog';
import DriverPackagesScreen from '../driver-packages';

const mockRouterReplace = jest.fn();
const mockRouterBack = jest.fn();
const mockActivatePackage = jest.fn();
const mockCreatePackagePurchase = jest.fn();
const mockUpdatePackagePurchaseStatus = jest.fn();
let mockEntitlement: DriverEntitlement = EMPTY_DRIVER_ENTITLEMENT;
let mockCatalog: DriverRidePackageCatalogEntry[] = DRIVER_RIDE_PACKAGE_CATALOG;
let mockCampaigns: campaignModule.DriverRidePackageCampaign[] = [];
let mockHasCatalogSnapshot = true;
let mockIsCatalogLoading = false;
let mockSyncWarning: string | null = null;
const mockRefreshPackages = jest.fn();
const mockSaveLockedPackageOffer = jest.fn();
let mockSyncGeneration = 'generation-1';
let mockGetActiveDriverRideCampaigns: jest.SpiedFunction<typeof campaignModule.getActiveDriverRideCampaigns>;

const successfulPurchase: DriverPackagePurchase = {
  amount: 2_000,
  createdAt: '2026-06-08T10:00:00.000Z',
  packageId: 'growth',
  vehicleId: 'driver-vehicle:moto:rad-001-a',
  vehicleType: 'moto',
  phoneNumber: '+250788000000',
  provider: 'mtn',
  status: 'pending',
  transactionId: 'momo-package:growth:2026-06-08T10:00:00.000Z',
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
  const animation = () => ({ start: (callback?: ({ finished }: { finished: boolean }) => void) => callback?.({ finished: true }) });
  return {
    ActivityIndicator: host('ActivityIndicator'),
    Animated: {
      Value,
      View: host('AnimatedView'),
      timing: jest.fn(animation),
    },
    Easing: {
      cubic: jest.fn(),
      in: jest.fn((value: unknown) => value),
      out: jest.fn((value: unknown) => value),
    },
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
    back: mockRouterBack,
    push: jest.fn(),
    replace: mockRouterReplace,
  },
}));

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light' },
  impactAsync: jest.fn(),
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

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const Icon = ({ name }: { name: string }) => <Text>{name}</Text>;
  return { Feather: Icon };
});

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'driver-user-1' },
    driverProfile: {
      isVerified: true,
      momoCode: '+250788000000',
      momoProvider: 'mtn',
      verificationStatus: 'approved',
    },
  }),
}));

jest.mock('@/context/DriverEntitlementContext', () => ({
  useDriverEntitlement: () => ({
    activatePackage: mockActivatePackage,
    createPackagePurchase: mockCreatePackagePurchase,
    entitlement: mockEntitlement,
    isLoading: false,
    launchOfferUsed: mockEntitlement.activations.some(activation => activation.packageId === 'launch_starter'),
    bonusRides: mockEntitlement.remainingBonusRides,
    rideCredits: mockEntitlement.remainingRideCredits,
    totalAvailableRides: mockEntitlement.remainingRideCredits + mockEntitlement.remainingBonusRides,
    updatePackagePurchaseStatus: mockUpdatePackagePurchaseStatus,
  }),
}));

jest.mock('@/context/PackageSyncContext', () => ({
  usePackageSync: () => ({
    campaigns: mockCampaigns,
    catalog: mockCatalog,
    hasCatalogSnapshot: mockHasCatalogSnapshot,
    catalogLoaded: mockHasCatalogSnapshot,
    campaignsLoaded: mockHasCatalogSnapshot,
    offerSourceReady: mockHasCatalogSnapshot,
    syncGeneration: mockSyncGeneration,
    isLoading: mockIsCatalogLoading,
    isRefreshing: false,
    lastSyncedAt: '2026-06-19T10:00:00.000Z',
    refresh: mockRefreshPackages,
    syncWarning: mockSyncWarning,
  }),
}));

jest.mock('@/persistence/lockedPackageOfferPersistence', () => ({
  saveLockedPackageOffer: (...args: unknown[]) => mockSaveLockedPackageOffer(...args),
}));

describe('DriverPackagesScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockGetActiveDriverRideCampaigns = jest.spyOn(campaignModule, 'getActiveDriverRideCampaigns').mockReturnValue([]);
    jest.spyOn(console, 'error').mockImplementation((...args) => {
      if (String(args[0]).includes('react-test-renderer is deprecated')) return;
      console.warn(...args);
    });
    mockEntitlement = EMPTY_DRIVER_ENTITLEMENT;
    mockCatalog = DRIVER_RIDE_PACKAGE_CATALOG;
    mockCampaigns = [];
    mockHasCatalogSnapshot = true;
    mockIsCatalogLoading = false;
    mockSyncWarning = null;
    mockSyncGeneration = 'generation-1';
    mockSaveLockedPackageOffer.mockImplementation(async offer => offer);
    mockGetActiveDriverRideCampaigns.mockReturnValue([]);
    mockActivatePackage.mockResolvedValue({
      id: 'activation:launch_starter:2026-06-08T10:00:00.000Z',
      packageId: 'launch_starter',
      vehicleId: 'driver-vehicle:moto:rad-001-a',
      vehicleType: 'moto',
      activatedAt: '2026-06-08T10:00:00.000Z',
      pricePaidRwf: 0,
      creditsGranted: 35,
      authority: 'local_prototype',
    });
    mockCreatePackagePurchase.mockResolvedValue(successfulPurchase);
    mockUpdatePackagePurchaseStatus.mockImplementation(async (_transactionId: string, status: string) => ({
      purchase: { ...successfulPurchase, status },
      activation: status === 'successful' ? {
        id: 'activation:momo-package:growth:2026-06-08T10:00:00.000Z',
        packageId: 'growth',
        vehicleId: 'driver-vehicle:moto:rad-001-a',
        vehicleType: 'moto',
        activatedAt: '2026-06-08T10:01:00.000Z',
        pricePaidRwf: 2_000,
        creditsGranted: 75,
        authority: 'local_prototype',
      } : undefined,
    }));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('opens the payment page only after buying the selected package', async () => {
    render(<DriverPackagesScreen />);

    fireEvent.press(screen.getByText('Growth Package'));
    await waitFor(() => expect(mockSaveLockedPackageOffer).toHaveBeenCalled());
    fireEvent.press(screen.getByText('Buy Selected Package'));

    expect(require('expo-router').router.push).toHaveBeenCalledWith({
      pathname: '/driver-package-payment',
      params: {
        offerId: expect.stringContaining('package-offer:'),
      },
    });
    expect(mockSaveLockedPackageOffer.mock.calls[0][0]).toMatchObject({
      offerId: expect.stringContaining('package-offer:'),
      packageId: 'growth',
      packageVersion: 'v1',
      packageName: 'Growth Package',
      priceRwf: 2_000,
      ridesGranted: 60,
      bonusRidesGranted: 15,
      source: 'local_catalog',
      ownerUserId: 'driver-user-1',
      quoteAuthority: 'local',
    });
  });

  test('deselects a package when it is pressed again', async () => {
    render(<DriverPackagesScreen />);

    fireEvent.press(screen.getByText('Growth Package'));
    await waitFor(() => expect(mockSaveLockedPackageOffer).toHaveBeenCalled());
    fireEvent.press(screen.getByText('Growth Package'));
    fireEvent.press(screen.getByText('Buy Selected Package'));

    expect(require('expo-router').router.push).not.toHaveBeenCalled();
  });

  test('clears the selected offer when the catalog/campaign generation changes', async () => {
    const view = render(<DriverPackagesScreen />);
    fireEvent.press(screen.getByText('Growth Package'));
    await waitFor(() => expect(mockSaveLockedPackageOffer).toHaveBeenCalled());

    mockSyncGeneration = 'generation-2';
    view.rerender(<DriverPackagesScreen />);

    expect(await screen.findByText('Package offers were refreshed. Please select again.')).toBeTruthy();
    fireEvent.press(screen.getByText('Buy Selected Package'));
    expect(require('expo-router').router.push).not.toHaveBeenCalled();
  });

  test('keeps purchase history off the package page', () => {
    mockEntitlement = {
      ...EMPTY_DRIVER_ENTITLEMENT,
      activePackageId: 'growth',
      remainingRideCredits: 110,
      purchaseHistory: [
        {
          amount: 2_000,
          createdAt: '2026-06-08T10:00:00.000Z',
          completedAt: '2026-06-08T10:01:00.000Z',
          packageId: 'growth',
          vehicleId: 'driver-vehicle:moto:rad-001-a',
          vehicleType: 'moto',
          phoneNumber: '+250788000000',
          provider: 'mtn',
          status: 'successful',
          transactionId: 'momo-package:growth:2026-06-08T10:00:00.000Z',
        },
        {
          amount: 2_000,
          createdAt: '2026-06-07T10:00:00.000Z',
          packageId: 'growth',
          vehicleId: 'driver-vehicle:moto:rad-001-a',
          vehicleType: 'moto',
          phoneNumber: '+250788000000',
          provider: 'airtel',
          status: 'failed',
          transactionId: 'momo-package:growth:2026-06-07T10:00:00.000Z',
        },
      ],
      updatedAt: '2026-06-08T10:00:00.000Z',
    };

    render(<DriverPackagesScreen />);

    expect(screen.queryByText('Purchase history')).toBeNull();
    expect(screen.queryByText('Successful')).toBeNull();
    expect(screen.queryByText('Failed')).toBeNull();
  });

  test('shows the simplified package copy', () => {
    render(<DriverPackagesScreen />);

    expect(screen.getAllByText('FREE NOW').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('30 Rides + 5 Bonus Rides')).toBeTruthy();
    expect(screen.getAllByText('Launch Offer').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('60 Rides + 15 Bonus Rides')).toBeTruthy();
    expect(screen.getAllByText('Ride Package').length).toBeGreaterThan(0);
    expect(screen.getByText('Pro Package')).toBeTruthy();
    expect(screen.getByLabelText('120 Rides + 30 Bonus Rides')).toBeTruthy();
    expect(screen.getByText('3,500 RWF')).toBeTruthy();
    const renderedText = screen.UNSAFE_getAllByType(Text)
      .map(node => String(node.props.children))
      .join(' ')
      .toLowerCase();
    expect(renderedText).not.toContain('credits');
  });

  test('user-facing package copy avoids misleading payment platform terms', () => {
    render(<DriverPackagesScreen />);

    fireEvent.press(screen.getByText('Growth Package'));

    const renderedText = screen.UNSAFE_getAllByType(Text)
      .map(node => String(node.props.children))
      .join(' ')
      .toLowerCase();

    expect(renderedText).not.toContain('wallet');
    expect(renderedText).not.toContain('withdrawal');
    expect(renderedText).not.toContain('payout');
    expect(renderedText).not.toContain('prototype');
    expect(renderedText).not.toContain('backend');
    expect(renderedText).not.toContain('simulated');
  });

  test('shows campaign values when a promotion is active', () => {
    mockGetActiveDriverRideCampaigns.mockReturnValue([{
      campaignId: 'world-cup',
      campaignName: 'World Cup',
      campaignType: 'global',
      status: 'active',
      startDate: '2026-06-01T00:00:00.000Z',
      endDate: '2026-07-01T00:00:00.000Z',
      createdAt: '2026-06-01T00:00:00.000Z',
      description: 'Temporary promotion',
      packageIds: ['growth'],
      priceRwf: 1_500,
      ridesGranted: 40,
      bonusRidesGranted: 5,
    }]);

    render(<DriverPackagesScreen />);

    expect(screen.getByText('World Cup')).toBeTruthy();
    expect(screen.getByLabelText('40 Rides + 5 Bonus Rides')).toBeTruthy();
    expect(screen.getByText('1,500 RWF')).toBeTruthy();
    expect(screen.getByText('Promotional Offer')).toBeTruthy();
  });

  test('renders variable package counts and unknown package IDs from the supplied catalog', () => {
    const catalog: DriverRidePackageCatalogEntry[] = [
      {
        packageId: 'moto_weekend_special',
        packageVersion: '2026-weekend-1',
        packageName: 'Moto Weekend Special',
        vehicleType: 'moto',
        priceRwf: 900,
        ridesGranted: 25,
        bonusRidesGranted: 5,
        status: 'active',
        createdAt: '2026-06-19T00:00:00.000Z',
        effectiveFrom: '2026-06-19T00:00:00.000Z',
        effectiveUntil: null,
      },
      {
        packageId: 'moto_premium',
        packageVersion: 'v4',
        packageName: 'Moto Premium',
        vehicleType: 'moto',
        priceRwf: 7_500,
        ridesGranted: 250,
        bonusRidesGranted: 75,
        status: 'active',
        createdAt: '2026-06-19T00:00:00.000Z',
        effectiveFrom: '2026-06-19T00:00:00.000Z',
        effectiveUntil: null,
      },
    ];

    mockCatalog = catalog;
    render(<DriverPackagesScreen />);

    expect(screen.getByText('Moto Weekend Special')).toBeTruthy();
    expect(screen.getByText('Moto Premium')).toBeTruthy();
    expect(screen.getByLabelText('25 Rides + 5 Bonus Rides')).toBeTruthy();
    expect(screen.getByLabelText('250 Rides + 75 Bonus Rides')).toBeTruthy();
    expect(screen.queryByText('Growth Package')).toBeNull();
  });

  test('shows loading, unavailable, and empty catalog states', () => {
    mockCatalog = [];
    mockHasCatalogSnapshot = false;
    mockIsCatalogLoading = true;
    const loadingView = render(<DriverPackagesScreen />);
    expect(screen.getByText('Loading packages...')).toBeTruthy();
    loadingView.unmount();

    mockIsCatalogLoading = false;
    mockSyncWarning = 'Using cached package data';
    const unavailableView = render(<DriverPackagesScreen />);
    expect(screen.getByText('Packages unavailable.')).toBeTruthy();
    expect(screen.getByText('Please connect to the internet and try again.')).toBeTruthy();
    unavailableView.unmount();

    mockHasCatalogSnapshot = true;
    mockSyncWarning = null;
    render(<DriverPackagesScreen />);
    expect(screen.getByText('No packages available')).toBeTruthy();
  });

  test('manually refreshes package data and shows cached warning', () => {
    mockSyncWarning = 'Using cached package data';
    render(<DriverPackagesScreen />);

    expect(screen.getByText('Using cached package data')).toBeTruthy();
    fireEvent.press(screen.getByText('Refresh'));
    expect(mockRefreshPackages).toHaveBeenCalled();
  });
});
