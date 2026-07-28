import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import type { Coords } from '@/types';

/**
 * Live device GPS via expo-location. Returns the latest real fix, or null until
 * the first one arrives (or permission is denied). This is REAL location only —
 * it replaces the old route-stepping simulation so the driver's marker reflects
 * where they actually are, never a fake animation along the route.
 */
export function useDeviceLocation(enabled: boolean, intervalMs = 4000): Coords | null {
  const [coords, setCoords] = useState<Coords | null>(null);
  const subRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (!enabled) {
      subRef.current?.remove();
      subRef.current = null;
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || cancelled) return;
        // Seed immediately so the marker doesn't wait a full interval for the
        // first watch callback.
        const first = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (!cancelled) setCoords({ latitude: first.coords.latitude, longitude: first.coords.longitude });
        subRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: intervalMs, distanceInterval: 5 },
          loc => setCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude }),
        );
      } catch {
        // Location unavailable (e.g. permission revoked mid-session) — keep the
        // last known fix; callers fall back to their own default.
      }
    })();
    return () => {
      cancelled = true;
      subRef.current?.remove();
      subRef.current = null;
    };
  }, [enabled, intervalMs]);

  return coords;
}
