import { getActiveRideCredits } from '@/domain/driverRidePackages';
import { getActiveDriverVehicle, getApprovedDriverVehicles } from '@/domain/driverVehicles';
import { canAccessDriverMode } from '@/utils/driverVerification';
import type { CapabilityResolverInput, CapabilityResolverState, CapabilitySet } from './types';

function hasApprovedVehicleInList(vehicles: CapabilityResolverInput['vehicles']) {
  return vehicles.some(vehicle => vehicle.status === 'approved');
}

export function resolveCapabilities(input: CapabilityResolverInput) {
  const isAuthenticated = Boolean(input.user?.id);
  const isApprovedDriver = canAccessDriverMode(input.driverProfile);
  const approvedVehicle = getApprovedDriverVehicles(input.driverProfile)[0] ?? null;
  const activeVehicle = getActiveDriverVehicle(input.driverProfile);
  const hasApprovedVehicle = hasApprovedVehicleInList(input.vehicles);
  const hasActiveVehicle = Boolean(activeVehicle ?? approvedVehicle);
  const hasRideCredits = getActiveRideCredits(input.driverEntitlement) > 0;
  const canDrive = isApprovedDriver && hasApprovedVehicle && hasRideCredits;
  const driverOnline = Boolean(input.driverProfile?.isOnline);

  const capabilities: CapabilitySet = {
    canBookRide: isAuthenticated,
    canReceiveRideRequests: canDrive && driverOnline,
    canGoOnline: canDrive && !driverOnline,
    canDrive,
    canEditProfile: isAuthenticated,
    canManageVehicles: isApprovedDriver,
    canBuyPackages: isApprovedDriver && hasActiveVehicle,
    canUseWallet: isAuthenticated,
    canWithdrawEarnings: false,
    canReceivePayments: isApprovedDriver && hasActiveVehicle,
    canInviteDrivers: false,
    canOperateFleet: false,
    canUseCorporateBilling: false,
    canViewDriverDashboard: isApprovedDriver,
    canViewCustomerTrips: isAuthenticated,
    canSwitchMode: isAuthenticated && (isApprovedDriver || input.mode === 'customer' || input.mode === 'driver'),
    canBecomeDriver: isAuthenticated && !isApprovedDriver,
  };

  const state: CapabilityResolverState = {
    ...input,
    isAuthenticated,
    isApprovedDriver,
    hasApprovedVehicle,
    hasActiveVehicle,
    hasRideCredits,
  };

  return {
    capabilities,
    state,
  };
}
