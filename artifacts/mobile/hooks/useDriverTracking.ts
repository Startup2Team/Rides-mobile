import { useEffect, useRef, useState } from 'react';
import { Coords } from '@/types';

interface UseDriverTrackingOptions {
  enabled: boolean;
  routeCoordinates: Coords[];
  /** How many ms between each position update. Default 1500 */
  intervalMs?: number;
  /** Number of visible steps to use across the route. Default 24 */
  stepCount?: number;
}

/**
 * Simulates a driver moving along the route polyline step by step.
 * In production replace the interval with a WebSocket message handler:
 *
 *   ws.onmessage = (e) => setDriverCoords(JSON.parse(e.data));
 */
export function useDriverTracking({
  enabled,
  routeCoordinates,
  intervalMs = 1500,
  stepCount = 24,
}: UseDriverTrackingOptions): Coords | null {
  const [driverCoords, setDriverCoords] = useState<Coords | null>(null);
  const stepRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled || routeCoordinates.length === 0) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    stepRef.current = 0;
    setDriverCoords(routeCoordinates[0]);
    const stepSize = Math.max(1, Math.ceil(routeCoordinates.length / stepCount));

    intervalRef.current = setInterval(() => {
      stepRef.current = Math.min(stepRef.current + stepSize, routeCoordinates.length - 1);
      setDriverCoords(routeCoordinates[stepRef.current]);

      if (stepRef.current >= routeCoordinates.length - 1) {
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    }, intervalMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, routeCoordinates, intervalMs, stepCount]);

  return driverCoords;
}
