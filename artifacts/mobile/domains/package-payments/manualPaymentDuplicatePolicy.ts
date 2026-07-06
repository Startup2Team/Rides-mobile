import type { ManualPaymentClaim, ManualPaymentProvider, PackagePaymentFailure, PackagePaymentOutcome } from './types';

export function normalizeManualPaymentTransactionReference(value: string | null | undefined) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getManualPaymentTransactionReferenceKey(
  provider: ManualPaymentProvider,
  transactionReference: string | null | undefined,
) {
  const normalized = normalizeManualPaymentTransactionReference(transactionReference);
  return normalized ? `${provider}:${normalized}` : null;
}

export function hasDuplicateManualPaymentTransactionReference(
  existingClaims: ManualPaymentClaim[],
  candidate: Pick<ManualPaymentClaim, 'provider' | 'transactionReference'>,
) {
  const candidateKey = getManualPaymentTransactionReferenceKey(candidate.provider, candidate.transactionReference);
  if (!candidateKey) return false;
  return existingClaims.some(claim =>
    getManualPaymentTransactionReferenceKey(claim.provider, claim.transactionReference) === candidateKey,
  );
}

export function assertNoDuplicateManualPaymentTransactionReference(
  existingClaims: ManualPaymentClaim[],
  candidate: Pick<ManualPaymentClaim, 'provider' | 'transactionReference'>,
): PackagePaymentOutcome<true> {
  if (hasDuplicateManualPaymentTransactionReference(existingClaims, candidate)) {
    return {
      data: null,
      failure: {
        code: 'duplicate_transaction_reference',
        message: 'A manual payment claim with this provider transaction reference already exists.',
        details: {
          provider: candidate.provider,
          duplicateDetected: true,
        },
      },
    };
  }
  return { data: true, failure: null };
}
