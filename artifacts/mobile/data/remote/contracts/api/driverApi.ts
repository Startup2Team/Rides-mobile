import type { ApiEnvelope, ApiErrorDto, ApiIdempotencyMetadata, ApiPaginationRequest, ApiPaginationResponse } from './shared';

export interface DriverApplicationDto {
  id: string;
  userId: string;
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'needs_clarification';
  submittedAt?: string | null;
}

export interface SubmitDriverApplicationRequestDto extends ApiIdempotencyMetadata {
  vehicleType: string;
  licenseNumber: string;
  documentIds: string[];
}

export interface SubmitDriverApplicationResponseDto extends ApiEnvelope<DriverApplicationDto> {}

export interface UploadDriverDocumentRequestDto extends ApiIdempotencyMetadata {
  applicationId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

export interface UploadDriverDocumentResponseDto extends ApiEnvelope<{ documentId: string; uploadedAt: string }> {}

export interface DriverApplicationStatusRequestDto {
  applicationId: string;
}

export interface DriverApplicationStatusResponseDto extends ApiEnvelope<DriverApplicationDto> {}

export interface AdminClarificationResponseRequestDto extends ApiIdempotencyMetadata {
  applicationId: string;
  clarificationId: string;
  message: string;
}

export interface AdminClarificationResponseResponseDto extends ApiEnvelope<{ accepted: true }> {}

export interface DriverErrorDto extends ApiErrorDto {}

export interface DriverApiContract {
  submitDriverApplication: SubmitDriverApplicationRequestDto;
  uploadDriverDocument: UploadDriverDocumentRequestDto;
  applicationStatus: DriverApplicationStatusRequestDto;
  adminClarificationResponse: AdminClarificationResponseRequestDto;
}

export const SubmitDriverApplicationRequestDto = {} as SubmitDriverApplicationRequestDto;
