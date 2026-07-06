jest.mock('@/query/hooks/useDriverVehiclesQuery', () => ({
  useDriverVehiclesQuery: () => ({ data: [] }),
}));

jest.mock('@/domain/driverVehicles', () => ({
  getDriverVehicles: () => [],
  getActiveDriverVehicle: () => null,
  getApprovedDriverVehicles: () => [],
}));

jest.mock('@/context/AuthContext', () => ({
  useOptionalAuth: () => null,
}));

jest.mock('@/context/DriverEntitlementContext', () => ({
  useOptionalDriverEntitlement: () => null,
}));

import type { DriverProfile, User, DriverVehicleProfile } from '@/types';
import { EMPTY_DRIVER_ENTITLEMENT, type DriverEntitlement } from '@/domain/driverRidePackages';
import { CAPABILITY_NAMES, resolveCapabilities } from '..';

function makeUser(mode: User['mode'] = 'customer'): User {
  return {
    id: 'user-1',
    name: 'Alice Rider',
    phone: '+250788111000',
    mode,
    isDriver: mode === 'driver',
    createdAt: '2026-06-28T00:00:00.000Z',
  };
}

function makeDriverProfile(overrides: Partial<DriverProfile> = {}): DriverProfile {
  return {
    vehicleType: 'moto',
    plateNumber: 'RAB 123 A',
    licenseNumber: 'LIC-123',
    province: 'Kigali',
    district: 'Gasabo',
    sector: 'Kimironko',
    momoCode: '123456',
    momoProvider: 'mtn',
    dob: '1990-01-01',
    isOnline: false,
    isVerified: false,
    acceptanceRate: 0,
    completedRides: 0,
    dailyRides: 0,
    dailyDeclines: 0,
    policyAccepted: true,
    earningsTotal: 0,
    ...overrides,
  };
}

function makeVehicle(overrides: Partial<DriverVehicleProfile> = {}): DriverVehicleProfile {
  return {
    id: 'vehicle-1',
    vehicleType: 'moto',
    status: 'approved',
    plateNumber: 'RAB 123 A',
    licenseNumber: 'LIC-123',
    submittedAt: '2026-06-28T00:00:00.000Z',
    ...overrides,
  };
}

function makeEntitlement(overrides: Partial<DriverEntitlement> = {}): DriverEntitlement {
  return {
    ...EMPTY_DRIVER_ENTITLEMENT,
    remainingRideCredits: 5,
    remainingBonusRides: 0,
    vehicleEntitlements: [],
    updatedAt: '2026-06-28T00:00:00.000Z',
    ...overrides,
  };
}

describe('capabilities', () => {
  test('defines the current capability surface', () => {
    expect(CAPABILITY_NAMES).toEqual([
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
    ]);
  });

  test('customer capability set stays customer-first', () => {
    const { capabilities } = resolveCapabilities({
      user: makeUser('customer'),
      driverProfile: null,
      driverEntitlement: null,
      vehicles: [],
      mode: 'customer',
    });

    expect(capabilities.canBookRide).toBe(true);
    expect(capabilities.canDrive).toBe(false);
    expect(capabilities.canBecomeDriver).toBe(true);
    expect(capabilities.canViewCustomerTrips).toBe(true);
    expect(capabilities.canViewDriverDashboard).toBe(false);
  });

  test('pending drivers do not get driving capabilities', () => {
    const { capabilities } = resolveCapabilities({
      user: makeUser('customer'),
      driverProfile: makeDriverProfile({ verificationStatus: 'pending_review', isVerified: false, vehicles: [makeVehicle({ status: 'pending_review' })] }),
      driverEntitlement: makeEntitlement({ remainingRideCredits: 0 }),
      vehicles: [makeVehicle({ status: 'pending_review' })],
      mode: 'customer',
    });

    expect(capabilities.canDrive).toBe(false);
    expect(capabilities.canGoOnline).toBe(false);
    expect(capabilities.canReceiveRideRequests).toBe(false);
    expect(capabilities.canBecomeDriver).toBe(true);
    expect(capabilities.canViewDriverDashboard).toBe(false);
  });

  test('approved drivers gain driving capabilities and can switch mode', () => {
    const { capabilities } = resolveCapabilities({
      user: makeUser('customer'),
      driverProfile: makeDriverProfile({
        verificationStatus: 'approved',
        isVerified: true,
        isOnline: false,
        vehicles: [makeVehicle()],
      }),
      driverEntitlement: makeEntitlement({ remainingRideCredits: 3 }),
      vehicles: [makeVehicle()],
      mode: 'customer',
    });

    expect(capabilities.canDrive).toBe(true);
    expect(capabilities.canGoOnline).toBe(true);
    expect(capabilities.canReceiveRideRequests).toBe(false);
    expect(capabilities.canViewDriverDashboard).toBe(true);
    expect(capabilities.canSwitchMode).toBe(true);
    expect(capabilities.canBecomeDriver).toBe(false);
  });

  test('online approved drivers receive ride requests instead of go-online capability', () => {
    const { capabilities } = resolveCapabilities({
      user: makeUser('driver'),
      driverProfile: makeDriverProfile({
        verificationStatus: 'approved',
        isVerified: true,
        isOnline: true,
        vehicles: [makeVehicle()],
      }),
      driverEntitlement: makeEntitlement({ remainingRideCredits: 3 }),
      vehicles: [makeVehicle()],
      mode: 'driver',
    });

    expect(capabilities.canReceiveRideRequests).toBe(true);
    expect(capabilities.canGoOnline).toBe(false);
    expect(capabilities.canDrive).toBe(true);
    expect(capabilities.canSwitchMode).toBe(true);
  });
});
