import type { StagingConnectionChecklistCategory, StagingConnectionItemStatus, StagingConnectionSeverity, StagingConnectionDomain } from './stagingConnectionTypes';

export const stagingConnectionDomains: StagingConnectionDomain[] = ['savedLocations', 'profile'];

export const stagingConnectionCategories: StagingConnectionChecklistCategory[] = [
  'environment',
  'transport',
  'authentication',
  'contracts',
  'dataIsolation',
  'privacy',
  'observability',
  'resilience',
  'rateLimits',
  'rollback',
  'domainReadiness',
];

export const stagingConnectionCriticalCategories = new Set<StagingConnectionChecklistCategory>([
  'environment',
  'transport',
  'authentication',
  'contracts',
  'dataIsolation',
  'privacy',
  'resilience',
  'rateLimits',
  'rollback',
]);

export function isTerminalStatus(status: StagingConnectionItemStatus) {
  return status === 'passed' || status === 'failed' || status === 'blocked' || status === 'not_applicable';
}

export function isFailureStatus(status: StagingConnectionItemStatus) {
  return status === 'failed' || status === 'blocked';
}

export function normalizeSeverity(category: StagingConnectionChecklistCategory, status: StagingConnectionItemStatus): StagingConnectionSeverity {
  if (status === 'blocked' || (stagingConnectionCriticalCategories.has(category) && status === 'failed')) return 'critical';
  if (stagingConnectionCriticalCategories.has(category)) return 'critical';
  return 'warning';
}

export function isUnknownStatus(value: unknown) {
  return value === 'unknown' || value === undefined || value === null;
}

export function isPendingStatus(value: unknown) {
  return value === 'pending';
}

export function booleanStatusToItemStatus(value: unknown) {
  if (value === true) return 'passed';
  if (value === false) return 'blocked';
  return 'unknown';
}

export function confirmedStatusToItemStatus(value: 'unknown' | 'confirmed' | 'failed' | undefined) {
  if (value === 'confirmed') return 'passed';
  if (value === 'failed') return 'failed';
  return 'pending';
}

export function isReadyOverallStatuses(statuses: StagingConnectionItemStatus[]) {
  return statuses.every(status => status === 'passed' || status === 'not_applicable');
}

