import { isManualPaymentClaimExpired } from './manualPaymentExpiryPolicy';
import { createManualPaymentReviewIdempotencyKey } from './manualPaymentReview';
import type { ManualPaymentClaim, PackagePaymentFailure, PackagePaymentOutcome } from './types';
import { validateManualPaymentVerificationEvidence } from './manualPaymentVerification';

function success<T>(data: T): PackagePaymentOutcome<T> {
  return { data, failure: null };
}

function fail<T>(
  code: PackagePaymentFailure['code'],
  message: string,
  details?: PackagePaymentFailure['details'],
): PackagePaymentOutcome<T> {
  return { data: null, failure: { code, message, details } };
}

function isPositiveWholeNumber(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function hasNonEmptyString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function canStartManualPaymentReview(
  claim: Pick<ManualPaymentClaim, 'status' | 'expiresAt'>,
  now = new Date(),
) {
  return claim.status === 'pending_review' && !isManualPaymentClaimExpired(claim, now);
}

export function canRequestManualPaymentClarification(
  claim: Pick<ManualPaymentClaim, 'status' | 'expiresAt'>,
  now = new Date(),
) {
  return claim.status === 'pending_review' && !isManualPaymentClaimExpired(claim, now);
}

export function canApproveManualPaymentClaim(
  claim: Pick<ManualPaymentClaim, 'id' | 'version' | 'status' | 'expiresAt' | 'activationId' | 'purchaseTransactionId' | 'driverId' | 'vehicleId' | 'vehicleType' | 'offerId' | 'packageId' | 'packageVersion' | 'packageName' | 'expectedAmountRwf' | 'provider' | 'merchantCodeSnapshot' | 'payerPhoneNumber' | 'transactionReference'>,
  options: {
    expectedClaimVersion?: number;
    now?: Date;
    requiresTransactionReference?: boolean;
  } = {},
) {
  const now = options.now ?? new Date();
  if (!canStartManualPaymentReview(claim, now)) return false;
  if (!isPositiveWholeNumber(claim.version)) return false;
  if (typeof options.expectedClaimVersion === 'number' && options.expectedClaimVersion !== claim.version) return false;
  if (claim.activationId || claim.purchaseTransactionId) return false;
  if (!hasNonEmptyString(claim.driverId)) return false;
  if (!hasNonEmptyString(claim.vehicleId)) return false;
  if (!hasNonEmptyString(claim.offerId)) return false;
  if (!hasNonEmptyString(claim.packageId)) return false;
  if (!hasNonEmptyString(claim.packageVersion)) return false;
  if (!hasNonEmptyString(claim.packageName)) return false;
  if (!isPositiveWholeNumber(claim.expectedAmountRwf)) return false;
  if (!hasNonEmptyString(claim.merchantCodeSnapshot)) return false;
  if (!hasNonEmptyString(claim.payerPhoneNumber)) return false;
  if (options.requiresTransactionReference && !hasNonEmptyString(claim.transactionReference)) return false;
  return true;
}

export function canRejectManualPaymentClaim(
  claim: Pick<ManualPaymentClaim, 'status' | 'expiresAt' | 'version' | 'activationId' | 'purchaseTransactionId'>,
  options: {
    expectedClaimVersion?: number;
    now?: Date;
  } = {},
) {
  const now = options.now ?? new Date();
  if (!canStartManualPaymentReview(claim, now)) return false;
  if (!isPositiveWholeNumber(claim.version)) return false;
  if (typeof options.expectedClaimVersion === 'number' && options.expectedClaimVersion !== claim.version) return false;
  if (claim.activationId || claim.purchaseTransactionId) return false;
  return true;
}

export function assertManualPaymentClaimReviewable(
  claim: Pick<ManualPaymentClaim, 'status' | 'expiresAt' | 'version'>,
  options: { expectedClaimVersion?: number; now?: Date } = {},
): PackagePaymentOutcome<true> {
  if (!canStartManualPaymentReview(claim, options.now ?? new Date())) {
    return fail('claim_not_reviewable', 'Manual payment claim is not reviewable.');
  }
  if (!isPositiveWholeNumber(claim.version)) {
    return fail('claim_not_reviewable', 'Manual payment claim version is invalid.');
  }
  if (typeof options.expectedClaimVersion === 'number' && options.expectedClaimVersion !== claim.version) {
    return fail('claim_version_conflict', 'Manual payment claim version does not match the expected version.', {
      expectedClaimVersion: options.expectedClaimVersion,
      claimVersion: claim.version,
    });
  }
  return success(true);
}

export function assertManualPaymentClaimApprovable(
  claim: Pick<ManualPaymentClaim, 'id' | 'version' | 'status' | 'expiresAt' | 'activationId' | 'purchaseTransactionId' | 'driverId' | 'vehicleId' | 'vehicleType' | 'offerId' | 'packageId' | 'packageVersion' | 'packageName' | 'expectedAmountRwf' | 'provider' | 'merchantCodeSnapshot' | 'payerPhoneNumber' | 'transactionReference'>,
  options: {
    expectedClaimVersion?: number;
    now?: Date;
    requiresTransactionReference?: boolean;
  } = {},
  verificationEvidence?: Parameters<typeof validateManualPaymentVerificationEvidence>[0],
): PackagePaymentOutcome<true> {
  const reviewable = assertManualPaymentClaimReviewable(claim, {
    expectedClaimVersion: options.expectedClaimVersion,
    now: options.now,
  });
  if (reviewable.failure) return reviewable;
  if (!canApproveManualPaymentClaim(claim, options)) {
    return fail('claim_not_approvable', 'Manual payment claim is not approvable.');
  }
  if (verificationEvidence) {
    const evidenceCheck = validateManualPaymentVerificationEvidence(verificationEvidence, claim, {
      requiresTransactionReference: options.requiresTransactionReference,
    });
    if (evidenceCheck.failure) {
      return {
        data: null,
        failure: evidenceCheck.failure,
      };
    }
  }
  return success(true);
}

export function createManualPaymentApprovalIdempotencyKey(claimId: string) {
  return createManualPaymentReviewIdempotencyKey(claimId, 'approval');
}
