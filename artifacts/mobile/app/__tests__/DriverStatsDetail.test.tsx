import { fireEvent, render, screen, waitFor, act } from '@testing-library/react-native';
import React from 'react';
import { Animated } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from 'expo-router';
import DriverStatsDetail from '../driver-stats-detail';
import { loadStoredDriverDailyGoals } from '@/persistence/driverDailyGoalPersistence';
import { publishDriverDailyGoalUpdate } from '@/persistence/driverDailyGoalUpdateSignal';
import {
  consumeDriverEarningsDateSelection,
  getDriverEarningsDateSelectionVersion,
  publishDriverEarningsDateSelection,
} from '@/persistence/driverEarningsDateSelectionSignal';
import { DRIVER_STATISTICS_MOTION } from '@/domains/driver-statistics/driverStatisticsMotion';
import { driverStatisticsHaptics } from '@/domains/driver-statistics/driverStatisticsHaptics';

let mockDetailFocusCallback: undefined | (() => void | (() => void));
let mockDetailFocusCleanup: undefined | (() => void);
let mockAppStateChangeHandler: undefined | ((state: string) => void);
let mockReducedMotion = false;

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));
  return {
    Platform: { OS: 'android', select: (options: Record<string, unknown>) => options.android ?? options.default },
    Pressable: host('Pressable'),
    ScrollView: host('ScrollView'),
    FlatList: React.forwardRef((props: {
      data?: Array<unknown>;
      renderItem?: (info: { item: unknown; index: number }) => React.ReactNode;
      keyExtractor?: (item: unknown, index: number) => string;
      testID?: string;
      initialScrollIndex?: number;
      ListHeaderComponent?: React.ReactNode;
    }, ref: unknown) => {
      const { data = [], renderItem, keyExtractor, testID, initialScrollIndex = 0 } = props;
      const center = Math.min(Math.max(0, initialScrollIndex), Math.max(0, data.length - 1));
      const start = Math.max(0, center - 2);
      const end = Math.min(data.length - 1, center + 2);
      const nodes = [];
      for (let index = start; index <= end; index += 1) {
        const item = data[index];
        nodes.push(
          React.createElement(
            React.Fragment,
            { key: keyExtractor ? keyExtractor(item, index) : String(index) },
            renderItem ? renderItem({ item, index }) : null,
          ),
        );
      }
      return React.createElement('FlatList', { ref, testID, initialScrollIndex }, nodes);
    }),
    StyleSheet: {
      create: (styles: object) => styles,
      flatten: (style: object) => style,
      hairlineWidth: 1,
      absoluteFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
    },
    Text: host('Text'),
    TouchableOpacity: host('TouchableOpacity'),
    useColorScheme: () => 'light',
    View: host('View'),
    Modal: React.forwardRef((props: { visible?: boolean; children?: React.ReactNode }, ref: unknown) => {
      if (!props.visible) return null;
      return React.createElement('Modal', { ...props, ref }, props.children);
    }),
    Image: host('Image'),
    PanResponder: {
      create: (handlers: object) => ({ panHandlers: handlers }),
    },
    Easing: {
      cubic: 'cubic',
      out: jest.fn(value => value),
      inOut: jest.fn(value => value),
    },
    InteractionManager: {
      runAfterInteractions: jest.fn(callback => {
        callback();
        return { cancel: jest.fn() };
      }),
    },
    Animated: {
      View: host('AnimatedView'),
      Value: jest.fn(() => ({
        interpolate: jest.fn(() => ({})),
        setValue: jest.fn(),
        stopAnimation: jest.fn(),
      })),
      timing: jest.fn((_value, config) => ({
        config,
        start: jest.fn((cb) => cb && cb({ finished: true })),
        stop: jest.fn(),
      })),
      sequence: jest.fn(() => ({
        start: jest.fn((cb) => cb && cb({ finished: true })),
        stop: jest.fn(),
      })),
      parallel: jest.fn(() => ({
        start: jest.fn((cb) => cb && cb({ finished: true })),
        stop: jest.fn(),
      })),
    },
    AppState: {
      addEventListener: jest.fn((_event, handler) => {
        mockAppStateChangeHandler = handler;
        return { remove: jest.fn() };
      }),
    },
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), navigate: jest.fn() },
  useFocusEffect: jest.fn((cb) => {
    const React = require('react');
    React.useEffect(() => {
      mockDetailFocusCallback = cb;
      const cleanup = cb();
      mockDetailFocusCleanup = typeof cleanup === 'function' ? cleanup : undefined;
      return cleanup;
    }, [cb]);
  }),
  useLocalSearchParams: () => ({ metric: 'earnings', period: 'today' }),
}));

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: ({ children }: { children?: React.ReactNode }) => <View>{children}</View>,
  };
});

jest.mock('@/components/BackButton', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    BackButton: ({ onPress }: { onPress?: () => void }) => (
      <Pressable onPress={onPress} testID="back-button">
        <Text>Back</Text>
      </Pressable>
    ),
  };
});

jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockSvg = (props: object) => <View {...props} />;
  return {
    __esModule: true,
    default: MockSvg,
    Circle: MockSvg,
    Path: MockSvg,
    G: MockSvg,
    Defs: MockSvg,
    Filter: MockSvg,
    FeGaussianBlur: MockSvg,
    RadialGradient: MockSvg,
    Stop: MockSvg,
    Ellipse: MockSvg,
    ClipPath: MockSvg,
  };
});

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const Icon = ({ name }: { name: string }) => <Text>{name}</Text>;
  return { Feather: Icon, FontAwesome: Icon };
});

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'driver-1' },
    driverProfile: {
      acceptanceRate: 80,
      completedRides: 10,
      dailyDeclines: 2,
      dailyRides: 8,
      earningsTotal: 30_000,
    },
  }),
}));

jest.mock('@/context/DriverEntitlementContext', () => ({
  useDriverEntitlement: () => ({
    entitlement: null,
    isLoading: false,
  }),
}));

jest.mock('@/query/hooks/useRideHistoryQuery', () => ({
  useRideHistoryQuery: () => ({
    data: [
      {
        id: 'ride-1',
        agreedFare: 12000,
        createdAt: '2026-07-07T23:55:00.000Z',
        completedAt: '2026-07-08T09:00:00',
        status: 'completed',
        driverId: 'driver-1',
        vehicleType: 'moto',
      },
      {
        id: 'cancelled-ride',
        agreedFare: 50000,
        createdAt: '2026-07-08T10:00:00.000Z',
        completedAt: '2026-07-08T10:30:00.000Z',
        status: 'cancelled',
        driverId: 'driver-1',
        vehicleType: 'moto',
      },
      {
        id: 'other-driver-ride',
        agreedFare: 70000,
        createdAt: '2026-07-08T11:00:00.000Z',
        completedAt: '2026-07-08T11:30:00.000Z',
        status: 'completed',
        driverId: 'driver-2',
        vehicleType: 'moto',
      }
    ],
    isLoading: false,
  }),
}));

jest.mock('@/persistence/driverRatingPersistence', () => ({
  loadStoredDriverRatings: jest.fn(() => Promise.resolve({ data: [] })),
}));

jest.mock('@/persistence/driverDailyGoalPersistence', () => ({
  loadStoredDriverDailyGoals: jest.fn(() =>
    Promise.resolve({ data: [], source: 'missing' }),
  ),
}));

jest.mock('@/hooks/useReducedMotionPreference', () => ({
  useReducedMotionPreference: () => mockReducedMotion,
}));

jest.mock('@/domains/driver-statistics/driverStatisticsHaptics', () => ({
  driverStatisticsHaptics: {
    selection: jest.fn(),
    lightImpact: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
  },
}));

function renderWithQueryClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      {ui}
    </QueryClientProvider>,
  );
}

function progressAnimationCount() {
  return (Animated.timing as jest.Mock).mock.calls.filter(
    ([, config]) =>
      config?.duration === DRIVER_STATISTICS_MOTION.ringEntryMs
      || config?.duration === DRIVER_STATISTICS_MOTION.ringUpdateMs,
  ).length;
}

function tuesdayLabel() {
  return /Tuesday, 7 July 2026.*from weekday label/;
}

describe('DriverStatsDetail UI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReducedMotion = false;
    jest.useFakeTimers({ now: new Date('2026-07-08T14:30:00.000Z') });
    mockDetailFocusCallback = undefined;
    mockDetailFocusCleanup = undefined;
    mockAppStateChangeHandler = undefined;
    consumeDriverEarningsDateSelection(getDriverEarningsDateSelectionVersion() - 1);
    (loadStoredDriverDailyGoals as jest.Mock).mockResolvedValue({
      data: [],
      source: 'missing',
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('renders detail hierarchy with large ring and metric cards', async () => {
    renderWithQueryClient(<DriverStatsDetail />);
    act(() => {
      jest.advanceTimersByTime(DRIVER_STATISTICS_MOTION.detailRingEntryDelayMs);
    });

    await waitFor(() => expect(screen.getByText('--/--')).toBeTruthy());

    expect(screen.getAllByText('Earnings').length).toBeGreaterThan(0);
    expect(screen.queryByText('Goal: 30000')).toBeNull();
    expect(screen.queryByText('No daily goal set')).toBeNull();
    expect(screen.getByText('Activity breakdown')).toBeTruthy();
    expect(screen.getByText('Daily Metrics Summary')).toBeTruthy();
  });

  test('shows Set goal action for today and opens the goal screen', async () => {
    renderWithQueryClient(<DriverStatsDetail />);

    await waitFor(() => expect(screen.getByText('--/--')).toBeTruthy());

    const goalAction = screen.getByLabelText('Set daily earnings goal');
    expect(goalAction).toBeTruthy();
    expect(screen.getByText('Set goal')).toBeTruthy();

    fireEvent.press(goalAction);
    expect(driverStatisticsHaptics.lightImpact).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/driver-daily-goal');
  });

  test('hides daily goal action for past selected dates without removing the action slot', async () => {
    renderWithQueryClient(<DriverStatsDetail />);

    await waitFor(() => expect(screen.getByText('--/--')).toBeTruthy());
    fireEvent.press(screen.getByLabelText(tuesdayLabel()));

    expect(screen.queryByLabelText('Set daily earnings goal')).toBeNull();
    expect(screen.queryByLabelText('Change daily earnings goal')).toBeNull();
    expect(screen.getByText('--/--')).toBeTruthy();
    expect(screen.queryByText('No goal was set for this day')).toBeNull();
    expect(screen.getByTestId('earnings-amount-without-goal')).toBeTruthy();
  });

  test('preserves a historical selection across cleanup and ordinary refocus', async () => {
    renderWithQueryClient(<DriverStatsDetail />);
    await waitFor(() => expect(screen.getByText(/8 Jul 2026/)).toBeTruthy());

    fireEvent.press(screen.getByLabelText(tuesdayLabel()));
    expect(screen.getByText(/7 Jul 2026/)).toBeTruthy();

    act(() => {
      mockDetailFocusCleanup?.();
      const cleanup = mockDetailFocusCallback?.();
      mockDetailFocusCleanup = typeof cleanup === 'function' ? cleanup : undefined;
    });

    expect(screen.getByText(/7 Jul 2026/)).toBeTruthy();
  });

  test('calendar icon navigates to Earnings History with selectedLocalDate', async () => {
    renderWithQueryClient(<DriverStatsDetail />);
    await waitFor(() => expect(screen.getByText(/8 Jul 2026/)).toBeTruthy());
    fireEvent.press(screen.getByLabelText(tuesdayLabel()));

    fireEvent.press(screen.getByLabelText('Open earnings calendar'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/driver-earnings-history',
      params: { selectedLocalDate: '2026-07-07' },
    });
    expect(screen.queryByTestId('earnings-history-calendar')).toBeNull();
    expect(screen.queryByTestId('earnings-history-calendar-list')).toBeNull();
  });

  test('Earnings History return signal selects the date once and centers the week', async () => {
    renderWithQueryClient(<DriverStatsDetail />);
    await waitFor(() => expect(screen.getByText(/8 Jul 2026/)).toBeTruthy());

    publishDriverEarningsDateSelection('2026-07-06');

    act(() => {
      mockDetailFocusCleanup?.();
      const cleanup = mockDetailFocusCallback?.();
      mockDetailFocusCleanup = typeof cleanup === 'function' ? cleanup : undefined;
    });

    await waitFor(() => expect(screen.getByText(/6 Jul 2026/)).toBeTruthy());

    act(() => {
      mockDetailFocusCleanup?.();
      const cleanup = mockDetailFocusCallback?.();
      mockDetailFocusCleanup = typeof cleanup === 'function' ? cleanup : undefined;
    });

    expect(screen.getByText(/6 Jul 2026/)).toBeTruthy();
  });

  test('Daily Goal return takes precedence over a pending calendar selection', async () => {
    renderWithQueryClient(<DriverStatsDetail />);
    await waitFor(() => expect(screen.getByText(/8 Jul 2026/)).toBeTruthy());
    fireEvent.press(screen.getByLabelText(tuesdayLabel()));

    publishDriverEarningsDateSelection('2026-07-06');
    publishDriverDailyGoalUpdate();

    act(() => {
      mockDetailFocusCleanup?.();
      const cleanup = mockDetailFocusCallback?.();
      mockDetailFocusCleanup = typeof cleanup === 'function' ? cleanup : undefined;
    });

    await waitFor(() => expect(screen.getByText(/8 Jul 2026/)).toBeTruthy());
  });

  test('successful Daily Goal return resets to today and reloads its goal', async () => {
    renderWithQueryClient(<DriverStatsDetail />);
    await waitFor(() => expect(screen.getByText(/8 Jul 2026/)).toBeTruthy());
    fireEvent.press(screen.getByLabelText(tuesdayLabel()));

    (loadStoredDriverDailyGoals as jest.Mock).mockResolvedValue({
      data: [{
        amountRwf: 40_000,
        effectiveFromLocalDate: '2026-07-08',
        createdAt: '2026-07-08T12:00:00.000Z',
        updatedAt: '2026-07-08T12:00:00.000Z',
      }],
      source: 'current',
    });
    publishDriverDailyGoalUpdate();

    act(() => {
      mockDetailFocusCleanup?.();
      const cleanup = mockDetailFocusCallback?.();
      mockDetailFocusCleanup = typeof cleanup === 'function' ? cleanup : undefined;
    });

    await waitFor(() => expect(screen.getByText(/12,000\/40,000/)).toBeTruthy());
    expect(screen.getByText(/8 Jul 2026/)).toBeTruthy();
    expect(screen.getByLabelText('Change daily earnings goal')).toBeTruthy();
  });

  test('foregrounding preserves an intentional historical selection', async () => {
    renderWithQueryClient(<DriverStatsDetail />);
    await waitFor(() => expect(screen.getByText(/8 Jul 2026/)).toBeTruthy());
    fireEvent.press(screen.getByLabelText(tuesdayLabel()));

    act(() => mockAppStateChangeHandler?.('active'));

    expect(screen.getByText(/7 Jul 2026/)).toBeTruthy();
  });

  test('foreground after midnight advances old today but preserves an older selection', async () => {
    const first = renderWithQueryClient(<DriverStatsDetail />);
    await waitFor(() => expect(screen.getByText(/8 Jul 2026/)).toBeTruthy());

    jest.setSystemTime(new Date('2026-07-09T08:00:00.000Z'));
    act(() => mockAppStateChangeHandler?.('active'));
    await waitFor(() => expect(screen.getByText(/9 Jul 2026/)).toBeTruthy());

    first.unmount();
    jest.setSystemTime(new Date('2026-07-08T14:30:00.000Z'));
    renderWithQueryClient(<DriverStatsDetail />);
    await waitFor(() => expect(screen.getByText(/8 Jul 2026/)).toBeTruthy());
    fireEvent.press(screen.getByLabelText(tuesdayLabel()));
    jest.setSystemTime(new Date('2026-07-09T08:00:00.000Z'));
    act(() => mockAppStateChangeHandler?.('active'));

    expect(screen.getByText(/7 Jul 2026/)).toBeTruthy();
  });

  test('a freshly mounted Earnings route starts on today again', async () => {
    const first = renderWithQueryClient(<DriverStatsDetail />);
    await waitFor(() => expect(screen.getByText(/8 Jul 2026/)).toBeTruthy());
    fireEvent.press(screen.getByLabelText(tuesdayLabel()));
    first.unmount();

    renderWithQueryClient(<DriverStatsDetail />);
    await waitFor(() => expect(screen.getByText(/8 Jul 2026/)).toBeTruthy());
  });

  test('fresh entry keeps idle rings when goal is unset with no progress animations', async () => {
    renderWithQueryClient(<DriverStatsDetail />);
    await waitFor(() => expect(screen.getByTestId('earnings-big-progress-ring')).toBeTruthy());
    act(() => {
      jest.advanceTimersByTime(DRIVER_STATISTICS_MOTION.detailRingEntryDelayMs);
    });

    // Unconfigured rings are track-only and static — no progress animations.
    expect(progressAnimationCount()).toBe(0);
    expect(screen.getByTestId('earnings-big-progress-ring').props.accessibilityLabel).toBe(
      'Daily earnings goal not set.',
    );
    expect(screen.getAllByTestId(/weekly-progress-ring-0-/)).toHaveLength(7);
    expect(screen.getAllByTestId(/weekly-progress-ring-1-/)).toHaveLength(7);
    expect(screen.getAllByTestId(/weekly-progress-ring-2-/)).toHaveLength(7);
  });

  test('fresh detail entry keeps core content visible while supporting content reveals', async () => {
    renderWithQueryClient(<DriverStatsDetail />);
    await waitFor(() => expect(screen.getByTestId('earnings-big-progress-ring')).toBeTruthy());
    expect(screen.getByText(/8 Jul 2026/)).toBeTruthy();
    expect(screen.getByText('Activity breakdown')).toBeTruthy();
  });

  test('date changes retarget only for meaningful progress changes when goals are configured', async () => {
    (loadStoredDriverDailyGoals as jest.Mock).mockResolvedValue({
      data: [{
        amountRwf: 30_000,
        effectiveFromLocalDate: '2026-07-01',
        createdAt: '2026-07-01T08:00:00.000Z',
        updatedAt: '2026-07-01T08:00:00.000Z',
      }],
      source: 'current',
    });
    renderWithQueryClient(<DriverStatsDetail />);
    await waitFor(() => expect(screen.getByText(/12,000\/30,000/)).toBeTruthy());
    act(() => {
      jest.advanceTimersByTime(DRIVER_STATISTICS_MOTION.detailRingEntryDelayMs);
    });
    await act(async () => Promise.resolve());
    const initialCount = progressAnimationCount();

    fireEvent.press(screen.getByLabelText(tuesdayLabel()));
    expect(progressAnimationCount()).toBe(initialCount + 1);
    expect(driverStatisticsHaptics.selection).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByLabelText(tuesdayLabel()));
    expect(progressAnimationCount()).toBe(initialCount + 1);
    expect(driverStatisticsHaptics.selection).toHaveBeenCalledTimes(1);
  });

  test('opening earnings history does not replay the big ring', async () => {
    (loadStoredDriverDailyGoals as jest.Mock).mockResolvedValue({
      data: [{
        amountRwf: 30_000,
        effectiveFromLocalDate: '2026-07-01',
        createdAt: '2026-07-01T08:00:00.000Z',
        updatedAt: '2026-07-01T08:00:00.000Z',
      }],
      source: 'current',
    });
    renderWithQueryClient(<DriverStatsDetail />);
    await waitFor(() => expect(screen.getByText(/12,000\/30,000/)).toBeTruthy());
    act(() => {
      jest.advanceTimersByTime(DRIVER_STATISTICS_MOTION.detailRingEntryDelayMs);
    });
    await act(async () => Promise.resolve());
    const initialCount = progressAnimationCount();

    fireEvent.press(screen.getByLabelText('Open earnings calendar'));
    act(() => mockAppStateChangeHandler?.('active'));

    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/driver-earnings-history' }),
    );
    expect(progressAnimationCount()).toBe(initialCount);
  });

  test('reduced motion skips supporting content delay animations', async () => {
    mockReducedMotion = true;
    renderWithQueryClient(<DriverStatsDetail />);
    await waitFor(() => expect(screen.getByTestId('earnings-big-progress-ring')).toBeTruthy());
    expect(screen.getByText('Activity breakdown')).toBeTruthy();
  });

  test('uses the authoritative completed-ride total and real completion-hour activity', async () => {
    renderWithQueryClient(<DriverStatsDetail />);

    await waitFor(() => expect(screen.getByText(/12,000 RWF earned/)).toBeTruthy());

    expect(screen.getAllByText('12,000 RWF').length).toBeGreaterThan(0);
    expect(screen.queryByText(/132,000/)).toBeNull();
    expect(screen.getByTestId('hourly-activity-bar-9').props.accessibilityValue).toEqual({
      min: 0,
      max: 12000,
      now: 12000,
    });
    expect(screen.queryByTestId('hourly-activity-bar-8')).toBeNull();
    expect(screen.queryByTestId('hourly-activity-bar-10')).toBeNull();
    expect(screen.queryByTestId('hourly-activity-bar-11')).toBeNull();
  });

  test('swipes between past weeks without navigating into the future', async () => {
    renderWithQueryClient(<DriverStatsDetail />);

    await waitFor(() => expect(screen.getByText('--/--')).toBeTruthy());
    const weekSelector = screen.getByTestId('weekly-date-selector');
    expect(
      screen.getAllByLabelText(/Thursday, 9 July 2026/).every(
        (node) => node.props.accessibilityState?.disabled === true,
      ),
    ).toBe(true);

    act(() => {
      weekSelector.props.onPanResponderRelease(null, { dx: 60, dy: 2, vx: 0 });
    });
    expect(screen.getByText(/8 Jul 2026/)).toBeTruthy();

    act(() => {
      weekSelector.props.onPanResponderRelease(null, { dx: 140, dy: 2, vx: 0 });
    });
    expect(screen.getByText(/1 Jul 2026/)).toBeTruthy();

    act(() => {
      weekSelector.props.onPanResponderRelease(null, { dx: -140, dy: 2, vx: 0 });
    });
    expect(screen.getByText(/8 Jul 2026/)).toBeTruthy();
  });

  test('failed swipe returns to the centered week without changing the selected date', async () => {
    renderWithQueryClient(<DriverStatsDetail />);
    await waitFor(() => expect(screen.getByText(/8 Jul 2026/)).toBeTruthy());
    const weekSelector = screen.getByTestId('weekly-date-selector');

    act(() => {
      weekSelector.props.onPanResponderRelease(null, { dx: 40, dy: 2, vx: 0 });
    });

    expect(screen.getByText(/8 Jul 2026/)).toBeTruthy();
  });
});
