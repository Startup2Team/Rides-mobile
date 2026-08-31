import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { BackendError } from '@/data/remote/contracts/backendErrors';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import { RideProvider, useRide } from '../RideProvider';
import {
  CANCELLED_RIDE_CLEAR_DELAY_MS,
  JOURNEY_TRACKING_INTERVAL_MS,
  RIDE_RECONCILE_INTERVAL_MS,
} from '../rideConstants';
import { loadRideHistory } from '../ridePersistence';
import { EMPTY_DRIVER_ENTITLEMENT } from '@/domain/driverRidePackages';
import { triggerRideReconcile } from '@/state/rideReconcileTrigger';
import type { RideLocation } from '@/types';

let mockAuthDriverProfile: any = null;
let mockAuthUser: any = null;
let mockDriverEntitlement: any = null;
// Handlers captured from the (mocked) customer tracking socket so tests can
// drive real backend events — matching + negotiation are now socket-driven.
let mockCapturedCustomerHandlers: any = null;
let mockCapturedDriverHandlers: any = null;
const mockCreateBackendRide = jest.fn(async (..._args: unknown[]) => ({ rideId: 'backend-ride-1' }));
const mockCancelBackendRide = jest.fn(async (..._args: unknown[]) => undefined);
const mockGetActiveRide = jest.fn(async (): Promise<any> => null);
const mockGetActiveDriverRide = jest.fn(async (): Promise<any> => null);
const mockShadowWireRequestRideCommand = jest.fn();
const mockShadowWireCancelRideCommand = jest.fn();
const mockShadowWireAcceptRideCommand = jest.fn();
const mockShadowWireDeclineRideCommand = jest.fn();
const mockShadowWireStartRideCommand = jest.fn();
const mockShadowWireCompleteRideCommand = jest.fn();
const mockUpdateCustomerLocation = jest.fn(async (..._args: unknown[]) => undefined);
const mockIsTerminalCustomerLocationError = jest.fn((_error: unknown) => false);
const mockStartCustomerLocationBackgroundUpdates = jest.fn(async (..._args: unknown[]) => false);
const mockStopCustomerLocationBackgroundUpdates = jest.fn(async () => undefined);
const mockGetTrackedCustomerLocationBackgroundRideId = jest.fn(async (): Promise<string | null> => null);

jest.mock('@/utils/driverProfileImage', () => ({
  buildDriverWithUploadedPhoto: jest.fn(async driver => driver),
}));

jest.mock('@/context/AuthContext', () => ({
  useOptionalAuth: () => {
    if (mockAuthDriverProfile) {
      return {
        user: { id: 'driver-1', mode: 'driver' },
        driverProfile: mockAuthDriverProfile,
      };
    }
    if (mockAuthUser) {
      return { user: mockAuthUser, driverProfile: null };
    }
    return null;
  },
}));

// Backend + socket services are stubbed so the real POST /customer/rides + the
// live tracking socket are deterministic. `driver_matched` and negotiation now
// arrive through the socket, so tests push them via the captured handlers.
jest.mock('@/services/rides', () => ({
  createRide: (...args: unknown[]) => mockCreateBackendRide(...args),
  cancelRide: (...args: unknown[]) => mockCancelBackendRide(...args),
  getActiveRide: () => mockGetActiveRide(),
}));
jest.mock('@/services/negotiation', () => ({
  proposeFare: jest.fn(async () => undefined),
  acceptFare: jest.fn(async () => undefined),
}));
jest.mock('@/services/driverRides', () => ({
  getActiveDriverRide: () => mockGetActiveDriverRide(),
  acceptRide: jest.fn(async () => undefined),
  declineRide: jest.fn(async () => undefined),
  driverCancelRide: jest.fn(async () => undefined),
  markEnRoute: jest.fn(async () => undefined),
  markArrived: jest.fn(async () => undefined),
  startTrip: jest.fn(async () => undefined),
  completeTrip: jest.fn(async () => undefined),
}));
jest.mock('@/services/driverNegotiation', () => ({
  proposeFare: jest.fn(async () => undefined),
  acceptFare: jest.fn(async () => undefined),
  lockManualFare: jest.fn(async () => undefined),
}));
// The customer live-location publish effect fires as soon as a ride is
// CONFIRMED — stub it so tests never make a real backend call.
jest.mock('@/services/customerLocation', () => ({
  updateCustomerLocation: (...args: unknown[]) => mockUpdateCustomerLocation(...args),
  isTerminalCustomerLocationError: (error: unknown) => mockIsTerminalCustomerLocationError(error),
}));
// The native background-location task itself is exercised in
// services/__tests__/customerLocationBackgroundTask.test.ts — here it's
// stubbed so Flow K and the bootstrap orphan-reconcile can be asserted on
// without touching expo-location's native background-permission surface.
jest.mock('@/services/customerLocationBackgroundTask', () => ({
  startCustomerLocationBackgroundUpdates: (...args: unknown[]) => mockStartCustomerLocationBackgroundUpdates(...args),
  stopCustomerLocationBackgroundUpdates: () => mockStopCustomerLocationBackgroundUpdates(),
  getTrackedCustomerLocationBackgroundRideId: () => mockGetTrackedCustomerLocationBackgroundRideId(),
}));
jest.mock('@/services/customerTrackingSocket', () => ({
  openCustomerTrackingSocket: (_rideId: string, handlers: any) => {
    mockCapturedCustomerHandlers = handlers;
    return { close: jest.fn() };
  },
}));
jest.mock('@/services/driverTrackingSocket', () => ({
  openDriverSocket: (handlers: any) => {
    mockCapturedDriverHandlers = handlers;
    return { close: jest.fn() };
  },
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
  shadowWireStartRideCommand: (...args: unknown[]) => mockShadowWireStartRideCommand(...args),
  shadowWireCompleteRideCommand: (...args: unknown[]) => mockShadowWireCompleteRideCommand(...args),
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

async function emitCustomer(type: string, payload: Record<string, unknown> = {}) {
  await waitFor(() => expect(mockCapturedCustomerHandlers).not.toBeNull());
  await act(async () => {
    mockCapturedCustomerHandlers.onEvent({ type, payload });
  });
}

async function createAndMatchRide(result: ReturnType<typeof renderRideProvider>['result']) {
  await act(async () => {
    await result.current.createRide(pickup, destination, 'moto', destination.address);
  });
  expect(result.current.currentRide?.status).toBe('searching');

  // The backend matches a driver and pushes `driver_matched` over the socket.
  await emitCustomer('driver_matched', {
    driver_id: 'backend-driver-1',
    driver_name: 'Backend Driver',
    driver_rating: 5,
    eta: 4,
    lat: pickup.latitude,
    lng: pickup.longitude,
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
    mockAuthUser = null;
    mockDriverEntitlement = null;
    mockCapturedCustomerHandlers = null;
    mockCapturedDriverHandlers = null;
    mockCreateBackendRide.mockClear();
    mockCreateBackendRide.mockImplementation(async () => ({ rideId: 'backend-ride-1' }));
    mockCancelBackendRide.mockClear();
    mockGetActiveRide.mockReset();
    mockGetActiveRide.mockResolvedValue(null);
    mockGetActiveDriverRide.mockReset();
    mockGetActiveDriverRide.mockResolvedValue(null);
    mockShadowWireRequestRideCommand.mockReset();
    mockShadowWireCancelRideCommand.mockReset();
    mockShadowWireAcceptRideCommand.mockReset();
    mockShadowWireDeclineRideCommand.mockReset();
    mockShadowWireStartRideCommand.mockReset();
    mockShadowWireCompleteRideCommand.mockReset();
    mockUpdateCustomerLocation.mockClear();
    mockIsTerminalCustomerLocationError.mockReset();
    mockIsTerminalCustomerLocationError.mockReturnValue(false);
    mockStartCustomerLocationBackgroundUpdates.mockClear();
    mockStopCustomerLocationBackgroundUpdates.mockClear();
    mockGetTrackedCustomerLocationBackgroundRideId.mockReset();
    mockGetTrackedCustomerLocationBackgroundRideId.mockResolvedValue(null);
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

  test('orchestrates creation, backend matching, negotiation, acceptance, arrival, journey, completion, and history persistence', async () => {
    mockAuthUser = { id: 'customer-1', mode: 'customer' };
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

    // The backend POST resolves, the tracking socket opens, and the server
    // pushes `driver_matched` — the only source of match state now.
    await emitCustomer('driver_matched', {
      driver_id: 'backend-driver-1',
      driver_name: 'Backend Driver',
      driver_rating: 5,
      eta: 4,
      lat: pickup.latitude,
      lng: pickup.longitude,
    });
    expect(result.current.currentRide).toEqual(expect.objectContaining({
      id: createdRideId,
      status: 'negotiating',
      driverId: 'backend-driver-1',
    }));
    expect(result.current.driverLocation).toEqual(result.current.currentRide?.driver?.location);

    // The driver's fare offer arrives as a negotiation_message over the socket.
    await emitCustomer('negotiation_message', { actor_role: 'DRIVER', amount: 3000 });
    const driverOffer = result.current.currentRide?.negotiation.at(-1);
    expect(driverOffer).toEqual(expect.objectContaining({
      sender: 'driver',
      type: 'offer',
      amount: 3000,
    }));

    act(() => result.current.acceptDriverOffer());
    expect(result.current.currentRide).toEqual(expect.objectContaining({
      id: createdRideId,
      status: 'confirmed',
      agreedFare: driverOffer?.amount,
    }));

    // Arrival is driven by the backend `driver_en_route` lifecycle event.
    await emitCustomer('driver_en_route', {});
    expect(result.current.currentRide?.status).toBe('arriving');

    act(() => result.current.markArrived());

    expect(result.current.currentRide).toEqual(expect.objectContaining({
      status: 'arrived',
      arrivedAt: expect.any(String),
      waitStartedAt: expect.any(String),
    }));

    act(() => result.current.startJourney());
    expect(result.current.currentRide?.status).toBe('in_progress');
    expect(mockShadowWireStartRideCommand).toHaveBeenCalledTimes(1);

    act(() => result.current.completeRide());
    expect(result.current.currentRide).toBeNull();
    expect(result.current.driverLocation).toBeNull();
    expect(mockShadowWireCompleteRideCommand).toHaveBeenCalledTimes(1);
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

  test('applies a customer counter-offer and confirms on the backend accept event', async () => {
    mockAuthUser = { id: 'customer-1', mode: 'customer' };
    const { result } = renderRideProvider();
    await createAndMatchRide(result);

    const offer = Math.ceil((result.current.currentRide?.suggestedFare ?? 0) * 0.9);
    act(() => result.current.counterOffer(offer));
    expect(result.current.currentRide?.negotiation.at(-1)).toEqual(expect.objectContaining({
      sender: 'customer',
      amount: offer,
    }));

    // The backend accepts the counter-offer and confirms the ride over the socket.
    await emitCustomer('ride_confirmed', { agreed_fare: offer });
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
    mockAuthUser = { id: 'customer-1', mode: 'customer' };
    const { result } = renderRideProvider();
    await createAndMatchRide(result);
    const activeRide = result.current.currentRide;

    await act(async () => {
      await result.current.createRide(destination, pickup, 'cab');
    });
    expect(result.current.currentRide).toBe(activeRide);

    act(() => result.current.startJourney());
    expect(result.current.currentRide).toBe(activeRide);
    expect(mockShadowWireStartRideCommand).not.toHaveBeenCalled();

    act(() => result.current.sendDriverOffer(0));
    expect(result.current.currentRide).toBe(activeRide);

    act(() => result.current.riderAcceptWithFare(0));
    expect(result.current.currentRide).toBe(activeRide);
  });

  test('loads persisted completed history through the provider API', async () => {
    mockAuthUser = { id: 'customer-1', mode: 'customer' };
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

    expect(mockShadowWireCompleteRideCommand).toHaveBeenCalledTimes(1);

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

  // ── Active-ride resume + search UX ─────────────────────────────────────────

  // GET /rides/active snapshot as mapped by services/rides.toDomain.
  const activeSnapshot = (overrides: Record<string, unknown> = {}) => ({
    id: 'srv-active-1',
    status: 'IN_PROGRESS',
    vehicleType: 'moto',
    customerId: 'cust-9',
    customerName: 'Cust',
    customerPhone: '+250780000555',
    customerRating: null,
    driverId: 'drv-3',
    driverName: 'Drv',
    driverPhone: '+250780000333',
    driverRating: 4.9,
    driverPlate: 'RAD3750A',
    pickup: { lat: pickup.latitude, lng: pickup.longitude, address: pickup.address },
    destination: { lat: destination.latitude, lng: destination.longitude, address: destination.address },
    estimatedDistanceKm: 2.4,
    customerInitialFare: 1200,
    agreedFare: 1500,
    estimatedFareRwf: 1300,
    finalFareRwf: null,
    cancelReason: null,
    driverArrivedAt: null,
    startedAt: '2026-08-12T08:02:00Z',
    completedAt: null,
    createdAt: '2026-08-12T07:55:00Z',
    updatedAt: '2026-08-12T08:02:00Z',
    ...overrides,
  });

  const driverProfileFixture = () => ({
    id: 'driver-1',
    isOnline: true,
    isVerified: true,
    verificationStatus: 'approved',
    vehicleType: 'moto',
    plateNumber: 'RAD 001 A',
    licenseNumber: 'LIC001',
    vehicles: [],
  });

  test('hydrates the customer active ride on cold start so navigation can resume it', async () => {
    mockAuthUser = { id: 'customer-1', mode: 'customer' };
    mockGetActiveRide.mockResolvedValue(activeSnapshot());

    const { result } = renderRideProvider();

    await waitFor(() => expect(result.current.currentRide).toEqual(expect.objectContaining({
      status: 'in_progress',
      backendRideId: 'srv-active-1',
      driverId: 'drv-3',
      agreedFare: 1500,
    })));
    expect(result.current.currentRide?.driver).toEqual(expect.objectContaining({
      name: 'Drv',
      phone: '+250780000333',
      plateNumber: 'RAD3750A',
    }));
  });

  test('hydrates the driver active ride on cold start with the customer identity', async () => {
    mockAuthDriverProfile = driverProfileFixture();
    mockGetActiveDriverRide.mockResolvedValue(activeSnapshot({ status: 'DRIVER_ARRIVED', driverArrivedAt: '2026-08-12T08:00:00Z' }));

    const { result } = renderRideProvider();

    await waitFor(() => expect(result.current.currentRide).toEqual(expect.objectContaining({
      status: 'arrived',
      backendRideId: 'srv-active-1',
      customerName: 'Cust',
      customerPhone: '+250780000555',
      waitStartedAt: '2026-08-12T08:00:00Z',
    })));
  });

  test('hydration never clobbers a ride that is already live locally', async () => {
    mockAuthUser = { id: 'customer-1', mode: 'customer' };
    let resolveActive: (value: unknown) => void = () => {};
    mockGetActiveRide.mockImplementation(() => new Promise(resolve => { resolveActive = resolve; }));

    const { result } = renderRideProvider();
    await act(async () => {
      await result.current.createRide(pickup, destination, 'moto');
    });
    const localRideId = result.current.currentRide?.id;

    await act(async () => {
      resolveActive(activeSnapshot());
      await Promise.resolve();
    });
    expect(result.current.currentRide?.id).toBe(localRideId);
    expect(result.current.currentRide?.status).toBe('searching');
  });

  test('driver ride_state replay resyncs the local ride status', async () => {
    mockAuthDriverProfile = driverProfileFixture();
    mockGetActiveDriverRide.mockResolvedValue(activeSnapshot({ status: 'DRIVER_EN_ROUTE' }));

    const { result } = renderRideProvider();
    await waitFor(() => expect(result.current.currentRide?.status).toBe('arriving'));

    await waitFor(() => expect(mockCapturedDriverHandlers).not.toBeNull());
    await act(async () => {
      mockCapturedDriverHandlers.onEvent({ type: 'ride_state', payload: { status: 'IN_PROGRESS' } });
    });
    expect(result.current.currentRide?.status).toBe('in_progress');
  });

  test('driver socket customer_location events update customerLocation', async () => {
    mockAuthDriverProfile = driverProfileFixture();
    mockGetActiveDriverRide.mockResolvedValue(activeSnapshot({ status: 'IN_PROGRESS' }));

    const { result } = renderRideProvider();
    await waitFor(() => expect(result.current.currentRide?.status).toBe('in_progress'));
    expect(result.current.customerLocation).toBeNull();

    await waitFor(() => expect(mockCapturedDriverHandlers).not.toBeNull());
    await act(async () => {
      mockCapturedDriverHandlers.onEvent({ type: 'customer_location', payload: { lat: -1.95, lng: 30.05 } });
    });
    expect(result.current.customerLocation).toEqual({ latitude: -1.95, longitude: 30.05 });

    // A reconnect's ride_state replay carries customer_lat/customer_lng and
    // must seed the same state — otherwise a driver whose socket reconnects
    // mid-ride sees a stale customer marker until the next publish tick.
    await act(async () => {
      mockCapturedDriverHandlers.onEvent({
        type: 'ride_state',
        payload: { status: 'IN_PROGRESS', customer_lat: -1.96, customer_lng: 30.06 },
      });
    });
    expect(result.current.customerLocation).toEqual({ latitude: -1.96, longitude: 30.06 });

    // The ride ending must not leave a stale customer marker behind.
    await act(async () => {
      mockCapturedDriverHandlers.onEvent({ type: 'ride_cancelled', payload: {} });
    });
    act(() => {
      jest.advanceTimersByTime(CANCELLED_RIDE_CLEAR_DELAY_MS);
    });
    expect(result.current.customerLocation).toBeNull();
  });

  test('customer live-location publish loop runs only while the ride is active', async () => {
    mockAuthUser = { id: 'customer-1', mode: 'customer' };
    const { result } = renderRideProvider();

    await createAndMatchRide(result);
    expect(mockUpdateCustomerLocation).not.toHaveBeenCalled();

    // The driver's fare offer, accepted → CONFIRMED, is the start of the
    // publish window (whole-trip tracking begins at acceptance, not before).
    await emitCustomer('negotiation_message', { actor_role: 'DRIVER', amount: 3000 });
    await act(async () => {
      result.current.acceptDriverOffer();
    });
    expect(result.current.currentRide?.status).toBe('confirmed');
    await flushPromises();
    expect(mockUpdateCustomerLocation).toHaveBeenCalledWith(
      'backend-ride-1',
      expect.objectContaining({ lat: -1.9441, lng: 30.0619 }),
    );

    const callsWhileActive = mockUpdateCustomerLocation.mock.calls.length;
    await act(async () => {
      jest.advanceTimersByTime(10_000);
      await Promise.resolve();
    });
    expect(mockUpdateCustomerLocation.mock.calls.length).toBeGreaterThan(callsWhileActive);

    // Ride completes → the effect must tear down immediately, not merely stop
    // being scheduled — a force-killed-and-relaunched app has no way to leak
    // this interval, but a live app session must not keep POSTing either.
    act(() => result.current.completeRide());
    const callsAfterCompletion = mockUpdateCustomerLocation.mock.calls.length;
    act(() => {
      jest.advanceTimersByTime(30_000);
    });
    expect(mockUpdateCustomerLocation.mock.calls.length).toBe(callsAfterCompletion);
  });

  test('customer live-location publish loop stops itself on a terminal 404/409 instead of polling a dead ride forever', async () => {
    mockAuthUser = { id: 'customer-1', mode: 'customer' };
    const { result } = renderRideProvider();

    await createAndMatchRide(result);
    await emitCustomer('negotiation_message', { actor_role: 'DRIVER', amount: 3000 });
    await act(async () => {
      result.current.acceptDriverOffer();
    });
    await flushPromises();
    expect(mockUpdateCustomerLocation).toHaveBeenCalledTimes(1);

    // The backend has, unbeknownst to this still-"confirmed" local state,
    // already ended the ride (RIDE_NOT_ACTIVE) — every further POST rejects
    // the same way and the classifier says so.
    mockUpdateCustomerLocation.mockRejectedValue(new Error('RIDE_NOT_ACTIVE'));
    mockIsTerminalCustomerLocationError.mockReturnValue(true);

    await act(async () => {
      jest.advanceTimersByTime(10_000);
      await Promise.resolve();
    });
    const callsAfterTerminalRejection = mockUpdateCustomerLocation.mock.calls.length;
    expect(callsAfterTerminalRejection).toBe(2);

    // Further ticks must not call it again — the loop tore itself down.
    await act(async () => {
      jest.advanceTimersByTime(30_000);
      await Promise.resolve();
    });
    expect(mockUpdateCustomerLocation.mock.calls.length).toBe(callsAfterTerminalRejection);
  });

  test('bootstrap reconcile stops an orphaned background-location task when there is no matching active ride', async () => {
    // Simulates a force-kill mid-ride: the native task survives termination
    // and left its ride id persisted, but by the time the app cold-starts
    // again there is no active ride at all (it ended on the backend while
    // the app was dead).
    mockAuthUser = { id: 'customer-1', mode: 'customer' };
    mockGetTrackedCustomerLocationBackgroundRideId.mockResolvedValue('orphaned-ride-1');
    mockGetActiveRide.mockResolvedValue(null);

    renderRideProvider();

    await waitFor(() => expect(mockStopCustomerLocationBackgroundUpdates).toHaveBeenCalled());
  });

  test('bootstrap reconcile stops an orphaned task when the resumed ride is no longer in a location-active status', async () => {
    // The tracked ride resolved, but the snapshot maps to a status outside
    // CUSTOMER_LOCATION_ACTIVE_STATUSES (completed) — rideFromActiveRideSnapshot
    // returns null for it, which must be treated the same as "no active ride".
    mockAuthUser = { id: 'customer-1', mode: 'customer' };
    mockGetTrackedCustomerLocationBackgroundRideId.mockResolvedValue('srv-active-1');
    mockGetActiveRide.mockResolvedValue(activeSnapshot({ status: 'COMPLETED' }));

    renderRideProvider();

    await waitFor(() => expect(mockStopCustomerLocationBackgroundUpdates).toHaveBeenCalled());
  });

  test('bootstrap reconcile does NOT stop the task when the resumed ride is genuinely still active', async () => {
    mockAuthUser = { id: 'customer-1', mode: 'customer' };
    mockGetTrackedCustomerLocationBackgroundRideId.mockResolvedValue('srv-active-1');
    mockGetActiveRide.mockResolvedValue(activeSnapshot({ status: 'IN_PROGRESS' }));

    const { result } = renderRideProvider();

    await waitFor(() => expect(result.current.currentRide?.status).toBe('in_progress'));
    await flushPromises();
    expect(mockStopCustomerLocationBackgroundUpdates).not.toHaveBeenCalled();
  });

  test('bootstrap reconcile is a no-op when nothing is persisted (the common case)', async () => {
    mockAuthUser = { id: 'customer-1', mode: 'customer' };
    mockGetActiveRide.mockResolvedValue(null);

    renderRideProvider();
    await flushPromises();

    expect(mockStopCustomerLocationBackgroundUpdates).not.toHaveBeenCalled();
  });

  test('background streaming retries once foreground permission resolves after being denied at first check (fresh-install ordering)', async () => {
    // Fresh install: RideProvider's mount-time bootstrap check sees foreground
    // permission not-yet-granted (the OS prompt hasn't resolved), so Flow K's
    // first attempt for this ride runs with foregroundLocationGranted still
    // false. Flow J's own request (fired at the same time) resolves granted a
    // tick later — foregroundLocationGranted flipping true must make Flow K
    // retry instead of being permanently stuck on its first, premature call.
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      granted: false,
      status: 'denied',
    });
    mockAuthUser = { id: 'customer-1', mode: 'customer' };
    const { result } = renderRideProvider();

    await createAndMatchRide(result);
    await emitCustomer('negotiation_message', { actor_role: 'DRIVER', amount: 3000 });
    await act(async () => {
      result.current.acceptDriverOffer();
    });
    expect(result.current.currentRide?.status).toBe('confirmed');
    await flushPromises();

    // Flow J's requestForegroundPermissionsAsync (granted by the jest.setup
    // default) has now resolved, flipping foregroundLocationGranted — Flow K
    // must have re-run and attempted to start background streaming again.
    expect(mockStartCustomerLocationBackgroundUpdates.mock.calls.length).toBeGreaterThan(1);
  });

  test('409 RIDE_ALREADY_ACTIVE rejoins the real ride instead of faking a search', async () => {
    mockAuthUser = { id: 'customer-1', mode: 'customer' };
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockCreateBackendRide.mockRejectedValue(new BackendError('conflict', 'Conflict', {
      status: 409,
      cause: { error: { code: 'RIDE_ALREADY_ACTIVE', message: 'You already have an active ride' } },
    }));
    mockGetActiveRide.mockResolvedValue(activeSnapshot());

    const { result } = renderRideProvider();
    await act(async () => {
      await result.current.createRide(pickup, destination, 'moto');
    });

    await waitFor(() => expect(result.current.currentRide).toEqual(expect.objectContaining({
      status: 'in_progress',
      backendRideId: 'srv-active-1',
    })));
    expect(alertSpy).toHaveBeenCalledWith(
      'Ride in progress',
      expect.stringContaining('already have a ride in progress'),
    );
    expect(alertSpy).not.toHaveBeenCalledWith('No drivers found', expect.anything());
  });

  test('backend no-driver give-up flips the search into the in-place failed state', async () => {
    mockAuthUser = { id: 'customer-1', mode: 'customer' };
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockCreateBackendRide.mockResolvedValue({
      rideId: 'backend-ride-1',
      giveUpSeconds: 45,
      searchDeadlineAt: '2026-08-12T08:00:45Z',
    } as any);

    const { result } = renderRideProvider();
    await act(async () => {
      await result.current.createRide(pickup, destination, 'moto');
    });
    await waitFor(() => expect(result.current.currentRide).toEqual(expect.objectContaining({
      backendRideId: 'backend-ride-1',
      searchBudgetSeconds: 45,
      searchDeadlineAt: '2026-08-12T08:00:45Z',
    })));

    await emitCustomer('ride_cancelled', { reason: 'No drivers accepted your request' });

    // Status stays 'searching' so navigation keeps the customer on /searching,
    // where searchOutcome switches the screen into its Try-again state.
    expect(result.current.currentRide).toEqual(expect.objectContaining({
      status: 'searching',
      searchOutcome: 'no_drivers',
      searchFailureReason: 'No drivers accepted your request',
    }));
    expect(result.current.currentRide?.backendRideId).toBeUndefined();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  test('an explicit customer cancel still cancels instead of entering the failed state', async () => {
    mockAuthUser = { id: 'customer-1', mode: 'customer' };
    const { result } = renderRideProvider();
    await act(async () => {
      await result.current.createRide(pickup, destination, 'moto');
    });
    await waitFor(() => expect(result.current.currentRide?.backendRideId).toBe('backend-ride-1'));

    act(() => result.current.cancelRide());
    expect(result.current.currentRide?.status).toBe('cancelled');
    expect(result.current.currentRide?.searchOutcome).toBeUndefined();
  });

  // ── Active-ride reconciliation (Phase 0 read-idle backstop) ────────────────
  // The tracking sockets' read-idle watchdog forces a reconnect when a
  // connection goes silently dead (services/socketReadIdleWatchdog.ts), but
  // whatever the socket missed while it sat dead still needs to reach the
  // app — that's reconcileActiveRide's job. These tests exercise it directly
  // through its own triggers (the periodic backstop interval, and an inbound
  // reconcile-worthy push) rather than through a live socket death, which the
  // socket-service test suites already cover.

  test('backstop reconcile converges a stale local status forward to match the server', async () => {
    mockAuthUser = { id: 'customer-1', mode: 'customer' };
    const { result } = renderRideProvider();
    await createAndMatchRide(result);
    await emitCustomer('negotiation_message', { actor_role: 'DRIVER', amount: 3000 });
    await act(async () => {
      result.current.acceptDriverOffer();
    });
    expect(result.current.currentRide).toEqual(expect.objectContaining({
      status: 'confirmed',
      backendRideId: 'backend-ride-1',
    }));

    // The tracking socket has gone silently dead (the scenario the read-idle
    // watchdog exists to catch) and the driver_en_route WS event never
    // arrived locally — but the backend has already moved the ride on.
    mockGetActiveRide.mockResolvedValue(activeSnapshot({ id: 'backend-ride-1', status: 'DRIVER_EN_ROUTE' }));

    act(() => {
      jest.advanceTimersByTime(RIDE_RECONCILE_INTERVAL_MS);
    });
    await waitFor(() => expect(result.current.currentRide?.status).toBe('arriving'));
  });

  test('backstop reconcile never rolls a locally-advanced status backward', async () => {
    mockAuthDriverProfile = driverProfileFixture();
    mockGetActiveDriverRide.mockResolvedValue(activeSnapshot({ status: 'DRIVER_ARRIVED', driverArrivedAt: '2026-08-12T08:00:00Z' }));

    const { result } = renderRideProvider();
    await waitFor(() => expect(result.current.currentRide?.status).toBe('arrived'));

    // A stale/racy read reports a status BEHIND local — e.g. a read that
    // landed before the driver's own optimistic mark-arrived was durable.
    // Reconcile must never regress a legitimately-newer local state; see
    // RECONCILE_STATUS_ORDER's comment in RideProvider.tsx.
    mockGetActiveDriverRide.mockResolvedValue(activeSnapshot({ status: 'CONFIRMED' }));

    act(() => {
      jest.advanceTimersByTime(RIDE_RECONCILE_INTERVAL_MS);
    });
    await flushPromises();
    expect(result.current.currentRide?.status).toBe('arrived');
  });

  test('backstop reconcile dismisses the ride locally when the server no longer has it live', async () => {
    mockAuthDriverProfile = driverProfileFixture();
    mockGetActiveDriverRide.mockResolvedValue(activeSnapshot({ status: 'IN_PROGRESS' }));

    const { result } = renderRideProvider();
    await waitFor(() => expect(result.current.currentRide?.status).toBe('in_progress'));

    // The ride ended on the backend (completed/cancelled) while the socket
    // sat dead and never delivered the lifecycle event — GET /rides/active
    // (or its driver equivalent) no longer has it live at all.
    mockGetActiveDriverRide.mockResolvedValue(null);

    act(() => {
      jest.advanceTimersByTime(RIDE_RECONCILE_INTERVAL_MS);
    });
    await waitFor(() => expect(result.current.currentRide?.status).toBe('cancelled'));

    act(() => {
      jest.advanceTimersByTime(CANCELLED_RIDE_CLEAR_DELAY_MS);
    });
    expect(result.current.currentRide).toBeNull();
    expect(result.current.driverLocation).toBeNull();
    expect(result.current.customerLocation).toBeNull();
  });

  test('an inbound reconcile-worthy push triggers the same convergence as the backstop interval', async () => {
    mockAuthUser = { id: 'customer-1', mode: 'customer' };
    const { result } = renderRideProvider();
    await createAndMatchRide(result);
    await emitCustomer('negotiation_message', { actor_role: 'DRIVER', amount: 3000 });
    await act(async () => {
      result.current.acceptDriverOffer();
    });
    expect(result.current.currentRide?.status).toBe('confirmed');

    mockGetActiveRide.mockResolvedValue(activeSnapshot({ id: 'backend-ride-1', status: 'DRIVER_EN_ROUTE' }));

    // Simulates services/usePushNotifications.ts calling triggerRideReconcile()
    // on a RECONCILE-worthy push (e.g. driver_en_route) — RideProvider
    // registers its handler once on mount (state/rideReconcileTrigger.ts).
    act(() => {
      triggerRideReconcile();
    });
    await waitFor(() => expect(result.current.currentRide?.status).toBe('arriving'));
  });

  test('reconcile is a no-op while no ride is loaded locally', async () => {
    mockAuthUser = { id: 'customer-1', mode: 'customer' };
    renderRideProvider();
    await flushPromises();
    mockGetActiveRide.mockClear();

    act(() => {
      jest.advanceTimersByTime(RIDE_RECONCILE_INTERVAL_MS);
    });
    await flushPromises();

    // No backstop interval is even running until a ride with a backendRideId
    // is loaded — reconcileActiveRide's own early-return is a second layer
    // of defense on top of that.
    expect(mockGetActiveRide).not.toHaveBeenCalled();
  });
});
