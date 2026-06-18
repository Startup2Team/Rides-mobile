import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import { DriverEntitlementProvider, useDriverEntitlement } from '../DriverEntitlementContext';
import { RideProvider, useRide } from '../RideContext';

let mockRideDriverProfile: any = null;

jest.mock('@/context/AuthContext', () => ({
  useOptionalAuth: () => mockRideDriverProfile ? { driverProfile: mockRideDriverProfile } : null,
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <DriverEntitlementProvider>{children}</DriverEntitlementProvider>
);
const rideWrapper = ({ children }: { children: React.ReactNode }) => (
  <DriverEntitlementProvider><RideProvider>{children}</RideProvider></DriverEntitlementProvider>
);

describe('DriverEntitlementProvider', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    (SecureStore as typeof SecureStore & { __clear: () => void }).__clear();
    mockRideDriverProfile = null;
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    mockRideDriverProfile = null;
    jest.restoreAllMocks();
  });

  test('activates a package and persists idempotent completed-ride deduction', async () => {
    const { result } = renderHook(() => useDriverEntitlement(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.activatePackage('launch_starter');
    });
    expect(result.current.rideCredits).toBe(30);
    expect(result.current.bonusRides).toBe(5);
    expect(result.current.totalAvailableRides).toBe(35);

    await act(async () => {
      expect(await result.current.deductCreditForCompletedRide('ride-1')).toBe(true);
      expect(await result.current.deductCreditForCompletedRide('ride-1')).toBe(false);
    });
    expect(result.current.rideCredits).toBe(29);
    expect(result.current.bonusRides).toBe(5);
    expect(result.current.totalAvailableRides).toBe(34);
  });

  test('driver completion deducts one credit while cancellation deducts none', async () => {
    mockRideDriverProfile = {
      vehicleType: 'moto',
      plateNumber: 'RAD 001 A',
      licenseNumber: 'LIC001',
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
      onlineVehicleSession: {
        vehicleId: 'driver-vehicle:moto:rad-001-a',
        vehicleType: 'moto',
        startedAt: '2026-06-08T09:00:00.000Z',
      },
      activeVehicle: { vehicleId: 'driver-vehicle:moto:rad-001-a' },
      vehicles: [{
        id: 'driver-vehicle:moto:rad-001-a',
        vehicleType: 'moto',
        status: 'approved',
        plateNumber: 'RAD 001 A',
        licenseNumber: 'LIC001',
        submittedAt: '2026-06-08T09:00:00.000Z',
      }],
    };
    const { result } = renderHook(() => ({
      entitlement: useDriverEntitlement(),
      ride: useRide(),
    }), { wrapper: rideWrapper });
    await waitFor(() => expect(result.current.entitlement.isLoading).toBe(false));
    await act(async () => {
      await result.current.entitlement.activatePackage('launch_starter');
    });
    act(() => {
      result.current.ride.simulateIncomingRideRequest();
      result.current.ride.acceptRideRequest();
      result.current.ride.cancelRide();
    });
    expect(result.current.entitlement.rideCredits).toBe(30);
    expect(result.current.entitlement.bonusRides).toBe(5);

    act(() => {
      result.current.ride.simulateIncomingRideRequest();
      result.current.ride.acceptRideRequest();
      result.current.ride.riderAcceptWithFare(5_000);
      result.current.ride.markArrived();
      result.current.ride.startJourney();
      result.current.ride.completeRide('driver');
    });
    await waitFor(() => expect(result.current.entitlement.rideCredits).toBe(29));
    expect(result.current.entitlement.bonusRides).toBe(5);
  });
});
