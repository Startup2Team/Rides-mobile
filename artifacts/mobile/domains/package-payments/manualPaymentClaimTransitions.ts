import { createManualPaymentClaimAuditEntry } from './manualPaymentClaimHelpers';
import {
  type ManualPaymentClaim,
  type ManualPaymentClaimStatus,
  type PackagePaymentFailure,
  type PackagePaymentOutcome,
} from './types';

const TRANSITIONS: Record<ManualPaymentClaimStatus, ManualPaymentClaimStatus[]> = {
  draft: ['submitted', 'cancelled', 'expired'],
  submitted: ['pending_review', 'cancelled', 'expired'],
  pending_review: ['needs_clarification', 'approved', 'rejected', 'expired'],
  needs_clarification: ['pending_review', 'cancelled', 'expired'],
  approved: [],
  rejected: [],
  expired: [],
  cancelled: [],
};

export function canTransitionManualPaymentClaim(
  from: ManualPaymentClaimStatus,
  to: ManualPaymentClaimStatus,
) {
  return TRANSITIONS[from].includes(to);
}

export function assertManualPaymentClaimTransition(
  from: ManualPaymentClaimStatus,
  to: ManualPaymentClaimStatus,
): PackagePaymentFailure | null {
  return canTransitionManualPaymentClaim(from, to)
    ? null
    : {
        code: 'invalid_claim_transition',
        message: `Cannot transition manual payment claim from ${from} to ${to}.`,
      };
}

export function transitionManualPaymentClaim(
  claim: ManualPaymentClaim,
  nextStatus: ManualPaymentClaimStatus,
  input: {
    at?: string;
    actorType?: 'driver' | 'admin' | 'support' | 'system';
    actorId?: string;
    reasonCode?: string;
  } = {},
): PackagePaymentOutcome<ManualPaymentClaim> {
  const failure = assertManualPaymentClaimTransition(claim.status, nextStatus);
  if (failure) return { data: null, failure };

  const at = input.at ?? new Date().toISOString();
  const auditActionByStatus: Record<ManualPaymentClaimStatus, Parameters<typeof createManualPaymentClaimAuditEntry>[0]['action'] | null> = {
    draft: null,
    submitted: 'claim_submitted',
    pending_review: 'review_started',
    needs_clarification: 'clarification_requested',
    approved: 'claim_approved',
    rejected: 'claim_rejected',
    expired: 'claim_expired',
    cancelled: 'claim_cancelled',
  };

  const action = auditActionByStatus[nextStatus];
  const nextClaim: ManualPaymentClaim = {
    ...claim,
    status: nextStatus,
    reviewedAt: nextStatus === 'approved' || nextStatus === 'rejected' || nextStatus === 'needs_clarification' ? at : claim.reviewedAt,
    reviewedBy: (nextStatus === 'approved' || nextStatus === 'rejected' || nextStatus === 'needs_clarification') ? input.actorId ?? claim.reviewedBy : claim.reviewedBy,
    auditLog: action
      ? [
          ...claim.auditLog,
          createManualPaymentClaimAuditEntry({
            claimId: claim.id,
            at,
            actorType: input.actorType ?? 'system',
            actorId: input.actorId,
            action,
            reasonCode: input.reasonCode,
          }),
        ]
      : claim.auditLog,
  };
  return { data: nextClaim, failure: null };
}
