import { createReadinessReport } from '../reports/readinessReport';
import { runEventPlatformReadinessScenario } from '../scenarios/eventPlatformScenario';
import { runObservabilityReadinessScenario } from '../scenarios/observabilityScenario';
import { runOfflineQueueReadinessScenario } from '../scenarios/offlineQueueScenario';
import { runRealtimeGatewayReadinessScenario } from '../scenarios/realtimeGatewayScenario';
import { runShadowProjectionReadinessScenario } from '../scenarios/shadowProjectionScenario';
import { createReadinessStressProfile } from '../stress/readinessStress';
import type { ReadinessGateDefinition, ReadinessReport, ReadinessStressProfile } from '../types';

export function createProductionReadinessGateDefinitions(
  profile: ReadinessStressProfile = createReadinessStressProfile(),
): ReadinessGateDefinition[] {
  return [
    {
      gateName: 'offline_queue',
      description: 'Validates queue throughput, retry, restore, expiry, pause/resume, and collapse behavior.',
      run: () => runOfflineQueueReadinessScenario(profile),
    },
    {
      gateName: 'realtime_gateway',
      description: 'Validates reconnect, heartbeat, subscription restore, and offline/online transitions.',
      run: () => runRealtimeGatewayReadinessScenario(profile),
    },
    {
      gateName: 'event_platform',
      description: 'Validates event dedupe, stale sequence rejection, replay, ordering, and dead letters.',
      run: () => runEventPlatformReadinessScenario(profile),
    },
    {
      gateName: 'shadow_ride_projection',
      description: 'Validates projector parity, replay, mismatch telemetry, and isolation from UI/query cache state.',
      run: () => runShadowProjectionReadinessScenario(profile),
    },
    {
      gateName: 'observability',
      description: 'Validates structured logs, metrics, tracing, correlation, and health checks.',
      run: () => runObservabilityReadinessScenario(),
    },
  ];
}

export async function runProductionReadinessGates(
  profile: ReadinessStressProfile = createReadinessStressProfile(),
): Promise<ReadinessReport> {
  const gates = createProductionReadinessGateDefinitions(profile);
  const results = await Promise.all(gates.map(gate => gate.run()));
  return createReadinessReport(results);
}
