jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
}));

import { clearOfflineQueueState } from '@/offline/storage/offlineQueueStorage';
import { resetObservabilityForTests } from '@/observability/context/observabilityContext';
import { createStorageReadCorruptionChaos, createStorageWriteFailureChaos, createInvalidEventPayloadChaos, createProjectorExceptionChaos, createReplayFailureChaos } from '../chaos/readinessChaos';
import { createProductionReadinessGateDefinitions } from '../gates/readinessGates';
import { createReadinessReport } from '../reports/readinessReport';
import { runEventPlatformReadinessScenario } from '../scenarios/eventPlatformScenario';
import { runObservabilityReadinessScenario } from '../scenarios/observabilityScenario';
import { runOfflineQueueReadinessScenario } from '../scenarios/offlineQueueScenario';
import { runRealtimeGatewayReadinessScenario } from '../scenarios/realtimeGatewayScenario';
import { runShadowProjectionReadinessScenario } from '../scenarios/shadowProjectionScenario';
import { createReadinessStressProfile, CI_SAFE_READINESS_STRESS_PROFILE } from '../stress/readinessStress';

describe('production readiness gates', () => {
  beforeEach(async () => {
    await clearOfflineQueueState();
    resetObservabilityForTests();
  });

  afterEach(async () => {
    await clearOfflineQueueState();
    resetObservabilityForTests();
  });

  test('defines all production readiness gates', () => {
    const gates = createProductionReadinessGateDefinitions(CI_SAFE_READINESS_STRESS_PROFILE);

    expect(gates.map(gate => gate.gateName)).toEqual([
      'offline_queue',
      'realtime_gateway',
      'event_platform',
      'shadow_ride_projection',
      'observability',
    ]);
    expect(gates.every(gate => typeof gate.description === 'string' && gate.description.length > 0)).toBe(true);
  });

  test('report generator summarizes gate results', () => {
    const report = createReadinessReport([
      {
        gateName: 'offline_queue',
        status: 'pass',
        metrics: [{ name: 'queued', value: 10 }],
        failureReason: null,
        timestamp: '2026-06-29T10:00:00.000Z',
        recommendedAction: 'none',
      },
      {
        gateName: 'realtime_gateway',
        status: 'warn',
        metrics: [{ name: 'reconnectCount', value: 2 }],
        failureReason: 'Intermittent reconnects observed',
        timestamp: '2026-06-29T10:01:00.000Z',
        recommendedAction: 'Investigate network churn',
      },
    ], () => new Date('2026-06-29T10:05:00.000Z'));

    expect(report).toMatchObject({
      generatedAt: '2026-06-29T10:05:00.000Z',
      readinessScore: 75,
      overallStatus: 'warn',
      counts: { pass: 1, warn: 1, fail: 0, total: 2 },
    });
  });

  test('offline queue stress scenario passes on a CI-safe profile', async () => {
    const result = await runOfflineQueueReadinessScenario(createReadinessStressProfile({
      offlineMutations: 20,
    }));

    expect(result.status).toBe('pass');
    expect(result.metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'queued', value: 20 }),
      expect.objectContaining({ name: 'restored', value: true }),
    ]));
  });

  test('realtime reconnect storm passes on a CI-safe profile', async () => {
    const result = await runRealtimeGatewayReadinessScenario(createReadinessStressProfile({
      reconnectStorm: 5,
    }));
    expect(result.status).toBe('pass');
    expect(result.metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'reconnectStorm', value: 5 }),
      expect.objectContaining({ name: 'heartbeatTimedOut', value: true }),
    ]));
  });

  test('event platform replay stress passes on a CI-safe profile', async () => {
    const result = await runEventPlatformReadinessScenario(createReadinessStressProfile({
      domainEvents: 25,
    }));

    expect(result.status).toBe('pass');
    expect(result.metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'eventCount', value: 26 }),
      expect.objectContaining({ name: 'deadLetters', value: expect.any(Number) }),
    ]));
  });

  test('shadow projection gate passes and keeps query cache isolated', () => {
    const result = runShadowProjectionReadinessScenario(createReadinessStressProfile({
      shadowReplayEvents: 3,
    }));

    expect(result.status).toBe('pass');
    expect(result.metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'noQueryMutation', value: true }),
      expect.objectContaining({ name: 'mismatchTelemetryObserved', value: true }),
    ]));
  });

  test('observability gate emits logs, metrics, traces, and health status', async () => {
    const result = await runObservabilityReadinessScenario();

    expect(result.status).toBe('pass');
    expect(result.metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'logCount', value: expect.any(Number) }),
      expect.objectContaining({ name: 'healthStatus', value: 'healthy' }),
    ]));
  });

  test('chaos helpers are deterministic and infrastructure-only', () => {
    expect(() => createStorageWriteFailureChaos().write()).toThrow('storage.write.failure');
    expect(createStorageReadCorruptionChaos().read()).toContain('corrupted');
    expect(createInvalidEventPayloadChaos().create()).toMatchObject({ aggregateType: 'ride' });
    expect(() => createReplayFailureChaos().replay()).toThrow('replay.failure');
    expect(createProjectorExceptionChaos({ register: () => () => undefined } as never)).toBeDefined();
  });
});
