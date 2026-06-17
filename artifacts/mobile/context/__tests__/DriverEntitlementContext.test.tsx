import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import { DriverEntitlementProvider, useDriverEntitlement } from '../DriverEntitlementContext';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <DriverEntitlementProvider>{children}</DriverEntitlementProvider>
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
});
