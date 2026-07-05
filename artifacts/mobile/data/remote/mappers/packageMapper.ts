import type { ApiIdempotencyMetadata } from '../contracts/api/shared';
import {
  BackendError,
  BackendUnavailableError,
  ConflictError,
  ForbiddenError,
  OfflineError,
  RateLimitedError,
  SerializationError,
  ServerError,
  TimeoutError,
  UnauthorizedError,
  ValidationError,
  createNotImplementedError,
} from '../contracts/backendErrors';
import type {
  ActivatePackageRequestDto,
  CreatePackagePurchaseRequestDto,
  DeductCreditRequestDto,
  PackageActivationDto,
  PackageCampaignDto,
  PackageCatalogItemDto,
  PackageCreditTransactionDto,
  PackageEntitlementDto,
  PackageOfferDto,
  PackageOfferSourceDto,
  PackagePurchaseDto,
  PackageVehicleEntitlementDto,
  UpdatePackagePurchaseStatusRequestDto,
} from '../contracts/api';
import type {
  DriverEntitlement,
  DriverPackageOfferSnapshot,
  DriverPackagePurchase,
  DriverCreditTransaction,
  DriverPackagePurchaseStatus,
  MobileMoneyPackageProvider,
  PackageActivation,
  VehicleEntitlement,
} from '@/domain/driverRidePackages';
import type { DriverRidePackageCampaign } from '@/domain/driverRideCampaigns';
import type { DriverRidePackageCatalogEntry } from '@/domain/driverRidePackageCatalog';
import type { PackageOfferSourceCache } from '@/persistence/packageSyncPersistence';
import type { VehicleType } from '@/types';

function mapArray<TInput, TOutput>(items: TInput[] | null | undefined, mapper: (item: TInput) => TOutput): TOutput[] {
  return (items ?? []).map(mapper);
}

export function dtoToDomainPackageCatalogEntry(dto: PackageCatalogItemDto): DriverRidePackageCatalogEntry {
  return {
    packageId: dto.packageId,
    packageVersion: dto.packageVersion,
    packageName: dto.packageName,
    vehicleType: dto.vehicleType,
    priceRwf: dto.priceRwf,
    isFreeTrial: dto.isFreeTrial ?? dto.freeTrial ?? undefined,
    ridesGranted: dto.ridesGranted,
    bonusRidesGranted: dto.bonusRidesGranted,
    status: dto.status,
    createdAt: dto.createdAt,
    effectiveFrom: dto.effectiveFrom,
    effectiveUntil: dto.effectiveUntil,
    compareAtPriceRwf: dto.compareAtPriceRwf ?? undefined,
  };
}

export function dtoListToDomainPackageCatalogEntries(items: PackageCatalogItemDto[] | null | undefined): DriverRidePackageCatalogEntry[] {
  return mapArray(items, dtoToDomainPackageCatalogEntry);
}

export function domainToPackageCatalogDto(entry: DriverRidePackageCatalogEntry): PackageCatalogItemDto {
  return {
    packageId: entry.packageId,
    packageVersion: entry.packageVersion,
    packageName: entry.packageName,
    vehicleType: entry.vehicleType,
    priceRwf: entry.priceRwf,
    isFreeTrial: entry.isFreeTrial ?? null,
    ridesGranted: entry.ridesGranted,
    bonusRidesGranted: entry.bonusRidesGranted,
    status: entry.status,
    createdAt: entry.createdAt,
    effectiveFrom: entry.effectiveFrom,
    effectiveUntil: entry.effectiveUntil,
    compareAtPriceRwf: entry.compareAtPriceRwf ?? null,
  };
}

export function dtoToDomainPackageCampaign(dto: PackageCampaignDto): DriverRidePackageCampaign {
  return {
    campaignId: dto.campaignId,
    campaignName: dto.campaignName,
    campaignType: dto.campaignType,
    status: dto.status,
    startDate: dto.startDate,
    endDate: dto.endDate,
    createdAt: dto.createdAt,
    description: dto.description,
    packageIds: dto.packageIds ?? undefined,
    vehicleTypes: dto.vehicleTypes ?? undefined,
    priceRwf: dto.priceRwf ?? undefined,
    ridesGranted: dto.ridesGranted ?? undefined,
    bonusRidesGranted: dto.bonusRidesGranted ?? undefined,
  };
}

export function dtoListToDomainPackageCampaigns(items: PackageCampaignDto[] | null | undefined): DriverRidePackageCampaign[] {
  return mapArray(items, dtoToDomainPackageCampaign);
}

export function domainToPackageCampaignDto(campaign: DriverRidePackageCampaign): PackageCampaignDto {
  return {
    campaignId: campaign.campaignId,
    campaignName: campaign.campaignName,
    campaignType: campaign.campaignType,
    status: campaign.status,
    startDate: campaign.startDate,
    endDate: campaign.endDate,
    createdAt: campaign.createdAt,
    description: campaign.description,
    packageIds: campaign.packageIds ?? null,
    vehicleTypes: campaign.vehicleTypes ?? null,
    priceRwf: campaign.priceRwf ?? null,
    ridesGranted: campaign.ridesGranted ?? null,
    bonusRidesGranted: campaign.bonusRidesGranted ?? null,
  };
}

export function dtoToDomainPackageOffer(dto: PackageOfferDto): DriverPackageOfferSnapshot {
  return {
    offerId: dto.offerId,
    packageId: dto.packageId,
    packageVersion: dto.packageVersion,
    packageName: dto.packageName,
    vehicleId: dto.vehicleId,
    vehicleType: dto.vehicleType,
    priceRwf: dto.priceRwf,
    ridesGranted: dto.ridesGranted,
    bonusRidesGranted: dto.bonusRidesGranted,
    campaignId: dto.campaignId ?? null,
    campaignName: dto.campaignName ?? null,
    campaignType: dto.campaignType ?? null,
    ownerUserId: dto.ownerUserId ?? null,
    quoteId: dto.quoteId ?? null,
    quoteSignature: dto.quoteSignature ?? null,
    quoteAuthority: dto.quoteAuthority,
    createdAt: dto.createdAt,
    expiresAt: dto.expiresAt,
    source: dto.source,
  };
}

export function dtoListToDomainPackageOffers(items: PackageOfferDto[] | null | undefined): DriverPackageOfferSnapshot[] {
  return mapArray(items, dtoToDomainPackageOffer);
}

export function domainToPackageOfferDto(offer: DriverPackageOfferSnapshot): PackageOfferDto {
  return {
    offerId: offer.offerId,
    packageId: offer.packageId,
    packageVersion: offer.packageVersion,
    packageName: offer.packageName,
    vehicleId: offer.vehicleId,
    vehicleType: offer.vehicleType,
    priceRwf: offer.priceRwf,
    ridesGranted: offer.ridesGranted,
    bonusRidesGranted: offer.bonusRidesGranted,
    campaignId: offer.campaignId ?? null,
    campaignName: offer.campaignName ?? null,
    campaignType: offer.campaignType ?? null,
    campaignStatus: offer.campaignId ? 'active' : null,
    ownerUserId: offer.ownerUserId ?? null,
    quoteId: offer.quoteId ?? null,
    quoteSignature: offer.quoteSignature ?? null,
    quoteAuthority: offer.quoteAuthority,
    createdAt: offer.createdAt,
    expiresAt: offer.expiresAt,
    source: offer.source,
  };
}

export function dtoToDomainPackageActivation(dto: PackageActivationDto): PackageActivation {
  return {
    id: dto.id,
    packageId: dto.packageId,
    packageVersion: dto.packageVersion ?? undefined,
    packageName: dto.packageName ?? undefined,
    campaignId: dto.campaignId ?? null,
    campaignName: dto.campaignName ?? null,
    campaignType: dto.campaignType ?? null,
    campaignStatus: dto.campaignStatus ?? null,
    vehicleId: dto.vehicleId,
    vehicleType: dto.vehicleType,
    activatedAt: dto.activatedAt,
    pricePaidRwf: dto.pricePaidRwf,
    pricePaid: dto.pricePaid ?? undefined,
    ridesGranted: dto.ridesGranted ?? undefined,
    bonusRidesGranted: dto.bonusRidesGranted ?? undefined,
    purchasedAt: dto.purchasedAt ?? undefined,
    creditsGranted: dto.creditsGranted,
    authority: dto.authority,
  };
}

export function domainToPackageActivationDto(activation: PackageActivation): PackageActivationDto {
  return {
    id: activation.id,
    packageId: activation.packageId,
    packageVersion: activation.packageVersion ?? null,
    packageName: activation.packageName ?? null,
    campaignId: activation.campaignId ?? null,
    campaignName: activation.campaignName ?? null,
    campaignType: activation.campaignType ?? null,
    campaignStatus: activation.campaignStatus ?? null,
    vehicleId: activation.vehicleId,
    vehicleType: activation.vehicleType,
    activatedAt: activation.activatedAt,
    pricePaidRwf: activation.pricePaidRwf,
    pricePaid: activation.pricePaid ?? null,
    ridesGranted: activation.ridesGranted ?? null,
    bonusRidesGranted: activation.bonusRidesGranted ?? null,
    purchasedAt: activation.purchasedAt ?? null,
    creditsGranted: activation.creditsGranted,
    authority: activation.authority,
  };
}

export function dtoToDomainPackageCreditTransaction(dto: PackageCreditTransactionDto): DriverCreditTransaction {
  return {
    id: dto.id,
    type: dto.type,
    vehicleId: dto.vehicleId,
    vehicleType: dto.vehicleType,
    amount: dto.amount,
    createdAt: dto.createdAt,
    packageActivationId: dto.packageActivationId ?? undefined,
    completedRideId: dto.completedRideId ?? undefined,
    idempotencyKey: dto.idempotencyKey,
    authority: dto.authority,
  };
}

export function domainToPackageCreditTransactionDto(transaction: DriverCreditTransaction): PackageCreditTransactionDto {
  return {
    id: transaction.id,
    type: transaction.type,
    vehicleId: transaction.vehicleId,
    vehicleType: transaction.vehicleType,
    amount: transaction.amount,
    createdAt: transaction.createdAt,
    packageActivationId: transaction.packageActivationId ?? null,
    completedRideId: transaction.completedRideId ?? null,
    idempotencyKey: transaction.idempotencyKey,
    authority: transaction.authority,
  };
}

export function dtoToDomainPackagePurchase(dto: PackagePurchaseDto): DriverPackagePurchase {
  return {
    offerId: dto.offerId ?? undefined,
    packageId: dto.packageId,
    packageVersion: dto.packageVersion ?? undefined,
    packageName: dto.packageName ?? undefined,
    campaignId: dto.campaignId ?? null,
    campaignName: dto.campaignName ?? null,
    campaignType: dto.campaignType ?? null,
    campaignStatus: dto.campaignStatus ?? null,
    vehicleId: dto.vehicleId,
    vehicleType: dto.vehicleType,
    amount: dto.amount,
    pricePaid: dto.pricePaid ?? undefined,
    ridesGranted: dto.ridesGranted ?? undefined,
    bonusRidesGranted: dto.bonusRidesGranted ?? undefined,
    purchasedAt: dto.purchasedAt ?? undefined,
    provider: dto.provider,
    phoneNumber: dto.phoneNumber,
    transactionId: dto.transactionId,
    status: dto.status,
    createdAt: dto.createdAt,
    completedAt: dto.completedAt ?? undefined,
  };
}

export function dtoListToDomainPackagePurchases(items: PackagePurchaseDto[] | null | undefined): DriverPackagePurchase[] {
  return mapArray(items, dtoToDomainPackagePurchase);
}

export function domainToPackagePurchaseDto(purchase: DriverPackagePurchase): PackagePurchaseDto {
  return {
    transactionId: purchase.transactionId,
    offerId: purchase.offerId ?? null,
    packageId: purchase.packageId,
    packageVersion: purchase.packageVersion ?? null,
    packageName: purchase.packageName ?? null,
    campaignId: purchase.campaignId ?? null,
    campaignName: purchase.campaignName ?? null,
    campaignType: purchase.campaignType ?? null,
    campaignStatus: purchase.campaignStatus ?? null,
    vehicleId: purchase.vehicleId,
    vehicleType: purchase.vehicleType,
    amount: purchase.amount,
    pricePaid: purchase.pricePaid ?? null,
    ridesGranted: purchase.ridesGranted ?? null,
    bonusRidesGranted: purchase.bonusRidesGranted ?? null,
    purchasedAt: purchase.purchasedAt ?? null,
    provider: purchase.provider,
    phoneNumber: purchase.phoneNumber,
    status: purchase.status,
    createdAt: purchase.createdAt,
    completedAt: purchase.completedAt ?? null,
  };
}

export function dtoToDomainPackageVehicleEntitlement(dto: PackageVehicleEntitlementDto): VehicleEntitlement {
  return {
    vehicleId: dto.vehicleId,
    vehicleType: dto.vehicleType,
    activePackageId: dto.activePackageId,
    remainingRideCredits: dto.remainingRideCredits,
    remainingBonusRides: dto.remainingBonusRides,
    activations: dto.activations.map(dtoToDomainPackageActivation),
    creditTransactions: dto.creditTransactions.map(dtoToDomainPackageCreditTransaction),
    purchaseHistory: dto.purchaseHistory.map(dtoToDomainPackagePurchase),
    updatedAt: dto.updatedAt,
    authority: dto.authority,
  };
}

export function domainToPackageVehicleEntitlementDto(entitlement: VehicleEntitlement): PackageVehicleEntitlementDto {
  return {
    vehicleId: entitlement.vehicleId,
    vehicleType: entitlement.vehicleType,
    activePackageId: entitlement.activePackageId,
    remainingRideCredits: entitlement.remainingRideCredits,
    remainingBonusRides: entitlement.remainingBonusRides,
    activations: mapArray(entitlement.activations, domainToPackageActivationDto),
    creditTransactions: mapArray(entitlement.creditTransactions, domainToPackageCreditTransactionDto),
    purchaseHistory: mapArray(entitlement.purchaseHistory, domainToPackagePurchaseDto),
    updatedAt: entitlement.updatedAt,
    authority: entitlement.authority,
  };
}

export function dtoToDomainPackageEntitlement(dto: PackageEntitlementDto): DriverEntitlement {
  return {
    vehicleId: dto.vehicleId,
    vehicleType: dto.vehicleType,
    activePackageId: dto.activePackageId,
    remainingRideCredits: dto.remainingRideCredits,
    remainingBonusRides: dto.remainingBonusRides,
    activations: dto.activations.map(dtoToDomainPackageActivation),
    creditTransactions: dto.creditTransactions.map(dtoToDomainPackageCreditTransaction),
    purchaseHistory: dto.purchaseHistory.map(dtoToDomainPackagePurchase),
    vehicleEntitlements: dto.vehicleEntitlements.map(dtoToDomainPackageVehicleEntitlement),
    updatedAt: dto.updatedAt,
    authority: dto.authority,
  };
}

export function domainToPackageEntitlementDto(entitlement: DriverEntitlement): PackageEntitlementDto {
  return {
    vehicleId: entitlement.vehicleId,
    vehicleType: entitlement.vehicleType,
    activePackageId: entitlement.activePackageId,
    remainingRideCredits: entitlement.remainingRideCredits,
    remainingBonusRides: entitlement.remainingBonusRides,
    activations: mapArray(entitlement.activations, domainToPackageActivationDto),
    creditTransactions: mapArray(entitlement.creditTransactions, domainToPackageCreditTransactionDto),
    purchaseHistory: mapArray(entitlement.purchaseHistory, domainToPackagePurchaseDto),
    vehicleEntitlements: mapArray(entitlement.vehicleEntitlements, domainToPackageVehicleEntitlementDto),
    updatedAt: entitlement.updatedAt,
    authority: entitlement.authority,
  };
}

export function dtoToDomainPackageOfferSource(dto: PackageOfferSourceDto): PackageOfferSourceCache {
  return {
    catalog: dto.catalog.map(dtoToDomainPackageCatalogEntry),
    campaigns: dto.campaigns.map(dtoToDomainPackageCampaign),
    catalogLoaded: true,
    campaignsLoaded: true,
    generation: dto.generation,
    lastSuccessfulGenerationAt: dto.lastSuccessfulGenerationAt,
    sourceVersion: dto.sourceVersion,
    cacheCreatedAt: dto.cacheCreatedAt,
  };
}

export function domainToPackageOfferSourceDto(cache: PackageOfferSourceCache): PackageOfferSourceDto {
  return {
    catalog: cache.catalog.map(domainToPackageCatalogDto),
    campaigns: cache.campaigns.map(domainToPackageCampaignDto),
    catalogLoaded: true,
    campaignsLoaded: true,
    generation: cache.generation,
    lastSuccessfulGenerationAt: cache.lastSuccessfulGenerationAt,
    sourceVersion: cache.sourceVersion,
    cacheCreatedAt: cache.cacheCreatedAt,
  };
}

export function domainToCreatePackagePurchaseDto(
  offer: DriverPackageOfferSnapshot,
  provider: MobileMoneyPackageProvider,
  phoneNumber: string,
  metadata: ApiIdempotencyMetadata,
): CreatePackagePurchaseRequestDto {
  return {
    idempotencyKey: metadata.idempotencyKey,
    correlationId: metadata.correlationId,
    actorId: metadata.actorId,
    actorRole: metadata.actorRole,
    clientTimestamp: metadata.clientTimestamp,
    packageId: offer.packageId,
    packageVersion: offer.packageVersion,
    packageName: offer.packageName,
    offerId: offer.offerId,
    vehicleId: offer.vehicleId,
    vehicleType: offer.vehicleType,
    provider,
    phoneNumber,
    amount: offer.priceRwf,
    pricePaid: offer.priceRwf,
    ridesGranted: offer.ridesGranted,
    bonusRidesGranted: offer.bonusRidesGranted,
    campaignId: offer.campaignId ?? null,
    campaignName: offer.campaignName ?? null,
    campaignType: offer.campaignType ?? null,
    campaignStatus: offer.campaignId ? 'active' : null,
  };
}

export function domainToUpdatePackagePurchaseStatusDto(
  transactionId: string,
  status: DriverPackagePurchaseStatus,
  metadata: ApiIdempotencyMetadata,
): UpdatePackagePurchaseStatusRequestDto {
  return {
    idempotencyKey: metadata.idempotencyKey,
    correlationId: metadata.correlationId,
    actorId: metadata.actorId,
    actorRole: metadata.actorRole,
    clientTimestamp: metadata.clientTimestamp,
    transactionId,
    status,
  };
}

export function domainToActivatePackageDto(
  offer: DriverPackageOfferSnapshot,
  metadata: ApiIdempotencyMetadata,
  purchaseId?: string | null,
): ActivatePackageRequestDto {
  const resolvedPurchaseId = purchaseId ?? offer.offerId;
  return {
    idempotencyKey: metadata.idempotencyKey,
    correlationId: metadata.correlationId,
    actorId: metadata.actorId,
    actorRole: metadata.actorRole,
    clientTimestamp: metadata.clientTimestamp,
    purchaseId: resolvedPurchaseId,
    transactionId: resolvedPurchaseId,
    offerId: offer.offerId,
    packageId: offer.packageId,
    packageVersion: offer.packageVersion,
    packageName: offer.packageName,
    vehicleId: offer.vehicleId,
    vehicleType: offer.vehicleType,
    pricePaidRwf: offer.priceRwf,
    ridesGranted: offer.ridesGranted,
    bonusRidesGranted: offer.bonusRidesGranted,
    campaignId: offer.campaignId ?? null,
    campaignName: offer.campaignName ?? null,
    campaignType: offer.campaignType ?? null,
  };
}

export function domainToDeductCreditDto(
  rideId: string,
  vehicleId: string,
  credits: number,
  metadata: ApiIdempotencyMetadata,
  vehicleType?: VehicleType | null,
  packageActivationId?: string | null,
): DeductCreditRequestDto {
  return {
    idempotencyKey: metadata.idempotencyKey,
    correlationId: metadata.correlationId,
    actorId: metadata.actorId,
    actorRole: metadata.actorRole,
    clientTimestamp: metadata.clientTimestamp,
    rideId,
    vehicleId,
    vehicleType: vehicleType ?? null,
    credits,
    packageActivationId: packageActivationId ?? null,
  };
}

export function dtoToDomainPackage<TDto>(dto: TDto): TDto {
  return dto;
}

export function domainToDtoPackage<TDomain>(domain: TDomain): TDomain {
  return domain;
}

export function errorToRepositoryFailurePackage(error: unknown): BackendError {
  if (error instanceof BackendError) return error;
  if (error instanceof Error) {
    if (error.name === 'UnauthorizedError') return new UnauthorizedError({ repository: 'package', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'ForbiddenError') return new ForbiddenError({ repository: 'package', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'ConflictError') return new ConflictError({ repository: 'package', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'ValidationError') return new ValidationError({ repository: 'package', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'RateLimitedError') return new RateLimitedError({ repository: 'package', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'ServerError') return new ServerError({ repository: 'package', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'TimeoutError') return new TimeoutError({ repository: 'package', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'OfflineError') return new OfflineError({ repository: 'package', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'SerializationError') return new SerializationError({ repository: 'package', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'BackendUnavailableError') return new BackendUnavailableError({ repository: 'package', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
  }
  return createNotImplementedError('package', 'errorToRepositoryFailure', 'mapper');
}

export function toPackageRepositoryFailure(error: unknown) {
  return errorToRepositoryFailurePackage(error);
}
