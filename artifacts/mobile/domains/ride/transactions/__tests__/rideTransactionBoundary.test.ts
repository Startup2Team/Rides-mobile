import type { CapabilitySnapshot } from '@/capabilities';
import { createCompleteRideCommand, createStartRideCommand } from '../../commandCreators';
import { MemoryRideTransactionTelemetry, RideTransactionBoundary, processRideTransaction } from '../index';
import type { ActiveRideReadModel } from '../../readModels';

function capabilitySnapshot(): CapabilitySnapshot {
  return {
    capabilities: {
      canBookRide: false,
      canReceiveRideRequests: true,
      canGoOnline: true,
      canDrive: true,
      canEditProfile: true,
      canManageVehicles: true,
      canBuyPackages: true,
      canUseWallet: false,
      canWithdrawEarnings: false,
      canReceivePayments: false,
      canInviteDrivers: false,
      canOperateFleet: false,
      canUseCorporateBilling: false,
      canViewDriverDashboard: true,
      canViewCustomerTrips: false,
      canSwitchMode: true,
      canBecomeDriver: true,
    },
    state: {
      user: { id: 'driver-1', mode: 'driver' } as never,
      driverProfile: { id: 'driver-1' } as never,
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
}

function pendingDriverCapabilitySnapshot(): CapabilitySnapshot {
  const snapshot = capabilitySnapshot();
  return {
    ...snapshot,
    capabilities: {
      ...snapshot.capabilities,
      canDrive: false,
    },
    state: {
      ...snapshot.state,
      isApprovedDriver: false,
    },
  };
}

function buildRide(status: ActiveRideReadModel['status'], phase: ActiveRideReadModel['phase']): ActiveRideReadModel {
  return {
    rideId: 'ride-1',
    status,
    phase,
    customer: {
      userId: 'customer-1',
      role: 'customer',
      displayName: 'Customer One',
    },
    driver: {
      userId: 'driver-1',
      role: 'driver',
      displayName: 'Driver One',
    },
    pickup: {
      address: 'Kimironko',
      latitude: -1.93,
      longitude: 30.1,
      capturedAt: '2026-06-30T09:55:00.000Z',
    },
    destination: {
      address: 'Kigali City',
      latitude: -1.95,
      longitude: 30.06,
      capturedAt: '2026-06-30T09:55:00.000Z',
    },
    fare: {
      amount: 5000,
      currency: 'RWF',
      source: 'negotiated',
      finalizedAt: null,
    },
    updatedAt: '2026-06-30T10:00:00.000Z',
    sequenceNumber: 6,
    projection: {
      appliedEventIds: [],
    },
  };
}

function startCommand() {
  return createStartRideCommand({
    rideId: 'ride-1',
    startedAt: '2026-06-30T10:02:00.000Z',
    location: null,
  }, {
    actorId: 'driver-1',
    actorRole: 'driver',
    correlationId: 'correlation-1',
    timestamp: '2026-06-30T10:02:00.000Z',
    idempotencyKey: 'ride:ride-1:start:driver-1',
    commandId: 'cmd-start-1',
  });
}

function completeCommand() {
  return createCompleteRideCommand({
    rideId: 'ride-1',
    completedAt: '2026-06-30T10:12:00.000Z',
    location: null,
  }, {
    actorId: 'driver-1',
    actorRole: 'driver',
    correlationId: 'correlation-2',
    timestamp: '2026-06-30T10:12:00.000Z',
    idempotencyKey: 'ride:ride-1:complete:driver-1',
    commandId: 'cmd-complete-1',
  });
}

describe('ride transaction boundary', () => {
  test('creates a preview for start ride without executing anything', () => {
    const telemetry = new MemoryRideTransactionTelemetry();
    const boundary = new RideTransactionBoundary({
      telemetry,
      now: () => new Date('2026-06-30T10:01:00.000Z'),
    });

    const result = boundary.evaluate(startCommand(), {
      currentRide: buildRide('driver_arrived', 'accepted'),
      capabilitySnapshot: capabilitySnapshot(),
      commandSequenceNumber: 7,
      lastSequenceNumber: 6,
    });

    expect(result).toEqual(expect.objectContaining({
      accepted: true,
      state: 'Accepted',
      commandType: 'ride.start',
      preview: expect.objectContaining({
        state: 'Pending',
        statusAfter: 'started',
        phaseAfter: 'active',
        rollbackPlan: expect.objectContaining({
          commandType: 'ride.start',
          hooks: [],
        }),
      }),
    }));
    expect(telemetry.records).toHaveLength(1);
    expect(telemetry.records[0]).toEqual(expect.objectContaining({
      commandType: 'ride.start',
      accepted: true,
    }));
  });

  test('rejects pending driver capability for start ride', () => {
    const boundary = new RideTransactionBoundary();
    const result = boundary.evaluate(startCommand(), {
      currentRide: buildRide('driver_arrived', 'accepted'),
      capabilitySnapshot: pendingDriverCapabilitySnapshot(),
      commandSequenceNumber: 7,
      lastSequenceNumber: 6,
    });

    expect(result.accepted).toBe(false);
    expect(result.validation.issues.some(issue => issue.code === 'capability-denied')).toBe(true);
    expect(result.reason).toBe('capability-denied');
  });

  test('rejects duplicate commands', () => {
    const boundary = new RideTransactionBoundary({ now: () => new Date('2026-06-30T10:01:00.000Z') });
    const command = startCommand();
    const context = {
      currentRide: buildRide('driver_arrived', 'accepted'),
      capabilitySnapshot: capabilitySnapshot(),
      commandSequenceNumber: 7,
      lastSequenceNumber: 6,
    };

    expect(boundary.evaluate(command, context)).toEqual(expect.objectContaining({
      accepted: true,
    }));
    const duplicate = boundary.evaluate(command, context);
    expect(duplicate).toEqual(expect.objectContaining({
      accepted: false,
      duplicate: true,
      state: 'Rejected',
    }));
    expect(duplicate.validation.issues.some(issue => issue.code === 'duplicate-command')).toBe(true);
  });

  test('rejects ordering violations', () => {
    const boundary = new RideTransactionBoundary();
    const result = boundary.evaluate(startCommand(), {
      currentRide: buildRide('driver_arrived', 'accepted'),
      capabilitySnapshot: capabilitySnapshot(),
      commandSequenceNumber: 5,
      lastSequenceNumber: 6,
    });

    expect(result.accepted).toBe(false);
    expect(result.orderingViolation).toBe(true);
    expect(result.validation.issues.some(issue => issue.code === 'ordering-violation')).toBe(true);
  });

  test('rejects invalid ride phase for complete ride', () => {
    const boundary = new RideTransactionBoundary();
    const result = boundary.evaluate(completeCommand(), {
      currentRide: buildRide('driver_arrived', 'accepted'),
      capabilitySnapshot: capabilitySnapshot(),
      commandSequenceNumber: 8,
      lastSequenceNumber: 7,
    });

    expect(result.accepted).toBe(false);
    expect(result.validation.issues.some(issue => issue.code === 'invalid-phase')).toBe(true);
  });

  test('rejects duplicate idempotency keys', () => {
    const boundary = new RideTransactionBoundary();
    const command = startCommand();
    const duplicate = {
      ...command,
      commandId: 'cmd-start-2',
    };

    boundary.evaluate(command, {
      currentRide: buildRide('driver_arrived', 'accepted'),
      capabilitySnapshot: capabilitySnapshot(),
      commandSequenceNumber: 7,
      lastSequenceNumber: 6,
    });

    const result = boundary.evaluate(duplicate, {
      currentRide: buildRide('driver_arrived', 'accepted'),
      capabilitySnapshot: capabilitySnapshot(),
      commandSequenceNumber: 8,
      lastSequenceNumber: 7,
    });

    expect(result.accepted).toBe(false);
    expect(result.validation.issues.some(issue => issue.code === 'duplicate-idempotency')).toBe(true);
  });

  test('rollback plan exposes compensation hooks without invoking them', () => {
    const hook = jest.fn();
    const boundary = new RideTransactionBoundary();
    const plan = boundary.createRollbackPlan(startCommand(), {
      currentRide: buildRide('driver_arrived', 'accepted'),
      compensationHooks: [{
        name: 'release-driver-lock',
        rollback: hook,
      }],
    });

    expect(plan).toEqual(expect.objectContaining({
      transactionId: expect.any(String),
      rideId: 'ride-1',
      commandType: 'ride.start',
      hooks: ['release-driver-lock'],
    }));
    expect(hook).not.toHaveBeenCalled();
  });

  test('exports a shared processor helper', () => {
    const result = processRideTransaction(startCommand(), {
      currentRide: buildRide('driver_arrived', 'accepted'),
      capabilitySnapshot: capabilitySnapshot(),
      commandSequenceNumber: 7,
      lastSequenceNumber: 6,
    });

    expect(result.accepted).toBe(true);
    expect(result.preview).toEqual(expect.objectContaining({
      commandType: 'ride.start',
    }));
  });

  test('rejects missing idempotency keys safely', () => {
    const boundary = new RideTransactionBoundary();
    const command = {
      ...startCommand(),
      idempotencyKey: '',
    };

    const result = boundary.evaluate(command, {
      currentRide: buildRide('driver_arrived', 'accepted'),
      capabilitySnapshot: capabilitySnapshot(),
      commandSequenceNumber: 7,
      lastSequenceNumber: 6,
    });

    expect(result.accepted).toBe(false);
    expect(result.validation.issues.some(issue => issue.field === 'idempotencyKey')).toBe(true);
  });
});
