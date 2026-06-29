import { QueryClient } from '@tanstack/react-query';
import { pushFlowScreen } from '@/navigation/navigationPolicy';
import { CrashReporter } from '../crash/crashReporter';
import { MemoryExporter } from '../exporters/memoryExporter';
import { HealthMonitor } from '../health/healthMonitor';
import {
  registerNetworkHealth,
  registerQueryCacheHealth,
  registerStorageHealth,
} from '../health/defaultHealthChecks';
import { Logger } from '../logger/logger';
import { MetricsRegistry } from '../metrics/metrics';
import {
  instrumentQueryClient,
  observeMutationEngine,
  observeRepositoryCall,
} from '../performance/instrumentation';
import { Tracer } from '../tracing/tracer';
import { observability, resetObservabilityForTests } from '../context/observabilityContext';

function createClock() {
  let current = new Date('2026-06-29T10:00:00.000Z');
  return {
    now: () => current,
    advance(ms: number) {
      current = new Date(current.getTime() + ms);
    },
  };
}

describe('observability foundation', () => {
  beforeEach(() => {
    resetObservabilityForTests();
  });

  test('logger writes structured logs and exports without direct console usage', () => {
    const exporter = new MemoryExporter();
    const logger = new Logger({
      exporter,
      now: () => new Date('2026-06-29T10:00:00.000Z'),
      baseContext: { service: 'mobile' },
    });

    const log = logger.error('repository.failure', { repository: 'profile' }, new Error('boom'));

    expect(log).toEqual({
      level: 'error',
      message: 'repository.failure',
      timestamp: '2026-06-29T10:00:00.000Z',
      context: { service: 'mobile', repository: 'profile' },
      error: { name: 'Error', message: 'boom' },
    });
    expect(exporter.getItems()).toEqual([log]);
  });

  test('metrics supports counter, gauge, histogram, timer, and async timing', async () => {
    const clock = createClock();
    const metrics = new MetricsRegistry(clock.now);

    metrics.counter('offline.enqueue');
    metrics.gauge('queue.size', 3);
    metrics.histogram('ride.latency', 42);
    clock.advance(25);
    await metrics.timeAsync('repository.load', async () => {
      clock.advance(75);
    });

    expect(metrics.getPoints().map(point => point.type)).toEqual(['counter', 'gauge', 'histogram', 'timer']);
    expect(metrics.getPoints()[3]).toMatchObject({ name: 'repository.load', value: 75 });
  });

  test('tracing creates trace context and child spans', () => {
    const ids = ['trace-1', 'span-1', 'span-2'];
    const tracer = new Tracer({
      idFactory: () => ids.shift() ?? 'id',
      now: () => new Date('2026-06-29T10:00:00.000Z'),
    });

    const root = tracer.startSpan('mutation.enqueue');
    const child = tracer.childSpan('repository.save', tracer.contextFrom(root));
    tracer.endSpan(child.spanId, 'ok');

    expect(child).toMatchObject({
      traceId: root.traceId,
      parentSpanId: root.spanId,
      correlationId: root.correlationId,
    });
    expect(tracer.getSpans()[1]).toMatchObject({ status: 'ok', endedAt: '2026-06-29T10:00:00.000Z' });
  });

  test('crash reporter is exporter-injected and has no Sentry dependency', () => {
    const exporter = new MemoryExporter();
    const crash = new CrashReporter({
      exporter,
      now: () => new Date('2026-06-29T10:00:00.000Z'),
    });

    const report = crash.report(new TypeError('bad state'), { area: 'query' }, true);

    expect(report).toMatchObject({ errorName: 'TypeError', fatal: true, context: { area: 'query' } });
    expect(exporter.getItems()).toEqual([report]);
  });

  test('health monitor rolls up network, storage, and query cache checks', async () => {
    const monitor = new HealthMonitor(() => new Date('2026-06-29T10:00:00.000Z'));
    const queryClient = new QueryClient();

    registerNetworkHealth(monitor, () => true);
    registerStorageHealth(monitor, () => true);
    registerQueryCacheHealth(monitor, queryClient);

    await expect(monitor.run()).resolves.toEqual({
      status: 'healthy',
      checkedAt: '2026-06-29T10:00:00.000Z',
      checks: {
        network: 'healthy',
        storage: 'healthy',
        query_cache: 'healthy',
      },
    });
  });

  test('instrumentation records repository, query cache, navigation, and mutation metrics', async () => {
    const repositoryCall = observeRepositoryCall('profile', 'load', async (id: string) => ({ id }));
    const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };

    await expect(repositoryCall('user-1')).resolves.toEqual({ id: 'user-1' });
    instrumentQueryClient(new QueryClient());
    pushFlowScreen(router, '/settings');
    observeMutationEngine('enqueue', 'completed');

    expect(router.push).toHaveBeenCalledWith('/settings');
    expect(observability.metrics.getPoints().map(point => point.name)).toEqual(expect.arrayContaining([
      'repository.call',
      'repository.success',
      'query.cache.size',
      'navigation.policy',
      'mutation.engine',
    ]));
    expect(observability.tracer.getSpans()).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'repository.profile.load', status: 'ok' }),
    ]));
  });
});
