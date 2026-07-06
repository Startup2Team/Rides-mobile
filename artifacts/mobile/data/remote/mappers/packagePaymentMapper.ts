import type {
  BackendErrorDto,
  BackendErrorResponseDto,
  CreateManualPaymentClaimRequestDto,
  ManualPackagePaymentConfigurationDto,
  ManualPaymentClaimDto,
  ManualPaymentClaimDetailResponseDto,
  ManualPaymentClaimMutationResponseDto,
  ManualPaymentClaimListResponseDto,
  ManualPaymentClaimQueueResponseDto,
  ManualPaymentClaimSummaryDto,
  PackagePaymentConfigurationDto,
  PackagePaymentModeDto,
  ResubmitManualPaymentClaimRequestDto,
  SubmitManualPaymentClaimRequestDto,
  CancelManualPaymentClaimRequestDto,
} from '../contracts/api/packagePaymentApi';
import { BackendClientError, isBackendClientError } from '../backendClient';
import {
  type CreateManualPaymentClaimInput,
  type ManualPackagePaymentConfiguration,
  type ManualPaymentClaim,
  type ManualPaymentClaimAuditAction,
  type ManualPaymentProviderConfiguration,
  type ManualPaymentValidationResult,
  type PackagePaymentConfiguration,
  type PackagePaymentFailure,
  type PackagePaymentFailureCode,
  type PackagePaymentMode,
  type SubmitManualPaymentClaimInput,
  type ResubmitManualPaymentClaimInput,
  type CancelManualPaymentClaimInput,
} from '@/domains/package-payments';
import { validatePackagePaymentConfiguration } from '@/domains/package-payments';
import { normalizeRwandaPhoneNumber } from '@/utils/rwandaValidation';

const FAILURE_CODES = new Set<PackagePaymentFailureCode>([
  'payment_mode_disabled',
  'manual_payment_unavailable',
  'provider_disabled',
  'invalid_payment_configuration',
  'invalid_ussd_template',
  'invalid_claim',
  'invalid_claim_transition',
  'claim_expired',
  'duplicate_transaction_reference',
  'transaction_reference_required',
  'proof_required',
  'claim_not_found',
  'claim_not_activation_eligible',
  'repository_unavailable',
]);

const AUDIT_ACTIONS = new Set<ManualPaymentClaimAuditAction>([
  'claim_created',
  'claim_submitted',
  'review_started',
  'clarification_requested',
  'clarification_resubmitted',
  'claim_approved',
  'claim_rejected',
  'claim_expired',
  'claim_cancelled',
  'activation_requested',
  'activation_completed',
]);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeOptionalString(value: unknown) {
  return isNonEmptyString(value) ? value.trim() : undefined;
}

function normalizeOptionalNullableString(value: unknown) {
  return isNonEmptyString(value) ? value.trim() : undefined;
}

function normalizeAuditAction(value: unknown): ManualPaymentClaimAuditAction {
  return typeof value === 'string' && AUDIT_ACTIONS.has(value as ManualPaymentClaimAuditAction)
    ? (value as ManualPaymentClaimAuditAction)
    : 'claim_created';
}

function mapManualPackagePaymentConfigurationDtoToDomain(
  dto: ManualPackagePaymentConfigurationDto | null | undefined,
): ManualPackagePaymentConfiguration | undefined {
  if (!dto) return undefined;
  return {
    providers: dto.providers.map((provider): ManualPaymentProviderConfiguration => ({
      provider: provider.provider,
      merchantCode: provider.merchantCode,
      ussdTemplate: provider.ussdTemplate,
      enabled: provider.enabled,
    })),
    claimExpiresAfterMinutes: dto.claimExpiresAfterMinutes,
    transactionReferenceRequired: dto.transactionReferenceRequired,
    proofImageEnabled: dto.proofImageEnabled,
    proofImageRequired: dto.proofImageRequired ?? undefined,
  };
}

export function mapPackagePaymentModeDtoToDomain(dto: PackagePaymentModeDto): PackagePaymentMode {
  return dto.mode;
}

export function mapPackagePaymentConfigurationDtoToDomain(
  dto: PackagePaymentConfigurationDto,
): PackagePaymentConfiguration {
  const validated = validatePackagePaymentConfiguration({
    mode: dto.mode,
    manual: mapManualPackagePaymentConfigurationDtoToDomain(dto.manual ?? undefined),
    version: dto.version,
    updatedAt: dto.updatedAt,
  });
  if (validated.failure || !validated.data) {
    throw new Error('Invalid package payment configuration DTO.');
  }
  return validated.data;
}

export function mapPackagePaymentConfigurationDomainToDto(
  configuration: PackagePaymentConfiguration,
): PackagePaymentConfigurationDto {
  return {
    mode: configuration.mode,
    manual: configuration.manual
      ? {
          providers: configuration.manual.providers.map(provider => ({ ...provider })),
          claimExpiresAfterMinutes: configuration.manual.claimExpiresAfterMinutes,
          transactionReferenceRequired: configuration.manual.transactionReferenceRequired,
          proofImageEnabled: configuration.manual.proofImageEnabled,
          proofImageRequired: configuration.manual.proofImageRequired ?? null,
        }
      : null,
    version: configuration.version,
    updatedAt: configuration.updatedAt,
  };
}

export function mapManualPaymentClaimDtoToDomain(dto: ManualPaymentClaimDto): ManualPaymentClaim {
  return {
    id: dto.id,
    driverId: dto.driverId,
    vehicleId: dto.vehicleId,
    vehicleType: dto.vehicleType,
    offerId: dto.offerId,
    packageId: dto.packageId,
    packageVersion: dto.packageVersion,
    packageName: dto.packageName,
    expectedAmountRwf: dto.expectedAmountRwf,
    provider: dto.provider,
    merchantCodeSnapshot: dto.merchantCodeSnapshot,
    payerPhoneNumber: normalizeRwandaPhoneNumber(dto.payerPhoneNumber) ?? dto.payerPhoneNumber,
    transactionReference: normalizeOptionalString(dto.transactionReference),
    proofImageId: normalizeOptionalString(dto.proofImageId),
    status: dto.status,
    createdAt: dto.createdAt,
    submittedAt: normalizeOptionalNullableString(dto.submittedAt),
    expiresAt: dto.expiresAt,
    reviewedAt: normalizeOptionalNullableString(dto.reviewedAt),
    reviewedBy: normalizeOptionalNullableString(dto.reviewedBy),
    rejectionReason: normalizeOptionalNullableString(dto.rejectionReason),
    clarificationMessage: normalizeOptionalNullableString(dto.clarificationMessage),
    supportNote: normalizeOptionalNullableString(dto.supportNote),
    activationId: normalizeOptionalNullableString(dto.activationId),
    purchaseTransactionId: normalizeOptionalNullableString(dto.purchaseTransactionId),
    idempotencyKey: dto.idempotencyKey,
    auditLog: dto.auditLog.map(entry => ({
      id: entry.id,
      at: entry.at,
      actorType: entry.actorType,
      actorId: normalizeOptionalNullableString(entry.actorId),
      action: normalizeAuditAction(entry.action),
      reasonCode: normalizeOptionalNullableString(entry.reasonCode),
    })),
  };
}

function mapManualPaymentClaimToDto(claim: ManualPaymentClaim): ManualPaymentClaimDto {
  return {
    id: claim.id,
    driverId: claim.driverId,
    vehicleId: claim.vehicleId,
    vehicleType: claim.vehicleType,
    offerId: claim.offerId,
    packageId: claim.packageId,
    packageVersion: claim.packageVersion,
    packageName: claim.packageName,
    expectedAmountRwf: claim.expectedAmountRwf,
    provider: claim.provider,
    merchantCodeSnapshot: claim.merchantCodeSnapshot,
    payerPhoneNumber: claim.payerPhoneNumber,
    transactionReference: claim.transactionReference ?? null,
    proofImageId: claim.proofImageId ?? null,
    status: claim.status,
    createdAt: claim.createdAt,
    submittedAt: claim.submittedAt ?? null,
    expiresAt: claim.expiresAt,
    reviewedAt: claim.reviewedAt ?? null,
    reviewedBy: claim.reviewedBy ?? null,
    rejectionReason: claim.rejectionReason ?? null,
    clarificationMessage: claim.clarificationMessage ?? null,
    supportNote: claim.supportNote ?? null,
    activationId: claim.activationId ?? null,
    purchaseTransactionId: claim.purchaseTransactionId ?? null,
    idempotencyKey: claim.idempotencyKey,
    auditLog: claim.auditLog.map(entry => ({
      id: entry.id,
      at: entry.at,
      actorType: entry.actorType,
      actorId: entry.actorId ?? null,
      action: entry.action,
      reasonCode: entry.reasonCode ?? null,
    })),
  };
}

export function mapManualPaymentClaimCreateInputToDto(
  input: CreateManualPaymentClaimInput,
): CreateManualPaymentClaimRequestDto {
  return {
    driverId: input.driverId,
    vehicleId: input.offer.vehicleId,
    vehicleType: input.offer.vehicleType,
    offerId: input.offer.offerId,
    packageId: input.offer.packageId,
    packageVersion: input.offer.packageVersion,
    packageName: input.offer.packageName,
    expectedAmountRwf: input.offer.priceRwf,
    provider: input.provider,
    payerPhoneNumber: input.payerPhoneNumber,
    transactionReference: input.transactionReference ?? null,
    proofImageId: input.proofImageId ?? null,
    idempotencyKey: input.idempotencyKey ?? `manual-payment-claim:${input.claimId ?? input.offer.offerId}`,
  };
}

export function mapSubmitManualPaymentClaimInputToDto(
  input: SubmitManualPaymentClaimInput,
): SubmitManualPaymentClaimRequestDto {
  return {
    claimId: input.claim.id,
    idempotencyKey: input.claim.idempotencyKey,
  };
}

export function mapResubmitManualPaymentClaimInputToDto(
  input: ResubmitManualPaymentClaimInput,
): ResubmitManualPaymentClaimRequestDto {
  return {
    claimId: input.claim.id,
    idempotencyKey: input.claim.idempotencyKey,
  };
}

export function mapCancelManualPaymentClaimInputToDto(
  input: CancelManualPaymentClaimInput,
): CancelManualPaymentClaimRequestDto {
  return {
    claimId: input.claim.id,
    idempotencyKey: input.claim.idempotencyKey,
  };
}

export function mapManualPaymentClaimDetailResponseDtoToDomain(
  response: ManualPaymentClaimDetailResponseDto | ManualPaymentClaimMutationResponseDto,
): ManualPaymentClaim {
  if ('id' in response.data) {
    return mapManualPaymentClaimDtoToDomain(response.data);
  }
  const claim = response.data.claim ?? response.data.approvedClaim;
  if (!claim) throw new Error('Manual payment claim response did not include a claim.');
  return mapManualPaymentClaimDtoToDomain(claim);
}

export function mapManualPaymentClaimListResponseDtoToDomain(
  response: ManualPaymentClaimListResponseDto,
): ManualPaymentClaim[] {
  return response.data.items.map(mapManualPaymentClaimDtoToDomain);
}

export function mapManualPaymentClaimQueueResponseDtoToDomain(
  response: ManualPaymentClaimQueueResponseDto,
): ManualPaymentClaimSummaryDto[] {
  return response.data.items.map(item => ({ ...item }));
}

function isPackagePaymentFailureCode(value: string): value is PackagePaymentFailureCode {
  return FAILURE_CODES.has(value as PackagePaymentFailureCode);
}

function mapErrorDtoToFailure(dto: BackendErrorDto, fallback: PackagePaymentFailureCode = 'repository_unavailable'): PackagePaymentFailure {
  const code = isPackagePaymentFailureCode(dto.code) ? dto.code : fallback;
  return {
    code,
    message: dto.message || 'Package payment request failed.',
    details: dto.details ?? undefined,
  };
}

export function mapBackendPackagePaymentError(error: unknown): PackagePaymentFailure {
  if (isBackendClientError(error)) {
    const backendDto = error.details?.error as BackendErrorDto | undefined;
    if (backendDto) return mapErrorDtoToFailure(backendDto);

    if (error.code && isPackagePaymentFailureCode(error.code)) {
      return {
        code: error.code,
        message: error.message,
        details: error.status != null ? { status: error.status } : undefined,
      };
    }

    if (error.status === 404) return { code: 'claim_not_found', message: error.message, details: { status: error.status } };
    if (error.status === 409) return { code: 'duplicate_transaction_reference', message: error.message, details: { status: error.status } };
    if (error.status === 422) return { code: 'invalid_claim', message: error.message, details: { status: error.status } };
    if (error.status === 403) return { code: 'manual_payment_unavailable', message: error.message, details: { status: error.status } };

    return {
      code: 'repository_unavailable',
      message: error.message,
      details: error.status != null ? { status: error.status } : undefined,
    };
  }

  if (error instanceof Error) {
    return {
      code: 'repository_unavailable',
      message: error.message,
    };
  }

  return {
    code: 'repository_unavailable',
    message: 'Package payment repository is unavailable.',
  };
}

export function createPackagePaymentBackendFailure(
  error: unknown,
): ManualPaymentValidationResult<never> {
  return {
    data: null,
    failure: mapBackendPackagePaymentError(error),
  };
}
