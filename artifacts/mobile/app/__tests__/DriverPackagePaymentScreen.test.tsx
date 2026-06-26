import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import type { DriverPackageOfferSnapshot } from '@/domain/driverRidePackages';
import DriverPackagePaymentScreen from '../driver-package-payment';

const mockCreatePackagePurchase = jest.fn();
let mockParams: { offerId?: string; priceRwf?: string; ridesGranted?: string } = {};
const mockLoadLockedPackageOffer = jest.fn();

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

jest.mock('@/components/GlassScrollView', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    GlassScrollView: React.forwardRef(({ children, onRefresh, refreshing, ...props }: any, ref: any) => (
      <View
        ref={ref}
        testID="packages-refresh-control"
        onRefresh={onRefresh}
        refreshing={refreshing}
        {...props}
      >
        {children}
      </View>
    )),
  };
});


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

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { Feather: ({ name }: { name: string }) => <Text>{name}</Text> };
});

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
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
  }),
}));

jest.mock('@/context/DriverEntitlementContext', () => ({
  useDriverEntitlement: () => ({
    activatePackage: jest.fn(),
    createPackagePurchase: mockCreatePackagePurchase,
    entitlement: {
      vehicleId: null,
      vehicleType: null,
    },
    updatePackagePurchaseStatus: jest.fn(),
  }),
}));

jest.mock('@/persistence/lockedPackageOfferPersistence', () => ({
  loadLockedPackageOffer: (...args: unknown[]) => mockLoadLockedPackageOffer(...args),
}));

describe('DriverPackagePaymentScreen offer lock', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { offerId: lockedOffer.offerId };
    mockLoadLockedPackageOffer.mockResolvedValue({ offer: lockedOffer, failure: null });
    mockCreatePackagePurchase.mockResolvedValue({
      ...lockedOffer,
      amount: lockedOffer.priceRwf,
      provider: 'mtn',
      phoneNumber: '+250788000000',
      transactionId: 'purchase-1',
      status: 'pending',
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
});
