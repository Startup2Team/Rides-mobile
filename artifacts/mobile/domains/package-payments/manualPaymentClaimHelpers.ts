import type { ManualPaymentClaimAuditAction, ManualPaymentClaimAuditEntry } from './types';
import type { ManualPaymentClaimReadModel } from './manualPaymentClaimReadModel';

export function createManualPaymentClaimId(now = new Date()) {
  const year = now.getUTCFullYear();
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `RDP-${year}-${suffix}`;
}

export function bumpManualPaymentClaimVersion(version: number) {
  return Number.isInteger(version) && version > 0 ? version + 1 : 1;
}

export function createManualPaymentClaimAuditEntry(input: {
  claimId: string;
  at: string;
  actorType: ManualPaymentClaimAuditEntry['actorType'];
  actorId?: string;
  action: ManualPaymentClaimAuditAction;
  reasonCode?: string;
}): ManualPaymentClaimAuditEntry {
  return {
    id: `${input.claimId}:${input.action}:${input.at}`,
    at: input.at,
    actorType: input.actorType,
    actorId: input.actorId,
    action: input.action,
    reasonCode: input.reasonCode,
  };
}

export function selectRelevantManualPaymentClaim(
  claims: ManualPaymentClaimReadModel[],
  packageId: string,
  vehicleId: string
): ManualPaymentClaimReadModel | null {
  const relevant = claims.filter(
    claim =>
      claim.packageId === packageId &&
      claim.vehicleId === vehicleId &&
      ['submitted', 'pending_review', 'needs_clarification'].includes(claim.status)
  );

  if (relevant.length === 0) {
    return null;
  }

  // Sort by updatedAt or createdAt (latest first) to choose the latest one.
  return relevant.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

