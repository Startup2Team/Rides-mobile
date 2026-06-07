import type { LocationObject } from 'expo-location';

export const GOOD_HOME_LOCATION_ACCURACY_METERS = 40;
export const HOME_LOCATION_MAX_ATTEMPTS = 3;
export const HOME_LOCATION_ATTEMPT_TIMEOUT_MS = 5_000;

type Options = {
  getCurrentPosition: () => Promise<LocationObject | null>;
  isActive: () => boolean;
  goodAccuracyMeters?: number;
  maxAttempts?: number;
  attemptTimeoutMs?: number;
};

type LocationSubscription = {
  remove: () => void;
};

export async function startHomeLocationWatch({
  isActive,
  onLocation,
  watchPosition,
}: {
  isActive: () => boolean;
  onLocation: (location: LocationObject) => void;
  watchPosition: (
    callback: (location: LocationObject) => void,
  ) => Promise<LocationSubscription>;
}): Promise<() => void> {
  let active = true;
  const subscription = await watchPosition(location => {
    if (active && isActive()) onLocation(location);
  });

  if (!active || !isActive()) {
    active = false;
    subscription.remove();
  }

  return () => {
    if (!active) return;
    active = false;
    subscription.remove();
  };
}

export async function requestHomeLocationPermission({
  getPermission,
  requestPermission,
}: {
  getPermission: () => Promise<{ granted: boolean; canAskAgain: boolean }>;
  requestPermission: () => Promise<{ granted: boolean }>;
}): Promise<boolean> {
  const permission = await getPermission();
  if (permission.granted) return true;
  if (!permission.canAskAgain) return false;
  return (await requestPermission()).granted;
}

function accuracyRank(location: LocationObject): number {
  const accuracy = location.coords.accuracy;
  return typeof accuracy === 'number' && Number.isFinite(accuracy)
    ? accuracy
    : Number.POSITIVE_INFINITY;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Current location attempt timed out')), timeoutMs);
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function acquireBestHomeLocation({
  getCurrentPosition,
  isActive,
  goodAccuracyMeters = GOOD_HOME_LOCATION_ACCURACY_METERS,
  maxAttempts = HOME_LOCATION_MAX_ATTEMPTS,
  attemptTimeoutMs = HOME_LOCATION_ATTEMPT_TIMEOUT_MS,
}: Options): Promise<LocationObject | null> {
  let bestLocation: LocationObject | null = null;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (!isActive()) return null;

    try {
      const location = await withTimeout(getCurrentPosition(), attemptTimeoutMs);
      if (!isActive()) return null;
      if (!location) {
        lastError = new Error('Current location returned no result');
        continue;
      }

      if (!bestLocation || accuracyRank(location) < accuracyRank(bestLocation)) {
        bestLocation = location;
      }
      if (accuracyRank(location) <= goodAccuracyMeters) {
        return location;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (!isActive()) return null;
  if (bestLocation) return bestLocation;
  throw lastError ?? new Error('Unable to acquire current location');
}
