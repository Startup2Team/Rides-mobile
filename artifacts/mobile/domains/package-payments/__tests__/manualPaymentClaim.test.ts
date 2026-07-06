import {
  buildManualPaymentUssdInstruction,
  createManualPaymentClaim,
  validateManualPackagePaymentConfiguration,
  validateManualPaymentClaim,
  validateManualPaymentClaimForSubmission,
} from '../index';
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
  undefined,
  { ownerUserId: 'driver-1' },
);

const manualConfig = {
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

describe('manual payment claim and instruction policies', () => {
  test('valid manual payment configuration validates', () => {
    const result = validateManualPackagePaymentConfiguration(manualConfig.manual);
    expect(result.failure).toBeNull();
    expect(result.data?.providers).toHaveLength(2);
  });

  test('disabled provider is rejected by the USSD helper', () => {
    const result = buildManualPaymentUssdInstruction(
      { provider: 'mtn', merchantCode: '0202565', ussdTemplate: '*182*8*1*{merchantCode}*{amount}#', enabled: false },
      2000,
    );
    expect(result.failure?.code).toBe('provider_disabled');
  });

  test('missing merchant code fails configuration validation', () => {
    const result = validateManualPackagePaymentConfiguration({
      ...manualConfig.manual,
      providers: [
        { provider: 'mtn', merchantCode: '', ussdTemplate: '*182*8*1*{merchantCode}*{amount}#', enabled: true },
      ],
    });
    expect(result.failure?.code).toBe('invalid_payment_configuration');
  });

  test('invalid expiry duration fails configuration validation', () => {
    const result = validateManualPackagePaymentConfiguration({
      ...manualConfig.manual,
      claimExpiresAfterMinutes: 0,
    });
    expect(result.failure?.code).toBe('invalid_payment_configuration');
  });

  test('MTN and Airtel USSD instructions are generated from config and amount', () => {
    expect(buildManualPaymentUssdInstruction(manualConfig.manual.providers[0], 2000).data).toBe('*182*8*1*0202565*2000#');
    expect(buildManualPaymentUssdInstruction(manualConfig.manual.providers[1], 2000).data).toBe('*182*8*1*3378888*2000#');
  });

  test('malformed and unsupported USSD templates are rejected', () => {
    expect(buildManualPaymentUssdInstruction({ provider: 'mtn', merchantCode: '0202565', ussdTemplate: '*182*8*1*{merchantCode}*{amount}*{foo}#', enabled: true }, 2000).failure?.code).toBe('invalid_ussd_template');
    expect(buildManualPaymentUssdInstruction({ provider: 'mtn', merchantCode: '0202565', ussdTemplate: '*182*8*1*{merchantCode}#', enabled: true }, 2000).failure?.code).toBe('invalid_ussd_template');
    expect(buildManualPaymentUssdInstruction({ provider: 'mtn', merchantCode: '0202565', ussdTemplate: '*182*8*1*{merchantCode}*{amount}#', enabled: true }, 0).failure?.code).toBe('invalid_ussd_template');
    expect(buildManualPaymentUssdInstruction({ provider: 'mtn', merchantCode: '0202565', ussdTemplate: '*182*8*1*{merchantCode}*{amount}#', enabled: true }, -1).failure?.code).toBe('invalid_ussd_template');
    expect(buildManualPaymentUssdInstruction({ provider: 'mtn', merchantCode: '0202565', ussdTemplate: '*182*8*1*{merchantCode}*{amount}#', enabled: true }, 12.5).failure?.code).toBe('invalid_ussd_template');
  });

  test('valid manual claim validates and snapshots the locked offer', () => {
    const result = createManualPaymentClaim({
      claimId: 'RDP-2026-ABCDE',
      driverId: 'driver-1',
      offer,
      provider: 'mtn',
      payerPhoneNumber: '+250788000000',
      transactionReference: 'ABC123',
      proofImageId: 'proof://image',
    }, manualConfig);

    expect(result.failure).toBeNull();
    expect(result.data).toMatchObject({
      id: 'RDP-2026-ABCDE',
      driverId: 'driver-1',
      packageId: offer.packageId,
      packageVersion: offer.packageVersion,
      packageName: offer.packageName,
      expectedAmountRwf: offer.priceRwf,
      provider: 'mtn',
      merchantCodeSnapshot: '0202565',
      payerPhoneNumber: '+250788000000',
      transactionReference: 'ABC123',
      proofImageId: 'proof://image',
      status: 'draft',
      idempotencyKey: 'manual-payment-claim:RDP-2026-ABCDE',
    });
  });

  test('missing driver or package identity is rejected', () => {
    const base = {
      claimId: 'RDP-2026-ABCDE',
      driverId: 'driver-1',
      offer,
      provider: 'mtn' as const,
      payerPhoneNumber: '+250788000000',
      transactionReference: 'ABC123',
    };

    expect(validateManualPaymentClaim({ ...base, driverId: '', offer: { ...offer, offerId: '' } }, manualConfig).failure?.code).toBe('invalid_claim');
  });

  test('required transaction reference is enforced', () => {
    const result = validateManualPaymentClaim({
      claimId: 'RDP-2026-ABCDE',
      driverId: 'driver-1',
      offer,
      provider: 'mtn',
      payerPhoneNumber: '+250788000000',
    }, manualConfig);
    expect(result.failure?.code).toBe('transaction_reference_required');
  });

  test('proof remains optional by default', () => {
    const result = validateManualPaymentClaim({
      claimId: 'RDP-2026-ABCDE',
      driverId: 'driver-1',
      offer,
      provider: 'mtn',
      payerPhoneNumber: '+250788000000',
      transactionReference: 'ABC123',
    }, manualConfig);
    expect(result.failure).toBeNull();
  });

  test('submission validation uses the claim snapshot and expiry policy', () => {
    const created = createManualPaymentClaim({
      claimId: 'RDP-2026-ABCDE',
      driverId: 'driver-1',
      offer,
      provider: 'mtn',
      payerPhoneNumber: '+250788000000',
      transactionReference: 'ABC123',
    }, manualConfig).data!;

    const result = validateManualPaymentClaimForSubmission(created, manualConfig, now);
    expect(result.failure).toBeNull();
  });
});
