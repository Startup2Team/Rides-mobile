import { useEffect, useRef, useState } from 'react';
import { Coords } from '@/types';

interface UseDriverTrackingOptions {
  enabled: boolean;
  /** The driver's REAL location (fed by the WebSocket `driver_location` event). */
  target: Coords | null;
  /** Number of frames to ease across between target updates. Default 24. */
  stepCount?: number;
  /** Milliseconds between easing frames. Default 60ms (~smooth). */
  intervalMs?: number;
}

/**
 * Smoothly eases the rendered driver marker toward the latest REAL driver
 * location, so it glides between WebSocket updates instead of snapping. This
 * replaces the previous implementation, which *simulated* a driver walking
 * along the route polyline regardless of the driver's actual position.
 *
 * A stationary driver simply stays put — no fabricated movement.
 */
export function useDriverTracking({
  enabled,
  target,
  stepCount = 24,
  intervalMs = 60,
}: UseDriverTrackingOptions): Coords | null {
  const [coords, setCoords] = useState<Coords | null>(target);
  const fromRef = useRef<Coords | null>(target);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled || !target) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const from = fromRef.current ?? target;
    let step = 0;
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      step += 1;
      const t = Math.min(1, step / Math.max(1, stepCount));
      const next: Coords = {
        latitude: from.latitude + (target.latitude - from.latitude) * t,
        longitude: from.longitude + (target.longitude - from.longitude) * t,
      };
      setCoords(next);
      fromRef.current = next;
      if (t >= 1 && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, intervalMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, target?.latitude, target?.longitude, stepCount, intervalMs]);

  return coords;
}
