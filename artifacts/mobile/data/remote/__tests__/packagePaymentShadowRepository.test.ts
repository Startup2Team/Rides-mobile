jest.mock('@/observability/monitoring', () => ({
  reportOperationalWarning: jest.fn(),
}));

import { createPackagePaymentShadowRepository } from '../repositories/packagePaymentShadowRepository';
import { InMemoryPackagePaymentRepository } from '@/domains/package-payments';
import { EMPTY_DRIVER_ENTITLEMENT, createPackageOfferSnapshot } from '@/domain/driverRidePackages';
import { resolvePackageOffer } from '@/domain/driverRideCampaigns';
import { DRIVER_RIDE_PACKAGE_CATALOG } from '@/domain/driverRidePackageCatalog';
import * as monitoring from '@/observability/monitoring';

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

describe('package payment shadow repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('keeps local results authoritative and emits sanitized telemetry', async () => {
    const localRepository = new InMemoryPackagePaymentRepository(config);
    const remoteRepository = {
      getPaymentConfiguration: jest.fn().mockResolvedValue({ data: { ...config, version: 'remote-version' }, failure: null }),
      createManualPaymentClaim: jest.fn().mockResolvedValue({ data: null, failure: { code: 'repository_unavailable', message: 'offline' } }),
      getManualPaymentClaim: jest.fn(),
      listDriverManualPaymentClaims: jest.fn(),
      submitManualPaymentClaim: jest.fn(),
      resubmitManualPaymentClaim: jest.fn(),
      cancelManualPaymentClaim: jest.fn(),
    };
    const shadow = createPackagePaymentShadowRepository({
      localRepository,
      remoteRepository: remoteRepository as never,
    });

    const result = await shadow.getPaymentConfiguration();
    expect(result.data).toEqual(config);
    expect(monitoring.reportOperationalWarning).toHaveBeenCalledWith(
      'package-payment.shadow.request',
      expect.objectContaining({ operation: 'getPaymentConfiguration' }),
    );
    expect(monitoring.reportOperationalWarning).toHaveBeenCalledWith(
      'package-payment.shadow.mismatch',
      expect.objectContaining({
        operation: 'getPaymentConfiguration',
        mismatchCategory: 'data-mismatch',
      }),
    );
  });

  test('does not emit phone numbers, transaction references, proof ids, or support text', async () => {
    const shadow = createPackagePaymentShadowRepository({
      localRepository: new InMemoryPackagePaymentRepository(config),
    });
    await shadow.createManualPaymentClaim({
      claimId: 'RDP-2026-ABCDE',
      driverId: 'driver-1',
      offer,
      provider: 'mtn',
      payerPhoneNumber: '+250788000000',
      transactionReference: 'ABC123',
      proofImageId: 'proof-1',
    });

    const payloads = (monitoring.reportOperationalWarning as jest.Mock).mock.calls.map(call => call[1]);
    const combined = JSON.stringify(payloads);
    expect(combined).not.toContain('+250788000000');
    expect(combined).not.toContain('ABC123');
    expect(combined).not.toContain('proof-1');
    expect(combined).not.toContain('support');
  });
});
