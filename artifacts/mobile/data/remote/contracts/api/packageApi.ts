import type { ApiEnvelope, ApiErrorDto, ApiIdempotencyMetadata, ApiPaginationRequest, ApiPaginationResponse } from './shared';

export interface PackageCatalogItemDto {
  id: string;
  vehicleType: string;
  title: string;
  rideCredits: number;
}

export interface PackageCampaignDto {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
}

export interface PackageEntitlementDto {
  id: string;
  vehicleId: string;
  remainingRideCredits: number;
}

export interface PackagePurchaseDto {
  id: string;
  status: 'pending' | 'activated' | 'failed';
}

export interface PackageCatalogResponseDto extends ApiEnvelope<{ items: PackageCatalogItemDto[] } & ApiPaginationResponse> {}
export interface PackageCampaignResponseDto extends ApiEnvelope<{ items: PackageCampaignDto[] } & ApiPaginationResponse> {}
export interface PackageEntitlementResponseDto extends ApiEnvelope<{ items: PackageEntitlementDto[] }> {}
export interface PackagePurchaseResponseDto extends ApiEnvelope<{ items: PackagePurchaseDto[] }> {}

export interface CreatePackagePurchaseRequestDto extends ApiIdempotencyMetadata {
  packageId: string;
  vehicleId: string;
}

export interface ActivatePackageRequestDto extends ApiIdempotencyMetadata {
  purchaseId: string;
}

export interface DeductCreditRequestDto extends ApiIdempotencyMetadata {
  rideId: string;
  vehicleId: string;
  credits: number;
}

export interface PackageErrorDto extends ApiErrorDto {}

export interface PackageApiContract {
  catalog: ApiPaginationRequest | undefined;
  campaigns: ApiPaginationRequest | undefined;
  entitlements: { vehicleId: string };
  purchases: { vehicleId: string };
  createPurchase: CreatePackagePurchaseRequestDto;
  activatePackage: ActivatePackageRequestDto;
  deductCredit: DeductCreditRequestDto;
}
