import { observability } from '@/observability/context/observabilityContext';

export type RepositoryResolverMode = 'LOCAL' | 'REMOTE' | 'HYBRID' | 'SHADOW_REMOTE';

export interface RepositoryResolutionContext<T> {
  repository: string;
  method: string;
  local: () => Promise<T>;
  remote: () => Promise<T>;
}

export interface RepositoryResolutionResult<T> {
  mode: RepositoryResolverMode;
  source: 'local' | 'remote' | 'hybrid' | 'shadow_remote';
  value: T;
}

export interface RepositoryShadowMetrics {
  repository: string;
  method: string;
  transport: 'local' | 'remote' | 'hybrid' | 'shadow_remote';
  latencyMs: number;
  result: 'success' | 'error' | 'ignored' | 'fallback';
  fallback: boolean;
  retry: boolean;
  responseShape: string;
}

function summarizeShape(value: unknown) {
  if (Array.isArray(value)) return `array:${value.length}`;
  if (value === null) return 'null';
  if (typeof value === 'object') return `object:${Object.keys(value as Record<string, unknown>).length}`;
  return typeof value;
}

function recordTelemetry(metrics: RepositoryShadowMetrics) {
  observability.metrics.counter('repository.remote.attempt', 1, {
    repository: metrics.repository,
    method: metrics.method,
    transport: metrics.transport,
    result: metrics.result,
    fallback: String(metrics.fallback),
    retry: String(metrics.retry),
  });
  observability.metrics.histogram('repository.remote.latency_ms', metrics.latencyMs, {
    repository: metrics.repository,
    method: metrics.method,
    transport: metrics.transport,
  });
  observability.logger.info('RepositoryRemoteAttempt', {
    repository: metrics.repository,
    method: metrics.method,
    transport: metrics.transport,
    latencyMs: metrics.latencyMs,
    result: metrics.result,
    fallback: metrics.fallback,
    retry: metrics.retry,
    responseShape: metrics.responseShape,
  });
}

async function runShadowRemote<T>(context: RepositoryResolutionContext<T>): Promise<RepositoryResolutionResult<T>> {
  const localStartedAt = Date.now();
  const localValue = await context.local();
  recordTelemetry({
    repository: context.repository,
    method: context.method,
    transport: 'shadow_remote',
    latencyMs: Date.now() - localStartedAt,
    result: 'success',
    fallback: false,
    retry: false,
    responseShape: summarizeShape(localValue),
  });

  const remoteStartedAt = Date.now();
  try {
    const remoteValue = await context.remote();
    recordTelemetry({
      repository: context.repository,
      method: context.method,
      transport: 'shadow_remote',
      latencyMs: Date.now() - remoteStartedAt,
      result: 'ignored',
      fallback: false,
      retry: false,
      responseShape: summarizeShape(remoteValue),
    });
  } catch (error) {
    recordTelemetry({
      repository: context.repository,
      method: context.method,
      transport: 'shadow_remote',
      latencyMs: Date.now() - remoteStartedAt,
      result: 'error',
      fallback: false,
      retry: false,
      responseShape: summarizeShape(error),
    });
  }

  return {
    mode: 'SHADOW_REMOTE',
    source: 'local',
    value: localValue,
  };
}

async function runHybrid<T>(context: RepositoryResolutionContext<T>): Promise<RepositoryResolutionResult<T>> {
  const localStartedAt = Date.now();
  try {
    const localValue = await context.local();
    recordTelemetry({
      repository: context.repository,
      method: context.method,
      transport: 'hybrid',
      latencyMs: Date.now() - localStartedAt,
      result: 'success',
      fallback: false,
      retry: false,
      responseShape: summarizeShape(localValue),
    });
    return {
      mode: 'HYBRID',
      source: 'local',
      value: localValue,
    };
  } catch (localError) {
    recordTelemetry({
      repository: context.repository,
      method: context.method,
      transport: 'hybrid',
      latencyMs: Date.now() - localStartedAt,
      result: 'fallback',
      fallback: true,
      retry: false,
      responseShape: summarizeShape(localError),
    });
    const remoteStartedAt = Date.now();
    try {
      const remoteValue = await context.remote();
      recordTelemetry({
        repository: context.repository,
        method: context.method,
        transport: 'hybrid',
        latencyMs: Date.now() - remoteStartedAt,
        result: 'success',
        fallback: true,
        retry: false,
        responseShape: summarizeShape(remoteValue),
      });
      return {
        mode: 'HYBRID',
        source: 'remote',
        value: remoteValue,
      };
    } catch (remoteError) {
      recordTelemetry({
        repository: context.repository,
        method: context.method,
        transport: 'hybrid',
        latencyMs: Date.now() - remoteStartedAt,
        result: 'error',
        fallback: true,
        retry: false,
        responseShape: summarizeShape(remoteError),
      });
      throw remoteError;
    }
  }
}

export class RepositoryResolver {
  constructor(private readonly mode: RepositoryResolverMode = 'LOCAL') {}

  getMode() {
    return this.mode;
  }

  async resolve<T>(context: RepositoryResolutionContext<T>): Promise<RepositoryResolutionResult<T>> {
    if (this.mode === 'REMOTE') {
      const startedAt = Date.now();
      const value = await context.remote();
      recordTelemetry({
        repository: context.repository,
        method: context.method,
        transport: 'remote',
        latencyMs: Date.now() - startedAt,
        result: 'success',
        fallback: false,
        retry: false,
        responseShape: summarizeShape(value),
      });
      return {
        mode: 'REMOTE',
        source: 'remote',
        value,
      };
    }

    if (this.mode === 'HYBRID') {
      return runHybrid(context);
    }

    if (this.mode === 'SHADOW_REMOTE') {
      return runShadowRemote(context);
    }

    const startedAt = Date.now();
    const value = await context.local();
    recordTelemetry({
      repository: context.repository,
      method: context.method,
      transport: 'local',
      latencyMs: Date.now() - startedAt,
      result: 'success',
      fallback: false,
      retry: false,
      responseShape: summarizeShape(value),
    });
    return {
      mode: 'LOCAL',
      source: 'local',
      value,
    };
  }
}

export const repositoryResolver = new RepositoryResolver();
