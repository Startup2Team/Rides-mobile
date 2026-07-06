import type { ManualPaymentClaimAuditAction, ManualPaymentClaimAuditEntry } from './types';

export function createManualPaymentClaimId(now = new Date()) {
  const year = now.getUTCFullYear();
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `RDP-${year}-${suffix}`;
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
