import { renderHook } from '@testing-library/react-native';
import { observability, resetObservabilityForTests } from '@/observability/context/observabilityContext';
import type { Ride } from '@/types';
import { recordRideDetailParity, recordRideHistoryParity, resetRideCanaryHealthForTests } from '../../canary/canaryHealth';
import {
  resetActiveRideRolloutGateForTests,
  seedActiveRideRolloutGateForTests,
} from '../../projection/activeRideRolloutGate';
import {
  createActiveRideUiSummary,
  mapProjectedActiveRideToRideLike,
} from '../../projection/activeRideUiModel';
import type { RideShadowSnapshot } from '../../shadow/shadowTypes';
import { rideShadowProjectionManager } from '../../shadow/shadowProjectionManager';
import { useActiveRideReadModel, forceLiveRideReadModel } from '../rideDualReadAdapter';
import { ActiveRideProjectionSummary } from '../../../../components/ride/ActiveRideProjectionSummary';

jest.mock('@/context/RideContext', () => ({
  useRide: jest.fn(),
}));

const mockedUseRide = jest.requireMock('@/context/RideContext').useRide as jest.Mock;

const originalNodeEnv = process.env.NODE_ENV;
const originalEnableProjectedActiveRideCanary = process.env.ENABLE_PROJECTED_ACTIVE_RIDE_CANARY;
const originalUseProjectedRideReadModel = process.env.USE_PROJECTED_RIDE_READ_MODEL;
const originalAllowProjectedActiveRideUi = process.env.ALLOW_PROJECTED_ACTIVE_RIDE_UI;
const environment = process.env as Record<string, string | undefined>;

function setEnvironment({
  nodeEnv = 'test',
  canaryEnabled = false,
  projectedReadModel = false,
  allowUi = false,
}: {
  nodeEnv?: 'development' | 'test' | 'production';
  canaryEnabled?: boolean;
  projectedReadModel?: boolean;
  allowUi?: boolean;
} = {}) {
  environment.NODE_ENV = nodeEnv;
  environment.ENABLE_PROJECTED_ACTIVE_RIDE_CANARY = String(canaryEnabled);
  environment.USE_PROJECTED_RIDE_READ_MODEL = String(projectedReadModel);
  environment.ALLOW_PROJECTED_ACTIVE_RIDE_UI = String(allowUi);
}

function restoreEnvironment() {
  if (originalNodeEnv === undefined) {
    delete environment.NODE_ENV;
  } else {
    environment.NODE_ENV = originalNodeEnv;
  }

  if (originalEnableProjectedActiveRideCanary === undefined) {
    delete environment.ENABLE_PROJECTED_ACTIVE_RIDE_CANARY;
  } else {
    environment.ENABLE_PROJECTED_ACTIVE_RIDE_CANARY = originalEnableProjectedActiveRideCanary;
  }

  if (originalUseProjectedRideReadModel === undefined) {
    delete environment.USE_PROJECTED_RIDE_READ_MODEL;
  } else {
    environment.USE_PROJECTED_RIDE_READ_MODEL = originalUseProjectedRideReadModel;
  }

  if (originalAllowProjectedActiveRideUi === undefined) {
    delete environment.ALLOW_PROJECTED_ACTIVE_RIDE_UI;
  } else {
    environment.ALLOW_PROJECTED_ACTIVE_RIDE_UI = originalAllowProjectedActiveRideUi;
  }
}

function createLiveRide(overrides: Partial<Ride> = {}): Ride {
  return {
    id: 'ride-ui-1',
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
    createdAt: '2026-06-08T09:00:00.000Z',
    arrivedAt: '2026-06-08T09:18:00.000Z',
    waitStartedAt: '2026-06-08T09:14:00.000Z',
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
    ...overrides,
  };
}

function createProjectedActiveRide(overrides: Partial<NonNullable<RideShadowSnapshot['shadowActiveRide']>> = {}) {
  return {
    rideId: 'ride-ui-1',
    status: 'started' as const,
    phase: 'active' as const,
    customer: { userId: 'customer-1', role: 'customer' as const, displayName: 'Customer One' },
    driver: { userId: 'driver-1', role: 'driver' as const, displayName: 'Driver One' },
    pickup: { latitude: -1.94, longitude: 30.06, address: 'Pickup' },
    destination: { latitude: -1.95, longitude: 30.07, address: 'Destination' },
    fare: { amount: 10000, currency: 'RWF', source: 'final' as const, finalizedAt: '2026-06-08T09:22:00.000Z' },
    etaMinutes: 3,
    updatedAt: '2026-06-08T09:22:00.000Z',
    sequenceNumber: 10,
    projection: { appliedEventIds: ['ride.started'] },
    ...overrides,
  } satisfies NonNullable<RideShadowSnapshot['shadowActiveRide']>;
}

function createShadowSnapshot(overrides: Partial<RideShadowSnapshot> = {}): RideShadowSnapshot {
  return {
    enabled: true,
    running: true,
    projectionStatus: 'running',
    lastProcessedEvent: {
      aggregateId: 'ride-ui-1',
      aggregateType: 'ride',
      eventId: 'event-10',
      eventType: 'ride.started',
      eventVersion: 1,
      sequenceNumber: 10,
      timestamp: '2026-06-08T09:22:00.000Z',
      correlationId: 'corr-1',
      causationId: 'cmd-1',
      producer: 'test',
      payload: {
        rideId: 'ride-ui-1',
        startedAt: '2026-06-08T09:22:00.000Z',
      },
    },
    comparisonCount: 0,
    mismatchCount: 0,
    lastComparison: null,
    shadowActiveRide: createProjectedActiveRide(),
    shadowRideHistory: [],
    shadowDriverRequests: [],
    ...overrides,
  };
}

describe('active ride projected UI cutover', () => {
  beforeEach(() => {
    resetObservabilityForTests();
    resetRideCanaryHealthForTests();
    resetActiveRideRolloutGateForTests();
    rideShadowProjectionManager.stop();
    rideShadowProjectionManager.reset();
    setEnvironment();
    mockedUseRide.mockReturnValue({ currentRide: null });
    jest.restoreAllMocks();
  });

  afterEach(() => {
    restoreEnvironment();
  });

  test('default live source stays live', () => {
    const live = createLiveRide();
    mockedUseRide.mockReturnValue({ currentRide: live });
    const { result } = renderHook(() => {
      const activeRide = useActiveRideReadModel();
      return { activeRide };
    });

    expect(result.current.activeRide.source).toBe('live');
    expect(result.current.activeRide.selected).toBe(live);
    expect(result.current.activeRide.summary.source).toBe('live');
    expect(live.status).toBe('in_progress');
  });

  test('projected flags disabled stays live', () => {
    const snapshot = createShadowSnapshot();
    jest.spyOn(rideShadowProjectionManager, 'getSnapshot').mockReturnValue(snapshot);
    mockedUseRide.mockReturnValue({ currentRide: createLiveRide() });

    const { result } = renderHook(() => useActiveRideReadModel());

    expect(result.current.source).toBe('live');
    expect(result.current.fallback).toBe(true);
    expect(result.current.readinessDenied).toBe(true);
  });

  test('projected enabled and gate passed uses projected read model', () => {
    setEnvironment({ canaryEnabled: true, projectedReadModel: true, allowUi: true });
    recordRideHistoryParity([createLiveRide()], [createLiveRide()]);
    recordRideDetailParity(createLiveRide(), createLiveRide());
    seedActiveRideRolloutGateForTests({
      startedAt: '2026-06-08T09:00:00.000Z',
      lastUpdatedAt: '2026-06-08T09:20:00.000Z',
      comparisonCount: 24,
      projectedAvailableCount: 24,
      mismatchCount: 0,
      fallbackCount: 0,
      stalenessCount: 0,
      mappingFailureCount: 0,
      unresolvedProjectionErrorCount: 0,
      disabled: false,
      forcedLive: false,
      lastReason: 'rollout-approved',
    });

    const snapshot = createShadowSnapshot();
    jest.spyOn(rideShadowProjectionManager, 'getSnapshot').mockReturnValue(snapshot);
    mockedUseRide.mockReturnValue({ currentRide: createLiveRide() });

    const { result } = renderHook(() => useActiveRideReadModel());

    expect(result.current.source).toBe('projected');
    expect(result.current.selected).toMatchObject({
      id: 'ride-ui-1',
      status: 'in_progress',
      driverName: 'Driver One',
    });
    expect(result.current.summary.phaseLabel).toBe('Active');
    expect(result.current.summary.statusMessage).toBe('Heading to destination');
    expect(observability.logger.getLogs().map(log => log.message)).toEqual(expect.arrayContaining([
      'RideActiveRideUiSourceSelected',
      'RideActiveRideUiProjectedEnabled',
    ]));
  });

  test('rollback forces live source', () => {
    setEnvironment({ canaryEnabled: true, projectedReadModel: true, allowUi: true });
    const snapshot = createShadowSnapshot();
    jest.spyOn(rideShadowProjectionManager, 'getSnapshot').mockReturnValue(snapshot);
    mockedUseRide.mockReturnValue({ currentRide: createLiveRide() });

    expect(forceLiveRideReadModel()).toBe('live');

    const { result } = renderHook(() => useActiveRideReadModel());

    expect(result.current.source).toBe('live');
    expect(result.current.summary.source).toBe('live');
    expect(observability.logger.getLogs().map(log => log.message)).toEqual(expect.arrayContaining([
      'RideProjectionRollbackToLive',
    ]));
  });

  test('summary model keeps the same read-only shape from live and projected sources', () => {
    const liveSummary = createActiveRideUiSummary(createLiveRide(), null, 'live');
    const projectedRide = mapProjectedActiveRideToRideLike(createLiveRide(), createProjectedActiveRide());
    const projectedSummary = createActiveRideUiSummary(
      projectedRide,
      createProjectedActiveRide(),
      'projected',
    );
    expect(liveSummary).toMatchObject({
      source: 'live',
      phaseLabel: 'Active',
      statusMessage: 'Heading to destination',
    });
    expect(projectedSummary).toMatchObject({
      source: 'projected',
      phaseLabel: 'Active',
      statusMessage: 'Heading to destination',
    });
    expect(projectedRide).toMatchObject({
      id: 'ride-ui-1',
      status: 'in_progress',
      driverName: 'Driver One',
    });
    expect(ActiveRideProjectionSummary).toBeDefined();
  });
});
