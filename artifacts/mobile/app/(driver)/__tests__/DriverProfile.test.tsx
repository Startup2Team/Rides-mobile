import { Alert, Pressable, Text, View } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

const mockReplace = jest.fn();
let mockAlert: jest.Mock;

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));
  mockAlert = jest.fn((_, __, buttons?: Array<{ text?: string; onPress?: () => unknown }>) => {
    buttons?.find((button) => button.text === 'Log Out')?.onPress?.();
  });
  return {
    Alert: { alert: mockAlert },
    Image: host('Image'),
    Modal: host('Modal'),
    Platform: { OS: 'android', select: (options: Record<string, unknown>) => options.android ?? options.default },
    Pressable: host('Pressable'),
    Animated: {
      View: host('AnimatedView'),
      Value: class {
        setValue = jest.fn();
        interpolate = jest.fn(() => 0);
      },
      timing: jest.fn(() => ({ start: (cb?: any) => cb?.() })),
      spring: jest.fn(() => ({ start: (cb?: any) => cb?.() })),
      parallel: jest.fn(() => ({ start: (cb?: any) => cb?.() })),
    },
    StyleSheet: { create: (styles: object) => styles, flatten: (style: object) => style },
    Text: host('Text'),
    TouchableOpacity: host('TouchableOpacity'),
    View: host('View'),
    useColorScheme: () => 'light',
  };
});

jest.mock('expo-router', () => ({
  router: {
    replace: mockReplace,
    push: jest.fn(),
  },
  useFocusEffect: (callback: () => (() => void) | void) => callback(),
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children?: React.ReactNode }) => {
    const React = require('react');
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => {
    const React = require('react');
    return React.createElement(React.Fragment, null, children);
  },
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
  MaterialCommunityIcons: () => null,
  FontAwesome: () => null,
}));

jest.mock('expo-symbols', () => ({
  SymbolView: () => null,
}));

jest.mock('@/components/GlassHeader', () => ({
  GlassHeader: () => null,
  useGlassHeaderMetrics: () => ({ contentTop: 0, indicatorTop: 0 }),
}));

jest.mock('@/components/GlassScrollView', () => ({
  GlassScrollView: ({ children }: { children?: React.ReactNode }) => {
    const React = require('react');
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
}));

jest.mock('@/components/VerifiedBadge', () => ({
  VerifiedBadge: () => null,
}));

jest.mock('@/components/OfflineBanner', () => ({
  OfflineBanner: () => null,
}));

jest.mock('@/components/ImageGalleryPreview', () => ({
  ImageGalleryPreview: () => null,
}));

jest.mock('@/hooks/useColors', () => ({
  useColors: () => ({
    foreground: '#111',
    mutedForeground: '#666',
    border: '#ddd',
    primary: '#2563eb',
    successHex: '#16a34a',
    destructive: '#dc2626',
    destructiveHex: '#dc2626',
  }),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { name: 'Driver User', phone: '250788000000', mode: 'driver' },
    driverProfile: { isVerified: true },
    switchMode: jest.fn(),
  }),
}));

jest.mock('@/context/DriverEntitlementContext', () => ({
  useDriverEntitlement: () => ({
    entitlement: null,
    isLoading: false,
    rideCredits: 0,
  }),
}));

jest.mock('@/context/RideContext', () => ({
  useRide: () => ({
    rideHistory: [],
    loadHistory: jest.fn(() => Promise.resolve()),
  }),
}));

jest.mock('@/persistence/profilePersistence', () => ({
  loadStoredProfileImage: jest.fn(() => Promise.resolve({ data: null })),
}));

jest.mock('@/persistence/driverRatingPersistence', () => ({
  loadStoredDriverRatings: jest.fn(() => Promise.resolve({ data: [] })),
}));

jest.mock('@/navigation/shareNavigation', () => ({
  getShareRouteForMode: () => '/share',
}));

jest.mock('@/utils/communityActions', () => ({
  leaveRidesFeedback: jest.fn(),
  rateRides: jest.fn(),
}));

describe('DriverProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('does not show a logout action', async () => {
    const DriverProfileScreen = require('../profile').default;
    render(<DriverProfileScreen />);

    expect(screen.queryByText('Log Out')).toBeNull();
    expect(mockAlert).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
