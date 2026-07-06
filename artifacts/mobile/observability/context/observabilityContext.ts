import { CrashReporter } from '../crash/crashReporter';
import { HealthMonitor } from '../health/healthMonitor';
import { Logger } from '../logger/logger';
import { MetricsRegistry } from '../metrics/metrics';
import { Tracer } from '../tracing/tracer';

export interface ObservabilityContext {
  logger: Logger;
  metrics: MetricsRegistry;
  tracer: Tracer;
  crash: CrashReporter;
  health: HealthMonitor;
}

export const observability: ObservabilityContext = {
  logger: new Logger({ baseContext: { component: 'mobile' } }),
  metrics: new MetricsRegistry(),
  tracer: new Tracer(),
  crash: new CrashReporter(),
  health: new HealthMonitor(),
};

export function resetObservabilityForTests() {
  observability.logger.clear();
  observability.metrics.clear();
  observability.tracer.clear();
  observability.crash.clear();
}
