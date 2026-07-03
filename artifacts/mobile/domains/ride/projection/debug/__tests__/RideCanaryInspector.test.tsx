import { act, fireEvent, render, renderHook } from '@testing-library/react-native';
import React from 'react';
import { RideProvider, useRide } from '@/context/RideContext';
import { queryClient } from '@/query/client';
import { resetObservabilityForTests } from '@/observability/context/observabilityContext';
import { recordRideDetailParity, recordRideHistoryParity, resetRideCanaryHealthForTests } from '../../../canary/canaryHealth';
import { resetActiveRideCanaryReport } from '../../activeRideCanaryReport';
import {
  forceActiveRideLiveSource,
  resetActiveRideRolloutGateForTests,
} from '../../activeRideRolloutGate';
import { recordActiveRideCanaryRollback, resetActiveRideCanaryStabilityForTests } from '../../activeRideCanaryStability';
import {
  createRideCanaryInspectorSnapshot,
  isRideCanaryInspectorVisible,
  useRideCanaryInspector,
} from '../RideCanaryInspectorHooks';
import { RideCanaryInspector, RideCanaryInspectorLauncher } from '../RideCanaryInspector';
import type { Ride } from '@/types';

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));
  return {
    Modal: ({ children, visible, testID }: { children?: React.ReactNode; visible?: boolean; testID?: string }) => (visible ? <React.Fragment>{React.createElement('Modal', { testID }, children)}</React.Fragment> : null),
    Pressable: host('Pressable'),
    ScrollView: host('ScrollView'),
    StyleSheet: {
      create: (styles: object) => styles,
      flatten: (style: object) => style,
    },
    Text: host('Text'),
    TouchableOpacity: host('TouchableOpacity'),
    View: host('View'),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => {
    const React = require('react');
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
  useSafeAreaInsets: () => ({ top: 12, right: 0, bottom: 24, left: 0 }),
}));

jest.mock('@/components/AppText', () => ({
  AppText: ({ children }: { children?: React.ReactNode }) => {
    const React = require('react');
    const { Text } = require('react-native');
    return <Text>{children}</Text>;
  },
}));

jest.mock('@/components/AppButton', () => ({
  AppButton: ({ title }: { title: string }) => {
    const React = require('react');
    const { Text } = require('react-native');
    return <Text>{title}</Text>;
  },
}));

jest.mock('@/hooks/useColors', () => ({
  useColors: () => ({
    background: '#ffffff',
    border: '#d1d5db',
    card: '#ffffff',
    destructive: '#dc2626',
    destructiveForeground: '#ffffff',
    destructiveHex: '#dc2626',
    foreground: '#111827',
    muted: '#f3f4f6',
    mutedForeground: '#6b7280',
    primary: '#2563eb',
    primaryForeground: '#ffffff',
    success: '#16a34a',
    successHex: '#16a34a',
    warning: '#f59e0b',
    warningHex: '#f59e0b',
  }),
}));

jest.mock('../../activeRideRolloutGate', () => {
  const actual = jest.requireActual('../../activeRideRolloutGate');
  return {
    ...actual,
    forceActiveRideLiveSource: jest.fn(actual.forceActiveRideLiveSource),
  };
});

jest.mock('../../activeRideCanaryStability', () => {
  const actual = jest.requireActual('../../activeRideCanaryStability');
  return {
    ...actual,
    recordActiveRideCanaryRollback: jest.fn(actual.recordActiveRideCanaryRollback),
  };
});

const originalNodeEnv = process.env.NODE_ENV;
const originalEnableInspector = process.env.ENABLE_RIDE_CANARY_INSPECTOR;
const originalExpoEnableInspector = process.env.EXPO_PUBLIC_ENABLE_RIDE_CANARY_INSPECTOR;
const environment = process.env as Record<string, string | undefined>;

function enableInspector() {
  environment.ENABLE_RIDE_CANARY_INSPECTOR = 'true';
}

function disableInspector() {
  delete environment.ENABLE_RIDE_CANARY_INSPECTOR;
  delete environment.EXPO_PUBLIC_ENABLE_RIDE_CANARY_INSPECTOR;
}

function createRide(id: string): Ride {
  return {
    id,
    customerId: 'customer-1',
    customerName: 'Customer One',
    vehicleType: 'moto',
    pickup: { latitude: -1.94, longitude: 30.06, address: 'Pickup' },
    destination: { latitude: -1.95, longitude: 30.07, address: 'Destination' },
    status: 'in_progress',
    distance: 7,
    duration: 22,
    suggestedFare: 12000,
    agreedFare: 10000,
    negotiation: [],
    createdAt: '2026-07-02T09:00:00.000Z',
    arrivedAt: '2026-07-02T09:18:00.000Z',
    waitStartedAt: '2026-07-02T09:14:00.000Z',
    driverId: 'driver-1',
    driverName: 'Driver One',
    driver: {
      id: 'driver-1',
      name: 'Driver One',
      phone: '+250788111001',
      vehicleType: 'moto',
      plateNumber: 'RAD 001 A',
      location: { latitude: -1.93, longitude: 30.05 },
      rating: 4.8,
      eta: 3,
    },
  };
}

function seedHistoryAndDetailHealth() {
  const liveRide = createRide('ride-canary-1');
  for (let index = 0; index < 12; index += 1) {
    recordRideHistoryParity([liveRide], [liveRide]);
  }
  for (let index = 0; index < 14; index += 1) {
    recordRideDetailParity(liveRide, liveRide);
  }
}

describe('RideCanaryInspector', () => {
  beforeEach(() => {
    resetObservabilityForTests();
    resetRideCanaryHealthForTests();
    resetActiveRideCanaryReport();
    resetActiveRideCanaryStabilityForTests();
    resetActiveRideRolloutGateForTests();
    queryClient.clear();
    environment.NODE_ENV = 'test';
    disableInspector();
    jest.clearAllMocks();
  });

  afterEach(() => {
    resetObservabilityForTests();
    resetRideCanaryHealthForTests();
    resetActiveRideCanaryReport();
    resetActiveRideCanaryStabilityForTests();
    resetActiveRideRolloutGateForTests();
    queryClient.clear();
    environment.NODE_ENV = originalNodeEnv;
    environment.ENABLE_RIDE_CANARY_INSPECTOR = originalEnableInspector;
    environment.EXPO_PUBLIC_ENABLE_RIDE_CANARY_INSPECTOR = originalExpoEnableInspector;
    jest.clearAllMocks();
  });

  test('is hidden by default in test', () => {
    environment.NODE_ENV = 'test';
    expect(isRideCanaryInspectorVisible()).toBe(false);
  });

  test('is hidden by default in dev', () => {
    environment.NODE_ENV = 'development';
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    expect(isRideCanaryInspectorVisible()).toBe(false);
  });

  test('is hidden by default in production', () => {
    environment.NODE_ENV = 'production';
    expect(isRideCanaryInspectorVisible()).toBe(false);
  });

  test('is visible only with explicit flag', () => {
    enableInspector();
    expect(isRideCanaryInspectorVisible()).toBe(true);
    disableInspector();
    environment.EXPO_PUBLIC_ENABLE_RIDE_CANARY_INSPECTOR = 'true';
    expect(isRideCanaryInspectorVisible()).toBe(true);
  });

  test('builds the combined report snapshot', () => {
    enableInspector();
    seedHistoryAndDetailHealth();
    const snapshot = createRideCanaryInspectorSnapshot();

    expect(snapshot.visible).toBe(true);
    expect(snapshot.history.status).toBe('healthy');
    expect(snapshot.detail.status).toBe('healthy');
    expect(snapshot.history.projectedReads).toBe(12);
    expect(snapshot.detail.projectedReads).toBe(14);
    expect(snapshot.monitoringReport).toContain('Active Ride Canary Report');
    expect(snapshot.report.recommendedAction).toBeDefined();
  });

  test('zero observations classify as idle and not observed', () => {
    enableInspector();
    const snapshot = createRideCanaryInspectorSnapshot();

    expect(snapshot.history.status).toBe('idle');
    expect(snapshot.detail.status).toBe('idle');
    expect(snapshot.activeRide.status).toBe('idle');
    expect(snapshot.history.readiness).toBe('not_observed');
    expect(snapshot.detail.readiness).toBe('not_observed');
    expect(snapshot.activeRide.readiness).toBe('not_observed');
    expect(snapshot.history.recommendation).toBe('collect_data');
    expect(snapshot.detail.recommendation).toBe('collect_data');
    expect(snapshot.activeRide.recommendation).toBe('collect_data');
    expect(snapshot.activeRide.recommendation).not.toBe('rollback');
    expect(snapshot.activeRide.tone).toBe('idle');
  });

  test('refresh reset export and force live do not mutate query cache', () => {
    enableInspector();
    seedHistoryAndDetailHealth();
    const beforeQueryCount = queryClient.getQueryCache().getAll().length;
    const { result } = renderHook(() => useRideCanaryInspector(), {
      wrapper: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    });

    expect(result.current.visible).toBe(true);
    expect(result.current.snapshot.history.projectedReads).toBe(12);

    const exported = result.current.exportReport();
    expect(JSON.parse(exported)).toEqual(expect.objectContaining({
      history: expect.objectContaining({ projectedReads: 12 }),
      detail: expect.objectContaining({ projectedReads: 14 }),
    }));

    act(() => {
      result.current.resetMetrics();
    });
    expect(result.current.snapshot.history.projectedReads).toBe(0);
    expect(result.current.snapshot.detail.projectedReads).toBe(0);
    expect(result.current.snapshot.history.status).toBe('idle');
    expect(result.current.snapshot.detail.status).toBe('idle');
    expect(result.current.snapshot.activeRide.status).toBe('idle');
    expect(queryClient.getQueryCache().getAll().length).toBe(beforeQueryCount);

    act(() => {
      result.current.forceLive();
    });

    expect(forceActiveRideLiveSource).toHaveBeenCalledTimes(1);
    expect(recordActiveRideCanaryRollback).toHaveBeenCalledTimes(1);
    (recordActiveRideCanaryRollback as jest.Mock).mockClear();

    act(() => {
      result.current.simulateRollback();
    });

    expect(recordActiveRideCanaryRollback).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryCache().getAll().length).toBe(beforeQueryCount);
  });

  test('renders the hidden inspector surface in test mode', () => {
    enableInspector();
    seedHistoryAndDetailHealth();
    const view = render(<RideCanaryInspector />);

    expect(view.getByText('Ride Canary Inspector')).toBeTruthy();
    expect(view.getByText('Monitoring Report')).toBeTruthy();
    expect(view.getByText('History')).toBeTruthy();
    expect(view.getByText('Ride Detail')).toBeTruthy();
    expect(view.getByText('Active Ride')).toBeTruthy();
    expect(view.getByText('Refresh Report')).toBeTruthy();
    expect(view.getByText('Reset Metrics')).toBeTruthy();
    expect(view.getByText('Force Live')).toBeTruthy();
    expect(view.getByText('Simulate Rollback')).toBeTruthy();
    expect(view.getByText('Export Report (JSON)')).toBeTruthy();
  });

  test('floating launcher is visible with explicit flag and full inspector is closed by default', () => {
    enableInspector();
    const view = render(<RideCanaryInspectorLauncher />);

    expect(view.getByTestId('ride-canary-launcher')).toBeTruthy();
    expect(view.queryByText('Monitoring Report')).toBeNull();
  });

  test('floating launcher is hidden in production', () => {
    environment.NODE_ENV = 'production';
    const view = render(<RideCanaryInspectorLauncher />);

    expect(view.queryByTestId('ride-canary-launcher')).toBeNull();
  });

  test('floating launcher is hidden in test by default', () => {
    environment.NODE_ENV = 'test';
    const view = render(<RideCanaryInspectorLauncher />);

    expect(view.queryByTestId('ride-canary-launcher')).toBeNull();
  });

  test('tapping launcher opens scrollable modal overlay and Close hides it', () => {
    enableInspector();
    const view = render(<RideCanaryInspectorLauncher />);

    fireEvent.press(view.getByTestId('ride-canary-launcher'));

    expect(view.getByTestId('ride-canary-inspector-modal')).toBeTruthy();
    expect(view.getByText('Monitoring Report')).toBeTruthy();
    expect(view.getByText('Current environment: test')).toBeTruthy();

    fireEvent.press(view.getByText('Close'));

    expect(view.queryByText('Monitoring Report')).toBeNull();
  });

  test('opening closing and refreshing do not increment rollback count', () => {
    enableInspector();
    const view = render(<RideCanaryInspectorLauncher />);

    expect(createRideCanaryInspectorSnapshot().activeRide.rollbackCount).toBe(0);

    fireEvent.press(view.getByTestId('ride-canary-launcher'));
    expect(createRideCanaryInspectorSnapshot().activeRide.rollbackCount).toBe(0);

    fireEvent.press(view.getByText('Refresh Report'));
    expect(createRideCanaryInspectorSnapshot().activeRide.rollbackCount).toBe(0);

    fireEvent.press(view.getByText('Close'));
    expect(createRideCanaryInspectorSnapshot().activeRide.rollbackCount).toBe(0);
  });

  test('explicit rollback simulation increments rollback exactly once', () => {
    enableInspector();
    const { result } = renderHook(() => useRideCanaryInspector());

    act(() => {
      result.current.simulateRollback();
    });

    expect(recordActiveRideCanaryRollback).toHaveBeenCalledTimes(1);
    expect(result.current.snapshot.activeRide.rollbackCount).toBe(1);
  });

  test('RideProvider state remains unchanged while inspector actions run', () => {
    enableInspector();
    const wrapper = ({ children }: { children: React.ReactNode }) => <RideProvider>{children}</RideProvider>;
    const { result } = renderHook(() => {
      const ride = useRide();
      const inspector = useRideCanaryInspector();
      return { ride, inspector };
    }, { wrapper });

    const beforeRide = result.current.ride.currentRide;
    const beforeHistory = result.current.ride.rideHistory;
    const beforePending = result.current.ride.pendingRequest;

    act(() => {
      result.current.inspector.refresh();
      result.current.inspector.forceLive();
      result.current.inspector.simulateRollback();
    });

    expect(result.current.ride.currentRide).toBe(beforeRide);
    expect(result.current.ride.rideHistory).toBe(beforeHistory);
    expect(result.current.ride.pendingRequest).toBe(beforePending);
  });
});
