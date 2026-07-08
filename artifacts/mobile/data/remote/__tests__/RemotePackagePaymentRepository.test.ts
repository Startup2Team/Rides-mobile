import { BackendClientError } from '../backendClient';
import { RemotePackagePaymentRepository } from '../repositories/RemotePackagePaymentRepository';
import {
  type BackendClient,
} from '../backendClient';
import {
  type ManualPaymentClaimDto,
  type PackagePaymentConfigurationDto,
} from '../contracts/api/packagePaymentApi';
import { EMPTY_DRIVER_ENTITLEMENT, createPackageOfferSnapshot } from '@/domain/driverRidePackages';
import { resolvePackageOffer } from '@/domain/driverRideCampaigns';
import { DRIVER_RIDE_PACKAGE_CATALOG } from '@/domain/driverRidePackageCatalog';
import {
  createManualPaymentClaim,
} from '@/domains/package-payments';

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

const configurationDto: PackagePaymentConfigurationDto = {
  mode: 'manual',
  version: '2026-07-06',
  updatedAt: now.toISOString(),
  manual: {
    providers: [
      { provider: 'mtn', merchantCode: '0202565', ussdTemplate: '*182*8*1*{merchantCode}*{amount}#', enabled: true },
    ],
    claimExpiresAfterMinutes: 30,
    transactionReferenceRequired: true,
    proofImageEnabled: true,
    proofImageRequired: false,
  },
};

function createClaimDto(status: ManualPaymentClaimDto['status'] = 'submitted'): ManualPaymentClaimDto {
  const claim = createManualPaymentClaim({
    claimId: 'RDP-2026-ABCDE',
    driverId: 'driver-1',
    offer,
    provider: 'mtn',
    payerPhoneNumber: '+250788000000',
    transactionReference: 'ABC123',
    proofImageId: 'proof-1',
  }, {
    ...configurationDto,
    manual: configurationDto.manual ?? undefined,
  } as Parameters<typeof createManualPaymentClaim>[1]).data!;

  return {
    ...claim,
    status,
    transactionReference: claim.transactionReference ?? null,
    proofImageId: claim.proofImageId ?? null,
    submittedAt: claim.submittedAt ?? null,
    reviewedAt: claim.reviewedAt ?? null,
    reviewedBy: claim.reviewedBy ?? null,
    rejectionReason: claim.rejectionReason ?? null,
    clarificationMessage: claim.clarificationMessage ?? null,
    supportNote: claim.supportNote ?? null,
    activationId: claim.activationId ?? null,
    purchaseTransactionId: claim.purchaseTransactionId ?? null,
    auditLog: claim.auditLog.map(entry => ({ ...entry, actorId: entry.actorId ?? null, reasonCode: entry.reasonCode ?? null })),
  };
}

function createClient(overrides: Partial<Record<'get' | 'post', jest.Mock>> = {}): BackendClient {
  return {
    get: overrides.get ?? jest.fn(),
    post: overrides.post ?? jest.fn(),
  };
}

describe('RemotePackagePaymentRepository', () => {
  test('maps configuration and claim DTOs without invoking activation authority', async () => {
    const client = createClient({
      get: jest.fn().mockResolvedValue(configurationDto),
      post: jest.fn().mockResolvedValue({ data: { claim: createClaimDto() } }),
    });
    const repository = new RemotePackagePaymentRepository(client);
    const activation = jest.fn();
    const updatePackagePurchaseStatus = jest.fn();
    const activatePackage = jest.fn();
    void activation;
    void updatePackagePurchaseStatus;
    void activatePackage;

    await expect(repository.getPaymentConfiguration()).resolves.toEqual({ data: expect.objectContaining({ mode: 'manual' }), failure: null });
    await expect(repository.createManualPaymentClaim({
      claimId: 'RDP-2026-ABCDE',
      driverId: 'driver-1',
      offer,
      provider: 'mtn',
      payerPhoneNumber: '+250788000000',
      transactionReference: 'ABC123',
      proofImageId: 'proof-1',
    })).resolves.toEqual({ data: expect.objectContaining({ id: 'RDP-2026-ABCDE' }), failure: null });

    expect(client.get).toHaveBeenCalled();
    expect(client.post).toHaveBeenCalled();
  });

  test('maps submit/resubmit/cancel requests correctly', async () => {
    const claim = createClaimDto();
    const client = createClient({
      post: jest.fn().mockResolvedValue({ data: { claim } }),
      get: jest.fn().mockResolvedValue({ data: { claim } }),
    });
    const repository = new RemotePackagePaymentRepository(client);

    await repository.submitManualPaymentClaim({ claim, submittedAt: now.toISOString(), actorId: 'driver-1' } as never);
    await repository.resubmitManualPaymentClaim({ claim: { ...claim, status: 'needs_clarification' } as never, submittedAt: now.toISOString(), actorId: 'driver-1' } as never);
    await repository.cancelManualPaymentClaim({ claim: { ...claim, status: 'submitted' } as never, cancelledAt: now.toISOString(), actorId: 'driver-1' } as never);

    expect(client.post).toHaveBeenCalledTimes(3);
  });

  test('maps backend errors to package-payment failures', async () => {
    const client = createClient({
      get: jest.fn().mockRejectedValue(new BackendClientError({
        kind: 'http',
        service: 'package-payments',
        operation: 'getManualPaymentClaim',
        status: 409,
        message: 'Duplicate reference',
      })),
    });
    const repository = new RemotePackagePaymentRepository(client);

    await expect(repository.getManualPaymentClaim('claim-1')).resolves.toMatchObject({
      failure: { code: 'duplicate_transaction_reference' },
    });
  });

  test('does not expose admin authority methods', () => {
    const repository = new RemotePackagePaymentRepository(createClient());
    expect('approveManualPaymentClaim' in repository).toBe(false);
    expect('rejectManualPaymentClaim' in repository).toBe(false);
    expect('forceActivatePackage' in repository).toBe(false);
    expect('markPaymentVerified' in repository).toBe(false);
  });
});
