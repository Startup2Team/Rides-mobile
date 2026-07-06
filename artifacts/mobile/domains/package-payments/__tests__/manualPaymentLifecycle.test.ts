import {
  assertManualPaymentClaimEligibleForActivation,
  assertManualPaymentClaimTransition,
  canTransitionManualPaymentClaim,
  calculateManualPaymentClaimExpiry,
  createManualPaymentClaim,
  expireManualPaymentClaim,
  getManualPaymentClaimActivationIdempotencyKey,
  assertNoDuplicateManualPaymentTransactionReference,
  hasDuplicateManualPaymentTransactionReference,
  isManualPaymentClaimEligibleForActivation,
  isManualPaymentClaimExpired,
  normalizeManualPaymentTransactionReference,
  resubmitManualPaymentClaim,
  submitManualPaymentClaim,
  transitionManualPaymentClaim,
} from '../index';
import { EMPTY_DRIVER_ENTITLEMENT, createPackageOfferSnapshot } from '@/domain/driverRidePackages';
import { resolvePackageOffer } from '@/domain/driverRideCampaigns';
import { DRIVER_RIDE_PACKAGE_CATALOG } from '@/domain/driverRidePackageCatalog';
import type { ManualPaymentClaimStatus } from '../types';

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
  undefined,
  { ownerUserId: 'driver-1' },
);

const config = {
  mode: 'manual' as const,
  version: '2026-07-06',
  updatedAt: now.toISOString(),
  manual: {
    providers: [
      { provider: 'mtn' as const, merchantCode: '0202565', ussdTemplate: '*182*8*1*{merchantCode}*{amount}#', enabled: true },
      { provider: 'airtel' as const, merchantCode: '3378888', ussdTemplate: '*182*8*1*{merchantCode}*{amount}#', enabled: true },
    ],
    claimExpiresAfterMinutes: 30,
    transactionReferenceRequired: true,
    proofImageEnabled: true,
    proofImageRequired: false,
  },
};

function makeClaim(claimStatus: ManualPaymentClaimStatus = 'draft') {
  const claim = createManualPaymentClaim({
    claimId: 'RDP-2026-ABCDE',
    driverId: 'driver-1',
    offer,
    provider: 'mtn',
    payerPhoneNumber: '+250788000000',
    transactionReference: 'ABC123',
  }, config).data!;
  return { ...claim, status: claimStatus };
}

describe('manual payment lifecycle policies', () => {
  test('expiry is calculated deterministically', () => {
    expect(calculateManualPaymentClaimExpiry(offer.createdAt, config.manual)).toBe('2026-07-06T10:30:00.000Z');
  });

  test('pending claims expire after the configured window', () => {
    const claim = makeClaim('submitted');
    expect(isManualPaymentClaimExpired({ ...claim, expiresAt: '2026-07-06T10:30:00.000Z' }, new Date('2026-07-06T10:31:00.000Z'))).toBe(true);
  });

  test('terminal claims stay terminal', () => {
    expect(isManualPaymentClaimExpired({ ...makeClaim('approved'), expiresAt: '2026-07-06T10:30:00.000Z' }, new Date('2026-07-06T11:00:00.000Z'))).toBe(false);
    expect(isManualPaymentClaimExpired({ ...makeClaim('rejected'), expiresAt: '2026-07-06T10:30:00.000Z' }, new Date('2026-07-06T11:00:00.000Z'))).toBe(false);
    expect(isManualPaymentClaimExpired({ ...makeClaim('cancelled'), expiresAt: '2026-07-06T10:30:00.000Z' }, new Date('2026-07-06T11:00:00.000Z'))).toBe(false);
  });

  test('allowed transitions are exhaustive', () => {
    const allowed: Array<[any, any]> = [
      ['draft', 'submitted'],
      ['draft', 'cancelled'],
      ['draft', 'expired'],
      ['submitted', 'pending_review'],
      ['submitted', 'cancelled'],
      ['submitted', 'expired'],
      ['pending_review', 'needs_clarification'],
      ['pending_review', 'approved'],
      ['pending_review', 'rejected'],
      ['pending_review', 'expired'],
      ['needs_clarification', 'pending_review'],
      ['needs_clarification', 'cancelled'],
      ['needs_clarification', 'expired'],
    ];

    allowed.forEach(([from, to]) => {
      expect(canTransitionManualPaymentClaim(from, to)).toBe(true);
      expect(assertManualPaymentClaimTransition(from, to)).toBeNull();
      expect(transitionManualPaymentClaim(makeClaim(from), to).data?.status).toBe(to);
    });
  });

  test('terminal transitions are blocked', () => {
    const blocked: Array<[any, any]> = [
      ['approved', 'pending_review'],
      ['approved', 'rejected'],
      ['approved', 'needs_clarification'],
      ['rejected', 'approved'],
      ['expired', 'approved'],
      ['cancelled', 'approved'],
    ];

    blocked.forEach(([from, to]) => {
      expect(canTransitionManualPaymentClaim(from, to)).toBe(false);
      expect(assertManualPaymentClaimTransition(from, to)?.code).toBe('invalid_claim_transition');
    });
  });

  test('duplicate transaction references are detected by provider namespace', () => {
    const claims = [
      makeClaim('draft'),
      { ...makeClaim('draft'), provider: 'airtel' as const, transactionReference: 'ABC123' },
    ];

    expect(hasDuplicateManualPaymentTransactionReference(claims, { provider: 'mtn', transactionReference: ' ABC123 ' })).toBe(true);
    expect(hasDuplicateManualPaymentTransactionReference(claims, { provider: 'airtel', transactionReference: 'ABC123' })).toBe(true);
    expect(normalizeManualPaymentTransactionReference('  ABC123  ')).toBe('ABC123');
  });

  test('duplicate failure does not expose the raw reference', () => {
    const result = assertNoDuplicateManualPaymentTransactionReference(
      [makeClaim('draft')],
      { provider: 'mtn', transactionReference: 'RAW-REF-123' },
    );
    expect(result.failure).toBeNull();
    const duplicate = assertNoDuplicateManualPaymentTransactionReference(
      [{ ...makeClaim('draft'), transactionReference: 'RAW-REF-123' }],
      { provider: 'mtn', transactionReference: 'RAW-REF-123' },
    );
    expect(duplicate.failure?.code).toBe('duplicate_transaction_reference');
    expect(JSON.stringify(duplicate.failure)).not.toContain('RAW-REF-123');
  });

  test('activation eligibility is only true for approved, not-expired, unactivated claims', () => {
    const approved = { ...makeClaim('approved'), activationId: undefined, purchaseTransactionId: undefined };
    expect(isManualPaymentClaimEligibleForActivation(approved, new Date('2026-07-06T10:10:00.000Z'))).toBe(true);
    expect(assertManualPaymentClaimEligibleForActivation(approved).failure).toBeNull();
    expect(getManualPaymentClaimActivationIdempotencyKey(approved)).toBe('manual-payment-claim:RDP-2026-ABCDE:activation');
    expect(isManualPaymentClaimEligibleForActivation({ ...approved, status: 'pending_review' }, now)).toBe(false);
    expect(isManualPaymentClaimEligibleForActivation({ ...approved, status: 'needs_clarification' }, now)).toBe(false);
    expect(isManualPaymentClaimEligibleForActivation({ ...approved, status: 'rejected' }, now)).toBe(false);
    expect(isManualPaymentClaimEligibleForActivation({ ...approved, status: 'expired' }, now)).toBe(false);
    expect(isManualPaymentClaimEligibleForActivation({ ...approved, activationId: 'activation-1' }, now)).toBe(false);
    expect(isManualPaymentClaimEligibleForActivation({ ...approved, purchaseTransactionId: 'purchase-1' }, now)).toBe(false);
  });

  test('submit and resubmit keep the claim dormant and do not activate or credit', () => {
    const draft = makeClaim('draft');
    const submitted = submitManualPaymentClaim({ claim: draft, actorId: 'driver-1' }, config, now).data!;
    expect(submitted.status).toBe('submitted');
    expect(submitted.version).toBe(2);
    const clarified = { ...submitted, status: 'needs_clarification' as const };
    const resubmitted = resubmitManualPaymentClaim({ claim: clarified, actorId: 'driver-1' }, config, now).data!;
    expect(resubmitted.status).toBe('pending_review');
    expect(resubmitted.version).toBe(3);
    expect(resubmitted.activationId).toBeUndefined();
    expect(resubmitted.purchaseTransactionId).toBeUndefined();
  });

  test('expiry helper does not affect approved claims', () => {
    const approved = { ...makeClaim('approved'), expiresAt: '2026-07-06T10:01:00.000Z' };
    expect(expireManualPaymentClaim(approved, new Date('2026-07-06T11:00:00.000Z')).data?.status).toBe('approved');
  });
});
