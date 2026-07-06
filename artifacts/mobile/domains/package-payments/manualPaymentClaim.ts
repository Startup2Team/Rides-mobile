import { calculateManualPaymentClaimExpiry, isManualPaymentClaimExpired } from './manualPaymentExpiryPolicy';
import { canUseManualPackagePayment } from './packagePaymentMode';
import {
  validatePackagePaymentConfiguration,
  validateManualPaymentClaim,
} from './manualPaymentClaimValidator';
import {
  type CancelManualPaymentClaimInput,
  type CreateManualPaymentClaimInput,
  type ManualPaymentClaim,
  type PackagePaymentConfiguration,
  type PackagePaymentFailure,
  type PackagePaymentOutcome,
  type ResubmitManualPaymentClaimInput,
  type SubmitManualPaymentClaimInput,
} from './types';
import { createManualPaymentClaimId, createManualPaymentClaimAuditEntry } from './manualPaymentClaimHelpers';

function outcome<T>(data: T | null, failure: PackagePaymentFailure | null): PackagePaymentOutcome<T> {
  return { data, failure };
}

export function createManualPaymentClaim(
  input: CreateManualPaymentClaimInput,
  configuration: PackagePaymentConfiguration,
  now = new Date(),
): PackagePaymentOutcome<ManualPaymentClaim> {
  const config = validatePackagePaymentConfiguration(configuration);
  if (config.failure || !config.data) return outcome<ManualPaymentClaim>(null, config.failure ?? {
    code: 'invalid_payment_configuration',
    message: 'Package payment configuration is invalid.',
  });

  if (!canUseManualPackagePayment(config.data.mode)) {
    return outcome<ManualPaymentClaim>(null, config.data.mode === 'disabled'
      ? { code: 'payment_mode_disabled', message: 'Package payment is disabled.' }
      : { code: 'manual_payment_unavailable', message: 'Manual package payment is unavailable in the current mode.' });
  }

  const validation = validateManualPaymentClaim(input, config.data);
  if (validation.failure || !validation.data) return outcome<ManualPaymentClaim>(null, validation.failure);
  return outcome<ManualPaymentClaim>(validation.data, null);
}

export function getManualPaymentClaimExpiry(
  claim: ManualPaymentClaim,
  configuration: PackagePaymentConfiguration,
) {
  const config = validatePackagePaymentConfiguration(configuration);
  if (config.failure || !config.data?.manual) return null;
  return calculateManualPaymentClaimExpiry(claim.createdAt, config.data.manual);
}

export function submitManualPaymentClaim(
  input: SubmitManualPaymentClaimInput,
  configuration: PackagePaymentConfiguration,
  now = new Date(),
): PackagePaymentOutcome<ManualPaymentClaim> {
  const config = validatePackagePaymentConfiguration(configuration);
  if (config.failure || !config.data) return outcome<ManualPaymentClaim>(null, config.failure ?? {
    code: 'invalid_payment_configuration',
    message: 'Package payment configuration is invalid.',
  });

  const claim = input.claim;
  if (isManualPaymentClaimExpired(claim, now)) {
    return outcome<ManualPaymentClaim>(null, { code: 'claim_expired', message: 'Manual payment claim has expired.' });
  }
  if (claim.status !== 'draft' && claim.status !== 'needs_clarification' && claim.status !== 'submitted') {
    return outcome<ManualPaymentClaim>(null, {
      code: 'invalid_claim_transition',
      message: `Cannot submit a claim from status ${claim.status}.`,
    });
  }

  const validation = validateManualPaymentClaim({
    claimId: claim.id,
    driverId: claim.driverId,
    provider: claim.provider,
    payerPhoneNumber: claim.payerPhoneNumber,
    transactionReference: claim.transactionReference,
    proofImageId: claim.proofImageId,
    offer: {
      offerId: claim.offerId,
      packageId: claim.packageId,
      packageVersion: claim.packageVersion,
      packageName: claim.packageName,
      vehicleId: claim.vehicleId,
      vehicleType: claim.vehicleType,
      priceRwf: claim.expectedAmountRwf,
      ridesGranted: 0,
      bonusRidesGranted: 0,
      createdAt: claim.createdAt,
      expiresAt: claim.expiresAt,
      source: 'local_catalog',
      quoteAuthority: 'local',
    },
  }, config.data);
  if (validation.failure || !validation.data) return outcome<ManualPaymentClaim>(null, validation.failure);

  const submittedAt = input.submittedAt ?? now.toISOString();
  const submitted: ManualPaymentClaim = {
    ...claim,
    transactionReference: validation.data.transactionReference,
    proofImageId: validation.data.proofImageId,
    status: 'submitted',
    submittedAt,
    auditLog: [
      ...claim.auditLog,
      createManualPaymentClaimAuditEntry({
        claimId: claim.id,
        at: submittedAt,
        actorType: 'driver',
        actorId: input.actorId,
        action: 'claim_submitted',
      }),
    ],
  };

  return outcome<ManualPaymentClaim>(submitted, null);
}

export function resubmitManualPaymentClaim(
  input: ResubmitManualPaymentClaimInput,
  configuration: PackagePaymentConfiguration,
  now = new Date(),
): PackagePaymentOutcome<ManualPaymentClaim> {
  const claim = input.claim;
  if (claim.status !== 'needs_clarification') {
    return outcome<ManualPaymentClaim>(null, {
      code: 'invalid_claim_transition',
      message: `Cannot resubmit a claim from status ${claim.status}.`,
    });
  }
  return outcome<ManualPaymentClaim>({
    ...claim,
    status: 'pending_review',
    submittedAt: input.submittedAt ?? now.toISOString(),
    auditLog: [
      ...claim.auditLog,
      createManualPaymentClaimAuditEntry({
        claimId: claim.id,
        at: input.submittedAt ?? now.toISOString(),
        actorType: 'driver',
        actorId: input.actorId,
        action: 'clarification_resubmitted',
      }),
    ],
  }, null);
}

export function cancelManualPaymentClaim(
  input: CancelManualPaymentClaimInput,
  now = new Date(),
): PackagePaymentOutcome<ManualPaymentClaim> {
  const claim = input.claim;
  if (['approved', 'rejected', 'expired', 'cancelled'].includes(claim.status)) {
    return outcome<ManualPaymentClaim>(null, {
      code: 'invalid_claim_transition',
      message: `Cannot cancel a claim from status ${claim.status}.`,
    });
  }
  const cancelledAt = input.cancelledAt ?? now.toISOString();
  return outcome<ManualPaymentClaim>({
    ...claim,
    status: 'cancelled',
    auditLog: [
      ...claim.auditLog,
      createManualPaymentClaimAuditEntry({
        claimId: claim.id,
        at: cancelledAt,
        actorType: 'driver',
        actorId: input.actorId,
        action: 'claim_cancelled',
        reasonCode: input.reasonCode,
      }),
    ],
  }, null);
}
