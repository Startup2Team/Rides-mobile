import type { PackageRepository } from '@/data/repositories/interfaces';
import { packageRepository as localPackageRepository } from '@/data/repositories';
import { observability } from '@/observability/context/observabilityContext';
import { BackendClient } from '../client/backendClient';
import { BackendError, createBackendUnavailableError } from '../contracts/backendErrors';
import type { ApiIdempotencyMetadata } from '../contracts/api/shared';
import type {
  GetPackageEntitlementResponseDto,
  PackageAvailableOffersResponseDto,
  PackageCatalogResponseDto,
  PackageCampaignResponseDto,
  PackageMutationResponseDto,
  PackageOfferSourceResponseDto,
  PackagePurchaseResponseDto,
} from '../contracts/api';
import {
  dtoListToDomainPackageCampaigns,
  dtoListToDomainPackageCatalogEntries,
  dtoToDomainPackageActivation,
  dtoToDomainPackageCreditTransaction,
  dtoToDomainPackagePurchase,
  dtoListToDomainPackageOffers,
  dtoListToDomainPackagePurchases,
  dtoToDomainPackageEntitlement,
  dtoToDomainPackageOfferSource,
  domainToActivatePackageDto,
  domainToCreatePackagePurchaseDto,
  domainToDeductCreditDto,
  domainToUpdatePackagePurchaseStatusDto,
  errorToRepositoryFailurePackage,
} from '../mappers/packageMapper';
import type {
  DriverEntitlement,
  DriverEntitlementVehicleRef,
  DriverPackageOfferSnapshot,
  DriverPackagePurchase,
  DriverPackagePurchaseStatus,
  DriverCreditTransaction,
  MobileMoneyPackageProvider,
  PackageActivation,
} from '@/domain/driverRidePackages';
import { EMPTY_DRIVER_ENTITLEMENT, createPackageOfferSnapshot, createPackagePurchaseFromOffer, deductCreditForCompletedRide, normalizeEntitlement, updatePackagePurchaseStatus, activatePackageOffer } from '@/domain/driverRidePackages';
import { getActiveDriverRideCampaigns, resolvePackageOffer, type DriverRidePackageCampaign } from '@/domain/driverRideCampaigns';
import { getActivePackages, type DriverRidePackageCatalogEntry } from '@/domain/driverRidePackageCatalog';
import type { PackageOfferSourceCache } from '@/persistence/packageSyncPersistence';
import { loadStoredDriverEntitlement } from '@/persistence/driverEntitlementPersistence';
import type { VehicleType } from '@/types';

export interface RemotePackageRepositoryOptions {
  client?: BackendClient;
  transportLabel?: 'remote' | 'shadow_remote' | 'hybrid';
}

export interface PackageAvailableOffersInput {
  vehicleId: string;
  vehicleType: VehicleType;
  entitlement?: DriverEntitlement | null;
  ownerUserId?: string | null;
}

export interface PackageCreatePurchaseInput {
  entitlement?: DriverEntitlement | null;
  offer: DriverPackageOfferSnapshot;
  provider: MobileMoneyPackageProvider;
  phoneNumber: string;
  metadata: ApiIdempotencyMetadata;
  vehicle?: DriverEntitlementVehicleRef | null;
}

export interface PackageUpdatePurchaseStatusInput {
  entitlement?: DriverEntitlement | null;
  transactionId: string;
  status: DriverPackagePurchaseStatus;
  metadata: ApiIdempotencyMetadata;
  vehicle?: DriverEntitlementVehicleRef | null;
}

export interface PackageActivateInput {
  entitlement?: DriverEntitlement | null;
  offer: DriverPackageOfferSnapshot;
  metadata: ApiIdempotencyMetadata;
  purchaseId?: string | null;
  vehicle?: DriverEntitlementVehicleRef | null;
}

export interface PackageDeductCreditInput {
  entitlement?: DriverEntitlement | null;
  rideId: string;
  vehicleId: string;
  vehicleType?: VehicleType | null;
  credits: number;
  metadata: ApiIdempotencyMetadata;
  packageActivationId?: string | null;
}

export interface PackageMutationResult {
  entitlement: DriverEntitlement;
  purchase?: DriverPackagePurchase | null;
  activation?: PackageActivation | null;
  deducted?: boolean;
  creditTransaction?: DriverCreditTransaction | null;
}

export interface PackageShadowRepository {
  getCatalog(): Promise<DriverRidePackageCatalogEntry[] | null>;
  refreshCatalog(): Promise<DriverRidePackageCatalogEntry[]>;
  getCampaigns(): Promise<DriverRidePackageCampaign[] | null>;
  refreshCampaigns(): Promise<DriverRidePackageCampaign[]>;
  getOfferSource(): Promise<PackageOfferSourceCache | null>;
  refreshOfferSource(): Promise<PackageOfferSourceCache>;
  getAvailableOffers(input: PackageAvailableOffersInput): Promise<DriverPackageOfferSnapshot[]>;
  getAvailablePackageOffers(input: PackageAvailableOffersInput): Promise<DriverPackageOfferSnapshot[]>;
  getDriverEntitlement(entitlement?: DriverEntitlement | null): Promise<DriverEntitlement | null>;
  getDriverEntitlements(entitlement?: DriverEntitlement | null): Promise<DriverEntitlement | null>;
  getDriverPackagePurchases(entitlement?: DriverEntitlement | null): Promise<DriverPackagePurchase[]>;
  getDriverPurchases(entitlement?: DriverEntitlement | null): Promise<DriverPackagePurchase[]>;
  createPurchase(input: PackageCreatePurchaseInput): Promise<PackageMutationResult>;
  updatePurchaseStatus(input: PackageUpdatePurchaseStatusInput): Promise<PackageMutationResult>;
  activatePackage(input: PackageActivateInput): Promise<PackageMutationResult>;
  deductRideCredit(input: PackageDeductCreditInput): Promise<PackageMutationResult>;
}

function summarizeShape(value: unknown) {
  if (Array.isArray(value)) return `array:${value.length}`;
  if (value === null) return 'null';
  if (typeof value === 'object') return `object:${Object.keys(value as Record<string, unknown>).length}`;
  return typeof value;
}

function summarizeCatalogEntry(entry: DriverRidePackageCatalogEntry) {
  return {
    packageId: entry.packageId,
    packageVersion: entry.packageVersion,
    packageName: entry.packageName,
    vehicleType: entry.vehicleType,
    priceRwf: entry.priceRwf,
    ridesGranted: entry.ridesGranted,
    bonusRidesGranted: entry.bonusRidesGranted,
    status: entry.status,
    compareAtPriceRwf: entry.compareAtPriceRwf ?? null,
  };
}

function summarizeCampaign(campaign: DriverRidePackageCampaign) {
  return {
    campaignId: campaign.campaignId,
    campaignName: campaign.campaignName,
    campaignType: campaign.campaignType,
    status: campaign.status,
    startDate: campaign.startDate,
    endDate: campaign.endDate,
    description: campaign.description,
    packageIds: campaign.packageIds ?? [],
    vehicleTypes: campaign.vehicleTypes ?? [],
    priceRwf: campaign.priceRwf ?? null,
    ridesGranted: campaign.ridesGranted ?? null,
    bonusRidesGranted: campaign.bonusRidesGranted ?? null,
  };
}

function summarizeOffer(offer: DriverPackageOfferSnapshot) {
  return {
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
    quoteAuthority: offer.quoteAuthority,
    source: offer.source,
  };
}

function summarizeActivation(activation?: PackageActivation | null) {
  if (!activation) return null;
  return {
    packageId: activation.packageId,
    packageVersion: activation.packageVersion ?? null,
    packageName: activation.packageName ?? null,
    campaignId: activation.campaignId ?? null,
    campaignName: activation.campaignName ?? null,
    campaignType: activation.campaignType ?? null,
    campaignStatus: activation.campaignStatus ?? null,
    vehicleId: activation.vehicleId,
    vehicleType: activation.vehicleType,
    pricePaidRwf: activation.pricePaidRwf,
    ridesGranted: activation.ridesGranted ?? null,
    bonusRidesGranted: activation.bonusRidesGranted ?? null,
    creditsGranted: activation.creditsGranted,
    authority: activation.authority,
  };
}

function summarizePurchase(purchase?: DriverPackagePurchase | null) {
  if (!purchase) return null;
  return {
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
    provider: purchase.provider,
    phoneNumber: purchase.phoneNumber,
    status: purchase.status,
    completedAt: purchase.completedAt ?? null,
  };
}

function summarizeCreditTransaction(transaction?: DriverCreditTransaction | null) {
  if (!transaction) return null;
  return {
    type: transaction.type,
    vehicleId: transaction.vehicleId,
    vehicleType: transaction.vehicleType,
    amount: transaction.amount,
    packageActivationId: transaction.packageActivationId ?? null,
    completedRideId: transaction.completedRideId ?? null,
    authority: transaction.authority,
  };
}

function summarizeVehicleEntitlement(entitlement: ReturnType<typeof normalizeEntitlement>['vehicleEntitlements'][number]) {
  return {
    vehicleId: entitlement.vehicleId,
    vehicleType: entitlement.vehicleType,
    activePackageId: entitlement.activePackageId,
    remainingRideCredits: entitlement.remainingRideCredits,
    remainingBonusRides: entitlement.remainingBonusRides,
    activations: entitlement.activations.map(summarizeActivation),
    creditTransactions: entitlement.creditTransactions.map(summarizeCreditTransaction),
    purchaseHistory: entitlement.purchaseHistory.map(summarizePurchase),
    authority: entitlement.authority,
  };
}

function summarizeEntitlement(entitlement: DriverEntitlement | null | undefined) {
  if (!entitlement) return null;
  const normalized = normalizeEntitlement(entitlement);
  return {
    vehicleId: normalized.vehicleId,
    vehicleType: normalized.vehicleType,
    activePackageId: normalized.activePackageId,
    remainingRideCredits: normalized.remainingRideCredits,
    remainingBonusRides: normalized.remainingBonusRides,
    activations: normalized.activations.map(summarizeActivation),
    creditTransactions: normalized.creditTransactions.map(summarizeCreditTransaction),
    purchaseHistory: normalized.purchaseHistory.map(summarizePurchase),
    vehicleEntitlements: normalized.vehicleEntitlements.map(summarizeVehicleEntitlement),
    authority: normalized.authority,
  };
}

function summarizeOfferSource(source: PackageOfferSourceCache | null | undefined) {
  if (!source) return null;
  return {
    generation: source.generation,
    lastSuccessfulGenerationAt: source.lastSuccessfulGenerationAt,
    sourceVersion: source.sourceVersion,
    catalog: source.catalog.map(summarizeCatalogEntry),
    campaigns: source.campaigns.map(summarizeCampaign),
  };
}

function summarizeAvailableOffers(offers: DriverPackageOfferSnapshot[] | null | undefined) {
  return (offers ?? []).map(summarizeOffer);
}

function recordTelemetry(
  event: 'package remote shadow request' | 'package remote shadow success' | 'package remote shadow failure',
  context: {
    method: string;
    latencyMs: number;
    responseShape: string;
    transport: 'remote' | 'shadow_remote' | 'hybrid';
    error?: unknown;
  },
) {
  observability.metrics.counter('package.remote.shadow', 1, {
    method: context.method,
    transport: context.transport,
    event,
  });
  observability.metrics.histogram('package.remote.latency_ms', context.latencyMs, {
    method: context.method,
    transport: context.transport,
  });
  observability.logger.info('PackageRemoteShadow', {
    event,
    method: context.method,
    transport: context.transport,
    latencyMs: context.latencyMs,
    responseShape: context.responseShape,
    error: context.error instanceof Error ? context.error.name : undefined,
  });
}

function recordMismatch(method: string, local: unknown, remote: unknown, detail?: string) {
  if (summarizeShape(local) !== summarizeShape(remote)) {
    observability.metrics.counter('package.remote.shape_mismatch', 1, { method, detail: detail ?? 'shape' });
  }
  observability.metrics.counter('package.remote.semantic_mismatch', 1, { method, detail: detail ?? 'semantic' });
  observability.logger.warn('PackageRemoteShadowMismatch', {
    method,
    detail,
    localShape: summarizeShape(local),
    remoteShape: summarizeShape(remote),
  });
}

function recordSpecificMismatch(metric: string, method: string, detail: string) {
  observability.metrics.counter(metric, 1, { method, detail });
}

function toRepositoryFailure(error: unknown): BackendError {
  return errorToRepositoryFailurePackage(error);
}

function resolveClient(method: string, client?: BackendClient) {
  if (!client) throw createBackendUnavailableError('package', method, 'remote');
  return client;
}

function resolveEntitlement(input?: DriverEntitlement | null): DriverEntitlement {
  return normalizeEntitlement(input ?? EMPTY_DRIVER_ENTITLEMENT);
}

function buildAvailableOffers(
  catalog: DriverRidePackageCatalogEntry[],
  campaigns: DriverRidePackageCampaign[],
  entitlement: DriverEntitlement | null | undefined,
  input: PackageAvailableOffersInput,
) {
  const normalizedEntitlement = entitlement ? normalizeEntitlement(entitlement) : null;
  const vehicle = input.vehicleId && input.vehicleType
    ? { vehicleId: input.vehicleId, vehicleType: input.vehicleType }
    : null;
  const activeCampaigns = getActiveDriverRideCampaigns(campaigns);
  return getActivePackages(input.vehicleType, catalog).map(entry =>
    createPackageOfferSnapshot(
      resolvePackageOffer({
        package: entry,
        vehicleType: input.vehicleType,
        entitlement: normalizedEntitlement ?? undefined,
        activeCampaigns,
      }),
      vehicle ?? { vehicleId: input.vehicleId, vehicleType: input.vehicleType },
      new Date(),
      undefined,
      { ownerUserId: input.ownerUserId ?? null },
    ),
  );
}

async function loadLocalEntitlement(current?: DriverEntitlement | null) {
  if (current) return current;
  try {
    const stored = await loadStoredDriverEntitlement();
    return stored.data ?? null;
  } catch {
    return null;
  }
}

export class RemotePackageRepository implements PackageRepository {
  private readonly client?: BackendClient;
  private readonly transportLabel: 'remote' | 'shadow_remote' | 'hybrid';

  constructor(options: RemotePackageRepositoryOptions = {}) {
    this.client = options.client;
    this.transportLabel = options.transportLabel ?? 'remote';
  }

  private async shadow<T>(method: string, execute: () => Promise<T>): Promise<T> {
    const startedAt = Date.now();
    recordTelemetry('package remote shadow request', {
      method,
      latencyMs: 0,
      responseShape: 'pending',
      transport: this.transportLabel,
    });
    try {
      const value = await execute();
      recordTelemetry('package remote shadow success', {
        method,
        latencyMs: Date.now() - startedAt,
        responseShape: summarizeShape(value),
        transport: this.transportLabel,
      });
      return value;
    } catch (error) {
      recordTelemetry('package remote shadow failure', {
        method,
        latencyMs: Date.now() - startedAt,
        responseShape: summarizeShape(error),
        transport: this.transportLabel,
        error,
      });
      throw toRepositoryFailure(error);
    }
  }

  async getCatalog(): Promise<DriverRidePackageCatalogEntry[] | null> {
    return this.shadow('getCatalog', async () => {
      const client = resolveClient('getCatalog', this.client);
      const response = await client.get<PackageCatalogResponseDto>('/v1/packages/catalog');
      const rawData = response.data?.data;
      const items = Array.isArray(rawData) ? rawData : (rawData as any)?.items ?? [];
      return dtoListToDomainPackageCatalogEntries(items);
    });
  }

  async refreshCatalog(): Promise<DriverRidePackageCatalogEntry[]> {
    return (await this.getCatalog()) ?? [];
  }

  async getCampaigns(): Promise<DriverRidePackageCampaign[] | null> {
    return this.shadow('getCampaigns', async () => {
      const client = resolveClient('getCampaigns', this.client);
      const response = await client.get<PackageCampaignResponseDto>('/v1/packages/campaigns');
      return dtoListToDomainPackageCampaigns(response.data?.data?.items ?? []);
    });
  }

  async refreshCampaigns(): Promise<DriverRidePackageCampaign[]> {
    return (await this.getCampaigns()) ?? [];
  }

  async getOfferSource(): Promise<PackageOfferSourceCache | null> {
    return this.shadow('getOfferSource', async () => {
      const client = resolveClient('getOfferSource', this.client);
      const response = await client.get<PackageOfferSourceResponseDto>('/v1/packages/offer-source');
      return dtoToDomainPackageOfferSource(response.data.data);
    });
  }

  async refreshOfferSource(): Promise<PackageOfferSourceCache> {
    return (await this.getOfferSource()) ?? {
      catalog: [],
      campaigns: [],
      catalogLoaded: true,
      campaignsLoaded: true,
      generation: 'package:remote:none',
      lastSuccessfulGenerationAt: new Date().toISOString(),
      sourceVersion: 'unknown',
      cacheCreatedAt: new Date().toISOString(),
    };
  }

  async getAvailableOffers(input: PackageAvailableOffersInput): Promise<DriverPackageOfferSnapshot[]> {
    return this.shadow('getAvailableOffers', async () => {
      const client = resolveClient('getAvailableOffers', this.client);
      const response = await client.get<PackageAvailableOffersResponseDto>('/v1/packages/offers', {
        query: {
          vehicleId: input.vehicleId,
          vehicleType: input.vehicleType,
        },
      });
      return dtoListToDomainPackageOffers(response.data?.data?.items ?? []);
    });
  }

  async getAvailablePackageOffers(input: PackageAvailableOffersInput): Promise<DriverPackageOfferSnapshot[]> {
    return this.getAvailableOffers(input);
  }

  async getDriverEntitlement(entitlement?: DriverEntitlement | null): Promise<DriverEntitlement | null> {
    return this.shadow('getDriverEntitlement', async () => {
      const client = resolveClient('getDriverEntitlement', this.client);
      const response = await client.get<GetPackageEntitlementResponseDto>('/v1/packages/entitlements');
      const remote = response.data.data ? dtoToDomainPackageEntitlement(response.data.data) : null;
      if (entitlement || remote) {
        const localShape = summarizeEntitlement(entitlement);
        const remoteShape = summarizeEntitlement(remote);
        if (summarizeShape(localShape) !== summarizeShape(remoteShape) || JSON.stringify(localShape) !== JSON.stringify(remoteShape)) {
          recordMismatch('getDriverEntitlement', localShape, remoteShape, 'entitlement');
          recordSpecificMismatch('package.remote.entitlement_shadow_mismatch', 'getDriverEntitlement', 'entitlement');
        }
      }
      return remote;
    });
  }

  async getDriverEntitlements(entitlement?: DriverEntitlement | null): Promise<DriverEntitlement | null> {
    return this.getDriverEntitlement(entitlement);
  }

  async getDriverPackagePurchases(entitlement?: DriverEntitlement | null): Promise<DriverPackagePurchase[]> {
    return this.shadow('getDriverPackagePurchases', async () => {
      const client = resolveClient('getDriverPackagePurchases', this.client);
      const response = await client.get<PackagePurchaseResponseDto>('/v1/packages/purchases');
      const remote = dtoListToDomainPackagePurchases(response.data?.data?.items ?? []);
      if (entitlement) {
        const localPurchases = resolveEntitlement(entitlement).purchaseHistory;
        const localShape = localPurchases.map(summarizePurchase);
        const remoteShape = remote.map(summarizePurchase);
        if (summarizeShape(localShape) !== summarizeShape(remoteShape) || JSON.stringify(localShape) !== JSON.stringify(remoteShape)) {
          recordMismatch('getDriverPackagePurchases', localShape, remoteShape, 'purchase-history');
        }
      }
      return remote;
    });
  }

  async getDriverPurchases(entitlement?: DriverEntitlement | null): Promise<DriverPackagePurchase[]> {
    return this.getDriverPackagePurchases(entitlement);
  }

  async createPurchase(input: PackageCreatePurchaseInput): Promise<PackageMutationResult> {
    return this.shadow<PackageMutationResult>('createPurchase', async () => {
      const client = resolveClient('createPurchase', this.client);
      const request = domainToCreatePackagePurchaseDto(input.offer, input.provider, input.phoneNumber, input.metadata);
      const response = await client.post<PackageMutationResponseDto>('/v1/packages/purchases', { body: request });
      const data = response.data.data;
      return {
        entitlement: data.entitlement ? dtoToDomainPackageEntitlement(data.entitlement) : resolveEntitlement(input.entitlement),
        purchase: data.purchase ? dtoToDomainPackagePurchase(data.purchase) : null,
        activation: data.activation ? dtoToDomainPackageActivation(data.activation) : null,
        deducted: data.deducted ?? false,
        creditTransaction: data.creditTransaction ? dtoToDomainPackageCreditTransaction(data.creditTransaction) : null,
      };
    });
  }

  async updatePurchaseStatus(input: PackageUpdatePurchaseStatusInput): Promise<PackageMutationResult> {
    return this.shadow<PackageMutationResult>('updatePurchaseStatus', async () => {
      const client = resolveClient('updatePurchaseStatus', this.client);
      const nextStatus = (input.status === 'idle' ? 'pending' : input.status) as Exclude<DriverPackagePurchaseStatus, 'idle'>;
      const request = domainToUpdatePackagePurchaseStatusDto(input.transactionId, nextStatus, input.metadata);
      const response = await client.patch<PackageMutationResponseDto>(`/v1/packages/purchases/${input.transactionId}/status`, {
        body: request,
      });
      const data = response.data.data;
      return {
        entitlement: data.entitlement ? dtoToDomainPackageEntitlement(data.entitlement) : resolveEntitlement(input.entitlement),
        purchase: data.purchase ? dtoToDomainPackagePurchase(data.purchase) : null,
        activation: data.activation ? dtoToDomainPackageActivation(data.activation) : null,
        deducted: data.deducted ?? false,
        creditTransaction: data.creditTransaction ? dtoToDomainPackageCreditTransaction(data.creditTransaction) : null,
      };
    });
  }

  async activatePackage(input: PackageActivateInput): Promise<PackageMutationResult> {
    return this.shadow<PackageMutationResult>('activatePackage', async () => {
      const client = resolveClient('activatePackage', this.client);
      const request = domainToActivatePackageDto(input.offer, input.metadata, input.purchaseId ?? input.offer.offerId);
      const response = await client.post<PackageMutationResponseDto>(`/v1/packages/purchases/${request.purchaseId ?? request.transactionId ?? request.offerId}/activate`, {
        body: request,
      });
      const data = response.data.data;
      return {
        entitlement: data.entitlement ? dtoToDomainPackageEntitlement(data.entitlement) : resolveEntitlement(input.entitlement),
        purchase: data.purchase ? dtoToDomainPackagePurchase(data.purchase) : null,
        activation: data.activation ? dtoToDomainPackageActivation(data.activation) : null,
        deducted: data.deducted ?? false,
        creditTransaction: data.creditTransaction ? dtoToDomainPackageCreditTransaction(data.creditTransaction) : null,
      };
    });
  }

  async deductRideCredit(input: PackageDeductCreditInput): Promise<PackageMutationResult> {
    return this.shadow<PackageMutationResult>('deductRideCredit', async () => {
      const client = resolveClient('deductRideCredit', this.client);
      const request = domainToDeductCreditDto(
        input.rideId,
        input.vehicleId,
        input.credits,
        input.metadata,
        input.vehicleType ?? null,
        input.packageActivationId ?? null,
      );
      const response = await client.post<PackageMutationResponseDto>('/v1/packages/credits/deduct', {
        body: request,
      });
      const data = response.data.data;
      return {
        entitlement: data.entitlement ? dtoToDomainPackageEntitlement(data.entitlement) : resolveEntitlement(input.entitlement),
        purchase: data.purchase ? dtoToDomainPackagePurchase(data.purchase) : null,
        activation: data.activation ? dtoToDomainPackageActivation(data.activation) : null,
        deducted: data.deducted ?? false,
        creditTransaction: data.creditTransaction ? dtoToDomainPackageCreditTransaction(data.creditTransaction) : null,
      };
    });
  }
}

export function createRemotePackageRepositoryPrototype(options: RemotePackageRepositoryOptions = {}) {
  return new RemotePackageRepository(options);
}

export function createRemotePackageRepository(options: RemotePackageRepositoryOptions = {}) {
  return createRemotePackageRepositoryPrototype(options);
}

export function createPackageShadowRepository(options: {
  localRepository?: PackageRepository;
  remoteRepository: RemotePackageRepository;
}) : PackageShadowRepository {
  const localRepository = options.localRepository ?? localPackageRepository;
  const { remoteRepository } = options;

  async function compareAndReturn<T>(
    method: string,
    local: () => Promise<T>,
    remote: () => Promise<T>,
    compare: (localValue: T, remoteValue: T) => void,
  ): Promise<T> {
    const localValue = await local();
    try {
      const remoteValue = await remote();
      compare(localValue, remoteValue);
    } catch (error) {
      observability.logger.warn('PackageRemoteShadowFailure', {
        method,
        error: error instanceof Error ? error.name : 'unknown',
      });
    }
    return localValue;
  }

  return {
    async getCatalog() {
      return compareAndReturn(
        'getCatalog',
        () => localRepository.getCatalog(),
        () => remoteRepository.getCatalog(),
        (localValue, remoteValue) => {
          const localShape = (localValue ?? []).map(summarizeCatalogEntry);
          const remoteShape = (remoteValue ?? []).map(summarizeCatalogEntry);
          if (summarizeShape(localShape) !== summarizeShape(remoteShape) || JSON.stringify(localShape) !== JSON.stringify(remoteShape)) {
            recordMismatch('getCatalog', localShape, remoteShape, 'catalog');
          }
        },
      );
    },
    async refreshCatalog() {
      return compareAndReturn(
        'refreshCatalog',
        () => localRepository.refreshCatalog(),
        () => remoteRepository.refreshCatalog(),
        (localValue, remoteValue) => {
          const localShape = (localValue ?? []).map(summarizeCatalogEntry);
          const remoteShape = (remoteValue ?? []).map(summarizeCatalogEntry);
          if (summarizeShape(localShape) !== summarizeShape(remoteShape) || JSON.stringify(localShape) !== JSON.stringify(remoteShape)) {
            recordMismatch('refreshCatalog', localShape, remoteShape, 'catalog');
          }
        },
      );
    },
    async getCampaigns() {
      return compareAndReturn(
        'getCampaigns',
        () => localRepository.getCampaigns(),
        () => remoteRepository.getCampaigns(),
        (localValue, remoteValue) => {
          const localShape = (localValue ?? []).map(summarizeCampaign);
          const remoteShape = (remoteValue ?? []).map(summarizeCampaign);
          if (summarizeShape(localShape) !== summarizeShape(remoteShape) || JSON.stringify(localShape) !== JSON.stringify(remoteShape)) {
            recordMismatch('getCampaigns', localShape, remoteShape, 'campaign');
          }
        },
      );
    },
    async refreshCampaigns() {
      return compareAndReturn(
        'refreshCampaigns',
        () => localRepository.refreshCampaigns(),
        () => remoteRepository.refreshCampaigns(),
        (localValue, remoteValue) => {
          const localShape = (localValue ?? []).map(summarizeCampaign);
          const remoteShape = (remoteValue ?? []).map(summarizeCampaign);
          if (summarizeShape(localShape) !== summarizeShape(remoteShape) || JSON.stringify(localShape) !== JSON.stringify(remoteShape)) {
            recordMismatch('refreshCampaigns', localShape, remoteShape, 'campaign');
          }
        },
      );
    },
    async getOfferSource() {
      return compareAndReturn(
        'getOfferSource',
        () => localRepository.getOfferSource(),
        () => remoteRepository.getOfferSource(),
        (localValue, remoteValue) => {
          const localShape = summarizeOfferSource(localValue);
          const remoteShape = summarizeOfferSource(remoteValue);
          if (summarizeShape(localShape) !== summarizeShape(remoteShape) || JSON.stringify(localShape) !== JSON.stringify(remoteShape)) {
            recordMismatch('getOfferSource', localShape, remoteShape, 'offer-source');
          }
        },
      );
    },
    async refreshOfferSource() {
      return compareAndReturn(
        'refreshOfferSource',
        () => localRepository.refreshOfferSource(),
        () => remoteRepository.refreshOfferSource(),
        (localValue, remoteValue) => {
          const localShape = summarizeOfferSource(localValue);
          const remoteShape = summarizeOfferSource(remoteValue);
          if (summarizeShape(localShape) !== summarizeShape(remoteShape) || JSON.stringify(localShape) !== JSON.stringify(remoteShape)) {
            recordMismatch('refreshOfferSource', localShape, remoteShape, 'offer-source');
          }
        },
      );
    },
    async getAvailableOffers(input: PackageAvailableOffersInput) {
      return compareAndReturn(
        'getAvailableOffers',
        async () => {
          const offerSource = await localRepository.getOfferSource();
          const entitlement = await loadLocalEntitlement(input.entitlement);
          const catalog = offerSource?.catalog ?? (await localRepository.getCatalog()) ?? [];
          const campaigns = offerSource?.campaigns ?? (await localRepository.getCampaigns()) ?? [];
          return buildAvailableOffers(catalog, campaigns, entitlement, input);
        },
        () => remoteRepository.getAvailableOffers(input),
        (localValue, remoteValue) => {
          const localShape = summarizeAvailableOffers(localValue);
          const remoteShape = summarizeAvailableOffers(remoteValue);
          if (summarizeShape(localShape) !== summarizeShape(remoteShape) || JSON.stringify(localShape) !== JSON.stringify(remoteShape)) {
            recordMismatch('getAvailableOffers', localShape, remoteShape, 'offers');
          }
        },
      );
    },
    async getAvailablePackageOffers(input: PackageAvailableOffersInput) {
      return compareAndReturn(
        'getAvailablePackageOffers',
        async () => {
          const offerSource = await localRepository.getOfferSource();
          const entitlement = await loadLocalEntitlement(input.entitlement);
          const catalog = offerSource?.catalog ?? (await localRepository.getCatalog()) ?? [];
          const campaigns = offerSource?.campaigns ?? (await localRepository.getCampaigns()) ?? [];
          return buildAvailableOffers(catalog, campaigns, entitlement, input);
        },
        () => remoteRepository.getAvailablePackageOffers(input),
        (localValue, remoteValue) => {
          const localShape = summarizeAvailableOffers(localValue);
          const remoteShape = summarizeAvailableOffers(remoteValue);
          if (summarizeShape(localShape) !== summarizeShape(remoteShape) || JSON.stringify(localShape) !== JSON.stringify(remoteShape)) {
            recordMismatch('getAvailablePackageOffers', localShape, remoteShape, 'offers');
          }
        },
      );
    },
    async getDriverEntitlement(entitlement?: DriverEntitlement | null) {
      return compareAndReturn(
        'getDriverEntitlement',
        () => loadLocalEntitlement(entitlement),
        () => remoteRepository.getDriverEntitlement(entitlement),
        (localValue, remoteValue) => {
          const localShape = summarizeEntitlement(localValue);
          const remoteShape = summarizeEntitlement(remoteValue);
          if (summarizeShape(localShape) !== summarizeShape(remoteShape) || JSON.stringify(localShape) !== JSON.stringify(remoteShape)) {
            recordMismatch('getDriverEntitlement', localShape, remoteShape, 'entitlement');
            recordSpecificMismatch('package.remote.entitlement_shadow_mismatch', 'getDriverEntitlement', 'entitlement');
          }
        },
      );
    },
    async getDriverEntitlements(entitlement?: DriverEntitlement | null) {
      return compareAndReturn(
        'getDriverEntitlements',
        () => loadLocalEntitlement(entitlement),
        () => remoteRepository.getDriverEntitlements(entitlement),
        (localValue, remoteValue) => {
          const localShape = summarizeEntitlement(localValue);
          const remoteShape = summarizeEntitlement(remoteValue);
          if (summarizeShape(localShape) !== summarizeShape(remoteShape) || JSON.stringify(localShape) !== JSON.stringify(remoteShape)) {
            recordMismatch('getDriverEntitlements', localShape, remoteShape, 'entitlement');
            recordSpecificMismatch('package.remote.entitlement_shadow_mismatch', 'getDriverEntitlements', 'entitlement');
          }
        },
      );
    },
    async getDriverPackagePurchases(entitlement?: DriverEntitlement | null) {
      return compareAndReturn(
        'getDriverPackagePurchases',
        async () => (await loadLocalEntitlement(entitlement))?.purchaseHistory ?? [],
        () => remoteRepository.getDriverPackagePurchases(entitlement),
        (localValue, remoteValue) => {
          const localShape = (localValue ?? []).map(summarizePurchase);
          const remoteShape = (remoteValue ?? []).map(summarizePurchase);
          if (summarizeShape(localShape) !== summarizeShape(remoteShape) || JSON.stringify(localShape) !== JSON.stringify(remoteShape)) {
            recordMismatch('getDriverPackagePurchases', localShape, remoteShape, 'purchases');
          }
        },
      );
    },
    async getDriverPurchases(entitlement?: DriverEntitlement | null) {
      return compareAndReturn(
        'getDriverPurchases',
        async () => (await loadLocalEntitlement(entitlement))?.purchaseHistory ?? [],
        () => remoteRepository.getDriverPurchases(entitlement),
        (localValue, remoteValue) => {
          const localShape = (localValue ?? []).map(summarizePurchase);
          const remoteShape = (remoteValue ?? []).map(summarizePurchase);
          if (summarizeShape(localShape) !== summarizeShape(remoteShape) || JSON.stringify(localShape) !== JSON.stringify(remoteShape)) {
            recordMismatch('getDriverPurchases', localShape, remoteShape, 'purchases');
          }
        },
      );
    },
    async createPurchase(input: PackageCreatePurchaseInput) {
      return compareAndReturn<PackageMutationResult>(
        'createPurchase',
        async () => {
          const current = resolveEntitlement(await loadLocalEntitlement(input.entitlement));
          const result = createPackagePurchaseFromOffer(current, {
            offer: input.offer,
            provider: input.provider,
            phoneNumber: input.phoneNumber,
          }, undefined, input.vehicle ?? { vehicleId: input.offer.vehicleId, vehicleType: input.offer.vehicleType });
          return {
            entitlement: result.entitlement,
            purchase: result.purchase,
            activation: null,
            deducted: false,
            creditTransaction: null,
          };
        },
        () => remoteRepository.createPurchase(input),
        (localValue, remoteValue) => {
          const localShape = {
            entitlement: summarizeEntitlement(localValue.entitlement),
            purchase: summarizePurchase(localValue.purchase),
          };
          const remoteShape = {
            entitlement: summarizeEntitlement(remoteValue.entitlement),
            purchase: summarizePurchase(remoteValue.purchase ?? localValue.purchase),
          };
          if (summarizeShape(localShape) !== summarizeShape(remoteShape) || JSON.stringify(localShape) !== JSON.stringify(remoteShape)) {
            recordMismatch('createPurchase', localShape, remoteShape, 'purchase');
          }
        },
      );
    },
    async updatePurchaseStatus(input: PackageUpdatePurchaseStatusInput) {
      return compareAndReturn<PackageMutationResult>(
        'updatePurchaseStatus',
        async () => {
          const current = resolveEntitlement(await loadLocalEntitlement(input.entitlement));
          const nextStatus = input.status === 'idle' ? 'pending' : input.status;
          const updated = updatePackagePurchaseStatus(current, input.transactionId, nextStatus, undefined, input.vehicle ?? null);
          return {
            entitlement: updated.entitlement,
            purchase: updated.purchase,
            activation: updated.activation ?? null,
            deducted: false,
            creditTransaction: null,
          };
        },
        () => remoteRepository.updatePurchaseStatus(input),
        (localValue, remoteValue) => {
          const localShape = {
            entitlement: summarizeEntitlement(localValue.entitlement),
            purchase: summarizePurchase(localValue.purchase),
            activation: localValue.activation ? summarizeActivation(localValue.activation) : null,
          };
          const remoteShape = {
            entitlement: summarizeEntitlement(remoteValue.entitlement),
            purchase: summarizePurchase(remoteValue.purchase ?? localValue.purchase),
            activation: remoteValue.activation ? summarizeActivation(remoteValue.activation) : null,
          };
          if (summarizeShape(localShape) !== summarizeShape(remoteShape) || JSON.stringify(localShape) !== JSON.stringify(remoteShape)) {
            recordMismatch('updatePurchaseStatus', localShape, remoteShape, 'purchase-status');
          }
        },
      );
    },
    async activatePackage(input: PackageActivateInput) {
      return compareAndReturn<PackageMutationResult>(
        'activatePackage',
        async () => {
          const current = resolveEntitlement(await loadLocalEntitlement(input.entitlement));
          const activation = activatePackageOffer(current, input.offer, new Date().toISOString(), input.vehicle ?? null);
          return {
            entitlement: activation.entitlement,
            purchase: null,
            activation: activation.activation,
            deducted: false,
            creditTransaction: null,
          };
        },
        () => remoteRepository.activatePackage(input),
        (localValue, remoteValue) => {
          const localShape = {
            entitlement: summarizeEntitlement(localValue.entitlement),
            activation: summarizeActivation(localValue.activation),
          };
          const remoteShape = {
            entitlement: summarizeEntitlement(remoteValue.entitlement),
            activation: remoteValue.activation ? summarizeActivation(remoteValue.activation) : null,
          };
          if (summarizeShape(localShape) !== summarizeShape(remoteShape) || JSON.stringify(localShape) !== JSON.stringify(remoteShape)) {
            recordMismatch('activatePackage', localShape, remoteShape, 'activation');
          }
        },
      );
    },
    async deductRideCredit(input: PackageDeductCreditInput) {
      return compareAndReturn<PackageMutationResult>(
        'deductRideCredit',
        async () => {
          const current = resolveEntitlement(await loadLocalEntitlement(input.entitlement));
          const deducted = deductCreditForCompletedRide(current, input.rideId, new Date().toISOString(), input.vehicleType ? { vehicleId: input.vehicleId, vehicleType: input.vehicleType } : null);
          return {
            entitlement: deducted.entitlement,
            purchase: null,
            activation: null,
            deducted: deducted.deducted,
            creditTransaction: deducted.deducted
              ? deducted.entitlement.vehicleEntitlements[0]?.creditTransactions.slice(-1)[0] ?? null
              : null,
          };
        },
        () => remoteRepository.deductRideCredit(input),
        (localValue, remoteValue) => {
          const localShape = {
            entitlement: summarizeEntitlement(localValue.entitlement),
            deducted: localValue.deducted,
          };
          const remoteShape = {
            entitlement: summarizeEntitlement(remoteValue.entitlement),
            deducted: remoteValue.deducted,
          };
          if (summarizeShape(localShape) !== summarizeShape(remoteShape) || JSON.stringify(localShape) !== JSON.stringify(remoteShape)) {
            recordMismatch('deductRideCredit', localShape, remoteShape, 'credit-deduction');
            recordSpecificMismatch('package.remote.credit_deduction_shadow_mismatch', 'deductRideCredit', 'credit-deduction');
          }
        },
      );
    },
  };
}
