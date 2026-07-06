import { createPackagePaymentRepository } from '../packagePaymentRepositoryFactory';
import { EMPTY_DRIVER_ENTITLEMENT, createPackageOfferSnapshot } from '@/domain/driverRidePackages';
import { resolvePackageOffer } from '@/domain/driverRideCampaigns';
import { DRIVER_RIDE_PACKAGE_CATALOG } from '@/domain/driverRidePackageCatalog';
import { createManualPaymentClaim } from '@/domains/package-payments';
import type { ManualPaymentClaim, PackagePaymentConfiguration } from '@/domains/package-payments';

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

const configuration: PackagePaymentConfiguration = {
  mode: 'manual',
  version: '2026-07-06',
  updatedAt: now.toISOString(),
  manual: {
    providers: [
      { provider: 'mtn', merchantCode: '0202565', ussdTemplate: '*182*8*1*{merchantCode}*{amount}#', enabled: true },
      { provider: 'airtel', merchantCode: '3378888', ussdTemplate: '*182*8*1*{merchantCode}*{amount}#', enabled: true },
    ],
    claimExpiresAfterMinutes: 30,
    transactionReferenceRequired: true,
    proofImageEnabled: true,
    proofImageRequired: false,
  },
};

const mockLoadStoredManualPaymentClaims = jest.fn();
const mockSaveStoredManualPaymentClaims = jest.fn();
let storedClaims: ManualPaymentClaim[] = [];

jest.mock('@/persistence/manualPaymentClaimsPersistence', () => ({
  loadStoredManualPaymentClaims: async (...args: unknown[]) => mockLoadStoredManualPaymentClaims(...args),
  saveStoredManualPaymentClaims: async (claims: ManualPaymentClaim[], ...args: unknown[]) => mockSaveStoredManualPaymentClaims(claims, ...args),
}));

describe('packagePaymentRepositoryFactory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storedClaims = [];
    mockLoadStoredManualPaymentClaims.mockImplementation(async () => ({ data: storedClaims, source: 'current' }));
    mockSaveStoredManualPaymentClaims.mockImplementation(async (claims: ManualPaymentClaim[]) => {
      storedClaims = claims;
    });
  });

  test('returns the configured payment configuration and keeps admin authority unavailable', async () => {
    const repository = createPackagePaymentRepository({ configuration });
    const repositoryRecord = repository as unknown as Record<string, unknown>;

    const config = await repository.getPaymentConfiguration();
    expect(config.data).toEqual(configuration);
    expect(repositoryRecord.approveManualPaymentClaim).toBeUndefined();
    expect(repositoryRecord.rejectManualPaymentClaim).toBeUndefined();
    expect(repositoryRecord.forceActivatePackage).toBeUndefined();
    expect(repositoryRecord.markPaymentVerified).toBeUndefined();
  });

  test('creates and submits a manual claim without activating a package', async () => {
    const repository = createPackagePaymentRepository({ configuration });

    const created = await repository.createManualPaymentClaim({
      claimId: 'RDP-2026-ABC12',
      driverId: 'driver-1',
      offer,
      provider: 'mtn',
      payerPhoneNumber: '+250788000000',
      transactionReference: 'MP123',
    });
    expect(created.failure).toBeNull();
    expect(created.data?.status).toBe('draft');

    const storedClaim = {
      ...created.data!,
      createdAt: '2026-07-06T10:00:00.000Z',
      expiresAt: '2099-01-01T00:30:00.000Z',
    };
    storedClaims = [storedClaim];
    const submitted = await repository.submitManualPaymentClaim({
      claim: storedClaim,
      actorId: 'driver-1',
      submittedAt: '2026-07-06T10:01:00.000Z',
    });

    expect(submitted.failure).toBeNull();
    expect(submitted.data?.status).toBe('submitted');
    expect(mockSaveStoredManualPaymentClaims).toHaveBeenCalled();
  });

  test('rejects duplicate references in the same provider namespace', async () => {
    const existing = createManualPaymentClaim({
      claimId: 'RDP-2026-XYZ99',
      driverId: 'driver-1',
      offer,
      provider: 'mtn',
      payerPhoneNumber: '+250788000000',
      transactionReference: 'DUP-123',
    }, configuration).data as ManualPaymentClaim;

    mockLoadStoredManualPaymentClaims.mockImplementationOnce(async () => ({ data: [existing], source: 'current' }));

    const repository = createPackagePaymentRepository({ configuration });
    const duplicate = await repository.createManualPaymentClaim({
      claimId: 'RDP-2026-ABC12',
      driverId: 'driver-1',
      offer,
      provider: 'mtn',
      payerPhoneNumber: '+250788000000',
      transactionReference: ' DUP-123 ',
    });

    expect(duplicate.failure?.code).toBe('duplicate_transaction_reference');
    expect(JSON.stringify(duplicate.failure)).not.toContain('DUP-123');
  });

  test('rejects invalid phones before persistence', async () => {
    const repository = createPackagePaymentRepository({ configuration });
    const result = await repository.createManualPaymentClaim({
      claimId: 'RDP-2026-ABC12',
      driverId: 'driver-1',
      offer,
      provider: 'mtn',
      payerPhoneNumber: '123',
      transactionReference: 'MP123',
    });

    expect(result.failure?.code).toBe('invalid_claim');
    expect(mockSaveStoredManualPaymentClaims).not.toHaveBeenCalled();
  });
});
