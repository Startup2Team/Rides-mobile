import type { ManualPaymentClaimStatus, ManualPaymentProvider, PackagePaymentMode } from '@/domains/package-payments';
import type { ManualPaymentVerificationEvidence } from '@/domains/package-payments/manualPaymentVerification';
import type { VehicleType } from '@/types';

export interface ApiEnvelope<T> {
  data: T;
}

export interface ApiPaginationRequest {
  page?: number;
  pageSize?: number;
}

export interface ApiPaginationResponse {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface BackendErrorDto {
  code: string;
  message: string;
  details?: Record<string, string | number | boolean | null | undefined> | null;
}

export interface PackagePaymentModeDto {
  mode: PackagePaymentMode;
  version: string;
  updatedAt: string;
}

export interface ManualPaymentProviderConfigurationDto {
  provider: ManualPaymentProvider;
  displayName?: string | null;
  merchantCode: string;
  ussdTemplate: string;
  enabled: boolean;
}

export interface ManualPackagePaymentConfigurationDto {
  providers: ManualPaymentProviderConfigurationDto[];
  claimExpiresAfterMinutes: number;
  transactionReferenceRequired: boolean;
  proofImageEnabled: boolean;
  proofImageRequired?: boolean | null;
}

export interface PackagePaymentConfigurationDto {
  mode: PackagePaymentMode;
  manual?: ManualPackagePaymentConfigurationDto | null;
  version: string;
  updatedAt: string;
}

export interface ManualPaymentClaimDto {
  id: string;
  displayClaimId?: string | null;
  version: number;
  driverId: string;
  vehicleId: string;
  vehicleType: VehicleType;
  offerId: string;
  packageId: string;
  packageVersion: string;
  packageName: string;
  expectedAmountRwf: number;
  provider: ManualPaymentProvider;
  merchantCodeSnapshot: string;
  payerPhoneNumber: string;
  maskedPayerPhone?: string | null;
  transactionReference?: string | null;
  transactionReferencePresent?: boolean | null;
  maskedTransactionReference?: string | null;
  proofImageId?: string | null;
  status: ManualPaymentClaimStatus;
  createdAt: string;
  submittedAt?: string | null;
  expiresAt: string;
  updatedAt?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  rejectionReason?: string | null;
  rejectionReasonCode?: string | null;
  rejectionMessage?: string | null;
  clarificationMessage?: string | null;
  supportNote?: string | null;
  approvedAt?: string | null;
  activationId?: string | null;
  purchaseTransactionId?: string | null;
  entitlementVersion?: number | null;
  idempotencyKey: string;
  auditLog: Array<{
    id: string;
    at: string;
    actorType: 'driver' | 'admin' | 'support' | 'system';
    actorId?: string | null;
    action: string;
    reasonCode?: string | null;
  }>;
}

export interface ManualPaymentClaimSummaryDto {
  id: string;
  version: number;
  driverId: string;
  packageId: string;
  packageName: string;
  status: ManualPaymentClaimStatus;
  provider: ManualPaymentProvider;
  expectedAmountRwf: number;
  createdAt: string;
  expiresAt: string;
}

export interface ManualPaymentClaimQueueItemDto extends ManualPaymentClaimSummaryDto {
  duplicateTransactionReferenceDetected?: boolean | null;
  ageMinutes?: number | null;
  proofAttached?: boolean | null;
}

export interface ManualPaymentClaimReviewQueueFiltersDto extends ApiPaginationRequest {
  status?: ManualPaymentClaimStatus[] | null;
  provider?: ManualPaymentProvider | null;
  submittedFrom?: string | null;
  submittedTo?: string | null;
  claimSearch?: string | null;
  driverSearch?: string | null;
}

export interface ManualPaymentApprovalEntitlementDto {
  packageId: string;
  packageVersion: string;
  vehicleId: string;
  remainingCredits: number;
  bonusCredits: number;
  activatedAt: string;
  expiresAt: string;
  version: number;
}

export interface ManualPaymentApprovalResultDto {
  claimId: string;
  claimStatus: 'approved';
  claimVersion: number;
  packagePurchaseTransactionId: string;
  packageActivationId: string;
  creditTransactionId: string;
  entitlement: ManualPaymentApprovalEntitlementDto;
  eventId: string;
}

export interface ManualPaymentClaimDetailResponseDto extends ApiEnvelope<ManualPaymentClaimDto> {}
export interface ManualPaymentClaimQueueResponseDto extends ApiEnvelope<{ items: ManualPaymentClaimQueueItemDto[] } & ApiPaginationResponse> {}
export interface ManualPaymentClaimListResponseDto extends ApiEnvelope<{ items: ManualPaymentClaimDto[] } & ApiPaginationResponse> {}
export interface ManualPaymentClaimCursorListResponseDto extends ApiEnvelope<{
  items: ManualPaymentClaimDto[];
  nextCursor: string | null;
}> {}
export interface ManualPaymentClaimMutationResponseDto extends ApiEnvelope<{
  claim?: ManualPaymentClaimDto | null;
  approvedClaim?: ManualPaymentClaimDto | null;
  approvalResult?: ManualPaymentApprovalResultDto | null;
  purchaseTransactionId?: string | null;
  activationId?: string | null;
  entitlementVersion?: string | null;
  eventIds?: string[] | null;
}> {}

export interface BackendErrorResponseDto extends ApiEnvelope<{ error: BackendErrorDto }> {}

export interface GetPackagePaymentConfigurationRequestDto {}
export interface GetManualPaymentClaimRequestDto {
  claimId: string;
}
export interface ManualPaymentClaimListQueryRequestDto {
  driverId?: string | null;
  cursor?: string | null;
  limit?: number | null;
}
export interface ListDriverManualPaymentClaimsRequestDto extends ApiPaginationRequest {
  driverId: string;
  cursor?: string | null;
  limit?: number | null;
}
export interface CreateManualPaymentClaimRequestDto {
  driverId: string;
  vehicleId: string;
  vehicleType: VehicleType;
  offerId: string;
  packageId: string;
  packageVersion: string;
  packageName: string;
  expectedAmountRwf: number;
  provider: ManualPaymentProvider;
  payerPhoneNumber: string;
  transactionReference?: string | null;
  proofImageId?: string | null;
  idempotencyKey: string;
}
export interface ManualPaymentClaimReadDto extends ManualPaymentClaimDto {}
export interface SubmitManualPaymentClaimRequestDto {
  claimId: string;
  idempotencyKey: string;
}
export interface ResubmitManualPaymentClaimRequestDto {
  claimId: string;
  idempotencyKey: string;
}
export interface CancelManualPaymentClaimRequestDto {
  claimId: string;
  idempotencyKey: string;
}

export interface AdminManualPaymentReviewQueueRequestDto extends ApiPaginationRequest {}
export interface AdminManualPaymentClaimDetailRequestDto {
  claimId: string;
}
export interface AdminManualPaymentRequestClarificationRequestDto {
  claimId: string;
  message: string;
  expectedClaimVersion: number;
  idempotencyKey: string;
}
export interface AdminManualPaymentRejectClaimRequestDto {
  claimId: string;
  expectedClaimVersion: number;
  reasonCode: string;
  message?: string | null;
  idempotencyKey: string;
}
export interface AdminManualPaymentApproveClaimRequestDto {
  claimId: string;
  expectedClaimVersion: number;
  verificationEvidence: ManualPaymentVerificationEvidence;
  idempotencyKey: string;
}

export interface AdminManualPaymentClaimReviewResponseDto extends ApiEnvelope<{
  claim?: ManualPaymentClaimDto | null;
  reviewResult?: ManualPaymentApprovalResultDto | null;
  eventId?: string | null;
}> {}

export interface PackagePaymentApiContract {
  getPaymentConfiguration: GetPackagePaymentConfigurationRequestDto | undefined;
  createManualPaymentClaim: CreateManualPaymentClaimRequestDto;
  getManualPaymentClaim: GetManualPaymentClaimRequestDto;
  listDriverManualPaymentClaims: ListDriverManualPaymentClaimsRequestDto;
  submitManualPaymentClaim: SubmitManualPaymentClaimRequestDto;
  resubmitManualPaymentClaim: ResubmitManualPaymentClaimRequestDto;
  cancelManualPaymentClaim: CancelManualPaymentClaimRequestDto;
}

export interface PackagePaymentAdminApiContract {
  listManualPaymentReviewQueue: ManualPaymentClaimReviewQueueFiltersDto | undefined;
  getManualPaymentClaimDetail: AdminManualPaymentClaimDetailRequestDto;
  requestClarification: AdminManualPaymentRequestClarificationRequestDto;
  rejectClaim: AdminManualPaymentRejectClaimRequestDto;
  approveClaim: AdminManualPaymentApproveClaimRequestDto;
}
