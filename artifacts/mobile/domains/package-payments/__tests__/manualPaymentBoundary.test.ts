import { InMemoryPackagePaymentRepository } from '../repository';
import { buildManualPaymentUssdInstruction, createManualPaymentClaim } from '../index';
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
  },
};

describe('package payment repository and boundary', () => {
  test('driver repository does not expose admin approval authority', () => {
    const repo = new InMemoryPackagePaymentRepository(config);
    expect('approveManualPaymentClaim' in repo).toBe(false);
    expect('rejectManualPaymentClaim' in repo).toBe(false);
    expect('forceActivatePackage' in repo).toBe(false);
    expect('markPaymentVerified' in repo).toBe(false);
  });

  test('repository can return the current configuration, but not approve claims', async () => {
    const repo = new InMemoryPackagePaymentRepository(config);
    await expect(repo.getPaymentConfiguration()).resolves.toEqual({ data: config, failure: null });
  });

  test('manual claim creation snapshots the locked offer but does not activate credits', () => {
    const result = createManualPaymentClaim({
      claimId: 'RDP-2026-ABCDE',
      driverId: 'driver-1',
      offer,
      provider: 'mtn',
      payerPhoneNumber: '+250788000000',
      transactionReference: 'ABC123',
    }, config);
    expect(result.failure).toBeNull();
    expect(result.data?.status).toBe('draft');
    expect(result.data?.activationId).toBeUndefined();
    expect(result.data?.purchaseTransactionId).toBeUndefined();
  });

  test('manual USSD helper does not trust driver-entered amount', () => {
    expect(buildManualPaymentUssdInstruction(config.manual.providers[0], offer.priceRwf).data).toBe('*182*8*1*0202565*2000#');
  });
});
