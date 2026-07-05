import type { DriverRideCampaignStatus, DriverRideCampaignType } from '@/domain/driverRideCampaigns';
import type { DriverRidePackageCatalogStatus } from '@/domain/driverRidePackageCatalog';
import type {
  DriverEntitlementAuthority,
  DriverPackageOfferSource,
  DriverPackageQuoteAuthority,
  DriverPackagePurchaseStatus,
  MobileMoneyPackageProvider,
} from '@/domain/driverRidePackages';
import type { VehicleType } from '@/types';
import type { ApiEnvelope, ApiErrorDto, ApiIdempotencyMetadata, ApiPaginationRequest, ApiPaginationResponse } from './shared';

export interface PackageCatalogItemDto {
  packageId: string;
  packageVersion: string;
  packageName: string;
  vehicleType: VehicleType;
  priceRwf: number;
  isFreeTrial?: boolean | null;
  freeTrial?: boolean | null;
  ridesGranted: number;
  bonusRidesGranted: number;
  status: DriverRidePackageCatalogStatus;
  createdAt: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  compareAtPriceRwf?: number | null;
}

export interface PackageCampaignDto {
  campaignId: string;
  campaignName: string;
  campaignType: DriverRideCampaignType;
  status: DriverRideCampaignStatus;
  startDate: string;
  endDate: string;
  createdAt: string;
  description: string;
  packageIds?: string[] | null;
  vehicleTypes?: VehicleType[] | null;
  priceRwf?: number | null;
  ridesGranted?: number | null;
  bonusRidesGranted?: number | null;
}

export interface PackageOfferDto {
  offerId: string;
  packageId: string;
  packageVersion: string;
  packageName: string;
  vehicleId: string;
  vehicleType: VehicleType;
  priceRwf: number;
  ridesGranted: number;
  bonusRidesGranted: number;
  campaignId?: string | null;
  campaignName?: string | null;
  campaignType?: DriverRideCampaignType | null;
  campaignStatus?: DriverRideCampaignStatus | null;
  ownerUserId?: string | null;
  quoteId?: string | null;
  quoteSignature?: string | null;
  quoteAuthority: DriverPackageQuoteAuthority;
  createdAt: string;
  expiresAt: string;
  source: DriverPackageOfferSource;
}

export interface PackageActivationDto {
  id: string;
  packageId: string;
  packageVersion?: string | null;
  packageName?: string | null;
  campaignId?: string | null;
  campaignName?: string | null;
  campaignType?: DriverRideCampaignType | null;
  campaignStatus?: DriverRideCampaignStatus | null;
  vehicleId: string;
  vehicleType: VehicleType;
  activatedAt: string;
  pricePaidRwf: number;
  pricePaid?: number | null;
  ridesGranted?: number | null;
  bonusRidesGranted?: number | null;
  purchasedAt?: string | null;
  creditsGranted: number;
  authority: DriverEntitlementAuthority;
}

export interface PackageCreditTransactionDto {
  id: string;
  type: 'credit' | 'debit';
  vehicleId: string;
  vehicleType: VehicleType;
  amount: number;
  createdAt: string;
  packageActivationId?: string | null;
  completedRideId?: string | null;
  idempotencyKey: string;
  authority: DriverEntitlementAuthority;
}

export interface PackagePurchaseDto {
  transactionId: string;
  offerId?: string | null;
  packageId: string;
  packageVersion?: string | null;
  packageName?: string | null;
  campaignId?: string | null;
  campaignName?: string | null;
  campaignType?: DriverRideCampaignType | null;
  campaignStatus?: DriverRideCampaignStatus | null;
  vehicleId: string;
  vehicleType: VehicleType;
  amount: number;
  pricePaid?: number | null;
  ridesGranted?: number | null;
  bonusRidesGranted?: number | null;
  purchasedAt?: string | null;
  provider: MobileMoneyPackageProvider;
  phoneNumber: string;
  status: DriverPackagePurchaseStatus;
  createdAt: string;
  completedAt?: string | null;
}

export interface PackageVehicleEntitlementDto {
  vehicleId: string;
  vehicleType: VehicleType;
  activePackageId: string | null;
  remainingRideCredits: number;
  remainingBonusRides: number;
  activations: PackageActivationDto[];
  creditTransactions: PackageCreditTransactionDto[];
  purchaseHistory: PackagePurchaseDto[];
  updatedAt: string;
  authority: DriverEntitlementAuthority;
}

export interface PackageEntitlementDto {
  vehicleId: string | null;
  vehicleType: VehicleType | null;
  activePackageId: string | null;
  remainingRideCredits: number;
  remainingBonusRides: number;
  activations: PackageActivationDto[];
  creditTransactions: PackageCreditTransactionDto[];
  purchaseHistory: PackagePurchaseDto[];
  vehicleEntitlements: PackageVehicleEntitlementDto[];
  updatedAt: string;
  authority: DriverEntitlementAuthority;
}

export interface PackageOfferSourceDto {
  catalog: PackageCatalogItemDto[];
  campaigns: PackageCampaignDto[];
  catalogLoaded: true;
  campaignsLoaded: true;
  generation: string;
  lastSuccessfulGenerationAt: string;
  sourceVersion: string;
  cacheCreatedAt: string;
}

export interface PackageCatalogResponseDto extends ApiEnvelope<{ items: PackageCatalogItemDto[] } & ApiPaginationResponse> {}
export interface PackageCampaignResponseDto extends ApiEnvelope<{ items: PackageCampaignDto[] } & ApiPaginationResponse> {}
export interface PackageAvailableOffersResponseDto extends ApiEnvelope<{ items: PackageOfferDto[] } & ApiPaginationResponse> {}
export interface GetPackageEntitlementResponseDto extends ApiEnvelope<PackageEntitlementDto | null> {}
export interface PackagePurchaseResponseDto extends ApiEnvelope<{ items: PackagePurchaseDto[] } & ApiPaginationResponse> {}
export interface PackageOfferSourceResponseDto extends ApiEnvelope<PackageOfferSourceDto> {}
export interface PackageMutationResponseDto extends ApiEnvelope<{
  entitlement: PackageEntitlementDto;
  purchase?: PackagePurchaseDto | null;
  activation?: PackageActivationDto | null;
  deducted?: boolean | null;
  creditTransaction?: PackageCreditTransactionDto | null;
}> {}

export interface CreatePackagePurchaseRequestDto extends ApiIdempotencyMetadata {
  packageId: string;
  packageVersion?: string | null;
  packageName?: string | null;
  offerId?: string | null;
  vehicleId: string;
  vehicleType: VehicleType;
  provider: MobileMoneyPackageProvider;
  phoneNumber: string;
  amount: number;
  pricePaid?: number | null;
  ridesGranted?: number | null;
  bonusRidesGranted?: number | null;
  campaignId?: string | null;
  campaignName?: string | null;
  campaignType?: DriverRideCampaignType | null;
  campaignStatus?: DriverRideCampaignStatus | null;
}

export interface UpdatePackagePurchaseStatusRequestDto extends ApiIdempotencyMetadata {
  transactionId: string;
  status: DriverPackagePurchaseStatus;
}

export interface ActivatePackageRequestDto extends ApiIdempotencyMetadata {
  purchaseId?: string | null;
  transactionId?: string | null;
  offerId?: string | null;
  packageId: string;
  packageVersion?: string | null;
  packageName?: string | null;
  vehicleId: string;
  vehicleType: VehicleType;
  pricePaidRwf: number;
  ridesGranted: number;
  bonusRidesGranted: number;
  campaignId?: string | null;
  campaignName?: string | null;
  campaignType?: DriverRideCampaignType | null;
}

export interface DeductCreditRequestDto extends ApiIdempotencyMetadata {
  rideId: string;
  vehicleId: string;
  vehicleType?: VehicleType | null;
  credits: number;
  packageActivationId?: string | null;
}

export interface PackageCatalogRequestDto extends ApiPaginationRequest {}
export interface PackageCampaignRequestDto extends ApiPaginationRequest {}
export interface PackageOfferSourceRequestDto {}
export interface PackageAvailableOffersRequestDto {
  vehicleId: string;
  vehicleType?: VehicleType | null;
}
export interface PackageEntitlementRequestDto {
  vehicleId?: string | null;
}
export interface PackagePurchaseListRequestDto {
  vehicleId?: string | null;
}

export interface PackageErrorDto extends ApiErrorDto {}

export interface PackageApiContract {
  catalog: PackageCatalogRequestDto | undefined;
  campaigns: PackageCampaignRequestDto | undefined;
  offerSource: PackageOfferSourceRequestDto | undefined;
  offers: PackageAvailableOffersRequestDto | undefined;
  entitlements: PackageEntitlementRequestDto | undefined;
  purchases: PackagePurchaseListRequestDto | undefined;
  createPurchase: CreatePackagePurchaseRequestDto;
  updatePurchaseStatus: UpdatePackagePurchaseStatusRequestDto;
  activatePackage: ActivatePackageRequestDto;
  deductCredit: DeductCreditRequestDto;
}

export const PackageCatalogItemDto = {} as PackageCatalogItemDto;
export const PackageCampaignDto = {} as PackageCampaignDto;
export const PackageOfferDto = {} as PackageOfferDto;
export const PackageActivationDto = {} as PackageActivationDto;
export const PackageCreditTransactionDto = {} as PackageCreditTransactionDto;
export const PackagePurchaseDto = {} as PackagePurchaseDto;
export const PackageVehicleEntitlementDto = {} as PackageVehicleEntitlementDto;
export const PackageEntitlementDto = {} as PackageEntitlementDto;
export const PackageOfferSourceDto = {} as PackageOfferSourceDto;
export const PackageCatalogResponseDto = {} as PackageCatalogResponseDto;
export const PackageCampaignResponseDto = {} as PackageCampaignResponseDto;
export const PackageAvailableOffersResponseDto = {} as PackageAvailableOffersResponseDto;
export const GetPackageEntitlementResponseDto = {} as GetPackageEntitlementResponseDto;
export const PackagePurchaseResponseDto = {} as PackagePurchaseResponseDto;
export const PackageOfferSourceResponseDto = {} as PackageOfferSourceResponseDto;
export const PackageMutationResponseDto = {} as PackageMutationResponseDto;
export const CreatePackagePurchaseRequestDto = {} as CreatePackagePurchaseRequestDto;
export const UpdatePackagePurchaseStatusRequestDto = {} as UpdatePackagePurchaseStatusRequestDto;
export const ActivatePackageRequestDto = {} as ActivatePackageRequestDto;
export const DeductCreditRequestDto = {} as DeductCreditRequestDto;
export const PackageCatalogRequestDto = {} as PackageCatalogRequestDto;
export const PackageCampaignRequestDto = {} as PackageCampaignRequestDto;
export const PackageOfferSourceRequestDto = {} as PackageOfferSourceRequestDto;
export const PackageAvailableOffersRequestDto = {} as PackageAvailableOffersRequestDto;
export const PackageEntitlementRequestDto = {} as PackageEntitlementRequestDto;
export const PackagePurchaseListRequestDto = {} as PackagePurchaseListRequestDto;
export const PackageErrorDto = {} as PackageErrorDto;
export const PackageApiContract = {} as PackageApiContract;
