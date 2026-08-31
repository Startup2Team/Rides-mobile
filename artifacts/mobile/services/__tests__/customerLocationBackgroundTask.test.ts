import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { BackendError, ConflictError, OfflineError } from '@/data/remote/contracts/backendErrors';
import { STORAGE_KEYS } from '@/constants/storage';
import { saveVersionedStorage } from '@/persistence/versionedStorage';

const mockUpdateCustomerLocation = jest.fn();

jest.mock('../customerLocation', () => {
  const actual = jest.requireActual('../customerLocation');
  return {
    ...actual,
    updateCustomerLocation: (...args: unknown[]) => mockUpdateCustomerLocation(...args),
  };
});

// Imported after the mock above so the module picks up the mocked
// updateCustomerLocation when it registers the task at load time.
import {
  getTrackedCustomerLocationBackgroundRideId,
  CUSTOMER_LOCATION_BACKGROUND_TASK,
} from '../customerLocationBackgroundTask';

// Captured once, right after the module-under-test registers it at import
// time (TaskManager.defineTask runs unconditionally at module load) — must
// not be re-derived from `.mock.calls` inside a test, since `beforeEach`
// below clears every jest.fn()'s call history.
const registeredTaskCallback = (() => {
  const calls = (TaskManager.defineTask as jest.Mock).mock.calls;
  const call = calls.find(([name]) => name === CUSTOMER_LOCATION_BACKGROUND_TASK);
  if (!call) throw new Error('customer-live-location-task was never registered');
  return call[1] as (input: { data?: unknown; error?: unknown }) => Promise<void>;
})();

function fixDelivery(
  overrides: Partial<{ latitude: number; longitude: number; heading: number | null; speed: number | null }> = {},
) {
  return {
    data: {
      locations: [
        {
          coords: {
            latitude: overrides.latitude ?? -1.95,
            longitude: overrides.longitude ?? 30.05,
            heading: overrides.heading ?? null,
            speed: overrides.speed ?? null,
          },
        },
      ],
    },
    error: null,
  };
}

describe('customer-live-location background task', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await require('@react-native-async-storage/async-storage').clear();
    (Location.hasStartedLocationUpdatesAsync as jest.Mock).mockResolvedValue(true);
    (Location.stopLocationUpdatesAsync as jest.Mock).mockResolvedValue(undefined);
  });

  test('getTrackedCustomerLocationBackgroundRideId reads back what was persisted', async () => {
    await expect(getTrackedCustomerLocationBackgroundRideId()).resolves.toBeNull();

    await saveVersionedStorage(STORAGE_KEYS.customerLocationBackgroundRideId, 'ride-orphan-1');

    await expect(getTrackedCustomerLocationBackgroundRideId()).resolves.toBe('ride-orphan-1');
  });

  test('self-stops native updates and clears the persisted ride id on a terminal 409 (RIDE_NOT_ACTIVE)', async () => {
    await saveVersionedStorage(STORAGE_KEYS.customerLocationBackgroundRideId, 'ride-orphan-1');
    mockUpdateCustomerLocation.mockRejectedValue(new ConflictError({ status: 409 }));

    await registeredTaskCallback(fixDelivery());

    expect(Location.stopLocationUpdatesAsync).toHaveBeenCalledWith(CUSTOMER_LOCATION_BACKGROUND_TASK);
    await expect(getTrackedCustomerLocationBackgroundRideId()).resolves.toBeNull();
  });

  test('self-stops on a terminal 404 (unknown/expired ride) too', async () => {
    await saveVersionedStorage(STORAGE_KEYS.customerLocationBackgroundRideId, 'ride-orphan-2');
    // A 404 falls through httpBackendTransport's mapStatusError default branch
    // (no dedicated NotFoundError class exists) but still carries status: 404
    // — isTerminalCustomerLocationError keys off the status, not the class.
    mockUpdateCustomerLocation.mockRejectedValue(new BackendError('backend_unavailable', 'Not found', { status: 404 }));

    await registeredTaskCallback(fixDelivery());

    expect(Location.stopLocationUpdatesAsync).toHaveBeenCalledWith(CUSTOMER_LOCATION_BACKGROUND_TASK);
    await expect(getTrackedCustomerLocationBackgroundRideId()).resolves.toBeNull();
  });

  test('does NOT self-stop on a transient error (offline) — keeps streaming for the next fix', async () => {
    await saveVersionedStorage(STORAGE_KEYS.customerLocationBackgroundRideId, 'ride-live-1');
    mockUpdateCustomerLocation.mockRejectedValue(new OfflineError());

    await registeredTaskCallback(fixDelivery());

    expect(Location.stopLocationUpdatesAsync).not.toHaveBeenCalled();
    await expect(getTrackedCustomerLocationBackgroundRideId()).resolves.toBe('ride-live-1');
  });

  test('does nothing when no ride id is currently tracked (task delivered after a stop)', async () => {
    await registeredTaskCallback(fixDelivery());

    expect(mockUpdateCustomerLocation).not.toHaveBeenCalled();
    expect(Location.stopLocationUpdatesAsync).not.toHaveBeenCalled();
  });

  // Regression: expo-location reports heading/speed as -1 (a number, not null)
  // when unknown. Forwarding -1 made the backend 400 the whole update (gte=0),
  // silently dropping the rider's live position. They must be omitted, not sent.
  test('omits heading and speed when the device reports -1 (unknown) so the update is not rejected', async () => {
    await saveVersionedStorage(STORAGE_KEYS.customerLocationBackgroundRideId, 'ride-live-unknown-course');
    mockUpdateCustomerLocation.mockResolvedValue(undefined);

    await registeredTaskCallback(fixDelivery({ heading: -1, speed: -1 }));

    expect(mockUpdateCustomerLocation).toHaveBeenCalledWith('ride-live-unknown-course', {
      lat: -1.95,
      lng: 30.05,
      heading: undefined,
      speed: undefined,
    });
  });
});
