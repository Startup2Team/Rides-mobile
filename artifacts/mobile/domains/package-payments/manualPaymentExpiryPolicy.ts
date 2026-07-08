import { transitionManualPaymentClaim } from './manualPaymentClaimTransitions';
import type { ManualPackagePaymentConfiguration, ManualPaymentClaim, PackagePaymentOutcome } from './types';

export function calculateManualPaymentClaimExpiry(
  createdAt: string,
  configuration: Pick<ManualPackagePaymentConfiguration, 'claimExpiresAfterMinutes'>,
) {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created) || configuration.claimExpiresAfterMinutes <= 0) return null;
  return new Date(created + configuration.claimExpiresAfterMinutes * 60_000).toISOString();
}

export function isManualPaymentClaimExpired(
  claim: Pick<ManualPaymentClaim, 'status' | 'expiresAt'>,
  now = new Date(),
) {
  if (['approved', 'rejected', 'cancelled', 'expired'].includes(claim.status)) return claim.status === 'expired';
  const expiresAt = new Date(claim.expiresAt).getTime();
  return !Number.isNaN(expiresAt) && now.getTime() >= expiresAt;
}

export function expireManualPaymentClaim(
  claim: ManualPaymentClaim,
  now = new Date(),
): PackagePaymentOutcome<ManualPaymentClaim> {
  if (['approved', 'rejected', 'cancelled', 'expired'].includes(claim.status)) {
    return { data: claim, failure: null };
  }
  if (!isManualPaymentClaimExpired(claim, now)) {
    return { data: claim, failure: null };
  }
  return transitionManualPaymentClaim(claim, 'expired', {
    at: now.toISOString(),
    actorType: 'system',
    reasonCode: 'claim-expired',
  });
}

export function shouldExpireManualPaymentClaim(
  claim: Pick<ManualPaymentClaim, 'status' | 'expiresAt'>,
  now = new Date(),
) {
  return isManualPaymentClaimExpired(claim, now) && claim.status !== 'approved' && claim.status !== 'rejected' && claim.status !== 'cancelled' && claim.status !== 'expired';
}
