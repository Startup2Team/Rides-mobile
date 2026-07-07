import type { ManualPaymentClaim, ManualPaymentProvider, PackagePaymentFailure, PackagePaymentOutcome } from './types';
import { normalizeManualPaymentTransactionReference } from './manualPaymentDuplicatePolicy';

export type ManualPaymentVerificationMethod =
  | 'merchant_message'
  | 'merchant_statement'
  | 'provider_portal'
  | 'provider_api'
  | 'other_internal';

export interface ManualPaymentVerificationEvidence {
  method: ManualPaymentVerificationMethod;
  verifiedAt: string;
  verifiedBy: string;
  provider: ManualPaymentProvider;
  amountMatched: boolean;
  providerReferenceMatched: boolean;
}

function fail<T>(
  code: PackagePaymentFailure['code'],
  message: string,
  details?: PackagePaymentFailure['details'],
): PackagePaymentOutcome<T> {
  return { data: null, failure: { code, message, details } };
}

function isNonEmptyString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateManualPaymentVerificationEvidence(
  evidence: ManualPaymentVerificationEvidence | null | undefined,
  claim: Pick<ManualPaymentClaim, 'provider' | 'expectedAmountRwf' | 'transactionReference'>,
  options: {
    requiresTransactionReference?: boolean;
  } = {},
): PackagePaymentOutcome<ManualPaymentVerificationEvidence> {
  if (!evidence || typeof evidence !== 'object') {
    return fail('invalid_verification_evidence', 'Manual payment verification evidence is required.');
  }

  const verifiedAt = isNonEmptyString(evidence.verifiedAt) && !Number.isNaN(new Date(evidence.verifiedAt).getTime())
    ? evidence.verifiedAt.trim()
    : null;
  if (!verifiedAt) {
    return fail('invalid_verification_evidence', 'verification verifiedAt is invalid.');
  }
  if (!isNonEmptyString(evidence.verifiedBy)) {
    return fail('invalid_verification_evidence', 'verification verifiedBy is required.');
  }
  if (evidence.provider !== claim.provider) {
    return fail('verification_provider_mismatch', 'Verification provider does not match the claim provider.', {
      provider: evidence.provider,
    });
  }
  if (!evidence.amountMatched) {
    return fail('payment_amount_not_matched', 'Verification amount does not match the claim amount.');
  }

  const requiresReference = options.requiresTransactionReference ?? Boolean(normalizeManualPaymentTransactionReference(claim.transactionReference));
  if (requiresReference && !evidence.providerReferenceMatched) {
    return fail('provider_reference_not_matched', 'Verification provider reference does not match the claim reference.');
  }

  return {
    data: {
      method: evidence.method,
      verifiedAt,
      verifiedBy: evidence.verifiedBy.trim(),
      provider: evidence.provider,
      amountMatched: true,
      providerReferenceMatched: Boolean(evidence.providerReferenceMatched),
    },
    failure: null,
  };
}
