import { observability, resetObservabilityForTests } from '@/observability/context/observabilityContext';
import { MemoryExporter } from '@/observability/exporters/memoryExporter';
import { registerEventEngineHealth, registerNetworkHealth, registerQueryCacheHealth, registerStorageHealth } from '@/observability/health/defaultHealthChecks';
import { QueryClient } from '@tanstack/react-query';
import { HealthMonitor } from '@/observability/health/healthMonitor';
import { InMemoryEventStore } from '@/events/store/inMemoryEventStore';
import { createDeterministicClock } from '../stress/readinessStress';
import { createReadinessGateResult } from '../types';

export async function runObservabilityReadinessScenario() {
  resetObservabilityForTests();
  const clock = createDeterministicClock();
  const exporter = new MemoryExporter();
  observability.logger.info('readiness.observability.start', { phase: '9F' });
  observability.logger.warn('readiness.observability.warn', { signal: 'diagnostic' });
  observability.metrics.counter('readiness.observability.counter', 1);
  observability.metrics.gauge('readiness.observability.gauge', 1);
  const span = observability.tracer.startSpan('readiness.observability.span');
  const child = observability.tracer.childSpan('readiness.observability.child', observability.tracer.contextFrom(span));
  observability.tracer.endSpan(child.spanId, 'ok');
  observability.tracer.endSpan(span.spanId, 'ok');
  exporter.export(observability.logger.getLogs()[0]);

  const queryClient = new QueryClient();
  const monitor = new HealthMonitor(clock.now);
  const eventStore = new InMemoryEventStore();
  registerNetworkHealth(monitor, () => true);
  registerStorageHealth(monitor, () => true);
  registerEventEngineHealth(monitor, eventStore);
  registerQueryCacheHealth(monitor, queryClient);
  const health = await monitor.run();

  const success =
    observability.logger.getLogs().length >= 2 &&
    observability.metrics.getPoints().length >= 2 &&
    observability.tracer.getSpans().length >= 2 &&
    health.status === 'healthy';

  return createReadinessGateResult(
    'observability',
    success ? 'pass' : 'fail',
    [
      { name: 'logCount', value: observability.logger.getLogs().length, unit: 'logs' },
      { name: 'metricCount', value: observability.metrics.getPoints().length, unit: 'metrics' },
      { name: 'spanCount', value: observability.tracer.getSpans().length, unit: 'spans' },
      { name: 'healthStatus', value: health.status },
    ],
    success ? null : 'Observability logs, metrics, traces, or health checks did not produce expected diagnostics.',
    success
      ? 'Keep structured logging, metrics, tracing, and health checks available before migration.'
      : 'Fix observability instrumentation before moving readiness forward.',
    clock.now,
  );
}
