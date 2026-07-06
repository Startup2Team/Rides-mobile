import type { PackagePaymentFailure } from './types';

export interface PackagePaymentFailurePresentation {
  title: string;
  message: string;
  tone: 'info' | 'warning' | 'danger';
  refetchClaim: boolean;
  retryable: boolean;
}

const PRESENTATIONS: Record<PackagePaymentFailure['code'], PackagePaymentFailurePresentation> = {
  payment_mode_disabled: {
    title: 'Payment unavailable',
    message: 'Package payments are temporarily unavailable.',
    tone: 'warning',
    refetchClaim: false,
    retryable: false,
  },
  manual_payment_unavailable: {
    title: 'Manual payment unavailable',
    message: 'Manual payment is unavailable right now.',
    tone: 'warning',
    refetchClaim: false,
    retryable: false,
  },
  provider_disabled: {
    title: 'Provider unavailable',
    message: 'The selected payment provider is unavailable.',
    tone: 'warning',
    refetchClaim: false,
    retryable: false,
  },
  invalid_payment_configuration: {
    title: 'Payment configuration error',
    message: 'Package payment configuration is not available right now.',
    tone: 'danger',
    refetchClaim: false,
    retryable: false,
  },
  invalid_ussd_template: {
    title: 'Payment instruction error',
    message: 'The payment instruction could not be generated.',
    tone: 'danger',
    refetchClaim: false,
    retryable: false,
  },
  invalid_claim: {
    title: 'Payment claim invalid',
    message: 'The payment claim is invalid.',
    tone: 'danger',
    refetchClaim: false,
    retryable: false,
  },
  invalid_claim_transition: {
    title: 'Payment claim update unavailable',
    message: 'That payment claim cannot move to the requested state.',
    tone: 'warning',
    refetchClaim: true,
    retryable: false,
  },
  claim_expired: {
    title: 'Payment claim expired',
    message: 'This payment claim expired before verification was completed.',
    tone: 'warning',
    refetchClaim: true,
    retryable: false,
  },
  duplicate_transaction_reference: {
    title: 'Duplicate transaction reference',
    message: 'This transaction reference has already been used for a payment claim.',
    tone: 'warning',
    refetchClaim: false,
    retryable: false,
  },
  transaction_reference_required: {
    title: 'Transaction reference required',
    message: 'Enter the transaction reference before submitting the claim.',
    tone: 'warning',
    refetchClaim: false,
    retryable: false,
  },
  proof_required: {
    title: 'Proof required',
    message: 'A proof image is required for this payment claim.',
    tone: 'warning',
    refetchClaim: false,
    retryable: false,
  },
  claim_not_found: {
    title: 'Payment claim not found',
    message: 'This payment claim could not be found.',
    tone: 'warning',
    refetchClaim: false,
    retryable: false,
  },
  claim_not_activation_eligible: {
    title: 'Payment claim not ready',
    message: 'This payment claim is not ready for activation.',
    tone: 'warning',
    refetchClaim: false,
    retryable: false,
  },
  claim_version_conflict: {
    title: 'Payment status changed',
    message: 'The payment status changed. Refreshing the claim will show the latest state.',
    tone: 'warning',
    refetchClaim: true,
    retryable: false,
  },
  claim_not_reviewable: {
    title: 'Claim not reviewable',
    message: 'This payment claim cannot be reviewed right now.',
    tone: 'warning',
    refetchClaim: true,
    retryable: false,
  },
  claim_not_approvable: {
    title: 'Claim not approvable',
    message: 'This payment claim cannot be approved right now.',
    tone: 'warning',
    refetchClaim: true,
    retryable: false,
  },
  invalid_verification_evidence: {
    title: 'Verification evidence invalid',
    message: 'The verification evidence is invalid.',
    tone: 'danger',
    refetchClaim: false,
    retryable: false,
  },
  verification_provider_mismatch: {
    title: 'Verification provider mismatch',
    message: 'The verification provider does not match the payment claim.',
    tone: 'danger',
    refetchClaim: false,
    retryable: false,
  },
  payment_amount_not_matched: {
    title: 'Payment amount mismatch',
    message: 'The payment amount does not match the locked offer.',
    tone: 'danger',
    refetchClaim: false,
    retryable: false,
  },
  provider_reference_not_matched: {
    title: 'Reference mismatch',
    message: 'The payment reference could not be matched.',
    tone: 'danger',
    refetchClaim: false,
    retryable: false,
  },
  idempotency_conflict: {
    title: 'Request already processed',
    message: 'That request has already been processed.',
    tone: 'warning',
    refetchClaim: true,
    retryable: false,
  },
  approval_already_completed: {
    title: 'Approval already completed',
    message: 'This payment claim has already been approved.',
    tone: 'warning',
    refetchClaim: true,
    retryable: false,
  },
  activation_transaction_failed: {
    title: 'Payment status unavailable',
    message: 'Your payment status could not be refreshed right now. Please try again.',
    tone: 'danger',
    refetchClaim: true,
    retryable: true,
  },
  package_purchase_transaction_failed: {
    title: 'Payment status unavailable',
    message: 'Your payment status could not be refreshed right now. Please try again.',
    tone: 'danger',
    refetchClaim: true,
    retryable: true,
  },
  credit_transaction_failed: {
    title: 'Payment status unavailable',
    message: 'Your payment status could not be refreshed right now. Please try again.',
    tone: 'danger',
    refetchClaim: true,
    retryable: true,
  },
  approval_transaction_failed: {
    title: 'Payment status unavailable',
    message: 'Your payment status could not be refreshed right now. Please try again.',
    tone: 'danger',
    refetchClaim: true,
    retryable: true,
  },
  unauthorized: {
    title: 'Sign in required',
    message: 'Please sign in again to continue.',
    tone: 'warning',
    refetchClaim: false,
    retryable: false,
  },
  forbidden: {
    title: 'Access denied',
    message: 'You do not have access to this payment claim.',
    tone: 'warning',
    refetchClaim: false,
    retryable: false,
  },
  not_found: {
    title: 'Payment claim not found',
    message: 'This payment claim could not be found.',
    tone: 'warning',
    refetchClaim: false,
    retryable: false,
  },
  rate_limited: {
    title: 'Too many requests',
    message: 'Please wait a moment before trying again.',
    tone: 'warning',
    refetchClaim: false,
    retryable: true,
  },
  timeout: {
    title: 'Request timed out',
    message: 'The request took too long. Please try again.',
    tone: 'warning',
    refetchClaim: true,
    retryable: true,
  },
  network_error: {
    title: 'Network error',
    message: 'Check your connection and try again.',
    tone: 'warning',
    refetchClaim: false,
    retryable: true,
  },
  service_unavailable: {
    title: 'Service unavailable',
    message: 'Package payment is temporarily unavailable.',
    tone: 'warning',
    refetchClaim: true,
    retryable: true,
  },
  repository_unavailable: {
    title: 'Payment service unavailable',
    message: 'Your payment status could not be refreshed right now. Please try again.',
    tone: 'warning',
    refetchClaim: true,
    retryable: true,
  },
};

export function getPackagePaymentFailurePresentation(
  failure: PackagePaymentFailure | null | undefined,
): PackagePaymentFailurePresentation | null {
  if (!failure) return null;
  return PRESENTATIONS[failure.code] ?? PRESENTATIONS.repository_unavailable;
}
