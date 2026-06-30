import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { act, renderHook, waitFor } from '@testing-library/react-native';
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
import { EMPTY_DRIVER_ENTITLEMENT } from '@/domain/driverRidePackages';
import type { RideLocation } from '@/types';

let mockAuthDriverProfile: any = null;
let mockDriverEntitlement: any = null;
const mockShadowWireRequestRideCommand = jest.fn();
const mockShadowWireCancelRideCommand = jest.fn();
const mockShadowWireAcceptRideCommand = jest.fn();
const mockShadowWireDeclineRideCommand = jest.fn();

jest.mock('@/utils/driverProfileImage', () => ({
  buildDriverWithUploadedPhoto: jest.fn(async driver => driver),
}));

jest.mock('@/context/AuthContext', () => ({
  useOptionalAuth: () => mockAuthDriverProfile ? {
    user: {
      id: 'driver-1',
      mode: 'driver',
    },
    driverProfile: mockAuthDriverProfile,
  } : null,
}));

jest.mock('@/context/DriverEntitlementContext', () => ({
  useOptionalDriverEntitlement: () => mockDriverEntitlement,
}));

jest.mock('@/capabilities', () => ({
  resolveCapabilities: () => ({
    capabilities: {},
    state: {},
    mode: 'customer',
  }),
}));

jest.mock('@/domains/ride/commandPipeline', () => ({
  shadowWireRequestRideCommand: (...args: unknown[]) => mockShadowWireRequestRideCommand(...args),
  shadowWireCancelRideCommand: (...args: unknown[]) => mockShadowWireCancelRideCommand(...args),
  shadowWireAcceptRideCommand: (...args: unknown[]) => mockShadowWireAcceptRideCommand(...args),
  shadowWireDeclineRideCommand: (...args: unknown[]) => mockShadowWireDeclineRideCommand(...args),
  shadowWireSubmitRatingCommand: jest.fn(),
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
    mockAuthDriverProfile = null;
    mockDriverEntitlement = null;
    mockShadowWireRequestRideCommand.mockReset();
    mockShadowWireCancelRideCommand.mockReset();
    mockShadowWireAcceptRideCommand.mockReset();
    mockShadowWireDeclineRideCommand.mockReset();
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
    expect(mockShadowWireRequestRideCommand).toHaveBeenCalledTimes(1);

    const createdRideId = result.current.currentRide?.id;
    expect(result.current.currentRide).toEqual(expect.objectContaining({
      id: createdRideId,
      status: 'searching',
      pickup,
      destination,
      vehicleType: 'moto',
      requestedVehicleType: 'moto',
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
    expect(mockShadowWireCancelRideCommand).toHaveBeenCalledTimes(1);
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

  test('shadow wiring failure does not block ride creation or cancellation', async () => {
    mockShadowWireRequestRideCommand.mockImplementationOnce(() => {
      throw new Error('shadow request failed');
    });
    mockShadowWireCancelRideCommand.mockImplementationOnce(() => {
      throw new Error('shadow cancel failed');
    });

    const { result } = renderRideProvider();

    await act(async () => {
      await result.current.createRide(pickup, destination, 'moto');
    });
    expect(result.current.currentRide).toEqual(expect.objectContaining({
      status: 'searching',
    }));

    act(() => result.current.cancelRide());
    expect(result.current.currentRide).toEqual(expect.objectContaining({
      status: 'cancelled',
    }));
  });

  test('shadow-wires driver accept and decline without changing live behavior', async () => {
    mockAuthDriverProfile = {
      id: 'driver-1',
      isOnline: true,
      isVerified: true,
      verificationStatus: 'approved',
      vehicleType: 'moto',
      plateNumber: 'RAD 001 A',
      licenseNumber: 'LIC001',
      vehicles: [{
        id: 'driver-vehicle:moto:rad-001-a',
        vehicleType: 'moto',
        status: 'approved',
        plateNumber: 'RAD 001 A',
        licenseNumber: 'LIC001',
        submittedAt: '2026-06-08T09:00:00.000Z',
      }],
      activeVehicle: { vehicleId: 'driver-vehicle:moto:rad-001-a' },
    };
    mockDriverEntitlement = {
      entitlement: {
        ...EMPTY_DRIVER_ENTITLEMENT,
        vehicleId: 'driver-vehicle:moto:rad-001-a',
        vehicleType: 'moto',
        remainingRideCredits: 3,
        vehicleEntitlements: [{
          vehicleId: 'driver-vehicle:moto:rad-001-a',
          vehicleType: 'moto',
          activePackageId: null,
          remainingRideCredits: 3,
          remainingBonusRides: 0,
          activations: [],
          creditTransactions: [],
          purchaseHistory: [],
          updatedAt: '2026-06-08T09:00:00.000Z',
          authority: 'local_prototype',
        }],
      },
    };

    const { result } = renderRideProvider();

    await act(async () => {
      result.current.simulateIncomingRideRequest();
    });
    await waitFor(() => expect(result.current.pendingRequest).toEqual(expect.objectContaining({
      id: expect.any(String),
      status: 'searching',
    })));

    act(() => result.current.acceptRideRequest());
    expect(mockShadowWireAcceptRideCommand).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.currentRide).toEqual(expect.objectContaining({
      status: 'negotiating',
    })));

    await act(async () => {
      result.current.simulateIncomingRideRequest();
    });
    act(() => result.current.declineRideRequest());
    expect(mockShadowWireDeclineRideCommand).toHaveBeenCalledTimes(1);
    expect(result.current.pendingRequest).toBeNull();
  });

  test('shadow wiring failure does not block driver accept or decline', async () => {
    mockAuthDriverProfile = {
      id: 'driver-1',
      isOnline: true,
      isVerified: true,
      verificationStatus: 'approved',
      vehicleType: 'moto',
      plateNumber: 'RAD 001 A',
      licenseNumber: 'LIC001',
      vehicles: [{
        id: 'driver-vehicle:moto:rad-001-a',
        vehicleType: 'moto',
        status: 'approved',
        plateNumber: 'RAD 001 A',
        licenseNumber: 'LIC001',
        submittedAt: '2026-06-08T09:00:00.000Z',
      }],
      activeVehicle: { vehicleId: 'driver-vehicle:moto:rad-001-a' },
    };
    mockDriverEntitlement = {
      entitlement: {
        ...EMPTY_DRIVER_ENTITLEMENT,
        vehicleId: 'driver-vehicle:moto:rad-001-a',
        vehicleType: 'moto',
        remainingRideCredits: 3,
        vehicleEntitlements: [{
          vehicleId: 'driver-vehicle:moto:rad-001-a',
          vehicleType: 'moto',
          activePackageId: null,
          remainingRideCredits: 3,
          remainingBonusRides: 0,
          activations: [],
          creditTransactions: [],
          purchaseHistory: [],
          updatedAt: '2026-06-08T09:00:00.000Z',
          authority: 'local_prototype',
        }],
      },
    };
    mockShadowWireAcceptRideCommand.mockImplementationOnce(() => {
      throw new Error('shadow accept failed');
    });
    mockShadowWireDeclineRideCommand.mockImplementationOnce(() => {
      throw new Error('shadow decline failed');
    });

    const { result } = renderRideProvider();

    await act(async () => {
      result.current.simulateIncomingRideRequest();
    });
    act(() => result.current.acceptRideRequest());
    await waitFor(() => expect(result.current.currentRide).toEqual(expect.objectContaining({
      status: 'negotiating',
    })));

    await act(async () => {
      result.current.simulateIncomingRideRequest();
    });
    act(() => result.current.declineRideRequest());
    expect(result.current.pendingRequest).toBeNull();
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
    mockAuthDriverProfile = {
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
    mockDriverEntitlement = {
      ...EMPTY_DRIVER_ENTITLEMENT,
      vehicleId: 'driver-vehicle:moto:rad-001-a',
      vehicleType: 'moto',
      remainingRideCredits: 3,
      vehicleEntitlements: [{
        vehicleId: 'driver-vehicle:moto:rad-001-a',
        vehicleType: 'moto',
        activePackageId: null,
        remainingRideCredits: 3,
        remainingBonusRides: 0,
        activations: [],
        creditTransactions: [],
        purchaseHistory: [],
        updatedAt: '2026-06-08T09:00:00.000Z',
        authority: 'local_prototype',
      }],
      deductCreditForCompletedRide: jest.fn(async () => true),
    };
    const { result } = renderRideProvider();

    await act(async () => {
      await result.current.createRide(pickup, destination, 'moto');
    });
    act(() => result.current.completeRide('driver', {
      driverId: 'driver-1',
      driverName: 'Test Driver',
      vehicleId: 'driver-vehicle:moto:rad-001-a',
      vehicleType: 'moto',
    }));

    await waitFor(() => expect(result.current.rideHistory[0]).toEqual(expect.objectContaining({
      driverId: 'driver-1',
      driverName: 'Test Driver',
      status: 'completed',
      vehicleId: 'driver-vehicle:moto:rad-001-a',
      vehicleType: 'moto',
    })));

    await flushPromises();
    expect((await loadRideHistory())?.[0]).toEqual(expect.objectContaining({
      driverId: 'driver-1',
      driverName: 'Test Driver',
    }));
  });
});
