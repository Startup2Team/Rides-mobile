import { getManualPaymentClaimPresentation, getManualPaymentClaimRefreshPolicy, toManualPaymentClaimReadModel } from '../index';
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

const configuration = {
  mode: 'manual' as const,
  version: '2026-07-06',
  updatedAt: now.toISOString(),
  manual: {
    providers: [
      { provider: 'mtn' as const, displayName: 'MTN MoMo', merchantCode: '0202565', ussdTemplate: '*182*8*1*{merchantCode}*{amount}#', enabled: true },
    ],
    claimExpiresAfterMinutes: 30,
    transactionReferenceRequired: true,
    proofImageEnabled: true,
  },
};

describe('manual payment claim presentation', () => {
  test('maps statuses to safe titles and refresh policies', () => {
    expect(getManualPaymentClaimPresentation('draft')).toMatchObject({
      title: 'Payment confirmation not submitted',
      canCancel: true,
      terminal: false,
    });
    expect(getManualPaymentClaimPresentation('approved')).toMatchObject({
      title: 'Payment confirmed',
      expectActivation: true,
      terminal: true,
    });
    expect(getManualPaymentClaimRefreshPolicy('pending_review').refetchInterval).toBe(15_000);
    expect(getManualPaymentClaimRefreshPolicy('approved').refetchInterval).toBe(false);
  });

  test('sanitizes read model data and classifies local claims', () => {
    const claim = createManualPaymentClaim({
      claimId: 'RDP-2026-ABCDE',
      driverId: 'driver-1',
      offer,
      provider: 'mtn',
      payerPhoneNumber: '+250788000000',
      transactionReference: 'ABC123',
      proofImageId: 'proof-1',
    }, configuration).data!;

    const readModel = toManualPaymentClaimReadModel(claim);
    expect(readModel.authority).toBe('local_only_prototype');
    expect(readModel.maskedPayerPhone).toContain('***');
    expect(readModel.maskedTransactionReference).toContain('***');
    expect(JSON.stringify(readModel)).not.toContain('+250788000000');
    expect(JSON.stringify(readModel)).not.toContain('ABC123');
  });
});
