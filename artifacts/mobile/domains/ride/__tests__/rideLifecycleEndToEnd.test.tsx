import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import { RideProvider, useRide } from '@/context/ride/RideProvider';
import { EMPTY_DRIVER_ENTITLEMENT } from '@/domain/driverRidePackages';
import { observability, resetObservabilityForTests } from '@/observability/context/observabilityContext';
import { rideCommandPipeline } from '@/domains/ride/commandPipeline/rideCommandPipeline';
import { rideTransactionBoundary } from '@/domains/ride/transactions';
import type { RideLocation } from '@/types';

const mockAppendRideHistory = jest.fn(async () => undefined);
const mockLoadRideHistory = jest.fn(async () => []);
const mockReportOperationalFailure = jest.fn();
const mockProcessRideCommand = jest.fn();

let mockOptionalAuth: any = null;
let mockDriverEntitlement: any = null;

jest.mock('@/utils/driverProfileImage', () => ({
  buildDriverWithUploadedPhoto: jest.fn(async driver => driver),
}));

jest.mock('@/context/AuthContext', () => ({
  useOptionalAuth: () => mockOptionalAuth,
}));

jest.mock('@/context/DriverEntitlementContext', () => ({
  useOptionalDriverEntitlement: () => mockDriverEntitlement,
}));

jest.mock('@/context/ride/ridePersistence', () => ({
  appendRideHistory: (...args: any[]) => mockAppendRideHistory.apply(null, args),
  loadRideHistory: (...args: any[]) => mockLoadRideHistory.apply(null, args),
}));

jest.mock('@/observability/monitoring', () => ({
  reportOperationalFailure: (...args: unknown[]) => mockReportOperationalFailure(...args),
}));

// Backend + live-socket services are stubbed so the real POST /customer/rides
// and the tracking sockets are deterministic (matching is now backend-driven).
jest.mock('@/services/rides', () => ({
  createRide: jest.fn(async () => ({ rideId: 'backend-ride-1' })),
  cancelRide: jest.fn(async () => undefined),
  // Resume check on mount — no active ride in these scenarios.
  getActiveRide: jest.fn(async () => null),
}));
jest.mock('@/services/customerTrackingSocket', () => ({
  openCustomerTrackingSocket: () => ({ close: jest.fn() }),
}));
jest.mock('@/services/driverTrackingSocket', () => ({
  openDriverSocket: () => ({ close: jest.fn() }),
}));

jest.mock('../commandPipeline/rideCommandPipeline', () => {
  const actual = jest.requireActual('../commandPipeline/rideCommandPipeline');
  return {
    ...actual,
    processRideCommand: (...args: unknown[]) => mockProcessRideCommand(...args),
  };
});

const pickup: RideLocation = {
  address: 'Kimironko Market',
  latitude: -1.9365,
  longitude: 30.1011,
  locationType: 'precise',
};

const destination: RideLocation = {
  address: 'Kigali City Tower',
  latitude: -1.9438,
  longitude: 30.0616,
  locationType: 'precise',
};

function renderRideProvider() {
  return renderHook(() => useRide(), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <RideProvider>{children}</RideProvider>
    ),
  });
}

function resetDriverSession() {
  mockOptionalAuth = null;
  mockDriverEntitlement = null;
}

function setCustomerSession() {
  mockOptionalAuth = {
    user: {
      id: 'customer-1',
      mode: 'customer',
    },
    driverProfile: null,
  };
  mockDriverEntitlement = null;
}

function setApprovedDriverSession() {
  mockOptionalAuth = {
    user: {
      id: 'driver-1',
      mode: 'driver',
    },
    driverProfile: {
      id: 'driver-1',
      isOnline: true,
      isVerified: true,
      verificationStatus: 'approved',
      vehicleType: 'moto',
      plateNumber: 'RAD 001 A',
      licenseNumber: 'LIC001',
      vehicles: [{
        id: 'driver-vehicle:moto:rad-001-a',
        vehicleType: 'moto',
        status: 'approved',
        plateNumber: 'RAD 001 A',
        licenseNumber: 'LIC001',
        submittedAt: '2026-06-08T09:00:00.000Z',
      }],
      activeVehicle: { vehicleId: 'driver-vehicle:moto:rad-001-a' },
    },
  };
  mockDriverEntitlement = {
    entitlement: {
      ...EMPTY_DRIVER_ENTITLEMENT,
      vehicleId: 'driver-vehicle:moto:rad-001-a',
      vehicleType: 'moto',
      remainingRideCredits: 3,
      vehicleEntitlements: [{
        vehicleId: 'driver-vehicle:moto:rad-001-a',
        vehicleType: 'moto',
        activePackageId: null,
        remainingRideCredits: 3,
        remainingBonusRides: 0,
        activations: [],
        creditTransactions: [],
        purchaseHistory: [],
        updatedAt: '2026-06-08T09:00:00.000Z',
        authority: 'local_prototype',
      }],
    },
    deductCreditForCompletedRide: jest.fn(async () => true),
  };
}

// Drives an approved-driver session through a real driver-side assignment
// (incoming request → accept → confirm fare → arrive). Matching is now
// backend-driven, so drivers reach `negotiating` via acceptRideRequest rather
// than the removed local mock-match timer.
async function advanceToArrived(result: ReturnType<typeof renderRideProvider>['result']) {
  await act(async () => {
    result.current.simulateIncomingRideRequest();
  });
  await waitFor(() => expect(result.current.pendingRequest).not.toBeNull());

  act(() => result.current.acceptRideRequest());
  expect(result.current.currentRide?.status).toBe('negotiating');

  act(() => result.current.riderAcceptWithFare(3000));
  expect(result.current.currentRide?.status).toBe('confirmed');

  act(() => result.current.markArrived());
  expect(result.current.currentRide?.status).toBe('arrived');
}

function callThroughRideCommandPipeline(...args: unknown[]) {
  const actual = jest.requireActual('../commandPipeline/rideCommandPipeline') as typeof import('../commandPipeline/rideCommandPipeline');
  return actual.processRideCommand(...(args as Parameters<typeof actual.processRideCommand>));
}

function expectShadowCommandMetadata(command: Record<string, any>, actorRole: 'customer' | 'driver' | 'system') {
  expect(command).toEqual(expect.objectContaining({
    commandId: expect.any(String),
    idempotencyKey: expect.any(String),
    correlationId: expect.any(String),
    actorId: expect.any(String),
    actorRole,
    timestamp: expect.any(String),
  }));
}

function expectShadowTelemetry(action: string, commandType: string) {
  expect(observability.metrics.getPoints()).toEqual(expect.arrayContaining([
    expect.objectContaining({
      name: 'ride.shadow_command.created',
      tags: expect.objectContaining({ action, commandType }),
    }),
    expect.objectContaining({
      name: 'ride.shadow_command.accepted',
      tags: expect.objectContaining({ action, commandType }),
    }),
  ]));
}

describe('ride lifecycle end-to-end shadow verification', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Math, 'random').mockReturnValue(0);
    resetObservabilityForTests();
    rideCommandPipeline.reset();
    rideTransactionBoundary.reset();
    mockProcessRideCommand.mockReset();
    mockProcessRideCommand.mockImplementation(callThroughRideCommandPipeline);
    mockAppendRideHistory.mockClear();
    mockLoadRideHistory.mockClear();
    mockReportOperationalFailure.mockClear();
    resetDriverSession();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
    resetObservabilityForTests();
    rideCommandPipeline.reset();
    rideTransactionBoundary.reset();
  });

  test('request ride still executes live behavior and creates a shadow command', async () => {
    setCustomerSession();
    const { result } = renderRideProvider();

    await act(async () => {
      await result.current.createRide(pickup, destination, 'moto', destination.address);
    });

    expect(result.current.currentRide).toEqual(expect.objectContaining({
      status: 'searching',
      pickup,
      destination,
    }));
    expect(mockProcessRideCommand).toHaveBeenCalledTimes(1);
    const [command, context] = mockProcessRideCommand.mock.calls[0];
    expectShadowCommandMetadata(command as Record<string, any>, 'customer');
    expect((command as any).payload).toEqual(expect.objectContaining({
      rideId: expect.any(String),
      pickup,
      destination,
      vehicleType: 'moto',
    }));
    expect(context).toEqual(expect.objectContaining({ mode: 'shadow' }));
    expect(rideCommandPipeline.getDiagnostics()).toEqual(expect.objectContaining({
      lastRecord: expect.objectContaining({
        commandType: 'ride.request',
        correlationId: (command as any).correlationId,
        preview: null,
      }),
    }));
    expectShadowTelemetry('requestRide', 'ride.request');
    expect(mockAppendRideHistory).not.toHaveBeenCalled();
  });

  test('cancel ride still executes live behavior and creates a shadow command', async () => {
    setCustomerSession();
    const { result } = renderRideProvider();

    await act(async () => {
      await result.current.createRide(pickup, destination, 'moto');
    });
    mockProcessRideCommand.mockClear();
    resetObservabilityForTests();

    await act(async () => {
      await result.current.cancelRide();
    });

    expect(result.current.currentRide).toEqual(expect.objectContaining({
      status: 'cancelled',
    }));
    expect(mockProcessRideCommand).toHaveBeenCalledTimes(1);
    const [command, context] = mockProcessRideCommand.mock.calls[0];
    expectShadowCommandMetadata(command as Record<string, any>, 'customer');
    expect((command as any).payload).toEqual(expect.objectContaining({
      rideId: expect.any(String),
      reason: 'customer_before_acceptance',
      note: null,
    }));
    expect(context).toEqual(expect.objectContaining({ mode: 'shadow' }));
    expectShadowTelemetry('cancelRide', 'ride.cancel');
    expect(mockAppendRideHistory).not.toHaveBeenCalled();
  });

  test('accept ride still executes live behavior and creates a shadow command', async () => {
    setApprovedDriverSession();
    const { result } = renderRideProvider();

    await act(async () => {
      result.current.simulateIncomingRideRequest();
    });
    await waitFor(() => expect(result.current.pendingRequest).toEqual(expect.objectContaining({
      id: expect.any(String),
      status: 'searching',
    })));
    mockProcessRideCommand.mockClear();
    resetObservabilityForTests();

    act(() => result.current.acceptRideRequest());

    expect(result.current.currentRide).toEqual(expect.objectContaining({
      status: 'negotiating',
    }));
    expect(result.current.pendingRequest).toBeNull();
    expect(mockProcessRideCommand).toHaveBeenCalledTimes(1);
    const [command, context] = mockProcessRideCommand.mock.calls[0];
    expectShadowCommandMetadata(command as Record<string, any>, 'driver');
    expect((command as any).payload).toEqual(expect.objectContaining({
      rideId: expect.any(String),
      driverId: 'driver-1',
    }));
    expect(context).toEqual(expect.objectContaining({ mode: 'shadow' }));
    expectShadowTelemetry('acceptRide', 'ride.accept');
  });

  test('decline ride still executes live behavior and creates a shadow command', async () => {
    setApprovedDriverSession();
    const { result } = renderRideProvider();

    await act(async () => {
      result.current.simulateIncomingRideRequest();
    });
    await waitFor(() => expect(result.current.pendingRequest).toEqual(expect.objectContaining({
      id: expect.any(String),
      status: 'searching',
    })));
    mockProcessRideCommand.mockClear();
    resetObservabilityForTests();

    act(() => result.current.declineRideRequest());

    expect(result.current.pendingRequest).toBeNull();
    expect(mockProcessRideCommand).toHaveBeenCalledTimes(1);
    const [command, context] = mockProcessRideCommand.mock.calls[0];
    expectShadowCommandMetadata(command as Record<string, any>, 'driver');
    expect((command as any).payload).toEqual(expect.objectContaining({
      rideId: expect.any(String),
      driverId: 'driver-1',
      reason: null,
    }));
    expect(context).toEqual(expect.objectContaining({ mode: 'shadow' }));
    expect(observability.metrics.getPoints()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'ride.shadow_command.created',
        tags: expect.objectContaining({ action: 'declineRide', commandType: 'ride.decline' }),
      }),
      expect.objectContaining({
        name: 'ride.shadow_command.rejected',
        tags: expect.objectContaining({ action: 'declineRide', commandType: 'ride.decline' }),
      }),
      expect.objectContaining({
        name: 'ride.command.rejected',
        tags: expect.objectContaining({ commandType: 'ride.decline' }),
      }),
    ]));
  });

  test('start ride still executes live behavior, validates through the transaction boundary, and creates a shadow command', async () => {
    setApprovedDriverSession();
    const { result } = renderRideProvider();
    const evaluateSpy = jest.spyOn(rideTransactionBoundary, 'evaluate');

    await advanceToArrived(result);
    mockProcessRideCommand.mockClear();
    resetObservabilityForTests();

    act(() => result.current.startJourney());

    expect(result.current.currentRide?.status).toBe('in_progress');
    expect(evaluateSpy).toHaveBeenCalledTimes(1);
    expect(mockProcessRideCommand).toHaveBeenCalledTimes(1);
    const [command, context] = mockProcessRideCommand.mock.calls[0];
    expectShadowCommandMetadata(command as Record<string, any>, 'driver');
    expect((command as any).payload).toEqual(expect.objectContaining({
      rideId: expect.any(String),
      startedAt: expect.any(String),
      location: null,
    }));
    expect(context).toEqual(expect.objectContaining({ mode: 'shadow' }));
    const preview = evaluateSpy.mock.results[0]?.value?.preview;
    expect(preview).toEqual(expect.objectContaining({
      state: 'Pending',
      statusAfter: 'started',
      phaseAfter: 'active',
    }));
    expectShadowTelemetry('startRide', 'ride.start');
    expect(observability.metrics.getPoints()).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'ride.start_transaction.preview' }),
      expect.objectContaining({ name: 'ride.start_transaction.accepted' }),
    ]));
  });

  test('complete ride still executes live behavior, produces a financial preview, and creates a shadow command', async () => {
    setApprovedDriverSession();
    const { result } = renderRideProvider();
    const previewSpy = jest.spyOn(rideTransactionBoundary, 'preview');
    const evaluateSpy = jest.spyOn(rideTransactionBoundary, 'evaluate');

    await advanceToArrived(result);
    act(() => result.current.startJourney());
    previewSpy.mockClear();
    evaluateSpy.mockClear();
    mockProcessRideCommand.mockClear();
    resetObservabilityForTests();

    act(() => result.current.completeRide('driver', {
      driverId: 'driver-1',
      driverName: 'Test Driver',
      vehicleId: 'driver-vehicle:moto:rad-001-a',
      vehicleType: 'moto',
    }));

    expect(result.current.currentRide).toBeNull();
    expect(previewSpy).toHaveBeenCalledTimes(1);
    expect(evaluateSpy).toHaveBeenCalledTimes(1);
    expect(mockAppendRideHistory).toHaveBeenCalledTimes(1);
    expect(mockProcessRideCommand).toHaveBeenCalledTimes(1);
    const [command, context] = mockProcessRideCommand.mock.calls[0];
    expectShadowCommandMetadata(command as Record<string, any>, 'driver');
    expect((command as any).payload).toEqual(expect.objectContaining({
      rideId: expect.any(String),
      completedAt: expect.any(String),
      location: null,
      distanceKm: null,
      durationSeconds: null,
    }));
    expect(context).toEqual(expect.objectContaining({ mode: 'shadow' }));
    expect(previewSpy.mock.results[0]?.value).toEqual(expect.objectContaining({
      financialPreview: expect.objectContaining({
        mode: 'preview',
        effects: expect.arrayContaining([
          expect.objectContaining({ name: 'fare-settlement' }),
          expect.objectContaining({ name: 'payment-authorization' }),
          expect.objectContaining({ name: 'package-credit-deduction' }),
          expect.objectContaining({ name: 'driver-earnings' }),
          expect.objectContaining({ name: 'customer-receipt' }),
          expect.objectContaining({ name: 'analytics' }),
          expect.objectContaining({ name: 'notifications' }),
        ]),
      }),
    }));
    expectShadowTelemetry('completeRide', 'ride.complete');
    expect(observability.metrics.getPoints()).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'ride.complete_transaction.preview' }),
      expect.objectContaining({ name: 'ride.complete_transaction.financial_preview' }),
      expect.objectContaining({ name: 'ride.complete_transaction.rejected' }),
      expect.objectContaining({ name: 'ride.complete_transaction.duplicate_detected' }),
    ]));
  });

  test('shadow failures never block live ride creation', async () => {
    setCustomerSession();
    mockProcessRideCommand.mockImplementationOnce(() => {
      throw new Error('shadow pipeline failure');
    });
    const { result } = renderRideProvider();

    await act(async () => {
      await result.current.createRide(pickup, destination, 'moto');
    });

    expect(result.current.currentRide).toEqual(expect.objectContaining({
      status: 'searching',
    }));
    expect(mockProcessRideCommand).toHaveBeenCalledTimes(1);
    expect(mockReportOperationalFailure).not.toHaveBeenCalled();
    expect(observability.metrics.getPoints()).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'ride.shadow_command.failed' }),
    ]));
  });
});
