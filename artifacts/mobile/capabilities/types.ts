import type { AppMode, DriverProfile, User } from '@/types';
import type { DriverEntitlement } from '@/domain/driverRidePackages';
import type { DriverVehicleProfile } from '@/types';

export type CapabilityName =
  | 'canBookRide'
  | 'canReceiveRideRequests'
  | 'canGoOnline'
  | 'canDrive'
  | 'canEditProfile'
  | 'canManageVehicles'
  | 'canBuyPackages'
  | 'canUseWallet'
  | 'canWithdrawEarnings'
  | 'canReceivePayments'
  | 'canInviteDrivers'
  | 'canOperateFleet'
  | 'canUseCorporateBilling'
  | 'canViewDriverDashboard'
  | 'canViewCustomerTrips'
  | 'canSwitchMode'
  | 'canBecomeDriver';

export type CapabilitySet = Record<CapabilityName, boolean>;

export const CAPABILITY_NAMES: CapabilityName[] = [
  'canBookRide',
  'canReceiveRideRequests',
  'canGoOnline',
  'canDrive',
  'canEditProfile',
  'canManageVehicles',
  'canBuyPackages',
  'canUseWallet',
  'canWithdrawEarnings',
  'canReceivePayments',
  'canInviteDrivers',
  'canOperateFleet',
  'canUseCorporateBilling',
  'canViewDriverDashboard',
  'canViewCustomerTrips',
  'canSwitchMode',
  'canBecomeDriver',
];

export interface CapabilityResolverInput {
  user: User | null;
  driverProfile: DriverProfile | null;
  driverEntitlement: DriverEntitlement | null;
  vehicles: DriverVehicleProfile[];
  mode?: AppMode | null;
}

export interface CapabilityResolverState extends CapabilityResolverInput {
  isAuthenticated: boolean;
  isApprovedDriver: boolean;
  hasApprovedVehicle: boolean;
  hasActiveVehicle: boolean;
  hasRideCredits: boolean;
}

export interface CapabilitySnapshot {
  capabilities: CapabilitySet;
  state: CapabilityResolverState;
  mode: AppMode | null;
}
