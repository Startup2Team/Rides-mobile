const mockProcessRideCommand = jest.fn();
const mockLogInfo = jest.fn();
const mockLogWarn = jest.fn();
const mockMetricCounter = jest.fn();

function loadBridge(options: {
  enabled?: boolean;
  mode?: 'disabled' | 'dryRun' | 'shadow' | 'enqueueReady';
  processImpl?: (...args: unknown[]) => unknown;
}): any {
  jest.resetModules();
  mockProcessRideCommand.mockReset();
  mockLogInfo.mockReset();
  mockLogWarn.mockReset();
  mockMetricCounter.mockReset();

  if (options.processImpl) {
    mockProcessRideCommand.mockImplementation(options.processImpl);
  } else {
    mockProcessRideCommand.mockImplementation(() => ({
      accepted: true,
      reason: 'shadow-recorded',
      route: { commandType: 'ride.request' },
    }));
  }

  let module: typeof import('../rideCommandShadowBridge') | null = null;

  jest.isolateModules(() => {
    jest.doMock('../rideCommandPipeline', () => ({
      processRideCommand: (...args: unknown[]) => mockProcessRideCommand(...args),
    }));
    jest.doMock('../rideCommandTypes', () => ({
      ENABLE_RIDE_COMMAND_PIPELINE: options.enabled ?? true,
      ENABLE_RIDE_COMMAND_ENQUEUE: false,
      RIDE_COMMAND_PIPELINE_MODE: options.mode ?? 'shadow',
    }));
    jest.doMock('@/observability/context/observabilityContext', () => ({
      observability: {
        logger: {
          info: (...args: unknown[]) => mockLogInfo(...args),
          warn: (...args: unknown[]) => mockLogWarn(...args),
        },
        metrics: {
          counter: (...args: unknown[]) => mockMetricCounter(...args),
        },
      },
    }));
    module = require('../rideCommandShadowBridge');
  });

  if (!module) {
    throw new Error('Failed to load rideCommandShadowBridge');
  }

  return Object.assign(module as Record<string, unknown>, {
    mockProcessRideCommand,
    mockLogInfo,
    mockLogWarn,
    mockMetricCounter,
  }) as any;
}

describe('rideCommandShadowBridge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test.each([
    ['request', 'shadowWireRequestRideCommand', {
      actorId: 'user-1',
      actorRole: 'customer',
      rideId: 'ride-1',
      pickup: { address: 'Kimironko', latitude: -1.9, longitude: 30.1 },
      destination: { address: 'Kigali', latitude: -1.95, longitude: 30.06 },
      vehicleType: 'moto',
    }],
    ['cancel', 'shadowWireCancelRideCommand', {
      actorId: 'user-1',
      actorRole: 'customer',
      rideId: 'ride-2',
      reason: 'customer_before_acceptance',
      note: null,
    }],
    ['accept', 'shadowWireAcceptRideCommand', {
      actorId: 'driver-1',
      actorRole: 'driver',
      rideId: 'ride-3',
      driverId: 'driver-1',
      vehicleId: 'vehicle-1',
      acceptedFare: 4200,
    }],
    ['decline', 'shadowWireDeclineRideCommand', {
      actorId: 'driver-1',
      actorRole: 'driver',
      rideId: 'ride-4',
      driverId: 'driver-1',
      reason: 'busy',
    }],
    ['start', 'shadowWireStartRideCommand', {
      actorId: 'driver-1',
      actorRole: 'driver',
      rideId: 'ride-6',
      startedAt: '2026-06-30T10:02:00.000Z',
      location: null,
    }],
    ['complete', 'shadowWireCompleteRideCommand', {
      actorId: 'driver-1',
      actorRole: 'driver',
      rideId: 'ride-7',
      completedAt: '2026-06-30T10:12:00.000Z',
      location: null,
      distanceKm: 8.4,
      durationSeconds: 900,
    }],
    ['submit rating', 'shadowWireSubmitRatingCommand', {
      actorId: 'user-1',
      actorRole: 'customer',
      rideId: 'ride-5',
      rating: 5,
      comment: 'Great ride',
      ratedUserId: 'driver-1',
    }],
  ] as const)('creates and dispatches the %s shadow command', (_label, exportName, payload) => {
    const bridge: any = loadBridge({});
    const shadowWire = bridge[exportName];

    shadowWire({
      ...payload,
      correlationId: 'correlation-1',
      timestamp: '2026-06-30T10:00:00.000Z',
      capabilitySnapshot: null,
    } as never);

    expect(mockProcessRideCommand).toHaveBeenCalledTimes(1);
    const [command, context] = mockProcessRideCommand.mock.calls[0];
    expect(command).toEqual(expect.objectContaining({
      actorId: payload.actorId,
      actorRole: payload.actorRole,
      correlationId: 'correlation-1',
      idempotencyKey: expect.any(String),
      timestamp: '2026-06-30T10:00:00.000Z',
    }));
    expect(context).toEqual(expect.objectContaining({
      mode: 'shadow',
    }));
    expect(mockMetricCounter).toHaveBeenCalledWith('ride.shadow_command.created', 1, expect.objectContaining({
      action: expect.any(String),
    }));
    expect(mockMetricCounter).toHaveBeenCalledWith('ride.shadow_command.accepted', 1, expect.any(Object));
  });

  test('skips when the pipeline is disabled', () => {
    const bridge: any = loadBridge({ enabled: false, mode: 'disabled' });

    bridge.shadowWireRequestRideCommand({
      rideId: 'ride-4',
      pickup: { address: 'A', latitude: -1, longitude: 30 },
      destination: { address: 'B', latitude: -1.1, longitude: 30.1 },
      vehicleType: 'moto',
      actorId: 'user-1',
      actorRole: 'customer',
    });

    expect(mockProcessRideCommand).not.toHaveBeenCalled();
    expect(mockMetricCounter).toHaveBeenCalledWith('ride.shadow_command.skipped', 1, expect.objectContaining({
      action: 'requestRide',
    }));
  });

  test('reports failures without throwing into the caller', () => {
    const bridge: any = loadBridge({
      processImpl: () => {
        throw new Error('boom');
      },
    });

    expect(() => bridge.shadowWireSubmitRatingCommand({
      rideId: 'ride-5',
      rating: 4,
      actorId: 'user-1',
      actorRole: 'customer',
    } as never)).not.toThrow();

    expect(mockMetricCounter).toHaveBeenCalledWith('ride.shadow_command.failed', 1, expect.objectContaining({
      action: 'submitRating',
    }));
    expect(mockLogWarn).toHaveBeenCalled();
  });
});
