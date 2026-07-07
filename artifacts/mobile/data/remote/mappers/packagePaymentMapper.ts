import type {
  BackendErrorDto,
  BackendErrorResponseDto,
  AdminManualPaymentApproveClaimRequestDto,
  AdminManualPaymentClaimReviewResponseDto,
  AdminManualPaymentRejectClaimRequestDto,
  AdminManualPaymentRequestClarificationRequestDto,
  CreateManualPaymentClaimRequestDto,
  ManualPackagePaymentConfigurationDto,
  ManualPaymentClaimDto,
  ManualPaymentClaimDetailResponseDto,
  ManualPaymentClaimMutationResponseDto,
  ManualPaymentClaimListResponseDto,
  ManualPaymentClaimCursorListResponseDto,
  ManualPaymentClaimQueueResponseDto,
  ManualPaymentClaimReviewQueueFiltersDto,
  ManualPaymentClaimSummaryDto,
  ManualPaymentApprovalResultDto,
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
  type ManualPaymentVerificationEvidence,
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
  'claim_version_conflict',
  'claim_not_reviewable',
  'claim_not_approvable',
  'invalid_verification_evidence',
  'verification_provider_mismatch',
  'payment_amount_not_matched',
  'provider_reference_not_matched',
  'idempotency_conflict',
  'approval_already_completed',
  'activation_transaction_failed',
  'package_purchase_transaction_failed',
  'credit_transaction_failed',
  'approval_transaction_failed',
  'unauthorized',
  'forbidden',
  'not_found',
  'rate_limited',
  'timeout',
  'network_error',
  'service_unavailable',
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
      displayName: provider.displayName ?? undefined,
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
    version: dto.version ?? 1,
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
    // The backend may later return a safer read model; current domain mapping keeps compatibility.
    reviewedAt: normalizeOptionalNullableString(dto.reviewedAt),
    reviewedBy: normalizeOptionalNullableString(dto.reviewedBy),
    rejectionReason: normalizeOptionalNullableString(dto.rejectionReason ?? dto.rejectionReasonCode ?? dto.rejectionMessage),
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
    version: claim.version,
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
    maskedPayerPhone: normalizeRwandaPhoneNumber(claim.payerPhoneNumber)
      ? `+250***${normalizeRwandaPhoneNumber(claim.payerPhoneNumber)?.slice(-4)}`
      : null,
    transactionReference: claim.transactionReference ?? null,
    transactionReferencePresent: Boolean(claim.transactionReference?.trim()),
    maskedTransactionReference: claim.transactionReference ? `***${claim.transactionReference.trim().slice(-4)}` : null,
    proofImageId: claim.proofImageId ?? null,
    status: claim.status,
    createdAt: claim.createdAt,
    submittedAt: claim.submittedAt ?? null,
    expiresAt: claim.expiresAt,
    updatedAt: claim.reviewedAt ?? claim.submittedAt ?? claim.createdAt,
    reviewedAt: claim.reviewedAt ?? null,
    reviewedBy: claim.reviewedBy ?? null,
    rejectionReason: claim.rejectionReason ?? null,
    rejectionReasonCode: claim.rejectionReason ?? null,
    rejectionMessage: claim.rejectionReason ?? null,
    clarificationMessage: claim.clarificationMessage ?? null,
    supportNote: claim.supportNote ?? null,
    approvedAt: claim.status === 'approved' ? claim.reviewedAt ?? claim.submittedAt ?? claim.createdAt : null,
    activationId: claim.activationId ?? null,
    purchaseTransactionId: claim.purchaseTransactionId ?? null,
    entitlementVersion: null,
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

export function mapManualPaymentClaimCursorListResponseDtoToDomain(
  response: ManualPaymentClaimCursorListResponseDto,
): ManualPaymentClaim[] {
  return response.data.items.map(mapManualPaymentClaimDtoToDomain);
}

export function mapManualPaymentClaimQueueResponseDtoToDomain(
  response: ManualPaymentClaimQueueResponseDto,
): ManualPaymentClaimSummaryDto[] {
  return response.data.items.map(item => ({ ...item, version: item.version ?? 1 }));
}

export function mapManualPaymentReviewQueueFiltersToDto(
  input: ManualPaymentClaimReviewQueueFiltersDto,
): ManualPaymentClaimReviewQueueFiltersDto {
  return {
    page: input.page,
    pageSize: input.pageSize,
    status: input.status ?? null,
    provider: input.provider ?? null,
    submittedFrom: input.submittedFrom ?? null,
    submittedTo: input.submittedTo ?? null,
    claimSearch: input.claimSearch ?? null,
    driverSearch: input.driverSearch ?? null,
  };
}

export function mapManualPaymentApprovalEvidenceToDto(
  evidence: ManualPaymentVerificationEvidence,
): ManualPaymentVerificationEvidence {
  return { ...evidence };
}

export function mapAdminManualPaymentApproveClaimRequestToDto(
  input: AdminManualPaymentApproveClaimRequestDto,
): AdminManualPaymentApproveClaimRequestDto {
  return {
    claimId: input.claimId,
    expectedClaimVersion: input.expectedClaimVersion,
    verificationEvidence: mapManualPaymentApprovalEvidenceToDto(input.verificationEvidence),
    idempotencyKey: input.idempotencyKey,
  };
}

export function mapAdminManualPaymentRequestClarificationToDto(
  input: AdminManualPaymentRequestClarificationRequestDto,
): AdminManualPaymentRequestClarificationRequestDto {
  return {
    claimId: input.claimId,
    message: input.message,
    expectedClaimVersion: input.expectedClaimVersion,
    idempotencyKey: input.idempotencyKey,
  };
}

export function mapAdminManualPaymentRejectClaimToDto(
  input: AdminManualPaymentRejectClaimRequestDto,
): AdminManualPaymentRejectClaimRequestDto {
  return {
    claimId: input.claimId,
    expectedClaimVersion: input.expectedClaimVersion,
    reasonCode: input.reasonCode,
    message: input.message ?? null,
    idempotencyKey: input.idempotencyKey,
  };
}

export function mapManualPaymentApprovalResultDtoToDomain(dto: ManualPaymentApprovalResultDto) {
  return {
    claimId: dto.claimId,
    claimStatus: dto.claimStatus,
    claimVersion: dto.claimVersion,
    packagePurchaseTransactionId: dto.packagePurchaseTransactionId,
    packageActivationId: dto.packageActivationId,
    creditTransactionId: dto.creditTransactionId,
    entitlement: {
      packageId: dto.entitlement.packageId,
      packageVersion: dto.entitlement.packageVersion,
      vehicleId: dto.entitlement.vehicleId,
      remainingCredits: dto.entitlement.remainingCredits,
      bonusCredits: dto.entitlement.bonusCredits,
      activatedAt: dto.entitlement.activatedAt,
      expiresAt: dto.entitlement.expiresAt,
      version: dto.entitlement.version,
    },
    eventId: dto.eventId,
  };
}

export function mapAdminManualPaymentClaimReviewResponseDtoToDomain(
  response: AdminManualPaymentClaimReviewResponseDto,
) {
  return {
    claim: response.data.claim ? mapManualPaymentClaimDtoToDomain(response.data.claim) : null,
    reviewResult: response.data.reviewResult ? mapManualPaymentApprovalResultDtoToDomain(response.data.reviewResult) : null,
    eventId: response.data.eventId ?? null,
  };
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

    if (error.kind === 'network') return { code: 'network_error', message: error.message, details: { kind: error.kind } };
    if (error.kind === 'aborted') return { code: 'timeout', message: error.message, details: { kind: error.kind } };

    if (error.status === 401) return { code: 'unauthorized', message: error.message, details: { status: error.status } };
    if (error.status === 403) return { code: 'forbidden', message: error.message, details: { status: error.status } };
    if (error.status === 404) return { code: 'claim_not_found', message: error.message, details: { status: error.status } };
    if (error.status === 408) return { code: 'timeout', message: error.message, details: { status: error.status } };
    if (error.status === 409) return { code: 'duplicate_transaction_reference', message: error.message, details: { status: error.status } };
    if (error.status === 422) return { code: 'invalid_claim', message: error.message, details: { status: error.status } };
    if (error.status === 429) return { code: 'rate_limited', message: error.message, details: { status: error.status } };
    if (error.status === 503) return { code: 'service_unavailable', message: error.message, details: { status: error.status } };

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
