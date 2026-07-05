import type {
  StagingShadowDomain,
  StagingShadowDomainHealthMetrics,
  StagingShadowHealthEvent,
  StagingShadowEventType,
} from './stagingShadowHealthTypes';

const defaultDomains: StagingShadowDomain[] = ['savedLocations', 'profile'];
const healthState = new Map<StagingShadowDomain, StagingShadowDomainHealthMetrics & { lastUpdatedAt: string | null }>();
const knownDomains = new Set<StagingShadowDomain>(defaultDomains);

function nowIso(now: Date = new Date()) {
  return now.toISOString();
}

function createEmptyMetrics(): StagingShadowDomainHealthMetrics {
  return {
    localOperations: 0,
    shadowAttempts: 0,
    shadowSuccesses: 0,
    shadowFailures: 0,
    timeouts: 0,
    skippedInvalidConfig: 0,
    skippedModeLocal: 0,
    skippedWriteShadowDisabled: 0,
    semanticMismatches: 0,
    shapeMismatches: 0,
    totalLatencyMs: 0,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastMismatchCategory: null,
    lastErrorCategory: null,
    blocked: false,
    blockedReason: null,
  };
}

function getState(domain: StagingShadowDomain) {
  knownDomains.add(domain);
  const current = healthState.get(domain);
  if (current) return current;
  const next = { ...createEmptyMetrics(), lastUpdatedAt: null };
  healthState.set(domain, next);
  return next;
}

function recordLatency(state: ReturnType<typeof getState>, latencyMs?: number) {
  if (typeof latencyMs === 'number' && Number.isFinite(latencyMs)) {
    state.totalLatencyMs += Math.max(0, latencyMs);
  }
}

function recordBlocked(state: ReturnType<typeof getState>, reason: string) {
  state.blocked = true;
  state.blockedReason = reason;
}

function categoryOrFallback(value: string | undefined, fallback: string) {
  return value?.trim() || fallback;
}

function errorCategoryForEvent(event: StagingShadowEventType, statusClass?: string, errorCategory?: string) {
  if (event === 'timeout') return 'timeout';
  if (event === 'skipped_invalid_config') return categoryOrFallback(errorCategory, 'invalid_config');
  if (event === 'skipped_mode_local') return 'mode_local';
  if (event === 'skipped_write_shadow_disabled') return 'write_shadow_disabled';
  if (event === 'shadow_failure') return categoryOrFallback(errorCategory, statusClass ?? 'failure');
  return categoryOrFallback(errorCategory, statusClass ?? 'unknown');
}

export function recordStagingShadowEvent(event: StagingShadowHealthEvent) {
  const state = getState(event.domain);
  const timestamp = event.timestamp ?? nowIso();
  state.lastUpdatedAt = timestamp;

  switch (event.event) {
    case 'local_operation_completed':
      state.localOperations += 1;
      break;
    case 'shadow_attempted':
      state.shadowAttempts += 1;
      break;
    case 'shadow_success':
      state.shadowSuccesses += 1;
      recordLatency(state, event.latencyMs);
      state.lastSuccessAt = timestamp;
      break;
    case 'shadow_failure':
      state.shadowFailures += 1;
      recordLatency(state, event.latencyMs);
      state.lastFailureAt = timestamp;
      state.lastErrorCategory = errorCategoryForEvent(event.event, event.statusClass, event.errorCategory);
      break;
    case 'timeout':
      state.timeouts += 1;
      recordLatency(state, event.latencyMs);
      state.lastFailureAt = timestamp;
      state.lastErrorCategory = 'timeout';
      break;
    case 'semantic_mismatch':
      state.semanticMismatches += 1;
      state.lastMismatchCategory = event.mismatchCategory ?? 'semantic';
      break;
    case 'shape_mismatch':
      state.shapeMismatches += 1;
      state.lastMismatchCategory = event.mismatchCategory ?? 'shape';
      break;
    case 'skipped_invalid_config':
      state.skippedInvalidConfig += 1;
      recordBlocked(state, categoryOrFallback(event.errorCategory, 'invalid_config'));
      break;
    case 'skipped_mode_local':
      state.skippedModeLocal += 1;
      break;
    case 'skipped_write_shadow_disabled':
      state.skippedWriteShadowDisabled += 1;
      break;
    default:
      break;
  }

  healthState.set(event.domain, state);
}

export function getStagingShadowDomainState(domain: StagingShadowDomain) {
  return healthState.get(domain) ?? { ...createEmptyMetrics(), lastUpdatedAt: null };
}

export function getKnownStagingShadowDomains() {
  return [...knownDomains].sort();
}

export function resetStagingShadowHealthMetrics() {
  healthState.clear();
  knownDomains.clear();
  for (const domain of defaultDomains) {
    knownDomains.add(domain);
  }
}
