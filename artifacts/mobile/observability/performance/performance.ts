import type { MetricsRegistry } from '../metrics/metrics';
import type { Tracer } from '../tracing/tracer';

export async function instrumentAsync<T>(
  name: string,
  fn: () => Promise<T>,
  options: { metrics: MetricsRegistry; tracer: Tracer; attributes?: Record<string, unknown> },
) {
  const span = options.tracer.startSpan(name, null, options.attributes);
  return options.metrics.timeAsync(name, async () => {
    try {
      const result = await fn();
      options.tracer.endSpan(span.spanId, 'ok');
      return result;
    } catch (error) {
      options.tracer.endSpan(span.spanId, 'error');
      throw error;
    }
  });
}
