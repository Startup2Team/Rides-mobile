import { useEffect } from 'react';
import {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const APPEAR_DURATION_MS = 220;
const INITIAL_OPACITY = 0;
const INITIAL_SCALE = 0.85;

/**
 * Fade + scale-in entrance for map markers (the "you're here" location dot,
 * pickup/destination pins) so they appear smoothly on mount instead of
 * popping/glitching in. Runs once per mount, UI-thread only.
 *
 * Honors the OS reduced-motion setting: markers render at their final state
 * immediately, no animation.
 */
export function useMarkerAppear() {
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(reducedMotion ? 1 : INITIAL_OPACITY);
  const scale = useSharedValue(reducedMotion ? 1 : INITIAL_SCALE);

  useEffect(() => {
    if (reducedMotion) return;
    const easing = Easing.out(Easing.quad);
    opacity.value = withTiming(1, { duration: APPEAR_DURATION_MS, easing });
    scale.value = withTiming(1, { duration: APPEAR_DURATION_MS, easing });
    // Entrance plays once on mount — re-running on every render would replay
    // the pop-in every time a parent re-renders the marker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
}
