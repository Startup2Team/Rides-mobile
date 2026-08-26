import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { STORAGE_KEYS } from '@/constants/storage';
import { reportOperationalFailure } from '@/observability/monitoring';
import { customerLocationBackgroundRideIdSchema } from '@/persistence/storageSchemas';
import {
  loadVersionedStorage,
  removeVersionedStorage,
  saveVersionedStorage,
} from '@/persistence/versionedStorage';
import { isTerminalCustomerLocationError, updateCustomerLocation } from './customerLocation';

// Background customer live-location streaming — the "app is backgrounded
// during an active ride" half of the feature. Deliberately separate from the
// foreground publish effect in RideProvider (which keeps working on its own):
// this module only adds a supplementary channel for when that JS interval
// can't run, and can be reverted on its own (App Store review implications of
// background location are real; the foreground streaming has none).
//
// Mirrors CUSTOMER_LOCATION_PUBLISH_INTERVAL_MS (context/ride/rideConstants.ts)
// — kept as a literal here rather than imported so this services module never
// depends on the context/ride layer (services sit below it).
const BACKGROUND_LOCATION_INTERVAL_MS = 10_000;
const BACKGROUND_LOCATION_DISTANCE_METERS = 25;

export const CUSTOMER_LOCATION_BACKGROUND_TASK = 'customer-live-location-task';

interface BackgroundLocationTaskData {
  locations?: Array<{
    coords: {
      latitude: number;
      longitude: number;
      heading: number | null;
      speed: number | null;
    };
  }>;
}

// The ride the task is currently streaming for. Written by
// startCustomerLocationBackgroundUpdates / cleared by
// stopCustomerLocationBackgroundUpdates — read here because the task can run
// headless (the OS may relaunch the app purely to deliver a fix, with no
// RideProvider ever mounted), so it cannot come from React state.
async function loadTrackedRideId(): Promise<string | null> {
  const stored = await loadVersionedStorage(
    STORAGE_KEYS.customerLocationBackgroundRideId,
    customerLocationBackgroundRideIdSchema,
  );
  return stored.data;
}

/**
 * Public read of the ride id the background task is (or was last) tracking,
 * if any. Used by RideProvider's bootstrap/resume hydration to detect an
 * orphaned task after a force-kill: the native task survives app
 * termination, so a cold start with this key set but no matching active ride
 * means the task is still running for a ride that's already over — the
 * caller should stopCustomerLocationBackgroundUpdates() in that case.
 */
export async function getTrackedCustomerLocationBackgroundRideId(): Promise<string | null> {
  return loadTrackedRideId();
}

// MUST run unconditionally at module load, before any ride exists — imported
// once from app/_layout.tsx so the task is registered from cold start. A task
// name that isn't already defined when the OS tries to deliver to it is
// silently dropped.
TaskManager.defineTask(CUSTOMER_LOCATION_BACKGROUND_TASK, async ({ data, error }: any) => {
  if (error) {
    reportOperationalFailure('ride.customerLocation.backgroundTask', error);
    return;
  }
  const locations = (data as BackgroundLocationTaskData | undefined)?.locations;
  const latest = locations?.[locations.length - 1];
  if (!latest) return;

  const rideId = await loadTrackedRideId().catch(() => null);
  if (!rideId) return;

  try {
    // expo-location reports speed in metres/second; the backend field is
    // speed_kmh (see services/customerLocation.ts).
    const speedMps = latest.coords.speed;
    await updateCustomerLocation(rideId, {
      lat: latest.coords.latitude,
      lng: latest.coords.longitude,
      heading: latest.coords.heading ?? undefined,
      speed: speedMps != null && speedMps >= 0 ? speedMps * 3.6 : undefined,
    });
  } catch (error) {
    // A definitive 404/409 means the ride is over on the backend and will
    // never accept another update — self-stop instead of running this native
    // task (and its persistent "sharing your location" notification)
    // indefinitely. Anything else (offline, rate limit, 5xx) is transient —
    // ignore and retry on the next delivered fix.
    if (isTerminalCustomerLocationError(error)) {
      await stopCustomerLocationBackgroundUpdates();
    }
  }
});

/**
 * Upgrades to the "Always" location permission and starts native background
 * updates for `rideId`, so the customer's position keeps streaming while the
 * app is backgrounded. Returns whether background updates actually started.
 *
 * Graceful degradation is the point, not an edge case: this never throws, and
 * a `false` return (foreground permission missing, Always denied, native
 * start failure) just means the ride relies on the foreground-only interval
 * in RideProvider — never a broken ride.
 */
export async function startCustomerLocationBackgroundUpdates(rideId: string): Promise<boolean> {
  try {
    // The OS requires "When In Use" before it will even show the "Always"
    // upgrade dialog — this should already be granted by RideProvider's own
    // foreground publish effect by the time a ride is active.
    const foreground = await Location.getForegroundPermissionsAsync();
    if (foreground.status !== 'granted') return false;

    let background = await Location.getBackgroundPermissionsAsync();
    if (background.status !== 'granted' && background.canAskAgain) {
      background = await Location.requestBackgroundPermissionsAsync();
    }
    if (background.status !== 'granted') return false;

    await saveVersionedStorage(STORAGE_KEYS.customerLocationBackgroundRideId, rideId);

    const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(CUSTOMER_LOCATION_BACKGROUND_TASK);
    if (alreadyStarted) return true;

    await Location.startLocationUpdatesAsync(CUSTOMER_LOCATION_BACKGROUND_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: BACKGROUND_LOCATION_INTERVAL_MS,
      distanceInterval: BACKGROUND_LOCATION_DISTANCE_METERS,
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: false,
      foregroundService: {
        notificationTitle: 'Rides',
        notificationBody: 'Sharing your live location with your driver',
      },
    });
    return true;
  } catch (error) {
    reportOperationalFailure('ride.customerLocation.backgroundStart', error, { rideId });
    return false;
  }
}

/** Stops native background updates and clears the tracked ride id. Safe to call even when updates were never started. */
export async function stopCustomerLocationBackgroundUpdates(): Promise<void> {
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(CUSTOMER_LOCATION_BACKGROUND_TASK);
    if (started) await Location.stopLocationUpdatesAsync(CUSTOMER_LOCATION_BACKGROUND_TASK);
  } catch (error) {
    reportOperationalFailure('ride.customerLocation.backgroundStop', error);
  } finally {
    await removeVersionedStorage(STORAGE_KEYS.customerLocationBackgroundRideId).catch(() => {});
  }
}
