import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { HomeTopHeader } from '../HomeTopHeader';

const mockSwitchMode = jest.fn();
const callOrder: string[] = [];

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));

  class Value {
    value: number;
    constructor(initialValue: number) {
      this.value = initialValue;
    }
    setValue(nextValue: number) {
      this.value = nextValue;
    }
    stopAnimation(callback?: (value: number) => void) {
      callback?.(this.value);
    }
    interpolate() {
      return this.value;
    }
  }

  const animation = () => ({ start: (callback?: () => void) => callback?.() });

  return {
    AccessibilityInfo: { isReduceMotionEnabled: jest.fn(() => Promise.resolve(true)) },
    Animated: {
      Value,
      View: host('AnimatedView'),
      spring: jest.fn(animation),
      timing: jest.fn(animation),
    },
    Image: host('Image'),
    PanResponder: {
      create: (config: Record<string, (...args: unknown[]) => unknown>) => ({
        panHandlers: {
          onResponderGrant: config.onPanResponderGrant,
          onResponderMove: config.onPanResponderMove,
          onResponderRelease: config.onPanResponderRelease,
          onResponderTerminate: config.onPanResponderTerminate,
        },
      }),
    },
    Platform: { OS: 'android', select: (options: Record<string, unknown>) => options.android ?? options.default },
    Pressable: host('Pressable'),
    StyleSheet: { create: (styles: object) => styles, flatten: (style: object) => style },
    Text: host('Text'),
    TouchableOpacity: host('TouchableOpacity'),
    useColorScheme: () => 'light',
    View: host('View'),
  };
});

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: { Text },
    runOnJS: (fn: (...args: unknown[]) => unknown) => fn,
    useAnimatedStyle: (factory: () => object) => factory(),
    useSharedValue: (value: number) => ({ value }),
    withTiming: (value: number, _config: object, callback?: (finished: boolean) => void) => {
      callback?.(true);
      return value;
    },
  };
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

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(() => {
      callOrder.push('replace');
    }),
  },
  useFocusEffect: (effect: () => void | (() => void)) => {
    const React = require('react');
    React.useEffect(effect, [effect]);
  },
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ switchMode: mockSwitchMode }),
}));

jest.mock('@/hooks/useColors', () => ({
  useColors: () => ({
    card: '#ffffff',
    destructive: '#ff0000',
    foreground: '#111111',
    primary: '#0066ff',
    primaryForeground: '#ffffff',
  }),
}));

jest.mock('@/persistence/profilePersistence', () => ({
  loadStoredProfileImage: jest.fn(() => Promise.resolve({ data: null })),
}));

function renderHeader(
  driverVerificationStatus: React.ComponentProps<typeof HomeTopHeader>['driverVerificationStatus'],
  canSwitchToDriverMode = false,
) {
  return render(
    <HomeTopHeader
      paddingTop={12}
      locationText="Kigali"
      locLoading={false}
      profileInitial="T"
      driverVerificationStatus={driverVerificationStatus}
      canSwitchToDriverMode={canSwitchToDriverMode}
    />,
  );
}

describe('HomeTopHeader driver CTA', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    callOrder.length = 0;
    const originalConsoleError = console.error;
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args) => {
      const message = String(args[0]);
      if (message.includes('react-test-renderer is deprecated')) return;
      if (message.includes('inside a test was not wrapped in act')) return;
      if (message.includes('You called act(async () => ...) without await')) return;
      originalConsoleError(...args);
    });
    mockSwitchMode.mockImplementation(async mode => {
      callOrder.push(`switch:${mode}`);
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.useRealTimers();
  });

  test('approved verified CTA slides to driver mode and switches before navigating', async () => {
    renderHeader('approved', true);

    expect(screen.getByText('Slide to Driver')).toBeTruthy();
    const dragHandle = screen.getByTestId('driver-mode-avatar-drag-handle');

    fireEvent(dragHandle, 'responderGrant', {}, { dx: 0, dy: 0 });
    fireEvent(dragHandle, 'responderMove', {}, { dx: 120, dy: 0 });
    fireEvent(dragHandle, 'responderRelease', {}, { dx: 120, dy: 0 });

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(driver)'));
    expect(mockSwitchMode).toHaveBeenCalledWith('driver');
    expect(callOrder).toEqual(['switch:driver', 'replace']);
  });

  test('approved verified CTA snaps back when released before the slide threshold', async () => {
    renderHeader('approved', true);

    const dragHandle = screen.getByTestId('driver-mode-avatar-drag-handle');
    fireEvent(dragHandle, 'responderGrant', {}, { dx: 0, dy: 0 });
    fireEvent(dragHandle, 'responderMove', {}, { dx: 30, dy: 0 });
    fireEvent(dragHandle, 'responderRelease', {}, { dx: 30, dy: 0 });

    expect(mockSwitchMode).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalledWith('/(driver)');
  });

  test('approved verified CTA keeps accessibility activation fallback', async () => {
    renderHeader('approved', true);

    const switchCta = screen.getByLabelText('Slide to switch to driver mode');
    fireEvent(switchCta, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(driver)'));
    expect(mockSwitchMode).toHaveBeenCalledWith('driver');
  });

  test('pending review still opens submission confirmation', () => {
    renderHeader('pending_review');

    fireEvent.press(screen.getByLabelText('In Review'));

    expect(router.push).toHaveBeenCalledWith('/driver-submission-confirmation');
    expect(mockSwitchMode).not.toHaveBeenCalled();
  });

  test.each([
    ['draft' as const, 'Continue application'],
    ['rejected' as const, 'Update application'],
  ])('%s still opens driver onboarding', (status, label) => {
    renderHeader(status);

    fireEvent.press(screen.getByLabelText(label));

    expect(router.push).toHaveBeenCalledWith('/driver-onboarding');
    expect(mockSwitchMode).not.toHaveBeenCalled();
  });

  test('not started keeps rotating recruitment CTA and opens onboarding', async () => {
    renderHeader('not_started');

    expect(screen.getByText('Join as Driver')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Join as Driver'));
    expect(router.push).toHaveBeenCalledWith('/driver-onboarding');

    await act(async () => {
      await Promise.resolve();
      jest.advanceTimersByTime(45_000);
    });

    expect(screen.getByText('Drive and Earn')).toBeTruthy();
  });
});
