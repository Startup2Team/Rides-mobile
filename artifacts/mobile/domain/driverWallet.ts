export type DriverWalletAuthority = 'local_prototype' | 'backend';
export type DriverPayoutStatus = 'pending' | 'available' | 'processing' | 'paid' | 'failed' | 'reversed';
export type DriverFareCollectionMethod = 'cash_collected' | 'platform_collected';
export type DriverPayoutProvider = 'mtn' | 'airtel';
export type DriverPayoutMethodVerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';
export type DriverRatingModerationStatus = 'pending' | 'published' | 'hidden' | 'flagged';
export type DriverRatingStars = 1 | 2 | 3 | 4 | 5;

export interface DriverEarningLedgerEntry {
  id: string;
  driverId: string;
  rideId: string;
  completedAt: string;
  createdAt: string;
  grossFareRwf: number;
  platformFeeRwf: number;
  netEarningRwf: number;
  collectionMethod: DriverFareCollectionMethod;
  payoutStatus: DriverPayoutStatus;
  payoutRequestId?: string;
  idempotencyKey: string;
  authority: DriverWalletAuthority;
  note?: string;
}

export interface DriverWalletBalance {
  driverId: string;
  currency: 'RWF';
  pendingRwf: number;
  availableRwf: number;
  processingRwf: number;
  paidRwf: number;
  failedRwf: number;
  reversedRwf: number;
  cashCollectedRwf: number;
  activityGrossRwf: number;
  updatedAt: string;
  authority: DriverWalletAuthority;
}

export interface DriverPayoutMethod {
  id: string;
  driverId: string;
  provider: DriverPayoutProvider;
  accountPhone: string;
  merchantCode?: string;
  label: string;
  isDefault: boolean;
  verificationStatus: DriverPayoutMethodVerificationStatus;
  createdAt: string;
  updatedAt: string;
  authority: DriverWalletAuthority;
}

export interface DriverPayoutRequest {
  id: string;
  driverId: string;
  payoutMethodId: string;
  amountRwf: number;
  status: DriverPayoutStatus;
  ledgerEntryIds: string[];
  requestedAt: string;
  availableAt?: string;
  processingAt?: string;
  paidAt?: string;
  failedAt?: string;
  reversedAt?: string;
  failureReason?: string;
  idempotencyKey: string;
  authority: DriverWalletAuthority;
}

export interface DriverRating {
  id: string;
  rideId: string;
  driverId: string;
  customerId: string;
  stars: DriverRatingStars;
  reviewText?: string;
  moderationStatus: DriverRatingModerationStatus;
  createdAt: string;
  updatedAt?: string;
  idempotencyKey: string;
  authority: DriverWalletAuthority;
}

export interface DriverPerformanceMetrics {
  driverId: string;
  window: 'today' | '7_days' | '30_days' | 'lifetime';
  windowStartedAt: string;
  windowEndedAt: string;
  completedRides: number;
  acceptedRideRequests: number;
  declinedRideRequests: number;
  cancelledRides: number;
  acceptanceRate: number | null;
  completionRate: number | null;
  averageRating: number | null;
  ratingCount: number;
  grossActivityRwf: number;
  netPlatformCollectedRwf: number;
  authority: DriverWalletAuthority;
  updatedAt: string;
}

export function buildCompletedRideEarningIdempotencyKey(rideId: string) {
  return `driver-earning:completed-ride:${rideId}`;
}

export function hasEarningForCompletedRide(entries: DriverEarningLedgerEntry[], rideId: string) {
  const key = buildCompletedRideEarningIdempotencyKey(rideId);
  return entries.some(entry => entry.rideId === rideId || entry.idempotencyKey === key);
}

export function summarizeDriverWalletBalance({
  authority = 'local_prototype',
  driverId,
  entries,
  updatedAt,
}: {
  authority?: DriverWalletAuthority;
  driverId: string;
  entries: DriverEarningLedgerEntry[];
  updatedAt: string;
}): DriverWalletBalance {
  const balance: DriverWalletBalance = {
    driverId,
    currency: 'RWF',
    pendingRwf: 0,
    availableRwf: 0,
    processingRwf: 0,
    paidRwf: 0,
    failedRwf: 0,
    reversedRwf: 0,
    cashCollectedRwf: 0,
    activityGrossRwf: 0,
    updatedAt,
    authority,
  };

  entries
    .filter(entry => entry.driverId === driverId)
    .forEach(entry => {
      const grossFareRwf = Math.max(0, Math.round(entry.grossFareRwf));
      const netEarningRwf = Math.max(0, Math.round(entry.netEarningRwf));
      balance.activityGrossRwf += grossFareRwf;

      if (entry.collectionMethod === 'cash_collected') {
        balance.cashCollectedRwf += netEarningRwf;
        return;
      }

      if (entry.payoutStatus === 'pending') balance.pendingRwf += netEarningRwf;
      if (entry.payoutStatus === 'available') balance.availableRwf += netEarningRwf;
      if (entry.payoutStatus === 'processing') balance.processingRwf += netEarningRwf;
      if (entry.payoutStatus === 'paid') balance.paidRwf += netEarningRwf;
      if (entry.payoutStatus === 'failed') balance.failedRwf += netEarningRwf;
      if (entry.payoutStatus === 'reversed') balance.reversedRwf += netEarningRwf;
    });

  return balance;
}
