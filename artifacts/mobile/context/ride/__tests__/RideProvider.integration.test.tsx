import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { act, renderHook } from '@testing-library/react-native';
import React from 'react';
import { RideProvider, useRide } from '../RideProvider';
import {
  ARRIVING_TRACKING_INTERVAL_MS,
  ARRIVING_TRACKING_STEPS,
  CANCELLED_RIDE_CLEAR_DELAY_MS,
  CONFIRMED_RIDE_START_DELAY_MS,
  DRIVER_MATCH_MIN_DELAY_MS,
  DRIVER_OFFER_DELAY_MS,
  JOURNEY_TRACKING_INTERVAL_MS,
  NEGOTIATION_RESPONSE_DELAY_MS,
} from '../rideConstants';
import { loadRideHistory } from '../ridePersistence';
import type { RideLocation } from '@/types';

jest.mock('@/utils/driverProfileImage', () => ({
  buildDriverWithUploadedPhoto: jest.fn(async driver => driver),
}));

const pickup: RideLocation = {
  address: 'Kimironko Market',
  latitude: -1.9365,
  longitude: 30.1011,
  locationType: 'precise',
};

const destination: RideLocation = {
  address: 'Kigali City Tower',
  latitude: -1.9438,
  longitude: 30.0616,
  locationType: 'precise',
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <RideProvider>{children}</RideProvider>
);

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function createAndMatchRide(result: ReturnType<typeof renderRideProvider>['result']) {
  await act(async () => {
    await result.current.createRide(pickup, destination, 'moto', destination.address);
  });
  expect(result.current.currentRide?.status).toBe('searching');

  await act(async () => {
    jest.advanceTimersByTime(DRIVER_MATCH_MIN_DELAY_MS);
    await Promise.resolve();
  });
  expect(result.current.currentRide?.status).toBe('negotiating');
  expect(result.current.currentRide?.driver?.vehicleType).toBe('moto');
}

function renderRideProvider() {
  return renderHook(() => useRide(), { wrapper });
}

describe('RideProvider lifecycle orchestration', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const originalConsoleError = console.error;
    jest.spyOn(console, 'error').mockImplementation((...args) => {
      if (String(args[0]).includes('react-test-renderer is deprecated')) return;
      originalConsoleError(...args);
    });
    await AsyncStorage.clear();
    (SecureStore as typeof SecureStore & { __clear: () => void }).__clear();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('orchestrates creation, matching, negotiation, acceptance, arrival, journey, completion, and history persistence', async () => {
    const { result, unmount } = renderRideProvider();

    await act(async () => {
      await result.current.createRide(pickup, destination, 'moto', destination.address);
    });

    const createdRideId = result.current.currentRide?.id;
    expect(result.current.currentRide).toEqual(expect.objectContaining({
      id: createdRideId,
      status: 'searching',
      pickup,
      destination,
      vehicleType: 'moto',
    }));
    expect(result.current.cancelledSearchDraft).toEqual(expect.objectContaining({
      pickup,
      destination,
      vehicleType: 'moto',
      destText: destination.address,
    }));

    await act(async () => {
      jest.advanceTimersByTime(DRIVER_MATCH_MIN_DELAY_MS);
      await Promise.resolve();
    });
    expect(result.current.currentRide).toEqual(expect.objectContaining({
      id: createdRideId,
      status: 'negotiating',
      driverId: expect.any(String),
    }));
    expect(result.current.driverLocation).toEqual(result.current.currentRide?.driver?.location);
    expect(result.current.cancelledSearchDraft).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(DRIVER_OFFER_DELAY_MS);
    });
    const driverOffer = result.current.currentRide?.negotiation.at(-1);
    expect(driverOffer).toEqual(expect.objectContaining({
      sender: 'driver',
      type: 'offer',
      amount: expect.any(Number),
    }));

    act(() => result.current.acceptDriverOffer());
    expect(result.current.currentRide).toEqual(expect.objectContaining({
      id: createdRideId,
      status: 'confirmed',
      agreedFare: driverOffer?.amount,
    }));

    act(() => {
      jest.advanceTimersByTime(CONFIRMED_RIDE_START_DELAY_MS);
    });
    expect(result.current.currentRide?.status).toBe('arriving');

    act(() => {
      jest.advanceTimersByTime(ARRIVING_TRACKING_INTERVAL_MS * ARRIVING_TRACKING_STEPS);
    });

    act(() => result.current.markArrived());

    expect(result.current.currentRide).toEqual(expect.objectContaining({
      status: 'arrived',
      arrivedAt: expect.any(String),
      waitStartedAt: expect.any(String),
    }));

    act(() => result.current.startJourney());
    expect(result.current.currentRide?.status).toBe('in_progress');

    act(() => result.current.completeRide());
    expect(result.current.currentRide).toBeNull();
    expect(result.current.driverLocation).toBeNull();
    expect(result.current.rideHistory[0]).toEqual(expect.objectContaining({
      id: createdRideId,
      status: 'completed',
      completedAt: expect.any(String),
    }));

    await flushPromises();
    expect((await loadRideHistory())?.[0]).toEqual(expect.objectContaining({
      id: createdRideId,
      status: 'completed',
    }));

    act(() => {
      jest.advanceTimersByTime(JOURNEY_TRACKING_INTERVAL_MS * 2);
    });
    expect(result.current.driverLocation).toBeNull();

    act(() => unmount());
  });

  test('applies negotiation responses through the provider timer', async () => {
    const { result } = renderRideProvider();
    await createAndMatchRide(result);

    const offer = Math.ceil((result.current.currentRide?.suggestedFare ?? 0) * 0.9);
    act(() => result.current.counterOffer(offer));
    expect(result.current.currentRide?.negotiation.at(-1)).toEqual(expect.objectContaining({
      sender: 'customer',
      amount: offer,
    }));

    act(() => {
      jest.advanceTimersByTime(NEGOTIATION_RESPONSE_DELAY_MS);
    });
    expect(result.current.currentRide).toEqual(expect.objectContaining({
      status: 'confirmed',
      agreedFare: offer,
    }));
  });

  test('cancels a ride, clears matching work, and does not persist it to history', async () => {
    const { result } = renderRideProvider();

    await act(async () => {
      await result.current.createRide(pickup, destination, 'moto');
    });
    const cancelledRideId = result.current.currentRide?.id;

    act(() => result.current.cancelRide());
    expect(result.current.currentRide).toEqual(expect.objectContaining({
      id: cancelledRideId,
      status: 'cancelled',
    }));
    expect(result.current.restoreBookingOnHomeFocus).toBe(true);
    expect(result.current.driverLocation).toBeNull();

    act(() => {
      jest.advanceTimersByTime(CANCELLED_RIDE_CLEAR_DELAY_MS);
    });
    expect(result.current.currentRide).toBeNull();

    act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(result.current.currentRide).toBeNull();
    expect(result.current.rideHistory).toEqual([]);
    expect(await loadRideHistory()).toBeNull();
  });

  test('guarded invalid transitions do not replace or advance active ride state', async () => {
    const { result } = renderRideProvider();
    await createAndMatchRide(result);
    const activeRide = result.current.currentRide;

    await act(async () => {
      await result.current.createRide(destination, pickup, 'cab');
    });
    expect(result.current.currentRide).toBe(activeRide);

    act(() => result.current.startJourney());
    expect(result.current.currentRide).toBe(activeRide);

    act(() => result.current.sendDriverOffer(0));
    expect(result.current.currentRide).toBe(activeRide);

    act(() => result.current.riderAcceptWithFare(0));
    expect(result.current.currentRide).toBe(activeRide);
  });

  test('loads persisted completed history through the provider API', async () => {
    const firstProvider = renderRideProvider();
    await createAndMatchRide(firstProvider.result);

    act(() => firstProvider.result.current.acceptDriverOffer());
    act(() => firstProvider.result.current.completeRide());
    await flushPromises();
    const completedRideId = firstProvider.result.current.rideHistory[0].id;
    firstProvider.unmount();

    const secondProvider = renderRideProvider();
    await act(async () => {
      await secondProvider.result.current.loadHistory();
    });

    expect(secondProvider.result.current.rideHistory[0]).toEqual(expect.objectContaining({
      id: completedRideId,
      status: 'completed',
    }));
  });

  test('stamps active driver identity when a driver completes a ride', async () => {
    const { result } = renderRideProvider();

    act(() => result.current.simulateIncomingRideRequest());
    act(() => result.current.acceptRideRequest());
    act(() => result.current.riderAcceptWithFare(3500));
    act(() => result.current.completeRide('driver', {
      driverId: 'driver-1',
      driverName: 'Test Driver',
      vehicleType: 'moto',
    }));

    expect(result.current.rideHistory[0]).toEqual(expect.objectContaining({
      driverId: 'driver-1',
      driverName: 'Test Driver',
      status: 'completed',
      vehicleType: 'moto',
    }));

    await flushPromises();
    expect((await loadRideHistory())?.[0]).toEqual(expect.objectContaining({
      driverId: 'driver-1',
      driverName: 'Test Driver',
    }));
  });
});
