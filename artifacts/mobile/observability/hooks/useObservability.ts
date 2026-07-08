import { useSyncExternalStore } from 'react';
import { observability } from '../context/observabilityContext';

function getSnapshot() {
  return {
    logs: observability.logger.getLogs().length,
    metrics: observability.metrics.getPoints().length,
    traces: observability.tracer.getSpans().length,
    crashes: observability.crash.getReports().length,
    health: observability.health.getSnapshot(),
  };
}

export function useObservability() {
  return useSyncExternalStore(
    () => () => undefined,
    getSnapshot,
    getSnapshot,
  );
}
