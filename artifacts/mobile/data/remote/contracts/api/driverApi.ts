import type { ApiEnvelope, ApiErrorDto, ApiIdempotencyMetadata, ApiPaginationRequest, ApiPaginationResponse } from './shared';
import type { DriverVehicleReviewEventType, VerificationSubmissionHistoryEventType, VerificationSubmissionStatus, VehicleType } from '@/types';
import type { DocumentKey } from '@/hooks/driver-onboarding/onboardingTypes';

export interface DriverApplicationDto {
  id: string;
  clientSubmissionId?: string | null;
  userId: string;
  status: 'draft' | 'submitted' | 'pending_review' | 'under_review' | 'approved' | 'rejected' | 'needs_clarification' | 'resubmitted';
  reviewStatus?: 'pending_review' | 'approved' | 'rejected' | 'needs_clarification' | null;
  fullName?: string | null;
  phone?: string | null;
  dob?: string | null;
  nationalId?: string | null;
  operatingLocation?: {
    province: string;
    district: string;
    sector: string;
    cell?: string | null;
    village?: string | null;
    city?: string | null;
  } | null;
  momoDetails?: {
    provider: 'mtn' | 'airtel';
    momoCode: string;
    merchantCode?: string | null;
  } | null;
  selfieReference?: string | null;
  firstVehicle?: {
    vehicleType: VehicleType;
    plateNumber: string;
    licenseNumber: string;
    brand?: string | null;
    model?: string | null;
    manufactureYear?: number | null;
    passengerSeats?: number | null;
    loadCapacityKg?: number | null;
    licenseExpiryDate?: string | null;
    insuranceExpiryDate?: string | null;
    authorizationExpiryDate?: string | null;
  } | null;
  documents?: DriverDocumentMetadataDto[] | null;
  reviewDecision?: {
    status: 'approved' | 'rejected';
    reviewedAt: string;
    reviewedBy?: string | null;
    reason?: string | null;
    rejectedFields?: string[] | null;
    rejectedDocuments?: string[] | null;
  } | null;
  history?: Array<{
    id: string;
    type: VerificationSubmissionHistoryEventType | DriverVehicleReviewEventType;
    at: string;
    reason?: string | null;
    rejectedFields?: string[] | null;
    rejectedDocuments?: string[] | null;
    reviewedBy?: string | null;
  }> | null;
  submittedAt?: string | null;
  updatedAt?: string | null;
}

export interface SubmitDriverApplicationRequestDto extends ApiIdempotencyMetadata {
  clientSubmissionId?: string | null;
  userId?: string | null;
  fullName?: string | null;
  phone?: string | null;
  dob?: string | null;
  nationalId?: string | null;
  vehicleType: string;
  plateNumber?: string | null;
  licenseNumber: string;
  operatingLocation?: DriverApplicationDto['operatingLocation'];
  momoDetails?: DriverApplicationDto['momoDetails'];
  documentIds?: string[];
  documents?: DriverDocumentMetadataDto[];
  selfieReference?: string | null;
}

export interface UpdateDriverApplicationRequestDto extends SubmitDriverApplicationRequestDto {
  applicationId: string;
}

export interface DriverApplicationStatusDto {
  applicationId: string;
  userId: string;
  status: DriverApplicationDto['status'];
  reviewStatus: NonNullable<DriverApplicationDto['reviewStatus']>;
  stage: 'draft' | 'submitted' | 'under_review' | 'needs_clarification' | 'approved' | 'rejected';
  updatedAt: string;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  reason?: string | null;
}

export interface SubmitDriverApplicationResponseDto extends ApiEnvelope<DriverApplicationDto> {}
export interface UpdateDriverApplicationResponseDto extends ApiEnvelope<DriverApplicationDto> {}

export interface UploadDriverDocumentRequestDto extends ApiIdempotencyMetadata {
  applicationId: string;
  documentId?: string | null;
  documentType: DocumentKey;
  uploadReferenceKey: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  version?: number | null;
}

export interface DriverDocumentMetadataDto {
  documentId: string;
  documentType: DocumentKey;
  uploadReferenceKey: string;
  verificationStatus: 'verified' | 'pending_review' | 'rejected' | 'needs_clarification';
  submittedAt: string;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  clarificationReason?: string | null;
  version: number;
}

export interface UploadDriverDocumentResponseDto extends ApiEnvelope<DriverDocumentMetadataDto> {}
export interface DriverDocumentMetadataResponseDto extends ApiEnvelope<{ items: DriverDocumentMetadataDto[] } & Partial<ApiPaginationResponse>> {}

export interface DriverApplicationStatusRequestDto {
  applicationId: string;
}

export interface DriverApplicationStatusResponseDto extends ApiEnvelope<DriverApplicationStatusDto> {}

export interface DriverApplicationResponseDto extends ApiEnvelope<DriverApplicationDto | null> {}

export interface DriverClarificationDto {
  id: string;
  applicationId: string;
  status: 'open' | 'responded' | 'closed';
  category: 'application' | 'document' | 'vehicle' | 'payment' | 'other';
  message: string;
  requestedAt: string;
  respondedAt?: string | null;
  responseMessage?: string | null;
}

export interface DriverClarificationListResponseDto extends ApiEnvelope<{ items: DriverClarificationDto[] } & Partial<ApiPaginationResponse>> {}

export interface AdminClarificationResponseRequestDto extends ApiIdempotencyMetadata {
  applicationId: string;
  clarificationId: string;
  message: string;
}

export interface AdminClarificationResponseResponseDto extends ApiEnvelope<DriverClarificationDto | { accepted: true }> {}

export interface DriverErrorDto extends ApiErrorDto {}

export interface DriverApiContract {
  submitDriverApplication: SubmitDriverApplicationRequestDto;
  updateDriverApplication: UpdateDriverApplicationRequestDto;
  uploadDriverDocument: UploadDriverDocumentRequestDto;
  applicationStatus: DriverApplicationStatusRequestDto;
  adminClarificationResponse: AdminClarificationResponseRequestDto;
}

export const SubmitDriverApplicationRequestDto = {} as SubmitDriverApplicationRequestDto;
