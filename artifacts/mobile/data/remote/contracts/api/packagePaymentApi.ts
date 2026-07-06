import type { ManualPaymentClaimStatus, ManualPaymentProvider, PackagePaymentMode } from '@/domains/package-payments';
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
  transactionReference?: string | null;
  proofImageId?: string | null;
  status: ManualPaymentClaimStatus;
  createdAt: string;
  submittedAt?: string | null;
  expiresAt: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  rejectionReason?: string | null;
  clarificationMessage?: string | null;
  supportNote?: string | null;
  activationId?: string | null;
  purchaseTransactionId?: string | null;
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

export interface ManualPaymentClaimDetailResponseDto extends ApiEnvelope<ManualPaymentClaimDto> {}
export interface ManualPaymentClaimQueueResponseDto extends ApiEnvelope<{ items: ManualPaymentClaimQueueItemDto[] } & ApiPaginationResponse> {}
export interface ManualPaymentClaimListResponseDto extends ApiEnvelope<{ items: ManualPaymentClaimDto[] } & ApiPaginationResponse> {}
export interface ManualPaymentClaimMutationResponseDto extends ApiEnvelope<{
  claim?: ManualPaymentClaimDto | null;
  approvedClaim?: ManualPaymentClaimDto | null;
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
export interface ListDriverManualPaymentClaimsRequestDto extends ApiPaginationRequest {
  driverId: string;
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
  idempotencyKey: string;
}
export interface AdminManualPaymentRejectClaimRequestDto {
  claimId: string;
  reasonCode: string;
  message?: string | null;
  idempotencyKey: string;
}
export interface AdminManualPaymentApproveClaimRequestDto {
  claimId: string;
  idempotencyKey: string;
}

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
  listManualPaymentReviewQueue: AdminManualPaymentReviewQueueRequestDto | undefined;
  getManualPaymentClaimDetail: AdminManualPaymentClaimDetailRequestDto;
  requestClarification: AdminManualPaymentRequestClarificationRequestDto;
  rejectClaim: AdminManualPaymentRejectClaimRequestDto;
  approveClaim: AdminManualPaymentApproveClaimRequestDto;
}
