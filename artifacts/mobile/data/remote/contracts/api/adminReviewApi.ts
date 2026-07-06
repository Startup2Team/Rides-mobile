import type { ApiEnvelope, ApiErrorDto, ApiIdempotencyMetadata, ApiPaginationRequest, ApiPaginationResponse } from './shared';

export interface AdminReviewDto {
  id: string;
  entityType: 'driver_application' | 'document' | 'vehicle' | 'payment';
  status: 'pending' | 'approved' | 'rejected' | 'needs_clarification';
  createdAt: string;
}

export interface ListAdminReviewsResponseDto extends ApiEnvelope<{ items: AdminReviewDto[] } & ApiPaginationResponse> {}

export interface AdminReviewErrorDto extends ApiErrorDto {}

export interface AdminReviewApiContract {
  listReviews: ApiPaginationRequest | undefined;
}
