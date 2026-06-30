import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { observability } from '../context/observabilityContext';

function serializeKey(key: QueryKey) {
  return key.map(part => typeof part === 'string' ? part : JSON.stringify(part)).join('.');
}

export function observeQueryStart(queryKey: QueryKey) {
  observability.metrics.counter('query.start', 1, { queryKey: serializeKey(queryKey) });
}

export function observeQuerySuccess(queryKey: QueryKey) {
  observability.metrics.counter('query.success', 1, { queryKey: serializeKey(queryKey) });
}

export function observeQueryError(queryKey: QueryKey, error: unknown) {
  observability.metrics.counter('query.error', 1, { queryKey: serializeKey(queryKey) });
  observability.logger.warn('query.error', { queryKey: serializeKey(queryKey), errorType: error instanceof Error ? error.name : typeof error });
}

export function observeRepositoryCall<TArgs extends unknown[], TResult>(
  repository: string,
  operation: string,
  fn: (...args: TArgs) => Promise<TResult>,
) {
  return async (...args: TArgs) => {
    const span = observability.tracer.startSpan(`repository.${repository}.${operation}`, null, { repository, operation });
    observability.metrics.counter('repository.call', 1, { repository, operation });
    try {
      const result = await fn(...args);
      observability.tracer.endSpan(span.spanId, 'ok');
      observability.metrics.counter('repository.success', 1, { repository, operation });
      return result;
    } catch (error) {
      observability.tracer.endSpan(span.spanId, 'error');
      observability.metrics.counter('repository.error', 1, { repository, operation });
      throw error;
    }
  };
}

export function instrumentQueryClient(queryClient: QueryClient) {
  observability.metrics.gauge('query.cache.size', queryClient.getQueryCache().getAll().length);
  return queryClient;
}

export function observeNavigation(action: string, target: unknown) {
  observability.metrics.counter('navigation.policy', 1, { action });
  observability.logger.debug('navigation.policy', { action, target: typeof target === 'string' ? target : 'object' });
}

export function observeMutationEngine(action: string, status: 'started' | 'completed' | 'failed' = 'started') {
  observability.metrics.counter('mutation.engine', 1, { action, status });
}
