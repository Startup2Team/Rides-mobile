import type { ManualPaymentClaim, PackagePaymentFailure, PackagePaymentOutcome } from './types';
import { isManualPaymentClaimExpired } from './manualPaymentExpiryPolicy';

export function getManualPaymentClaimActivationIdempotencyKey(claim: Pick<ManualPaymentClaim, 'id'>) {
  return `manual-payment-claim:${claim.id}:activation`;
}

export function isManualPaymentClaimEligibleForActivation(
  claim: ManualPaymentClaim,
  now = new Date(),
) {
  if (claim.status !== 'approved') return false;
  if (isManualPaymentClaimExpired(claim, now)) return false;
  if (typeof claim.activationId === 'string' && claim.activationId.length > 0) return false;
  if (typeof claim.purchaseTransactionId === 'string' && claim.purchaseTransactionId.length > 0) return false;
  return true;
}

export function assertManualPaymentClaimEligibleForActivation(
  claim: ManualPaymentClaim,
  now = new Date(),
): PackagePaymentOutcome<true> {
  if (!isManualPaymentClaimEligibleForActivation(claim, now)) {
    return {
      data: null,
      failure: {
        code: 'claim_not_activation_eligible',
        message: 'Manual payment claim is not eligible for activation.',
      },
    };
  }
  return { data: true, failure: null };
}
