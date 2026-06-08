import type { DriverProfile } from '@/types';

export type DriverRidePackageId = 'launch_starter' | 'growth';
export type DriverEntitlementAuthority = 'local_prototype' | 'backend';

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
  activatedAt: string;
  pricePaidRwf: number;
  creditsGranted: number;
  authority: DriverEntitlementAuthority;
}

export interface DriverCreditTransaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  createdAt: string;
  packageActivationId?: string;
  completedRideId?: string;
  idempotencyKey: string;
  authority: DriverEntitlementAuthority;
}

export interface DriverEntitlement {
  activePackageId: DriverRidePackageId | null;
  remainingRideCredits: number;
  activations: PackageActivation[];
  creditTransactions: DriverCreditTransaction[];
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
};

export const EMPTY_DRIVER_ENTITLEMENT: DriverEntitlement = {
  activePackageId: null,
  remainingRideCredits: 0,
  activations: [],
  creditTransactions: [],
  updatedAt: '',
  authority: 'local_prototype',
};

export const getActiveRideCredits = (entitlement: DriverEntitlement | null | undefined) =>
  Math.max(0, entitlement?.remainingRideCredits ?? 0);

export const canDriverGoOnlineWithCredits = (
  profile: DriverProfile | null | undefined,
  entitlement: DriverEntitlement | null | undefined,
) => (profile?.verificationStatus ? profile.verificationStatus === 'approved' : profile?.isVerified === true)
  && profile?.isVerified === true
  && getActiveRideCredits(entitlement) > 0;

export const hasUsedLaunchOffer = (entitlement: DriverEntitlement | null | undefined) =>
  entitlement?.activations.some(activation => activation.packageId === 'launch_starter') ?? false;

export const isLowRideCreditBalance = (entitlement: DriverEntitlement | null | undefined) => {
  const credits = getActiveRideCredits(entitlement);
  return credits > 0 && credits <= 10;
};

export const getRideCreditBalanceMessage = (entitlement: DriverEntitlement | null | undefined) => {
  const credits = getActiveRideCredits(entitlement);
  if (credits === 0) return 'Choose a package to start receiving ride requests.';
  if (credits <= 2) return `Only ${credits} ride credits left. Add a package soon to keep receiving requests.`;
  if (credits <= 5) return `Only ${credits} ride credits left. Add a package soon to keep receiving requests.`;
  if (credits <= 10) return `${credits} ride credits left. Consider adding a package soon.`;
  return null;
};

export const getRideCreditProgress = (entitlement: DriverEntitlement | null | undefined) => {
  const current = entitlement ?? EMPTY_DRIVER_ENTITLEMENT;
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
): { entitlement: DriverEntitlement; activation: PackageActivation } {
  const current = entitlement ?? EMPTY_DRIVER_ENTITLEMENT;
  const ridePackage = DRIVER_RIDE_PACKAGES[packageId];
  if (ridePackage.launchOffer && hasUsedLaunchOffer(current)) {
    throw new Error('Launch Starter Package has already been used');
  }

  const activation: PackageActivation = {
    id: `activation:${packageId}:${now}`,
    packageId,
    activatedAt: now,
    pricePaidRwf: ridePackage.currentPriceRwf,
    creditsGranted: ridePackage.totalCredits,
    authority: 'local_prototype',
  };
  const transaction: DriverCreditTransaction = {
    id: `credit:${activation.id}`,
    type: 'credit',
    amount: ridePackage.totalCredits,
    createdAt: now,
    packageActivationId: activation.id,
    idempotencyKey: `package-activation:${activation.id}`,
    authority: 'local_prototype',
  };
  return {
    activation,
    entitlement: {
      activePackageId: packageId,
      remainingRideCredits: getActiveRideCredits(current) + ridePackage.totalCredits,
      activations: [...current.activations, activation],
      creditTransactions: [...current.creditTransactions, transaction],
      updatedAt: now,
      authority: 'local_prototype',
    },
  };
}

export function deductCreditForCompletedRide(
  entitlement: DriverEntitlement | null | undefined,
  completedRideId: string,
  now = new Date().toISOString(),
): { entitlement: DriverEntitlement; deducted: boolean } {
  const current = entitlement ?? EMPTY_DRIVER_ENTITLEMENT;
  const idempotencyKey = `completed-ride:${completedRideId}`;
  if (current.creditTransactions.some(transaction => transaction.idempotencyKey === idempotencyKey)) {
    return { entitlement: current, deducted: false };
  }
  if (getActiveRideCredits(current) < 1) return { entitlement: current, deducted: false };

  const transaction: DriverCreditTransaction = {
    id: `debit:${completedRideId}`,
    type: 'debit',
    amount: -1,
    createdAt: now,
    completedRideId,
    idempotencyKey,
    authority: 'local_prototype',
  };
  return {
    deducted: true,
    entitlement: {
      ...current,
      remainingRideCredits: current.remainingRideCredits - 1,
      creditTransactions: [...current.creditTransactions, transaction],
      updatedAt: now,
    },
  };
}
