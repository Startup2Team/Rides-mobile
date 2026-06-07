import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import { DriverEntitlementProvider, useDriverEntitlement } from '../DriverEntitlementContext';
import { RideProvider, useRide } from '../RideContext';

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
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  test('activates a package and persists idempotent completed-ride deduction', async () => {
    const { result } = renderHook(() => useDriverEntitlement(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.activatePackage('launch_starter');
    });
    expect(result.current.rideCredits).toBe(35);

    await act(async () => {
      expect(await result.current.deductCreditForCompletedRide('ride-1')).toBe(true);
      expect(await result.current.deductCreditForCompletedRide('ride-1')).toBe(false);
    });
    expect(result.current.rideCredits).toBe(34);
  });

  test('driver completion deducts one credit while cancellation deducts none', async () => {
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
    expect(result.current.entitlement.rideCredits).toBe(35);

    act(() => {
      result.current.ride.simulateIncomingRideRequest();
      result.current.ride.acceptRideRequest();
      result.current.ride.riderAcceptWithFare(5_000);
      result.current.ride.markArrived();
      result.current.ride.startJourney();
      result.current.ride.completeRide('driver');
    });
    await waitFor(() => expect(result.current.entitlement.rideCredits).toBe(34));
  });
});
