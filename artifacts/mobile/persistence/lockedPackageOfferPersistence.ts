import { z } from 'zod';
import { STORAGE_KEYS } from '@/constants/storage';
import {
  isPackageOfferExpired,
  validatePackageOfferSnapshot,
  type DriverEntitlementVehicleRef,
  type DriverPackageOfferSnapshot,
} from '@/domain/driverRidePackages';
import type { DriverRidePackageOffer } from '@/domain/driverRideCampaigns';
import {
  getActivePackages,
  type DriverRidePackageCatalogEntry,
} from '@/domain/driverRidePackageCatalog';
import { loadSecureStorage, saveSecureStorage } from './secureStorage';

const lockedOfferStoreSchema = z.record(z.string(), z.unknown());

export type LockedOfferLoadFailure =
  | 'missing'
  | 'invalid'
  | 'expired'
  | 'owner_mismatch'
  | 'vehicle_mismatch';

export type LockedOfferLoadResult =
  | { offer: DriverPackageOfferSnapshot; failure: null }
  | { offer: null; failure: LockedOfferLoadFailure };

async function loadStore() {
  return (await loadSecureStorage<Record<string, unknown>>(
    STORAGE_KEYS.lockedPackageOffers,
    lockedOfferStoreSchema,
  )).data ?? {};
}

export async function saveLockedPackageOffer(
  offerInput: DriverPackageOfferSnapshot,
  catalog: DriverRidePackageCatalogEntry[],
  resolvedOffer: DriverRidePackageOffer,
) {
  const offer = validatePackageOfferSnapshot(offerInput);
  if (!offer) throw new Error('Package offer is invalid.');

  const catalogMatch = getActivePackages(offer.vehicleType, catalog, new Date(offer.createdAt)).some(entry =>
    entry.packageId === offer.packageId
    && entry.packageVersion === offer.packageVersion
    && entry.vehicleType === offer.vehicleType);
  if (!catalogMatch) throw new Error('Package offer is no longer available.');
  const matchesResolvedOffer = offer.packageId === resolvedOffer.packageId
    && offer.packageVersion === resolvedOffer.packageVersion
    && offer.packageName === resolvedOffer.packageName
    && offer.vehicleType === resolvedOffer.vehicleType
    && offer.priceRwf === resolvedOffer.priceRwf
    && offer.ridesGranted === resolvedOffer.ridesGranted
    && offer.bonusRidesGranted === resolvedOffer.bonusRidesGranted
    && (offer.campaignId ?? null) === (resolvedOffer.campaignId ?? null)
    && (offer.campaignName ?? null) === (resolvedOffer.campaignName ?? null)
    && (offer.campaignType ?? null) === (resolvedOffer.campaignType ?? null);
  if (!matchesResolvedOffer) throw new Error('Package offer does not match the resolved catalog offer.');

  const store = await loadStore();
  const existing = store[offer.offerId];
  if (existing && JSON.stringify(existing) !== JSON.stringify(offer)) {
    throw new Error('Locked package offers cannot be changed.');
  }
  if (!existing) {
    await saveSecureStorage(STORAGE_KEYS.lockedPackageOffers, {
      ...store,
      [offer.offerId]: offer,
    });
  }
  return offer;
}

export async function loadLockedPackageOffer(
  offerId: string | string[] | undefined,
  options: {
    ownerUserId?: string | null;
    vehicle?: DriverEntitlementVehicleRef | null;
    now?: Date;
  } = {},
): Promise<LockedOfferLoadResult> {
  if (!offerId || Array.isArray(offerId)) return { offer: null, failure: 'missing' };
  const stored = (await loadStore())[offerId];
  if (!stored) return { offer: null, failure: 'missing' };
  const offer = validatePackageOfferSnapshot(stored);
  if (!offer) return { offer: null, failure: 'invalid' };
  if (isPackageOfferExpired(offer, options.now)) return { offer: null, failure: 'expired' };
  if (offer.ownerUserId && options.ownerUserId && offer.ownerUserId !== options.ownerUserId) {
    return { offer: null, failure: 'owner_mismatch' };
  }
  if (options.vehicle) {
    const vehicleOffer = validatePackageOfferSnapshot(offer, options.vehicle);
    if (!vehicleOffer) return { offer: null, failure: 'vehicle_mismatch' };
  }
  return { offer, failure: null };
}
