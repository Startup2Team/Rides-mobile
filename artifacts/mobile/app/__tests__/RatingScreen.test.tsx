import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import RatingScreen from '../rating';

const mockCompleteRide = jest.fn();
const mockNavigateToCustomerHomeAfterCompletion = jest.fn();
const mockProcessRideCommand = jest.fn();
const mockSaveDriverRatingOnce = jest.fn();

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));
  return {
    ActivityIndicator: host('ActivityIndicator'),
    Keyboard: { dismiss: jest.fn() },
    Platform: { OS: 'android', select: (options: Record<string, unknown>) => options.android ?? options.default },
    Pressable: host('Pressable'),
    StyleSheet: {
      create: (styles: object) => styles,
      flatten: (style: object) => style,
      hairlineWidth: 1,
    },
    Text: host('Text'),
    TextInput: host('TextInput'),
    View: host('View'),
    useColorScheme: () => 'light',
  };
});

jest.mock('expo-blur', () => ({
  BlurView: (props: object) => {
    const React = require('react');
    const { View } = require('react-native');
    return <View {...props} />;
  },
}));

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
}));

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => ({
    rideId: 'ride-1',
    driverName: 'Aline',
    driverPhoto: undefined,
    fare: '4200',
    vehicleType: 'moto',
  }),
}));

jest.mock('expo-store-review', () => ({
  isAvailableAsync: jest.fn(async () => false),
  requestReview: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'customer-1', mode: 'customer' } }),
}));

jest.mock('@/context/RideContext', () => ({
  useRide: () => ({
    currentRide: {
      id: 'ride-1',
      customerId: 'customer-1',
      driverId: 'driver-1',
      driver: { id: 'driver-1', name: 'Aline' },
    },
    rideHistory: [
      { id: 'ride-2' },
      { id: 'ride-3' },
      { id: 'ride-4' },
    ],
    completeRide: mockCompleteRide,
  }),
}));

jest.mock('@/domains/ride/commandPipeline/rideCommandPipeline', () => {
  const actual = jest.requireActual('@/domains/ride/commandPipeline/rideCommandPipeline');
  return {
    ...actual,
    processRideCommand: (...args: unknown[]) => mockProcessRideCommand(...args),
  };
});

jest.mock('@/hooks/useColors', () => ({
  useColors: () => ({
    background: '#fff',
    border: '#ddd',
    card: '#fff',
    destructive: '#dc2626',
    foreground: '#111',
    muted: '#f3f4f6',
    mutedForeground: '#666',
    primary: '#2563eb',
    star: '#f59e0b',
    starMuted: '#9ca3af',
  }),
}));

jest.mock('@/navigation/navigationPolicy', () => ({
  navigateToCustomerHomeAfterCompletion: (...args: unknown[]) => mockNavigateToCustomerHomeAfterCompletion(...args),
}));

jest.mock('@/persistence/driverRatingPersistence', () => ({
  buildLocalDriverRating: (rating: object) => rating,
  saveDriverRatingOnce: (...args: unknown[]) => mockSaveDriverRatingOnce(...args),
}));

jest.mock('@/components/KeyboardAwareScrollViewCompat', () => ({
  KeyboardAwareScrollViewCompat: ({ children }: { children?: React.ReactNode }) => {
    const React = require('react');
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
}));

jest.mock('@/components/ProfileAvatarCircle', () => ({
  ProfileAvatarCircle: () => {
    const React = require('react');
    const { View } = require('react-native');
    return <View />;
  },
}));

jest.mock('@/utils/driverProfileImage', () => ({
  isUploadedProfileImageUri: () => false,
  resolveDriverProfileImage: () => undefined,
}));

jest.mock('@/observability/monitoring', () => ({
  reportOperationalFailure: jest.fn(),
}));

describe('RatingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProcessRideCommand.mockImplementation((...args: unknown[]) => {
      const actual = jest.requireActual('@/domains/ride/commandPipeline/rideCommandPipeline') as typeof import('@/domains/ride/commandPipeline/rideCommandPipeline');
      return actual.processRideCommand(...(args as Parameters<typeof actual.processRideCommand>));
    });
  });

  test('submits rating through the real screen flow and shadow-wires the command', async () => {
    render(<RatingScreen />);

    fireEvent.press(screen.getByLabelText('5 stars'));
    fireEvent.press(screen.getByText('Submit'));
    await waitFor(() => expect(screen.getByLabelText('OK')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('OK'));

    await waitFor(() => expect(mockProcessRideCommand).toHaveBeenCalledTimes(1));
    const [command, context] = mockProcessRideCommand.mock.calls[0];
    expect(command).toEqual(expect.objectContaining({
      commandId: expect.any(String),
      idempotencyKey: expect.any(String),
      correlationId: expect.any(String),
      actorId: 'customer-1',
      actorRole: 'customer',
      timestamp: expect.any(String),
      payload: expect.objectContaining({
        rideId: 'ride-1',
        rating: 5,
        ratedUserId: 'driver-1',
      }),
    }));
    expect(context).toEqual(expect.objectContaining({
      mode: 'shadow',
    }));
    await waitFor(() => expect(mockSaveDriverRatingOnce).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockCompleteRide).toHaveBeenCalledTimes(1));
    expect(mockNavigateToCustomerHomeAfterCompletion).toHaveBeenCalledTimes(1);
  });
});
