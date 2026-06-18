import { EMPTY_DRIVER_ENTITLEMENT } from '@/domain/driverRidePackages';
import { getEligibleOnlineSessionVehicle } from '../rideSession';
import type { DriverEntitlement } from '@/domain/driverRidePackages';
import type { DriverProfile, DriverVehicleProfile, VehicleType } from '@/types';

function makeVehicle(
  id: string,
  vehicleType: VehicleType,
  status: DriverVehicleProfile['status'] = 'approved',
) {
  return {
    id,
    vehicleType,
    status,
    plateNumber: 'RAD 001 A',
    licenseNumber: 'LIC001',
    submittedAt: '2026-06-08T10:00:00.000Z',
  } satisfies DriverVehicleProfile;
}

function makeProfile(vehicle: DriverVehicleProfile, overrides: Partial<DriverProfile> = {}): DriverProfile {
  return {
    vehicleType: vehicle.vehicleType,
    plateNumber: vehicle.plateNumber,
    licenseNumber: vehicle.licenseNumber,
    province: 'Kigali',
    district: 'Gasabo',
    sector: 'Kimironko',
    momoCode: '0781234567',
    momoProvider: 'mtn',
    dob: '1990-01-01',
    isOnline: true,
    isVerified: true,
    acceptanceRate: 100,
    completedRides: 0,
    dailyRides: 0,
    dailyDeclines: 0,
    policyAccepted: true,
    earningsTotal: 0,
    vehicles: [vehicle],
    activeVehicle: { vehicleId: vehicle.id },
    ...overrides,
  };
}

function makeEntitlement(vehicle: DriverVehicleProfile, rides: number): DriverEntitlement {
  return {
    ...EMPTY_DRIVER_ENTITLEMENT,
    vehicleId: vehicle.id,
    vehicleType: vehicle.vehicleType,
    remainingRideCredits: rides,
    vehicleEntitlements: [{
      vehicleId: vehicle.id,
      vehicleType: vehicle.vehicleType,
      activePackageId: null,
      remainingRideCredits: rides,
      remainingBonusRides: 0,
      activations: [],
      creditTransactions: [],
      purchaseHistory: [],
      updatedAt: '2026-06-08T10:00:00.000Z',
      authority: 'local_prototype',
    }],
  };
}

describe('getEligibleOnlineSessionVehicle', () => {
  test('accepts an approved vehicle with rides remaining', () => {
    const vehicle = makeVehicle('driver-vehicle:moto:rad-001-a', 'moto', 'approved');
    expect(getEligibleOnlineSessionVehicle(makeProfile(vehicle), makeEntitlement(vehicle, 3), 'moto'))
      .toEqual(expect.objectContaining({ id: vehicle.id, vehicleType: 'moto' }));
  });

  test('rejects a wrong vehicle type', () => {
    const vehicle = makeVehicle('driver-vehicle:moto:rad-001-a', 'moto', 'approved');
    expect(getEligibleOnlineSessionVehicle(makeProfile(vehicle), makeEntitlement(vehicle, 3), 'cab'))
      .toBeNull();
  });

  test('rejects a pending vehicle', () => {
    const vehicle = makeVehicle('driver-vehicle:moto:rad-001-a', 'moto', 'pending_review');
    expect(getEligibleOnlineSessionVehicle(makeProfile(vehicle, { activeVehicle: { vehicleId: vehicle.id } }), makeEntitlement(vehicle, 3), 'moto'))
      .toBeNull();
  });

  test('rejects a rejected vehicle', () => {
    const vehicle = makeVehicle('driver-vehicle:moto:rad-001-a', 'moto', 'rejected');
    expect(getEligibleOnlineSessionVehicle(makeProfile(vehicle), makeEntitlement(vehicle, 3), 'moto'))
      .toBeNull();
  });

  test('rejects a zero-ride vehicle', () => {
    const vehicle = makeVehicle('driver-vehicle:moto:rad-001-a', 'moto', 'approved');
    expect(getEligibleOnlineSessionVehicle(makeProfile(vehicle), makeEntitlement(vehicle, 0), 'moto'))
      .toBeNull();
  });
});
