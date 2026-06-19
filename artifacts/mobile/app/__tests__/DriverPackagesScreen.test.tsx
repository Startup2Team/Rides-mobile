import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import type { DriverEntitlement, DriverPackagePurchase } from '@/domain/driverRidePackages';
import { EMPTY_DRIVER_ENTITLEMENT } from '@/domain/driverRidePackages';
import DriverPackagesScreen from '../driver-packages';

const mockRouterReplace = jest.fn();
const mockRouterBack = jest.fn();
const mockActivatePackage = jest.fn();
const mockCreatePackagePurchase = jest.fn();
const mockUpdatePackagePurchaseStatus = jest.fn();
let mockEntitlement: DriverEntitlement = EMPTY_DRIVER_ENTITLEMENT;

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

describe('DriverPackagesScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation((...args) => {
      if (String(args[0]).includes('react-test-renderer is deprecated')) return;
      console.warn(...args);
    });
    mockEntitlement = EMPTY_DRIVER_ENTITLEMENT;
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

  test('opens the payment page only after buying the selected package', () => {
    render(<DriverPackagesScreen />);

    fireEvent.press(screen.getByText('Growth Package'));
    fireEvent.press(screen.getByText('Buy Selected Package'));

    expect(require('expo-router').router.push).toHaveBeenCalledWith({
      pathname: '/driver-package-payment',
      params: { packageId: 'growth' },
    });
  });

  test('deselects a package when it is pressed again', () => {
    render(<DriverPackagesScreen />);

    fireEvent.press(screen.getByText('Growth Package'));
    fireEvent.press(screen.getByText('Growth Package'));
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
    expect(screen.getAllByText('Most Popular Plan').length).toBeGreaterThan(0);
    expect(screen.getByText('Pro Package')).toBeTruthy();
    expect(screen.getByLabelText('120 Rides + 30 Bonus Rides')).toBeTruthy();
    expect(screen.getAllByText('Best Value Plan').length).toBeGreaterThan(0);
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
});
