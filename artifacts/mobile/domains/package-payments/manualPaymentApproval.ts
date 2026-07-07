import type { ManualPaymentClaim } from './types';
import type { ManualPaymentReviewActor, ManualPaymentReviewContext } from './manualPaymentReview';
import type { ManualPaymentVerificationEvidence } from './manualPaymentVerification';
import { createManualPaymentReviewIdempotencyKey } from './manualPaymentReview';

export interface ApproveManualPaymentClaimCommand {
  claimId: string;
  expectedClaimVersion: number;
  reviewer: ManualPaymentReviewActor;
  verificationEvidence: ManualPaymentVerificationEvidence;
  idempotencyKey: string;
  requestedAt: string;
}

export interface ManualPaymentApprovalEntitlementSummary {
  packageId: string;
  packageVersion: string;
  vehicleId: string;
  remainingCredits: number;
  bonusCredits: number;
  activatedAt: string;
  expiresAt: string;
  version: number;
}

export interface ManualPaymentApprovalResult {
  claimId: string;
  claimStatus: 'approved';
  claimVersion: number;
  packagePurchaseTransactionId: string;
  packageActivationId: string;
  creditTransactionId: string;
  entitlement: ManualPaymentApprovalEntitlementSummary;
  eventId: string;
}

export interface ManualPaymentApprovalCommandState {
  claim: ManualPaymentClaim;
  context: ManualPaymentReviewContext;
}

export function getManualPaymentApprovalIdempotencyKey(claimId: string) {
  return createManualPaymentReviewIdempotencyKey(claimId, 'approval');
}
