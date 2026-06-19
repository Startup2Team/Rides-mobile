import { getActiveDriverVehicle, getDriverVehicleForSession, getPrimaryDriverVehicle } from './driverVehicles';
import {
  DRIVER_RIDE_PACKAGE_CATALOG,
  getActivePackages,
  getPackageCatalogEntry,
  type DriverRidePackageCatalogEntry,
  type DriverRidePackageCatalogStatus,
} from './driverRidePackageCatalog';
import type { DriverProfile, DriverVehicleProfile, VehicleType } from '@/types';

export type DriverRidePackageId = 'launch_starter' | 'growth' | 'pro' | 'cab_starter' | 'cab_growth' | 'cab_pro' | 'hilux_starter' | 'hilux_growth' | 'hilux_pro' | 'rifani_starter' | 'rifani_growth' | 'rifani_pro' | 'fuso_starter' | 'fuso_growth' | 'fuso_pro';
export type DriverEntitlementAuthority = 'local_prototype' | 'backend';
export type MobileMoneyPackageProvider = 'mtn' | 'airtel';
export type DriverPackagePurchaseStatus =
  | 'idle'
  | 'pending'
  | 'processing'
  | 'successful'
  | 'failed'
  | 'cancelled'
  | 'expired';

export interface DriverRidePackage {
  id: DriverRidePackageId;
  name: string;
  normalPriceRwf: number;
  currentPriceRwf: number;
  includedRides: number;
  bonusRides: number;
  totalCredits: number;
  launchOffer: boolean;
}

export interface DriverRidePackageCatalogSnapshot {
  packageId: DriverRidePackageId;
  packageVersion: string;
  packageName: string;
  vehicleType: VehicleType;
  pricePaid: number;
  ridesGranted: number;
  bonusRidesGranted: number;
  purchasedAt: string;
}

export interface PackageActivation {
  id: string;
  packageId: DriverRidePackageId;
  packageVersion?: string;
  packageName?: string;
  vehicleId: string;
  vehicleType: VehicleType;
  activatedAt: string;
  pricePaidRwf: number;
  creditsGranted: number;
  authority: DriverEntitlementAuthority;
}

export interface DriverPackagePurchase {
  packageId: DriverRidePackageId;
  packageVersion?: string;
  packageName?: string;
  vehicleId: string;
  vehicleType: VehicleType;
  amount: number;
  pricePaid?: number;
  ridesGranted?: number;
  bonusRidesGranted?: number;
  purchasedAt?: string;
  provider: MobileMoneyPackageProvider;
  phoneNumber: string;
  transactionId: string;
  status: DriverPackagePurchaseStatus;
  createdAt: string;
  completedAt?: string;
}

export interface DriverCreditTransaction {
  id: string;
  type: 'credit' | 'debit';
  vehicleId: string;
  vehicleType: VehicleType;
  amount: number;
  createdAt: string;
  packageActivationId?: string;
  completedRideId?: string;
  idempotencyKey: string;
  authority: DriverEntitlementAuthority;
}

export interface DriverEntitlement {
  vehicleId: string | null;
  vehicleType: VehicleType | null;
  activePackageId: DriverRidePackageId | null;
  remainingRideCredits: number;
  remainingBonusRides: number;
  activations: PackageActivation[];
  creditTransactions: DriverCreditTransaction[];
  purchaseHistory: DriverPackagePurchase[];
  vehicleEntitlements: VehicleEntitlement[];
  updatedAt: string;
  authority: DriverEntitlementAuthority;
}

export interface VehicleEntitlement {
  vehicleId: string;
  vehicleType: VehicleType;
  activePackageId: DriverRidePackageId | null;
  remainingRideCredits: number;
  remainingBonusRides: number;
  activations: PackageActivation[];
  creditTransactions: DriverCreditTransaction[];
  purchaseHistory: DriverPackagePurchase[];
  updatedAt: string;
  authority: DriverEntitlementAuthority;
}

function toLegacyRidePackage(entry: DriverRidePackageCatalogEntry): DriverRidePackage {
  const totalCredits = entry.ridesGranted + entry.bonusRidesGranted;
  return {
    id: entry.packageId,
    name: entry.packageName,
    normalPriceRwf: entry.compareAtPriceRwf ?? entry.priceRwf,
    currentPriceRwf: entry.priceRwf,
    includedRides: entry.ridesGranted,
    bonusRides: entry.bonusRidesGranted,
    totalCredits,
    launchOffer: entry.priceRwf === 0,
  };
}

export function getDriverRidePackageCatalogEntries(
  status?: DriverRidePackageCatalogStatus,
  vehicleType?: VehicleType | null,
  catalog: DriverRidePackageCatalogEntry[] = DRIVER_RIDE_PACKAGE_CATALOG,
) {
  return catalog.filter(entry =>
    (!status || entry.status === status) &&
    (!vehicleType || entry.vehicleType === vehicleType),
  );
}

export function getActivePackagesByVehicleType(
  vehicleType?: VehicleType | null,
  catalog: DriverRidePackageCatalogEntry[] = DRIVER_RIDE_PACKAGE_CATALOG,
) {
  return getActivePackages(vehicleType, catalog).map(toLegacyRidePackage);
}

export const DRIVER_RIDE_PACKAGES: Record<DriverRidePackageId, DriverRidePackage> = Object.fromEntries(
  getActivePackages().map(entry => [entry.packageId, toLegacyRidePackage(entry)]),
) as Record<DriverRidePackageId, DriverRidePackage>;

export function getPackageCatalogSnapshot(
  packageId: DriverRidePackageId,
  vehicleType?: VehicleType | null,
  packageVersion?: string | null,
  catalog: DriverRidePackageCatalogEntry[] = DRIVER_RIDE_PACKAGE_CATALOG,
): DriverRidePackageCatalogSnapshot | null {
  const entry = getPackageCatalogEntry(packageId, vehicleType, packageVersion, catalog);
  if (!entry) return null;
  return {
    packageId: entry.packageId,
    packageVersion: entry.packageVersion,
    packageName: entry.packageName,
    vehicleType: entry.vehicleType,
    pricePaid: entry.priceRwf,
    ridesGranted: entry.ridesGranted,
    bonusRidesGranted: entry.bonusRidesGranted,
    purchasedAt: entry.effectiveFrom,
  };
}

export function getPackagePurchaseSnapshot(
  purchase: DriverPackagePurchase | null | undefined,
  vehicle?: DriverEntitlementVehicleRef | null,
): DriverRidePackageCatalogSnapshot | null {
  if (!purchase) return null;
  const vehicleType = purchase.vehicleType ?? vehicle?.vehicleType ?? null;
  const snapshot = purchase.packageVersion
    ? getPackageCatalogSnapshot(purchase.packageId, vehicleType, purchase.packageVersion)
    : getPackageCatalogSnapshot(purchase.packageId, vehicleType);
  if (snapshot) {
    return {
      ...snapshot,
      packageVersion: purchase.packageVersion ?? snapshot.packageVersion,
      packageName: purchase.packageName ?? snapshot.packageName,
      pricePaid: purchase.pricePaid ?? purchase.amount ?? snapshot.pricePaid,
      ridesGranted: purchase.ridesGranted ?? snapshot.ridesGranted,
      bonusRidesGranted: purchase.bonusRidesGranted ?? snapshot.bonusRidesGranted,
      purchasedAt: purchase.purchasedAt ?? purchase.createdAt ?? snapshot.purchasedAt,
    };
  }

  return {
    packageId: purchase.packageId,
    packageVersion: purchase.packageVersion ?? 'v1',
    packageName: purchase.packageName ?? purchase.packageId,
    vehicleType: vehicleType ?? 'moto',
    pricePaid: purchase.pricePaid ?? purchase.amount,
    ridesGranted: purchase.ridesGranted ?? 0,
    bonusRidesGranted: purchase.bonusRidesGranted ?? 0,
    purchasedAt: purchase.purchasedAt ?? purchase.createdAt,
  };
}

export function getPackagesForVehicleType(vehicleType: VehicleType | null | undefined): DriverRidePackageId[] {
  return getActivePackagesByVehicleType(vehicleType).map(pkg => pkg.id);
}

function assertPackageMatchesVehicle(packageId: DriverRidePackageId, vehicleType: VehicleType) {
  if (!getPackagesForVehicleType(vehicleType).includes(packageId)) {
    throw new Error('Package does not apply to this vehicle type.');
  }
}

export function hasUsedCabStarterOffer(entitlement: DriverEntitlement | null | undefined) {
  return normalizeEntitlement(entitlement).activations.some(a => a.packageId === 'cab_starter');
}

export function hasUsedHiluxStarterOffer(entitlement: DriverEntitlement | null | undefined) {
  return normalizeEntitlement(entitlement).activations.some(a => a.packageId === 'hilux_starter');
}

export function hasUsedRifaniStarterOffer(entitlement: DriverEntitlement | null | undefined) {
  return normalizeEntitlement(entitlement).activations.some(a => a.packageId === 'rifani_starter');
}

export function hasUsedFusoStarterOffer(entitlement: DriverEntitlement | null | undefined) {
  return normalizeEntitlement(entitlement).activations.some(a => a.packageId === 'fuso_starter');
}

export const EMPTY_DRIVER_ENTITLEMENT: DriverEntitlement = {
  vehicleId: null,
  vehicleType: null,
  activePackageId: null,
  remainingRideCredits: 0,
  remainingBonusRides: 0,
  activations: [],
  creditTransactions: [],
  purchaseHistory: [],
  vehicleEntitlements: [],
  updatedAt: '',
  authority: 'local_prototype',
};

export type DriverEntitlementVehicleRef = Pick<DriverVehicleProfile, 'id' | 'vehicleType'> | {
  vehicleId: string;
  vehicleType: VehicleType;
};

const LEGACY_VEHICLE_ID = 'driver-vehicle:legacy';
const LEGACY_VEHICLE_TYPE: VehicleType = 'moto';

function vehicleIdFromRef(vehicle?: DriverEntitlementVehicleRef | null) {
  if (!vehicle) return null;
  return 'id' in vehicle ? vehicle.id : vehicle.vehicleId;
}

function vehicleTypeFromRef(vehicle?: DriverEntitlementVehicleRef | null) {
  return vehicle?.vehicleType ?? null;
}

function hasLegacyBalance(entitlement: DriverEntitlement | null | undefined) {
  return Boolean(
    entitlement?.activePackageId ||
    entitlement?.remainingRideCredits ||
    entitlement?.remainingBonusRides ||
    entitlement?.activations?.length ||
    entitlement?.creditTransactions?.length ||
    entitlement?.purchaseHistory?.length
  );
}

function emptyVehicleEntitlement(vehicleId: string, vehicleType: VehicleType, updatedAt = ''): VehicleEntitlement {
  return {
    vehicleId,
    vehicleType,
    activePackageId: null,
    remainingRideCredits: 0,
    remainingBonusRides: 0,
    activations: [],
    creditTransactions: [],
    purchaseHistory: [],
    updatedAt,
    authority: 'local_prototype',
  };
}

function stampActivation(
  activation: PackageActivation,
  vehicleId: string,
  vehicleType: VehicleType,
): PackageActivation {
  const snapshot = getPackageCatalogSnapshot(activation.packageId, activation.vehicleType ?? vehicleType, activation.packageVersion ?? null);
  return {
    ...activation,
    vehicleId: activation.vehicleId ?? vehicleId,
    vehicleType: activation.vehicleType ?? vehicleType,
    packageVersion: activation.packageVersion ?? snapshot?.packageVersion,
    packageName: activation.packageName ?? snapshot?.packageName,
  };
}

function stampPurchase(
  purchase: DriverPackagePurchase,
  vehicleId: string,
  vehicleType: VehicleType,
): DriverPackagePurchase {
  const snapshot = getPackageCatalogSnapshot(purchase.packageId, purchase.vehicleType ?? vehicleType, purchase.packageVersion ?? null);
  const packageVersion = purchase.packageVersion ?? snapshot?.packageVersion;
  const packageName = purchase.packageName ?? snapshot?.packageName;
  const ridesGranted = purchase.ridesGranted ?? snapshot?.ridesGranted;
  const bonusRidesGranted = purchase.bonusRidesGranted ?? snapshot?.bonusRidesGranted;
  const pricePaid = purchase.pricePaid ?? purchase.amount ?? snapshot?.pricePaid;
  const purchasedAt = purchase.purchasedAt ?? purchase.createdAt ?? snapshot?.purchasedAt;
  return {
    ...purchase,
    vehicleId: purchase.vehicleId ?? vehicleId,
    vehicleType: purchase.vehicleType ?? vehicleType,
    packageVersion,
    packageName,
    ridesGranted,
    bonusRidesGranted,
    pricePaid,
    purchasedAt,
    amount: pricePaid ?? purchase.amount,
    createdAt: purchase.createdAt ?? purchasedAt ?? '',
  };
}

function stampTransaction(
  transaction: DriverCreditTransaction,
  vehicleId: string,
  vehicleType: VehicleType,
): DriverCreditTransaction {
  return { ...transaction, vehicleId: transaction.vehicleId ?? vehicleId, vehicleType: transaction.vehicleType ?? vehicleType };
}

function legacyVehicleEntitlement(
  entitlement: DriverEntitlement,
  vehicleId: string,
  vehicleType: VehicleType,
): VehicleEntitlement {
  return {
    vehicleId,
    vehicleType,
    activePackageId: entitlement.activePackageId ?? null,
    remainingRideCredits: Math.max(0, entitlement.remainingRideCredits ?? 0),
    remainingBonusRides: Math.max(0, entitlement.remainingBonusRides ?? 0),
    activations: (entitlement.activations ?? []).map(activation => stampActivation(activation, vehicleId, vehicleType)),
    creditTransactions: (entitlement.creditTransactions ?? []).map(transaction => stampTransaction(transaction, vehicleId, vehicleType)),
    purchaseHistory: (entitlement.purchaseHistory ?? []).map(purchase => stampPurchase(purchase, vehicleId, vehicleType)),
    updatedAt: entitlement.updatedAt ?? '',
    authority: entitlement.authority ?? 'local_prototype',
  };
}

export function normalizeEntitlement(
  entitlement: DriverEntitlement | VehicleEntitlement | null | undefined,
  vehicle?: DriverEntitlementVehicleRef | null,
): DriverEntitlement {
  const base = { ...EMPTY_DRIVER_ENTITLEMENT, ...(entitlement ?? {}) };
  const requestedVehicleId = vehicleIdFromRef(vehicle);
  const requestedVehicleType = vehicleTypeFromRef(vehicle);
  const fallbackVehicleId = requestedVehicleId ?? base.vehicleId ?? base.vehicleEntitlements?.[0]?.vehicleId ?? LEGACY_VEHICLE_ID;
  const fallbackVehicleType = requestedVehicleType ?? base.vehicleType ?? base.vehicleEntitlements?.[0]?.vehicleType ?? LEGACY_VEHICLE_TYPE;

  const existingVehicles = base.vehicleEntitlements ?? [];
  let vehicleEntitlements = existingVehicles.length > 0
    ? existingVehicles.map(item => ({
        ...emptyVehicleEntitlement(item.vehicleId, item.vehicleType, item.updatedAt),
        ...item,
        activations: (item.activations ?? []).map(activation => stampActivation(activation, item.vehicleId, item.vehicleType)),
        creditTransactions: (item.creditTransactions ?? []).map(transaction => stampTransaction(transaction, item.vehicleId, item.vehicleType)),
        purchaseHistory: (item.purchaseHistory ?? []).map(purchase => stampPurchase(purchase, item.vehicleId, item.vehicleType)),
      }))
    : hasLegacyBalance(base)
      ? [legacyVehicleEntitlement(base, fallbackVehicleId, fallbackVehicleType)]
      : [];

  if (
    requestedVehicleId
    && requestedVehicleType
    && !vehicleEntitlements.some(item => item.vehicleId === requestedVehicleId)
    && vehicleEntitlements.length === 1
    && vehicleEntitlements[0].vehicleId === LEGACY_VEHICLE_ID
  ) {
    const [legacy] = vehicleEntitlements;
    vehicleEntitlements = [{
      ...legacy,
      vehicleId: requestedVehicleId,
      vehicleType: requestedVehicleType,
      activations: legacy.activations.map(activation => ({ ...activation, vehicleId: requestedVehicleId, vehicleType: requestedVehicleType })),
      creditTransactions: legacy.creditTransactions.map(transaction => ({ ...transaction, vehicleId: requestedVehicleId, vehicleType: requestedVehicleType })),
      purchaseHistory: legacy.purchaseHistory.map(purchase => ({ ...purchase, vehicleId: requestedVehicleId, vehicleType: requestedVehicleType })),
    }];
  }

  const activeVehicle = vehicleEntitlements.find(item => item.vehicleId === fallbackVehicleId)
    ?? (requestedVehicleId && requestedVehicleType ? emptyVehicleEntitlement(requestedVehicleId, requestedVehicleType, base.updatedAt) : null)
    ?? vehicleEntitlements[0]
    ?? null;

  return {
    ...base,
    vehicleId: activeVehicle?.vehicleId ?? requestedVehicleId ?? base.vehicleId ?? null,
    vehicleType: activeVehicle?.vehicleType ?? requestedVehicleType ?? base.vehicleType ?? null,
    activePackageId: activeVehicle?.activePackageId ?? null,
    remainingRideCredits: activeVehicle?.remainingRideCredits ?? 0,
    remainingBonusRides: activeVehicle?.remainingBonusRides ?? 0,
    activations: activeVehicle?.activations ?? [],
    creditTransactions: activeVehicle?.creditTransactions ?? [],
    purchaseHistory: activeVehicle?.purchaseHistory ?? [],
    vehicleEntitlements: activeVehicle && !vehicleEntitlements.some(item => item.vehicleId === activeVehicle.vehicleId)
      ? [...vehicleEntitlements, activeVehicle]
      : vehicleEntitlements,
    updatedAt: activeVehicle?.updatedAt ?? base.updatedAt ?? '',
    authority: activeVehicle?.authority ?? base.authority ?? 'local_prototype',
  };
}

function replaceVehicleEntitlement(
  entitlement: DriverEntitlement,
  vehicleEntitlement: VehicleEntitlement,
): DriverEntitlement {
  const existing = entitlement.vehicleEntitlements ?? [];
  const found = existing.some(item => item.vehicleId === vehicleEntitlement.vehicleId);
  return normalizeEntitlement({
    ...entitlement,
    vehicleEntitlements: found
      ? existing.map(item => item.vehicleId === vehicleEntitlement.vehicleId ? vehicleEntitlement : item)
      : [...existing, vehicleEntitlement],
  }, vehicleEntitlement);
}

export function getVehicleEntitlement(
  entitlement: DriverEntitlement | VehicleEntitlement | null | undefined,
  vehicle?: DriverEntitlementVehicleRef | null,
): VehicleEntitlement {
  const normalized = normalizeEntitlement(entitlement, vehicle);
  const vehicleId = normalized.vehicleId ?? vehicleIdFromRef(vehicle) ?? LEGACY_VEHICLE_ID;
  const vehicleType = normalized.vehicleType ?? vehicleTypeFromRef(vehicle) ?? LEGACY_VEHICLE_TYPE;
  return normalized.vehicleEntitlements.find(item => item.vehicleId === vehicleId)
    ?? emptyVehicleEntitlement(vehicleId, vehicleType, normalized.updatedAt);
}

export function getEntitlementVehicleForProfile(profile: DriverProfile | null | undefined) {
  return getDriverVehicleForSession(profile) ?? getActiveDriverVehicle(profile) ?? getPrimaryDriverVehicle(profile);
}

export const getActiveRideCredits = (entitlement: DriverEntitlement | VehicleEntitlement | null | undefined) =>
  Math.max(0, normalizeEntitlement(entitlement).remainingRideCredits + normalizeEntitlement(entitlement).remainingBonusRides);

export const getRideBalance = (entitlement: DriverEntitlement | VehicleEntitlement | null | undefined) =>
  Math.max(0, normalizeEntitlement(entitlement).remainingRideCredits ?? 0);

export const getActiveBonusRides = (entitlement: DriverEntitlement | VehicleEntitlement | null | undefined) =>
  Math.max(0, normalizeEntitlement(entitlement).remainingBonusRides ?? 0);

export const canDriverGoOnlineWithCredits = (
  profile: DriverProfile | null | undefined,
  entitlement: DriverEntitlement | VehicleEntitlement | null | undefined,
) => {
  const vehicle = getActiveDriverVehicle(profile) ?? getPrimaryDriverVehicle(profile);
  const vehicleApproved = vehicle ? vehicle.status === 'approved' : true;
  return !profile?.isOnline
    && (profile?.verificationStatus ? profile.verificationStatus === 'approved' : profile?.isVerified === true)
    && profile?.isVerified === true
    && vehicleApproved
    && getActiveRideCredits(normalizeEntitlement(entitlement, vehicle)) > 0;
};

export const hasUsedLaunchOffer = (entitlement: DriverEntitlement | null | undefined) =>
  normalizeEntitlement(entitlement).activations.some(activation => activation.packageId === 'launch_starter');

export const isLowRideCreditBalance = (entitlement: DriverEntitlement | null | undefined) => {
  const credits = getActiveRideCredits(entitlement);
  return credits > 0 && credits <= 10;
};

export const getRideCreditBalanceMessage = (entitlement: DriverEntitlement | null | undefined) => {
  const credits = getActiveRideCredits(entitlement);
  if (credits === 0) return 'Choose a package to start receiving ride requests.';
  if (credits <= 2) return `Only ${credits} rides left. Add a package soon to keep receiving requests.`;
  if (credits <= 5) return `Only ${credits} rides left. Add a package soon to keep receiving requests.`;
  if (credits <= 10) return `${credits} rides left. Consider adding a package soon.`;
  return null;
};

export const getRideCreditProgress = (entitlement: DriverEntitlement | null | undefined) => {
  const current = normalizeEntitlement(entitlement);
  const totalGranted = current.activations.reduce((total, activation) => total + activation.creditsGranted, 0);
  const remaining = getActiveRideCredits(current);
  return {
    remaining,
    totalGranted,
    ratio: totalGranted > 0 ? Math.min(1, remaining / totalGranted) : 0,
    activationCount: current.activations.length,
  };
};

export function activatePackage(
  entitlement: DriverEntitlement | null | undefined,
  packageId: DriverRidePackageId,
  now = new Date().toISOString(),
  vehicle?: DriverEntitlementVehicleRef | null,
): { entitlement: DriverEntitlement; activation: PackageActivation } {
  const current = normalizeEntitlement(entitlement, vehicle);
  const currentVehicle = getVehicleEntitlement(current, vehicle);
  const ridePackage = DRIVER_RIDE_PACKAGES[packageId];
  const catalogSnapshot = getPackageCatalogSnapshot(packageId, currentVehicle.vehicleType);
  const snapshot = catalogSnapshot ?? {
    packageId,
    packageVersion: 'v1',
    packageName: ridePackage.name,
    vehicleType: currentVehicle.vehicleType,
    pricePaid: ridePackage.currentPriceRwf,
    ridesGranted: ridePackage.includedRides,
    bonusRidesGranted: ridePackage.bonusRides,
    purchasedAt: now,
  };
  assertPackageMatchesVehicle(packageId, currentVehicle.vehicleType);
  if (ridePackage.launchOffer && currentVehicle.activations.some(activation => DRIVER_RIDE_PACKAGES[activation.packageId]?.launchOffer)) {
    throw new Error('Launch offer has already been used');
  }

  const activation: PackageActivation = {
    id: `activation:${currentVehicle.vehicleId}:${packageId}:${now}`,
    packageId,
    packageVersion: snapshot.packageVersion,
    packageName: snapshot.packageName,
    vehicleId: currentVehicle.vehicleId,
    vehicleType: currentVehicle.vehicleType,
    activatedAt: now,
    pricePaidRwf: snapshot.pricePaid,
    creditsGranted: snapshot.ridesGranted + snapshot.bonusRidesGranted,
    authority: 'local_prototype',
  };
  const transaction: DriverCreditTransaction = {
    id: `credit:${activation.id}`,
    type: 'credit',
    vehicleId: currentVehicle.vehicleId,
    vehicleType: currentVehicle.vehicleType,
    amount: snapshot.ridesGranted + snapshot.bonusRidesGranted,
    createdAt: now,
    packageActivationId: activation.id,
    idempotencyKey: `package-activation:${activation.id}`,
    authority: 'local_prototype',
  };
  return {
    activation,
    entitlement: replaceVehicleEntitlement(current, {
      ...currentVehicle,
      activePackageId: packageId,
      remainingRideCredits: currentVehicle.remainingRideCredits + snapshot.ridesGranted,
      remainingBonusRides: currentVehicle.remainingBonusRides + snapshot.bonusRidesGranted,
      activations: [...currentVehicle.activations, activation],
      creditTransactions: [...currentVehicle.creditTransactions, transaction],
      updatedAt: now,
      authority: 'local_prototype',
    }),
  };
}

export function createPackagePurchase(
  entitlement: DriverEntitlement | null | undefined,
  input: {
    packageId: DriverRidePackageId;
    provider: MobileMoneyPackageProvider;
    phoneNumber: string;
  },
  now = new Date().toISOString(),
  vehicle?: DriverEntitlementVehicleRef | null,
): { entitlement: DriverEntitlement; purchase: DriverPackagePurchase } {
  const current = normalizeEntitlement(entitlement, vehicle);
  const currentVehicle = getVehicleEntitlement(current, vehicle);
  const ridePackage = DRIVER_RIDE_PACKAGES[input.packageId];
  const catalogSnapshot = getPackageCatalogSnapshot(input.packageId, currentVehicle.vehicleType);
  const snapshot = catalogSnapshot ?? {
    packageId: input.packageId,
    packageVersion: 'v1',
    packageName: ridePackage.name,
    vehicleType: currentVehicle.vehicleType,
    pricePaid: ridePackage.currentPriceRwf,
    ridesGranted: ridePackage.includedRides,
    bonusRidesGranted: ridePackage.bonusRides,
    purchasedAt: now,
  };
  assertPackageMatchesVehicle(input.packageId, currentVehicle.vehicleType);
  if (ridePackage.currentPriceRwf <= 0) {
    throw new Error('This package does not require Mobile Money confirmation.');
  }

  const purchase: DriverPackagePurchase = {
    packageId: input.packageId,
    packageVersion: snapshot.packageVersion,
    packageName: snapshot.packageName,
    vehicleId: currentVehicle.vehicleId,
    vehicleType: currentVehicle.vehicleType,
    amount: snapshot.pricePaid,
    pricePaid: snapshot.pricePaid,
    ridesGranted: snapshot.ridesGranted,
    bonusRidesGranted: snapshot.bonusRidesGranted,
    purchasedAt: now,
    provider: input.provider,
    phoneNumber: input.phoneNumber,
    transactionId: `momo-package:${input.packageId}:${now}`,
    status: 'pending',
    createdAt: now,
  };

  return {
    purchase,
    entitlement: replaceVehicleEntitlement(current, {
      ...currentVehicle,
      purchaseHistory: [...currentVehicle.purchaseHistory, purchase],
      updatedAt: now,
    }),
  };
}

export function updatePackagePurchaseStatus(
  entitlement: DriverEntitlement | null | undefined,
  transactionId: string,
  status: Exclude<DriverPackagePurchaseStatus, 'idle'>,
  now = new Date().toISOString(),
  vehicle?: DriverEntitlementVehicleRef | null,
): { entitlement: DriverEntitlement; purchase: DriverPackagePurchase; activation?: PackageActivation } {
  const current = normalizeEntitlement(entitlement, vehicle);
  const vehicleEntitlements = current.vehicleEntitlements.length > 0
    ? current.vehicleEntitlements
    : [getVehicleEntitlement(current, vehicle)];
  const currentVehicle = vehicleEntitlements.find(item => item.purchaseHistory.some(purchase => purchase.transactionId === transactionId))
    ?? getVehicleEntitlement(current, vehicle);
  const purchase = currentVehicle.purchaseHistory.find(item => item.transactionId === transactionId);
  if (!purchase) throw new Error('Package purchase was not found.');

  const finalStatuses: DriverPackagePurchaseStatus[] = ['successful', 'failed', 'cancelled', 'expired'];
  const completedAt = finalStatuses.includes(status) ? now : purchase.completedAt;
  const updatedPurchase: DriverPackagePurchase = { ...purchase, status, completedAt };
  const purchaseHistory = currentVehicle.purchaseHistory.map(item =>
    item.transactionId === transactionId ? updatedPurchase : item,
  );

  let nextVehicle: VehicleEntitlement = {
    ...currentVehicle,
    purchaseHistory,
    updatedAt: now,
  };
  let next = replaceVehicleEntitlement(current, nextVehicle);

  if (status !== 'successful') return { entitlement: next, purchase: updatedPurchase };

  const idempotencyKey = `package-purchase:${transactionId}`;
  const existingActivation = nextVehicle.activations.find(activation => activation.id === `activation:${transactionId}`);
  if (nextVehicle.creditTransactions.some(transaction => transaction.idempotencyKey === idempotencyKey) && existingActivation) {
    return { entitlement: next, purchase: updatedPurchase, activation: existingActivation };
  }

  const ridePackage = DRIVER_RIDE_PACKAGES[purchase.packageId];
  const snapshot = getPackageCatalogSnapshot(purchase.packageId, currentVehicle.vehicleType, purchase.packageVersion)
    ?? {
      packageId: purchase.packageId,
      packageVersion: purchase.packageVersion ?? 'v1',
      packageName: purchase.packageName ?? ridePackage.name,
      vehicleType: currentVehicle.vehicleType,
      pricePaid: purchase.pricePaid ?? purchase.amount,
      ridesGranted: purchase.ridesGranted ?? ridePackage.includedRides,
      bonusRidesGranted: purchase.bonusRidesGranted ?? ridePackage.bonusRides,
      purchasedAt: purchase.purchasedAt ?? purchase.createdAt,
    };
  const activation: PackageActivation = {
    id: `activation:${transactionId}`,
    packageId: purchase.packageId,
    packageVersion: snapshot.packageVersion,
    packageName: snapshot.packageName,
    vehicleId: currentVehicle.vehicleId,
    vehicleType: currentVehicle.vehicleType,
    activatedAt: now,
    pricePaidRwf: snapshot.pricePaid,
    creditsGranted: snapshot.ridesGranted + snapshot.bonusRidesGranted,
    authority: 'local_prototype',
  };
  const transaction: DriverCreditTransaction = {
    id: `credit:${transactionId}`,
    type: 'credit',
    vehicleId: currentVehicle.vehicleId,
    vehicleType: currentVehicle.vehicleType,
    amount: snapshot.ridesGranted + snapshot.bonusRidesGranted,
    createdAt: now,
    packageActivationId: activation.id,
    idempotencyKey,
    authority: 'local_prototype',
  };

  nextVehicle = {
    ...nextVehicle,
    activePackageId: purchase.packageId,
    remainingRideCredits: nextVehicle.remainingRideCredits + snapshot.ridesGranted,
    remainingBonusRides: nextVehicle.remainingBonusRides + snapshot.bonusRidesGranted,
    activations: [...nextVehicle.activations, activation],
    creditTransactions: [...nextVehicle.creditTransactions, transaction],
    updatedAt: now,
  };
  next = replaceVehicleEntitlement(next, nextVehicle);

  return { entitlement: next, purchase: updatedPurchase, activation };
}

export function deductCreditForCompletedRide(
  entitlement: DriverEntitlement | null | undefined,
  completedRideId: string,
  now = new Date().toISOString(),
  vehicle?: DriverEntitlementVehicleRef | null,
): { entitlement: DriverEntitlement; deducted: boolean } {
  const current = normalizeEntitlement(entitlement, vehicle);
  const currentVehicle = getVehicleEntitlement(current, vehicle);
  const idempotencyKey = `completed-ride:${completedRideId}`;
  if (currentVehicle.creditTransactions.some(transaction => transaction.idempotencyKey === idempotencyKey)) {
    return { entitlement: current, deducted: false };
  }
  if (currentVehicle.remainingRideCredits + currentVehicle.remainingBonusRides < 1) return { entitlement: current, deducted: false };
  const deductFromBalance = currentVehicle.remainingRideCredits > 0;

  const transaction: DriverCreditTransaction = {
    id: `debit:${completedRideId}`,
    type: 'debit',
    vehicleId: currentVehicle.vehicleId,
    vehicleType: currentVehicle.vehicleType,
    amount: -1,
    createdAt: now,
    completedRideId,
    idempotencyKey,
    authority: 'local_prototype',
  };
  return {
    deducted: true,
    entitlement: replaceVehicleEntitlement(current, {
      ...currentVehicle,
      remainingRideCredits: deductFromBalance ? currentVehicle.remainingRideCredits - 1 : currentVehicle.remainingRideCredits,
      remainingBonusRides: deductFromBalance ? currentVehicle.remainingBonusRides : currentVehicle.remainingBonusRides - 1,
      creditTransactions: [...currentVehicle.creditTransactions, transaction],
      updatedAt: now,
    }),
  };
}
