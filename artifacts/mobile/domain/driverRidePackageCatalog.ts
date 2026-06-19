import type { VehicleType } from '@/types';

export type DriverRidePackageCatalogStatus = 'draft' | 'active' | 'scheduled' | 'expired' | 'archived';

export interface DriverRidePackageCatalogEntry {
  packageId: string;
  packageVersion: string;
  packageName: string;
  vehicleType: VehicleType;
  priceRwf: number;
  ridesGranted: number;
  bonusRidesGranted: number;
  status: DriverRidePackageCatalogStatus;
  createdAt: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  compareAtPriceRwf?: number;
}

const CATALOG_TIMESTAMP = '2026-06-01T00:00:00.000Z';
const ACTIVE_VERSION = 'v1';

export const DRIVER_RIDE_PACKAGE_CATALOG: DriverRidePackageCatalogEntry[] = [
  {
    packageId: 'launch_starter',
    packageVersion: ACTIVE_VERSION,
    packageName: 'Launch Starter Package',
    vehicleType: 'moto',
    priceRwf: 0,
    ridesGranted: 30,
    bonusRidesGranted: 5,
    status: 'active',
    createdAt: CATALOG_TIMESTAMP,
    effectiveFrom: CATALOG_TIMESTAMP,
    effectiveUntil: null,
    compareAtPriceRwf: 1_000,
  },
  {
    packageId: 'growth',
    packageVersion: ACTIVE_VERSION,
    packageName: 'Growth Package',
    vehicleType: 'moto',
    priceRwf: 2_000,
    ridesGranted: 60,
    bonusRidesGranted: 15,
    status: 'active',
    createdAt: CATALOG_TIMESTAMP,
    effectiveFrom: CATALOG_TIMESTAMP,
    effectiveUntil: null,
  },
  {
    packageId: 'pro',
    packageVersion: ACTIVE_VERSION,
    packageName: 'Pro Package',
    vehicleType: 'moto',
    priceRwf: 3_500,
    ridesGranted: 120,
    bonusRidesGranted: 30,
    status: 'active',
    createdAt: CATALOG_TIMESTAMP,
    effectiveFrom: CATALOG_TIMESTAMP,
    effectiveUntil: null,
  },
  {
    packageId: 'cab_starter',
    packageVersion: ACTIVE_VERSION,
    packageName: 'Starter',
    vehicleType: 'cab',
    priceRwf: 0,
    ridesGranted: 2,
    bonusRidesGranted: 2,
    status: 'active',
    createdAt: CATALOG_TIMESTAMP,
    effectiveFrom: CATALOG_TIMESTAMP,
    effectiveUntil: null,
    compareAtPriceRwf: 1_000,
  },
  {
    packageId: 'cab_growth',
    packageVersion: ACTIVE_VERSION,
    packageName: 'Growth',
    vehicleType: 'cab',
    priceRwf: 2_000,
    ridesGranted: 5,
    bonusRidesGranted: 4,
    status: 'active',
    createdAt: CATALOG_TIMESTAMP,
    effectiveFrom: CATALOG_TIMESTAMP,
    effectiveUntil: null,
  },
  {
    packageId: 'cab_pro',
    packageVersion: ACTIVE_VERSION,
    packageName: 'Pro',
    vehicleType: 'cab',
    priceRwf: 5_000,
    ridesGranted: 10,
    bonusRidesGranted: 9,
    status: 'active',
    createdAt: CATALOG_TIMESTAMP,
    effectiveFrom: CATALOG_TIMESTAMP,
    effectiveUntil: null,
  },
  {
    packageId: 'hilux_starter',
    packageVersion: ACTIVE_VERSION,
    packageName: 'Starter',
    vehicleType: 'hilux',
    priceRwf: 0,
    ridesGranted: 1,
    bonusRidesGranted: 1,
    status: 'active',
    createdAt: CATALOG_TIMESTAMP,
    effectiveFrom: CATALOG_TIMESTAMP,
    effectiveUntil: null,
    compareAtPriceRwf: 1_000,
  },
  {
    packageId: 'hilux_growth',
    packageVersion: ACTIVE_VERSION,
    packageName: 'Growth',
    vehicleType: 'hilux',
    priceRwf: 2_000,
    ridesGranted: 2,
    bonusRidesGranted: 3,
    status: 'active',
    createdAt: CATALOG_TIMESTAMP,
    effectiveFrom: CATALOG_TIMESTAMP,
    effectiveUntil: null,
  },
  {
    packageId: 'hilux_pro',
    packageVersion: ACTIVE_VERSION,
    packageName: 'Pro',
    vehicleType: 'hilux',
    priceRwf: 5_000,
    ridesGranted: 4,
    bonusRidesGranted: 7,
    status: 'active',
    createdAt: CATALOG_TIMESTAMP,
    effectiveFrom: CATALOG_TIMESTAMP,
    effectiveUntil: null,
  },
  {
    packageId: 'rifani_starter',
    packageVersion: ACTIVE_VERSION,
    packageName: 'Starter',
    vehicleType: 'rifani',
    priceRwf: 0,
    ridesGranted: 4,
    bonusRidesGranted: 2,
    status: 'active',
    createdAt: CATALOG_TIMESTAMP,
    effectiveFrom: CATALOG_TIMESTAMP,
    effectiveUntil: null,
    compareAtPriceRwf: 1_000,
  },
  {
    packageId: 'rifani_growth',
    packageVersion: ACTIVE_VERSION,
    packageName: 'Growth',
    vehicleType: 'rifani',
    priceRwf: 2_000,
    ridesGranted: 8,
    bonusRidesGranted: 5,
    status: 'active',
    createdAt: CATALOG_TIMESTAMP,
    effectiveFrom: CATALOG_TIMESTAMP,
    effectiveUntil: null,
  },
  {
    packageId: 'rifani_pro',
    packageVersion: ACTIVE_VERSION,
    packageName: 'Pro',
    vehicleType: 'rifani',
    priceRwf: 5_000,
    ridesGranted: 16,
    bonusRidesGranted: 11,
    status: 'active',
    createdAt: CATALOG_TIMESTAMP,
    effectiveFrom: CATALOG_TIMESTAMP,
    effectiveUntil: null,
  },
  {
    packageId: 'fuso_starter',
    packageVersion: ACTIVE_VERSION,
    packageName: 'Starter',
    vehicleType: 'fuso',
    priceRwf: 0,
    ridesGranted: 1,
    bonusRidesGranted: 2,
    status: 'active',
    createdAt: CATALOG_TIMESTAMP,
    effectiveFrom: CATALOG_TIMESTAMP,
    effectiveUntil: null,
    compareAtPriceRwf: 2_500,
  },
  {
    packageId: 'fuso_growth',
    packageVersion: ACTIVE_VERSION,
    packageName: 'Growth',
    vehicleType: 'fuso',
    priceRwf: 5_000,
    ridesGranted: 2,
    bonusRidesGranted: 3,
    status: 'active',
    createdAt: CATALOG_TIMESTAMP,
    effectiveFrom: CATALOG_TIMESTAMP,
    effectiveUntil: null,
  },
  {
    packageId: 'fuso_pro',
    packageVersion: ACTIVE_VERSION,
    packageName: 'Pro',
    vehicleType: 'fuso',
    priceRwf: 10_000,
    ridesGranted: 4,
    bonusRidesGranted: 7,
    status: 'active',
    createdAt: CATALOG_TIMESTAMP,
    effectiveFrom: CATALOG_TIMESTAMP,
    effectiveUntil: null,
  },
];

export function getActivePackages(
  vehicleType?: VehicleType | null,
  catalog: DriverRidePackageCatalogEntry[] = DRIVER_RIDE_PACKAGE_CATALOG,
  now = new Date(),
) {
  const currentTime = now.getTime();
  return catalog.filter(entry => {
    const effectiveFrom = new Date(entry.effectiveFrom).getTime();
    const effectiveUntil = entry.effectiveUntil ? new Date(entry.effectiveUntil).getTime() : null;
    return entry.status === 'active'
      && !Number.isNaN(effectiveFrom)
      && effectiveFrom <= currentTime
      && (effectiveUntil === null || (!Number.isNaN(effectiveUntil) && currentTime <= effectiveUntil))
      && (!vehicleType || entry.vehicleType === vehicleType);
  });
}

export function getPackageByVersion(
  packageId: string,
  packageVersion: string,
  vehicleType?: VehicleType | null,
  catalog: DriverRidePackageCatalogEntry[] = DRIVER_RIDE_PACKAGE_CATALOG,
) {
  return catalog.find(entry =>
    entry.packageId === packageId &&
    entry.packageVersion === packageVersion &&
    (!vehicleType || entry.vehicleType === vehicleType),
  ) ?? null;
}

export function getPackageCatalogEntry(
  packageId: string,
  vehicleType?: VehicleType | null,
  packageVersion?: string | null,
  catalog: DriverRidePackageCatalogEntry[] = DRIVER_RIDE_PACKAGE_CATALOG,
) {
  if (packageVersion) {
    return getPackageByVersion(packageId, packageVersion, vehicleType, catalog);
  }

  const active = getActivePackages(vehicleType, catalog).find(entry => entry.packageId === packageId);
  if (active) return active;

  return catalog.find(entry =>
    entry.packageId === packageId &&
    (!vehicleType || entry.vehicleType === vehicleType),
  ) ?? null;
}

const VEHICLE_TYPES: VehicleType[] = ['moto', 'rifani', 'cab', 'fuso', 'hilux'];

export function isValidPackageCatalogEntry(value: unknown): value is DriverRidePackageCatalogEntry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entry = value as Partial<DriverRidePackageCatalogEntry>;
  const createdAt = typeof entry.createdAt === 'string' ? new Date(entry.createdAt).getTime() : Number.NaN;
  const effectiveFrom = typeof entry.effectiveFrom === 'string'
    ? new Date(entry.effectiveFrom).getTime()
    : Number.NaN;
  const effectiveUntil = entry.effectiveUntil === null
    ? null
    : typeof entry.effectiveUntil === 'string'
      ? new Date(entry.effectiveUntil).getTime()
      : Number.NaN;
  return typeof entry.packageId === 'string'
    && entry.packageId.trim().length > 0
    && typeof entry.packageVersion === 'string'
    && entry.packageVersion.trim().length > 0
    && typeof entry.packageName === 'string'
    && entry.packageName.trim().length > 0
    && typeof entry.vehicleType === 'string'
    && VEHICLE_TYPES.includes(entry.vehicleType as VehicleType)
    && typeof entry.status === 'string'
    && ['draft', 'active', 'scheduled', 'expired', 'archived'].includes(entry.status)
    && typeof entry.priceRwf === 'number'
    && Number.isFinite(entry.priceRwf)
    && entry.priceRwf >= 0
    && typeof entry.ridesGranted === 'number'
    && Number.isInteger(entry.ridesGranted)
    && entry.ridesGranted >= 0
    && typeof entry.bonusRidesGranted === 'number'
    && Number.isInteger(entry.bonusRidesGranted)
    && entry.bonusRidesGranted >= 0
    && !Number.isNaN(createdAt)
    && !Number.isNaN(effectiveFrom)
    && (effectiveUntil === null || (!Number.isNaN(effectiveUntil) && effectiveUntil > effectiveFrom));
}

export function validatePackageCatalog(catalog: unknown): DriverRidePackageCatalogEntry[] {
  if (!Array.isArray(catalog) || !catalog.every(isValidPackageCatalogEntry)) {
    throw new Error('Package catalog is invalid.');
  }
  return catalog;
}
