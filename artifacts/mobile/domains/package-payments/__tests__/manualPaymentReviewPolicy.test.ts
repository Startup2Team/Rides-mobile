import {
  assertManualPaymentClaimApprovable,
  assertManualPaymentClaimReviewable,
  canApproveManualPaymentClaim,
  canRejectManualPaymentClaim,
  canRequestManualPaymentClarification,
  canStartManualPaymentReview,
  createManualPaymentApprovalIdempotencyKey,
} from '../index';
import { createManualPaymentClaim } from '../manualPaymentClaim';
import { EMPTY_DRIVER_ENTITLEMENT, createPackageOfferSnapshot } from '@/domain/driverRidePackages';
import { resolvePackageOffer } from '@/domain/driverRideCampaigns';
import { DRIVER_RIDE_PACKAGE_CATALOG } from '@/domain/driverRidePackageCatalog';

const now = new Date('2026-07-06T10:00:00.000Z');
const vehicle = { vehicleId: 'vehicle-1', vehicleType: 'moto' as const };
const packageEntry = DRIVER_RIDE_PACKAGE_CATALOG.find(item => item.packageId === 'growth' && item.vehicleType === 'moto')!;
const offer = createPackageOfferSnapshot(
  resolvePackageOffer({
    package: packageEntry,
    vehicleType: 'moto',
    entitlement: EMPTY_DRIVER_ENTITLEMENT,
    now,
  }),
  vehicle,
  now,
);

const config = {
  mode: 'manual' as const,
  version: '2026-07-06',
  updatedAt: now.toISOString(),
  manual: {
    providers: [
      { provider: 'mtn' as const, merchantCode: '0202565', ussdTemplate: '*182*8*1*{merchantCode}*{amount}#', enabled: true },
    ],
    claimExpiresAfterMinutes: 30,
    transactionReferenceRequired: true,
    proofImageEnabled: true,
    proofImageRequired: false,
  },
};

function makeClaim(status: 'draft' | 'submitted' | 'pending_review' | 'needs_clarification' | 'approved' | 'rejected' | 'expired' | 'cancelled' = 'pending_review') {
  const claim = createManualPaymentClaim({
    claimId: 'RDP-2026-ABCDE',
    driverId: 'driver-1',
    offer,
    provider: 'mtn',
    payerPhoneNumber: '+250788000000',
    transactionReference: 'ABC123',
  }, config).data!;
  return { ...claim, status, version: status === 'pending_review' ? 2 : claim.version };
}

describe('manual payment review policy', () => {
  test('pending review claims are reviewable', () => {
    const claim = makeClaim('pending_review');
    expect(canStartManualPaymentReview(claim, now)).toBe(true);
    expect(canRequestManualPaymentClarification(claim, now)).toBe(true);
    expect(canApproveManualPaymentClaim(claim, { expectedClaimVersion: 2, now, requiresTransactionReference: true })).toBe(true);
    expect(canRejectManualPaymentClaim(claim, { expectedClaimVersion: 2, now })).toBe(true);
    expect(assertManualPaymentClaimReviewable(claim, { expectedClaimVersion: 2, now }).failure).toBeNull();
    expect(assertManualPaymentClaimApprovable(claim, { expectedClaimVersion: 2, now, requiresTransactionReference: true }).failure).toBeNull();
    expect(createManualPaymentApprovalIdempotencyKey(claim.id)).toBe('manual-payment-claim:RDP-2026-ABCDE:approval');
  });

  test('submitted and clarification claims are not approvable until pending review', () => {
    expect(canApproveManualPaymentClaim(makeClaim('submitted'), { expectedClaimVersion: 2, now })).toBe(false);
    expect(canApproveManualPaymentClaim({ ...makeClaim('needs_clarification'), status: 'needs_clarification', version: 3 }, { expectedClaimVersion: 3, now })).toBe(false);
  });

  test('terminal claims are rejected from review', () => {
    expect(canApproveManualPaymentClaim(makeClaim('expired'), { expectedClaimVersion: 2, now })).toBe(false);
    expect(canApproveManualPaymentClaim(makeClaim('rejected'), { expectedClaimVersion: 2, now })).toBe(false);
    expect(canApproveManualPaymentClaim(makeClaim('cancelled'), { expectedClaimVersion: 2, now })).toBe(false);
    expect(canApproveManualPaymentClaim(makeClaim('approved'), { expectedClaimVersion: 2, now })).toBe(false);
  });

  test('stale claim versions conflict', () => {
    const claim = makeClaim('pending_review');
    expect(assertManualPaymentClaimReviewable(claim, { expectedClaimVersion: 1, now }).failure?.code).toBe('claim_version_conflict');
  });
});
