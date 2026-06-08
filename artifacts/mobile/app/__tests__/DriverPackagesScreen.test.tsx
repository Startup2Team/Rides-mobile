import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import type { DriverEntitlement } from '@/domain/driverRidePackages';
import { EMPTY_DRIVER_ENTITLEMENT } from '@/domain/driverRidePackages';
import DriverPackagesScreen from '../driver-packages';

const mockRouterReplace = jest.fn();
const mockRouterBack = jest.fn();
const mockActivatePackage = jest.fn();
let mockEntitlement: DriverEntitlement = EMPTY_DRIVER_ENTITLEMENT;

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
    TouchableOpacity: host('TouchableOpacity'),
    useColorScheme: () => 'light',
    View: host('View'),
  };
});

jest.mock('expo-router', () => ({
  router: {
    back: mockRouterBack,
    replace: mockRouterReplace,
  },
}));

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light' },
  impactAsync: jest.fn(),
}));

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
      verificationStatus: 'approved',
    },
  }),
}));

jest.mock('@/context/DriverEntitlementContext', () => ({
  useDriverEntitlement: () => ({
    activatePackage: mockActivatePackage,
    entitlement: mockEntitlement,
    isLoading: false,
    launchOfferUsed: mockEntitlement.activations.some(activation => activation.packageId === 'launch_starter'),
    rideCredits: mockEntitlement.remainingRideCredits,
  }),
}));

describe('DriverPackagesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation((...args) => {
      if (String(args[0]).includes('react-test-renderer is deprecated')) return;
      console.warn(...args);
    });
    mockEntitlement = EMPTY_DRIVER_ENTITLEMENT;
    mockActivatePackage.mockResolvedValue({
      id: 'activation:growth:2026-06-08T10:00:00.000Z',
      packageId: 'growth',
      activatedAt: '2026-06-08T10:00:00.000Z',
      pricePaidRwf: 2_000,
      creditsGranted: 75,
      authority: 'local_prototype',
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('reviews a paid package before recording a local prototype purchase', async () => {
    render(<DriverPackagesScreen />);

    fireEvent.press(screen.getByText('Review Plan'));

    expect(screen.getByText('Confirm package')).toBeTruthy();
    expect(screen.getByText('Mobile Money payment will be connected here during backend integration. For now this records a local prototype purchase.')).toBeTruthy();
    expect(mockActivatePackage).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.press(screen.getByText('Record Purchase'));
    });

    await waitFor(() => expect(mockActivatePackage).toHaveBeenCalledWith('growth'));
    expect(screen.getByText('Package confirmed')).toBeTruthy();
    expect(screen.getByText('Growth Package added 75 ride credits to your account.')).toBeTruthy();
  });

  test('shows package activation history from entitlement data', () => {
    mockEntitlement = {
      ...EMPTY_DRIVER_ENTITLEMENT,
      activePackageId: 'growth',
      remainingRideCredits: 110,
      activations: [
        {
          id: 'activation:launch_starter:2026-06-07T10:00:00.000Z',
          packageId: 'launch_starter',
          activatedAt: '2026-06-07T10:00:00.000Z',
          pricePaidRwf: 0,
          creditsGranted: 35,
          authority: 'local_prototype',
        },
        {
          id: 'activation:growth:2026-06-08T10:00:00.000Z',
          packageId: 'growth',
          activatedAt: '2026-06-08T10:00:00.000Z',
          pricePaidRwf: 2_000,
          creditsGranted: 75,
          authority: 'local_prototype',
        },
      ],
      updatedAt: '2026-06-08T10:00:00.000Z',
    };

    render(<DriverPackagesScreen />);

    expect(screen.getByText('Package history')).toBeTruthy();
    expect(screen.getAllByText('Growth Package').length).toBeGreaterThan(1);
    expect(screen.getByText('+75')).toBeTruthy();
    expect(screen.getAllByText('2,000 RWF').length).toBeGreaterThan(1);
    expect(screen.getAllByText('Launch Starter Package').length).toBeGreaterThan(1);
    expect(screen.getByText('+35')).toBeTruthy();
    expect(screen.getAllByText('FREE').length).toBeGreaterThan(1);
  });
});
