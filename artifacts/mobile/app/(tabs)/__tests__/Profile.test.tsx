import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));
  return {
    Alert: { alert: jest.fn() },
    Image: host('Image'),
    Platform: { OS: 'android', select: (options: Record<string, unknown>) => options.android ?? options.default },
    StyleSheet: { create: (styles: object) => styles, flatten: (style: object) => style, hairlineWidth: 1 },
    Text: host('Text'),
    TouchableOpacity: host('TouchableOpacity'),
    View: host('View'),
    useColorScheme: () => 'light',
  };
});

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
  },
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children?: React.ReactNode }) => {
    const React = require('react');
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
}));

jest.mock('expo-symbols', () => ({
  SymbolView: () => null,
}));

jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
  MaterialCommunityIcons: () => null,
  FontAwesome: () => null,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/components/GlassHeader', () => ({
  GlassHeader: ({ title, subtitle, onBackPress }: { title: string; subtitle?: string; onBackPress?: () => void }) => {
    const React = require('react');
    const { Pressable, Text, View } = require('react-native');
    return (
      <View>
        <Text>{title}</Text>
        {subtitle ? <Text>{subtitle}</Text> : null}
        <Pressable accessibilityLabel="Go back" onPress={onBackPress} />
      </View>
    );
  },
  useGlassHeaderMetrics: () => ({ contentTop: 0, indicatorTop: 0 }),
}));

jest.mock('@/components/GlassScrollView', () => ({
  GlassScrollView: ({ children }: { children?: React.ReactNode }) => {
    const React = require('react');
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
}));

jest.mock('@/components/AppText', () => ({
  AppText: ({ children }: { children?: React.ReactNode }) => {
    const React = require('react');
    const { Text } = require('react-native');
    return <Text>{children}</Text>;
  },
}));

jest.mock('@/components/OfflineBanner', () => ({
  OfflineBanner: () => null,
}));

jest.mock('@/components/ImageGalleryPreview', () => ({
  ImageGalleryPreview: () => null,
}));

jest.mock('@/components/ProfilePhotoEditSheet', () => ({
  ProfilePhotoEditSheet: () => null,
}));

jest.mock('@/hooks/useColors', () => ({
  useColors: () => ({
    background: '#fff',
    border: '#ddd',
    card: '#fff',
    destructive: '#dc2626',
    foreground: '#111',
    mutedForeground: '#666',
    primary: '#2563eb',
    primaryHex: '#2563eb',
  }),
}));

jest.mock('@/domains/profile', () => ({
  useProfile: () => ({
    user: { id: 'customer-1', mode: 'customer', name: 'Customer User' },
    driverProfile: null,
    profile: { fullName: 'Customer User' },
    switchMode: jest.fn(),
  }),
}));

jest.mock('@/hooks/useProfilePhotoActions', () => ({
  useProfilePhotoActions: () => ({
    profileImage: null,
    handleImagePick: jest.fn(),
    handleDeletePhoto: jest.fn(),
  }),
}));

jest.mock('@/utils/driverVerification', () => ({
  canAccessDriverMode: () => false,
  getDriverApplicationAction: () => ({ route: '/driver-onboarding', label: 'In Review' }),
}));

jest.mock('@/navigation/navigationPolicy', () => ({
  navigateToDriverHomeAfterCompletion: jest.fn(),
}));

jest.mock('@/navigation/shareNavigation', () => ({
  getShareRouteForMode: () => '/share',
}));

jest.mock('@/utils/communityActions', () => ({
  leaveRidesFeedback: jest.fn(),
  rateRides: jest.fn(),
}));

jest.mock('@/constants/branding', () => ({
  APP_NAME: 'Rides',
}));

describe('ProfileScreen', () => {
  test('opens rating information from the customer rating area', async () => {
    const ProfileScreen = require('../profile').default;
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={client}>
        <ProfileScreen />
      </QueryClientProvider>,
    );

    const ratingInfoButton = screen.getByLabelText('Open rating information');
    fireEvent.press(ratingInfoButton);
    fireEvent.press(ratingInfoButton);

    await waitFor(() => {
      const { router } = require('expo-router');
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/rating-information',
        params: { mode: 'customer' },
      });
    });
    const { router } = require('expo-router');
    expect(router.push).toHaveBeenCalledTimes(1);
  });
});
