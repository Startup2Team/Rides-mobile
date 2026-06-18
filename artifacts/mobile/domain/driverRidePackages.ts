import { getActiveDriverVehicle, getPrimaryDriverVehicle } from './driverVehicles';
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

export interface PackageActivation {
  id: string;
  packageId: DriverRidePackageId;
  vehicleId: string;
  vehicleType: VehicleType;
  activatedAt: string;
  pricePaidRwf: number;
  creditsGranted: number;
  authority: DriverEntitlementAuthority;
}

export interface DriverPackagePurchase {
  packageId: DriverRidePackageId;
  vehicleId: string;
  vehicleType: VehicleType;
  amount: number;
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

export const DRIVER_RIDE_PACKAGES: Record<DriverRidePackageId, DriverRidePackage> = {
  launch_starter: {
    id: 'launch_starter',
    name: 'Launch Starter Package',
    normalPriceRwf: 1_000,
    currentPriceRwf: 0,
    includedRides: 30,
    bonusRides: 5,
    totalCredits: 35,
    launchOffer: true,
  },
  growth: {
    id: 'growth',
    name: 'Growth Package',
    normalPriceRwf: 2_000,
    currentPriceRwf: 2_000,
    includedRides: 60,
    bonusRides: 15,
    totalCredits: 75,
    launchOffer: false,
  },
  pro: {
    id: 'pro',
    name: 'Pro Package',
    normalPriceRwf: 3_500,
    currentPriceRwf: 3_500,
    includedRides: 120,
    bonusRides: 30,
    totalCredits: 150,
    launchOffer: false,
  },
  cab_starter: {
    id: 'cab_starter',
    name: 'Starter',
    normalPriceRwf: 1_000,
    currentPriceRwf: 0,
    includedRides: 2,
    bonusRides: 2,
    totalCredits: 4,
    launchOffer: true,
  },
  cab_growth: {
    id: 'cab_growth',
    name: 'Growth',
    normalPriceRwf: 2_000,
    currentPriceRwf: 2_000,
    includedRides: 5,
    bonusRides: 4,
    totalCredits: 9,
    launchOffer: false,
  },
  cab_pro: {
    id: 'cab_pro',
    name: 'Pro',
    normalPriceRwf: 5_000,
    currentPriceRwf: 5_000,
    includedRides: 10,
    bonusRides: 9,
    totalCredits: 19,
    launchOffer: false,
  },
  hilux_starter: {
    id: 'hilux_starter',
    name: 'Starter',
    normalPriceRwf: 1_000,
    currentPriceRwf: 0,
    includedRides: 1,
    bonusRides: 1,
    totalCredits: 2,
    launchOffer: true,
  },
  hilux_growth: {
    id: 'hilux_growth',
    name: 'Growth',
    normalPriceRwf: 2_000,
    currentPriceRwf: 2_000,
    includedRides: 2,
    bonusRides: 3,
    totalCredits: 5,
    launchOffer: false,
  },
  hilux_pro: {
    id: 'hilux_pro',
    name: 'Pro',
    normalPriceRwf: 5_000,
    currentPriceRwf: 5_000,
    includedRides: 4,
    bonusRides: 7,
    totalCredits: 11,
    launchOffer: false,
  },
  rifani_starter: {
    id: 'rifani_starter',
    name: 'Starter',
    normalPriceRwf: 1_000,
    currentPriceRwf: 0,
    includedRides: 4,
    bonusRides: 2,
    totalCredits: 6,
    launchOffer: true,
  },
  rifani_growth: {
    id: 'rifani_growth',
    name: 'Growth',
    normalPriceRwf: 2_000,
    currentPriceRwf: 2_000,
    includedRides: 8,
    bonusRides: 5,
    totalCredits: 13,
    launchOffer: false,
  },
  rifani_pro: {
    id: 'rifani_pro',
    name: 'Pro',
    normalPriceRwf: 5_000,
    currentPriceRwf: 5_000,
    includedRides: 16,
    bonusRides: 11,
    totalCredits: 27,
    launchOffer: false,
  },
  fuso_starter: {
    id: 'fuso_starter',
    name: 'Starter',
    normalPriceRwf: 2_500,
    currentPriceRwf: 0,
    includedRides: 1,
    bonusRides: 2,
    totalCredits: 3,
    launchOffer: true,
  },
  fuso_growth: {
    id: 'fuso_growth',
    name: 'Growth',
    normalPriceRwf: 5_000,
    currentPriceRwf: 5_000,
    includedRides: 2,
    bonusRides: 3,
    totalCredits: 5,
    launchOffer: false,
  },
  fuso_pro: {
    id: 'fuso_pro',
    name: 'Pro',
    normalPriceRwf: 10_000,
    currentPriceRwf: 10_000,
    includedRides: 4,
    bonusRides: 7,
    totalCredits: 11,
    launchOffer: false,
  },
};

export function getPackagesForVehicleType(vehicleType: VehicleType | null | undefined): DriverRidePackageId[] {
  if (vehicleType === 'cab') return ['cab_starter', 'cab_growth', 'cab_pro'];
  if (vehicleType === 'hilux') return ['hilux_starter', 'hilux_growth', 'hilux_pro'];
  if (vehicleType === 'rifani') return ['rifani_starter', 'rifani_growth', 'rifani_pro'];
  if (vehicleType === 'fuso') return ['fuso_starter', 'fuso_growth', 'fuso_pro'];
  return ['launch_starter', 'growth', 'pro'];
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
  return { ...activation, vehicleId: activation.vehicleId ?? vehicleId, vehicleType: activation.vehicleType ?? vehicleType };
}

function stampPurchase(
  purchase: DriverPackagePurchase,
  vehicleId: string,
  vehicleType: VehicleType,
): DriverPackagePurchase {
  return { ...purchase, vehicleId: purchase.vehicleId ?? vehicleId, vehicleType: purchase.vehicleType ?? vehicleType };
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
  return getActiveDriverVehicle(profile) ?? getPrimaryDriverVehicle(profile);
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
  const vehicle = getEntitlementVehicleForProfile(profile);
  const vehicleApproved = vehicle ? vehicle.status === 'approved' : true;
  return (profile?.verificationStatus ? profile.verificationStatus === 'approved' : profile?.isVerified === true)
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
  assertPackageMatchesVehicle(packageId, currentVehicle.vehicleType);
  if (ridePackage.launchOffer && currentVehicle.activations.some(activation => DRIVER_RIDE_PACKAGES[activation.packageId]?.launchOffer)) {
    throw new Error('Launch offer has already been used');
  }

  const activation: PackageActivation = {
    id: `activation:${currentVehicle.vehicleId}:${packageId}:${now}`,
    packageId,
    vehicleId: currentVehicle.vehicleId,
    vehicleType: currentVehicle.vehicleType,
    activatedAt: now,
    pricePaidRwf: ridePackage.currentPriceRwf,
    creditsGranted: ridePackage.totalCredits,
    authority: 'local_prototype',
  };
  const transaction: DriverCreditTransaction = {
    id: `credit:${activation.id}`,
    type: 'credit',
    vehicleId: currentVehicle.vehicleId,
    vehicleType: currentVehicle.vehicleType,
    amount: ridePackage.totalCredits,
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
      remainingRideCredits: currentVehicle.remainingRideCredits + ridePackage.includedRides,
      remainingBonusRides: currentVehicle.remainingBonusRides + ridePackage.bonusRides,
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
  assertPackageMatchesVehicle(input.packageId, currentVehicle.vehicleType);
  if (ridePackage.currentPriceRwf <= 0) {
    throw new Error('This package does not require Mobile Money confirmation.');
  }

  const purchase: DriverPackagePurchase = {
    packageId: input.packageId,
    vehicleId: currentVehicle.vehicleId,
    vehicleType: currentVehicle.vehicleType,
    amount: ridePackage.currentPriceRwf,
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
  const activation: PackageActivation = {
    id: `activation:${transactionId}`,
    packageId: purchase.packageId,
    vehicleId: currentVehicle.vehicleId,
    vehicleType: currentVehicle.vehicleType,
    activatedAt: now,
    pricePaidRwf: purchase.amount,
    creditsGranted: ridePackage.totalCredits,
    authority: 'local_prototype',
  };
  const transaction: DriverCreditTransaction = {
    id: `credit:${transactionId}`,
    type: 'credit',
    vehicleId: currentVehicle.vehicleId,
    vehicleType: currentVehicle.vehicleType,
    amount: ridePackage.totalCredits,
    createdAt: now,
    packageActivationId: activation.id,
    idempotencyKey,
    authority: 'local_prototype',
  };

  nextVehicle = {
    ...nextVehicle,
    activePackageId: purchase.packageId,
    remainingRideCredits: nextVehicle.remainingRideCredits + ridePackage.includedRides,
    remainingBonusRides: nextVehicle.remainingBonusRides + ridePackage.bonusRides,
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
