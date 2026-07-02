import { act, render, renderHook } from '@testing-library/react-native';
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
import { recordActiveRideCanaryRollback } from '../../activeRideCanaryStability';
import {
  createRideCanaryInspectorSnapshot,
  isRideCanaryInspectorVisible,
  useRideCanaryInspector,
} from '../RideCanaryInspectorHooks';
import { RideCanaryInspector } from '../RideCanaryInspector';
import type { Ride } from '@/types';

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) => React.createElement(name, { ...props, ref }));
  return {
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
const environment = process.env as Record<string, string | undefined>;

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
    resetActiveRideRolloutGateForTests();
    queryClient.clear();
    environment.NODE_ENV = 'test';
    jest.clearAllMocks();
  });

  afterEach(() => {
    resetObservabilityForTests();
    resetRideCanaryHealthForTests();
    resetActiveRideCanaryReport();
    resetActiveRideRolloutGateForTests();
    queryClient.clear();
    environment.NODE_ENV = originalNodeEnv;
    jest.clearAllMocks();
  });

  test('is hidden in production', () => {
    environment.NODE_ENV = 'production';
    expect(isRideCanaryInspectorVisible()).toBe(false);
  });

  test('builds the combined report snapshot', () => {
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

  test('refresh reset export and force live do not mutate query cache', () => {
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

  test('RideProvider state remains unchanged while inspector actions run', () => {
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
