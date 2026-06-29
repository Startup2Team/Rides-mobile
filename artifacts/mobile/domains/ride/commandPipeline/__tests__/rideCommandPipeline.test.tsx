import { QueryClient } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';
import React from 'react';
import { RideProvider, useRide } from '@/context/ride/RideProvider';
import { resetObservabilityForTests, observability } from '@/observability/context/observabilityContext';
import {
  createAcceptRideCommand,
  createRequestRideCommand,
  createSubmitRatingCommand,
} from '../../commandCreators';
import {
  ENABLE_RIDE_COMMAND_ENQUEUE,
  ENABLE_RIDE_COMMAND_PIPELINE,
} from '../rideCommandTypes';
import { processRideCommand, rideCommandPipeline } from '../rideCommandPipeline';
import { rideCommandRoutes, toOfflineMutationPreview } from '../rideCommandRouter';
import { rideHistoryRepository } from '../../repository';

jest.mock('../../repository', () => ({
  rideHistoryRepository: {
    listRideHistory: jest.fn(),
    getRideDetail: jest.fn(),
  },
}));

const originalNodeEnv = process.env.NODE_ENV;
const environment = process.env as Record<string, string | undefined>;

const pickup = { address: 'Kimironko', latitude: -1.9, longitude: 30.1, locationType: 'precise' as const };
const destination = { address: 'Kigali', latitude: -1.95, longitude: 30.06, locationType: 'precise' as const };
const customerCap = {
  capabilities: {
    canBookRide: true,
    canReceiveRideRequests: false,
    canGoOnline: false,
    canDrive: false,
    canEditProfile: true,
    canManageVehicles: false,
    canBuyPackages: false,
    canUseWallet: true,
    canWithdrawEarnings: false,
    canReceivePayments: false,
    canInviteDrivers: false,
    canOperateFleet: false,
    canUseCorporateBilling: false,
    canViewDriverDashboard: false,
    canViewCustomerTrips: true,
    canSwitchMode: true,
    canBecomeDriver: true,
  },
  state: {
    user: { id: 'customer-1' },
    driverProfile: null,
    driverEntitlement: null,
    vehicles: [],
    mode: 'customer',
    isAuthenticated: true,
    isApprovedDriver: false,
    hasApprovedVehicle: false,
    hasActiveVehicle: false,
    hasRideCredits: false,
  },
  mode: 'customer',
};
const approvedDriverCap = {
  capabilities: {
    canBookRide: true,
    canReceiveRideRequests: true,
    canGoOnline: true,
    canDrive: true,
    canEditProfile: true,
    canManageVehicles: true,
    canBuyPackages: true,
    canUseWallet: true,
    canWithdrawEarnings: false,
    canReceivePayments: true,
    canInviteDrivers: false,
    canOperateFleet: false,
    canUseCorporateBilling: false,
    canViewDriverDashboard: true,
    canViewCustomerTrips: true,
    canSwitchMode: true,
    canBecomeDriver: false,
  },
  state: {
    user: { id: 'driver-1' },
    driverProfile: { id: 'driver-1', isOnline: true } as any,
    driverEntitlement: null,
    vehicles: [],
    mode: 'driver',
    isAuthenticated: true,
    isApprovedDriver: true,
    hasApprovedVehicle: true,
    hasActiveVehicle: true,
    hasRideCredits: true,
  },
  mode: 'driver',
};
const pendingDriverCap = {
  ...approvedDriverCap,
  capabilities: {
    ...approvedDriverCap.capabilities,
    canDrive: false,
    canReceiveRideRequests: false,
  },
  state: {
    ...approvedDriverCap.state,
    isApprovedDriver: false,
    hasRideCredits: false,
  },
};

describe('ride command pipeline', () => {
  beforeEach(() => {
    resetObservabilityForTests();
    rideCommandPipeline.reset();
  });

  afterEach(() => {
    resetObservabilityForTests();
    rideCommandPipeline.reset();
    environment.NODE_ENV = originalNodeEnv;
    jest.resetModules();
  });

  test('valid command is accepted in dryRun mode', () => {
    const command = createRequestRideCommand({
      rideId: 'ride-1',
      pickup,
      destination,
      vehicleType: 'moto',
    }, {
      actorId: 'customer-1',
      actorRole: 'customer',
      correlationId: 'correlation-1',
      idFactory: () => 'command-1',
      timestamp: '2026-06-30T10:00:00.000Z',
    });

    const result = processRideCommand(command, { mode: 'dryRun', capabilitySnapshot: customerCap as any });

    expect(result.accepted).toBe(true);
    expect(result.reason).toBe('dry-run');
    expect(result.preview).toBeNull();
    expect(observability.metrics.getPoints().map(point => point.name)).toEqual(expect.arrayContaining([
      'ride.command.validated',
      'ride.command.dry_run',
    ]));
  });

  test('invalid command is rejected', () => {
    const command = createRequestRideCommand({
      rideId: 'ride-1',
      pickup,
      destination,
      vehicleType: 'moto',
    }, {
      actorId: 'customer-1',
      actorRole: 'customer',
      correlationId: 'correlation-1',
      idFactory: () => 'command-1',
      timestamp: '2026-06-30T10:00:00.000Z',
    });
    command.payload = {
      ...command.payload,
      pickup: { ...command.payload.pickup, latitude: 'bad' as any },
    };

    const result = processRideCommand(command, { mode: 'dryRun', capabilitySnapshot: customerCap as any });

    expect(result.accepted).toBe(false);
    expect(result.validation.valid).toBe(false);
    expect(result.reason).toBe('invalid');
    expect(observability.logger.getLogs().map(log => log.message)).toEqual(expect.arrayContaining([
      'RideCommandValidated',
      'RideCommandRejected',
    ]));
  });

  test('missing idempotencyKey is rejected', () => {
    const command = createRequestRideCommand({
      rideId: 'ride-1',
      pickup: { ...pickup },
      destination: { ...destination },
      vehicleType: 'moto',
    }, {
      actorId: 'customer-1',
      actorRole: 'customer',
      correlationId: 'correlation-1',
      idFactory: () => 'command-1',
      timestamp: '2026-06-30T10:00:00.000Z',
    });
    delete (command as any).idempotencyKey;

    const result = processRideCommand(command, { mode: 'dryRun', capabilitySnapshot: customerCap as any });

    expect(result.accepted).toBe(false);
    expect(result.validation.issues.some(issue => issue.field === 'idempotencyKey')).toBe(true);
  });

  test('missing correlationId is handled and propagated', () => {
    const command = createRequestRideCommand({
      rideId: 'ride-1',
      pickup: { ...pickup },
      destination: { ...destination },
      vehicleType: 'moto',
    }, {
      actorId: 'customer-1',
      actorRole: 'customer',
      idFactory: () => 'command-1',
      timestamp: '2026-06-30T10:00:00.000Z',
    });
    delete (command as any).correlationId;

    const result = processRideCommand(command, { mode: 'shadow', capabilitySnapshot: customerCap as any });

    expect(result.command.correlationId).toEqual(expect.stringMatching(/^ride_correlation_/));
    expect(result.accepted).toBe(true);
  });

  test('customer request ride is allowed', () => {
    const command = createRequestRideCommand({
      rideId: 'ride-1',
      pickup: { ...pickup },
      destination: { ...destination },
      vehicleType: 'moto',
    }, {
      actorId: 'customer-1',
      actorRole: 'customer',
      correlationId: 'correlation-1',
      idFactory: () => 'command-1',
      timestamp: '2026-06-30T10:00:00.000Z',
    });

    const result = processRideCommand(command, { mode: 'shadow', capabilitySnapshot: customerCap as any });

    expect(result.accepted).toBe(true);
    expect(result.policy?.allowed).toBe(true);
  });

  test('pending driver accept is denied and approved driver accept is allowed', () => {
    const command = createAcceptRideCommand({
      rideId: 'ride-1',
      driverId: 'driver-1',
    }, {
      actorId: 'driver-1',
      actorRole: 'driver',
      correlationId: 'correlation-1',
      idFactory: () => 'accept-command',
      timestamp: '2026-06-30T10:00:00.000Z',
    });

    const denied = processRideCommand(command, { mode: 'dryRun', capabilitySnapshot: pendingDriverCap as any });
    const allowed = processRideCommand(command, { mode: 'dryRun', capabilitySnapshot: approvedDriverCap as any });

    expect(denied.accepted).toBe(false);
    expect(denied.reason).toBe('policy-denied');
    expect(allowed.accepted).toBe(true);
    expect(allowed.policy?.allowed).toBe(true);
  });

  test('commands are non-collapsible', () => {
    expect(rideCommandRoutes.requestRide.collapsible).toBe(false);
    expect(rideCommandRoutes.cancelRide.collapsible).toBe(false);
    expect(rideCommandRoutes.acceptRide.collapsible).toBe(false);
    expect(rideCommandRoutes.declineRide.collapsible).toBe(false);
    expect(rideCommandRoutes.startRide.collapsible).toBe(false);
    expect(rideCommandRoutes.completeRide.collapsible).toBe(false);
    expect(rideCommandRoutes.submitRating.collapsible).toBe(false);
  });

  test('offline mutation preview has the expected shape', () => {
    const command = createRequestRideCommand({
      rideId: 'ride-1',
      pickup: { ...pickup },
      destination: { ...destination },
      vehicleType: 'moto',
    }, {
      actorId: 'customer-1',
      actorRole: 'customer',
      correlationId: 'correlation-1',
      idFactory: () => 'command-1',
      timestamp: '2026-06-30T10:00:00.000Z',
    });
    const preview = toOfflineMutationPreview(command, rideCommandRoutes.requestRide, () => new Date('2026-06-30T10:00:00.000Z'));

    expect(preview).toMatchObject({
      id: 'command-1',
      idempotencyKey: 'ride:ride-1:request:customer-1',
      type: 'ride.command.request',
      commandType: 'ride.request',
      priority: 'high',
      collapseStrategy: 'none',
      collapseKey: null,
    });
    expect(preview.expiresAt).toBe('2026-07-01T10:00:00.000Z');
  });

  test('production default is disabled', () => {
    environment.NODE_ENV = 'production';
    jest.isolateModules(() => {
      const module = require('../rideCommandTypes') as typeof import('../rideCommandTypes');
      expect(module.ENABLE_RIDE_COMMAND_PIPELINE).toBe(false);
      expect(module.RIDE_COMMAND_PIPELINE_MODE).toBe('disabled');
      expect(module.ENABLE_RIDE_COMMAND_ENQUEUE).toBe(false);
    });
  });

  test('enqueue is disabled by default', () => {
    expect(ENABLE_RIDE_COMMAND_ENQUEUE).toBe(false);
    expect(ENABLE_RIDE_COMMAND_PIPELINE).toBe(process.env.NODE_ENV !== 'production');
  });

  test('no RideProvider mutation, query cache mutation, or repository calls', () => {
    const client = new QueryClient();
    const listSpy = jest.spyOn(rideHistoryRepository, 'listRideHistory');
    const detailSpy = jest.spyOn(rideHistoryRepository, 'getRideDetail');
    const wrapper = ({ children }: { children: React.ReactNode }) => <RideProvider>{children}</RideProvider>;

    const { result } = renderHook(() => {
      const ride = useRide();
      return ride;
    }, { wrapper });

    const beforeRide = result.current.currentRide;
    const beforeHistory = result.current.rideHistory;
    const beforePending = result.current.pendingRequest;
    const beforeQueries = client.getQueryCache().getAll();

    const command = createSubmitRatingCommand({
      rideId: 'ride-1',
      rating: 5,
    }, {
      actorId: 'customer-1',
      actorRole: 'customer',
      correlationId: 'correlation-1',
      idFactory: () => 'rating-command',
      timestamp: '2026-06-30T10:00:00.000Z',
    });
    processRideCommand(command, { mode: 'shadow', capabilitySnapshot: customerCap as any });

    expect(result.current.currentRide).toBe(beforeRide);
    expect(result.current.rideHistory).toBe(beforeHistory);
    expect(result.current.pendingRequest).toBe(beforePending);
    expect(client.getQueryCache().getAll()).toEqual(beforeQueries);
    expect(listSpy).not.toHaveBeenCalled();
    expect(detailSpy).not.toHaveBeenCalled();
  });
});
