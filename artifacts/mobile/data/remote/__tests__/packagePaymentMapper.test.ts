import { BackendClientError } from '../backendClient';
import {
  mapBackendPackagePaymentError,
  mapAdminManualPaymentApproveClaimRequestToDto,
  mapAdminManualPaymentClaimReviewResponseDtoToDomain,
  mapAdminManualPaymentRejectClaimToDto,
  mapAdminManualPaymentRequestClarificationToDto,
  mapCancelManualPaymentClaimInputToDto,
  mapManualPaymentClaimCreateInputToDto,
  mapManualPaymentClaimDtoToDomain,
  mapManualPaymentApprovalResultDtoToDomain,
  mapPackagePaymentConfigurationDtoToDomain,
  mapManualPaymentReviewQueueFiltersToDto,
  mapResubmitManualPaymentClaimInputToDto,
  mapSubmitManualPaymentClaimInputToDto,
} from '../mappers/packagePaymentMapper';
import {
  createManualPaymentClaim,
  type CancelManualPaymentClaimInput,
  type CreateManualPaymentClaimInput,
  type ManualPaymentClaim,
  type PackagePaymentConfiguration,
  type ResubmitManualPaymentClaimInput,
  type SubmitManualPaymentClaimInput,
} from '@/domains/package-payments';
import { EMPTY_DRIVER_ENTITLEMENT, createPackageOfferSnapshot } from '@/domain/driverRidePackages';
import { resolvePackageOffer } from '@/domain/driverRideCampaigns';
import { DRIVER_RIDE_PACKAGE_CATALOG } from '@/domain/driverRidePackageCatalog';
import type { ManualPaymentClaimDto, PackagePaymentConfigurationDto } from '../contracts/api/packagePaymentApi';

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
      { provider: 'mtn', displayName: 'MTN MoMo', merchantCode: '0202565', ussdTemplate: '*182*8*1*{merchantCode}*{amount}#', enabled: true },
      { provider: 'airtel', displayName: 'Airtel Money', merchantCode: '3378888', ussdTemplate: '*182*8*1*{merchantCode}*{amount}#', enabled: true },
    ],
    claimExpiresAfterMinutes: 30,
    transactionReferenceRequired: true,
    proofImageEnabled: true,
    proofImageRequired: false,
  },
};

function createClaimInput(): CreateManualPaymentClaimInput {
  return {
    claimId: 'RDP-2026-ABCDE',
    driverId: 'driver-1',
    offer,
    provider: 'mtn',
    payerPhoneNumber: '+250788000000',
    transactionReference: 'ABC123',
    proofImageId: 'proof-1',
    idempotencyKey: 'manual-payment-claim:RDP-2026-ABCDE',
  };
}

function createClaim(): ManualPaymentClaim {
  const result = createManualPaymentClaim(createClaimInput(), {
    ...configurationDto,
    manual: configurationDto.manual ?? undefined,
  } as PackagePaymentConfiguration).data;
  if (!result) throw new Error('Expected a valid claim fixture.');
  return result;
}

describe('package payment mapper', () => {
  test('maps payment configuration DTO to domain', () => {
    const domain = mapPackagePaymentConfigurationDtoToDomain(configurationDto);
    expect(domain).toMatchObject({
      mode: 'manual',
      version: '2026-07-06',
      manual: {
        claimExpiresAfterMinutes: 30,
        transactionReferenceRequired: true,
        proofImageEnabled: true,
        providers: [
          { provider: 'mtn', merchantCode: '0202565', ussdTemplate: '*182*8*1*{merchantCode}*{amount}#', enabled: true },
          { provider: 'airtel', merchantCode: '3378888', ussdTemplate: '*182*8*1*{merchantCode}*{amount}#', enabled: true },
        ],
      },
    });
    expect(domain.manual?.providers[0].displayName).toBe('MTN MoMo');
  });

  test('maps manual payment claim DTO to domain', () => {
    const claimDto: ManualPaymentClaimDto = {
      ...createClaim(),
      transactionReference: 'ABC123',
      proofImageId: 'proof-1',
      submittedAt: null,
      reviewedAt: null,
      reviewedBy: null,
      rejectionReason: null,
      clarificationMessage: null,
      supportNote: null,
      activationId: null,
      purchaseTransactionId: null,
      auditLog: createClaim().auditLog.map(entry => ({ ...entry, actorId: null, reasonCode: null })),
    };

    const domain = mapManualPaymentClaimDtoToDomain(claimDto);
    expect(domain).toMatchObject({
      id: 'RDP-2026-ABCDE',
      version: 1,
      provider: 'mtn',
      merchantCodeSnapshot: '0202565',
      expectedAmountRwf: offer.priceRwf,
      proofImageId: 'proof-1',
      transactionReference: 'ABC123',
    });
  });

  test('maps create/submit/resubmit/cancel inputs to request DTOs', () => {
    const claim = createClaim();
    const submitInput: SubmitManualPaymentClaimInput = { claim };
    const resubmitInput: ResubmitManualPaymentClaimInput = { claim };
    const cancelInput: CancelManualPaymentClaimInput = { claim };

    expect(mapManualPaymentClaimCreateInputToDto(createClaimInput())).toMatchObject({
      driverId: 'driver-1',
      vehicleId: 'vehicle-1',
      packageId: offer.packageId,
      expectedAmountRwf: offer.priceRwf,
      idempotencyKey: 'manual-payment-claim:RDP-2026-ABCDE',
    });
    expect(mapSubmitManualPaymentClaimInputToDto(submitInput)).toEqual({
      claimId: 'RDP-2026-ABCDE',
      idempotencyKey: claim.idempotencyKey,
    });
    expect(mapResubmitManualPaymentClaimInputToDto(resubmitInput)).toEqual({
      claimId: 'RDP-2026-ABCDE',
      idempotencyKey: claim.idempotencyKey,
    });
    expect(mapCancelManualPaymentClaimInputToDto(cancelInput)).toEqual({
      claimId: 'RDP-2026-ABCDE',
      idempotencyKey: claim.idempotencyKey,
    });
  });

  test('maps admin review DTO blueprints without leaking authority', () => {
    const approvalRequest = {
      claimId: 'RDP-2026-ABCDE',
      expectedClaimVersion: 2,
      verificationEvidence: {
        method: 'merchant_message' as const,
        verifiedAt: now.toISOString(),
        verifiedBy: 'admin-1',
        provider: 'mtn' as const,
        amountMatched: true,
        providerReferenceMatched: true,
      },
      idempotencyKey: 'manual-payment-claim:RDP-2026-ABCDE:approval',
    };
    const clarificationRequest = {
      claimId: 'RDP-2026-ABCDE',
      message: 'Please confirm the payment reference.',
      expectedClaimVersion: 2,
      idempotencyKey: 'manual-payment-claim:RDP-2026-ABCDE:approval',
    };
    const rejectionRequest = {
      claimId: 'RDP-2026-ABCDE',
      reasonCode: 'duplicate_reference',
      message: 'Duplicate payment reference.',
      expectedClaimVersion: 2,
      idempotencyKey: 'manual-payment-claim:RDP-2026-ABCDE:approval',
    };
    const approvalResult = {
      claimId: 'RDP-2026-ABCDE',
      claimStatus: 'approved' as const,
      claimVersion: 3,
      packagePurchaseTransactionId: 'purchase-1',
      packageActivationId: 'activation-1',
      creditTransactionId: 'credit-1',
      entitlement: {
        packageId: 'growth',
        packageVersion: 'v1',
        vehicleId: 'vehicle-1',
        remainingCredits: 20,
        bonusCredits: 0,
        activatedAt: now.toISOString(),
        expiresAt: now.toISOString(),
        version: 5,
      },
      eventId: 'event-1',
    };

    expect(mapAdminManualPaymentApproveClaimRequestToDto(approvalRequest)).toMatchObject(approvalRequest);
    expect(mapAdminManualPaymentRequestClarificationToDto(clarificationRequest)).toMatchObject(clarificationRequest);
    expect(mapAdminManualPaymentRejectClaimToDto(rejectionRequest)).toMatchObject({
      ...rejectionRequest,
      message: 'Duplicate payment reference.',
    });
    expect(mapManualPaymentApprovalResultDtoToDomain(approvalResult)).toMatchObject(approvalResult);
    expect(mapManualPaymentReviewQueueFiltersToDto({ page: 1, pageSize: 20, status: ['pending_review'], provider: 'mtn' })).toMatchObject({ page: 1, pageSize: 20, status: ['pending_review'], provider: 'mtn' });
    expect(mapAdminManualPaymentClaimReviewResponseDtoToDomain({ data: { claim: createClaim() as never, reviewResult: approvalResult as never, eventId: 'event-1' } })).toMatchObject({
      eventId: 'event-1',
    });
  });

  test('maps typed backend errors to package-payment failures', () => {
    expect(mapBackendPackagePaymentError(new BackendClientError({
      kind: 'http',
      service: 'package-payments',
      operation: 'createManualPaymentClaim',
      status: 409,
      message: 'Duplicate reference',
    }))).toMatchObject({ code: 'duplicate_transaction_reference' });

    expect(mapBackendPackagePaymentError(new BackendClientError({
      kind: 'http',
      service: 'package-payments',
      operation: 'getManualPaymentClaim',
      status: 404,
      message: 'Not found',
    }))).toMatchObject({ code: 'claim_not_found' });
    expect(mapBackendPackagePaymentError(new BackendClientError({
      kind: 'http',
      service: 'package-payments',
      operation: 'approveManualPaymentClaim',
      status: 409,
      code: 'claim_version_conflict',
      message: 'Version conflict',
    }))).toMatchObject({ code: 'claim_version_conflict' });
  });
});
