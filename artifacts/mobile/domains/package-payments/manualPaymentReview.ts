import type { ManualPaymentClaim } from './types';
import type { ManualPaymentVerificationEvidence } from './manualPaymentVerification';

export type ManualPaymentReviewDecision =
  | 'request_clarification'
  | 'approve'
  | 'reject';

export interface ManualPaymentReviewActor {
  actorId: string;
  actorType: 'admin' | 'support';
}

export interface ManualPaymentReviewContext {
  claimId: string;
  expectedClaimVersion: number;
  actor: ManualPaymentReviewActor;
  reviewedAt: string;
}

export interface ManualPaymentClarificationDecisionInput {
  context: ManualPaymentReviewContext;
  message: string;
  reasonCode?: string;
}

export interface ManualPaymentRejectionDecisionInput {
  context: ManualPaymentReviewContext;
  reasonCode: string;
  message?: string;
}

export interface ManualPaymentApprovalDecisionInput {
  context: ManualPaymentReviewContext;
  verificationEvidence: ManualPaymentVerificationEvidence;
  idempotencyKey: string;
}

export interface ManualPaymentClaimReviewProjection extends Pick<
  ManualPaymentClaim,
  | 'id'
  | 'version'
  | 'status'
  | 'expiresAt'
  | 'activationId'
  | 'purchaseTransactionId'
  | 'driverId'
  | 'vehicleId'
  | 'vehicleType'
  | 'offerId'
  | 'packageId'
  | 'packageVersion'
  | 'packageName'
  | 'expectedAmountRwf'
  | 'provider'
  | 'merchantCodeSnapshot'
  | 'payerPhoneNumber'
  | 'transactionReference'
> {}

export interface ManualPaymentReviewEligibilityOptions {
  expectedClaimVersion?: number;
  now?: Date;
  requiresTransactionReference?: boolean;
  requiresProofImage?: boolean;
}

export interface ManualPaymentReviewFailure {
  code:
    | 'claim_version_conflict'
    | 'claim_not_reviewable'
    | 'claim_not_approvable'
    | 'invalid_verification_evidence'
    | 'verification_provider_mismatch'
    | 'payment_amount_not_matched'
    | 'provider_reference_not_matched'
    | 'approval_already_completed'
    | 'idempotency_conflict';
  message: string;
  details?: Record<string, string | number | boolean | null | undefined>;
}

export function createManualPaymentReviewIdempotencyKey(claimId: string, action: 'approval' | 'activation' | 'purchase' | 'credits' | 'approved-event') {
  return `manual-payment-claim:${claimId}:${action}`;
}
