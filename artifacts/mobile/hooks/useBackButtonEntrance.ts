import { useCallback, useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

const ENTRANCE_DURATION_MS = 380;
const EXIT_DURATION_MS = 160;

/**
 * Back affordance: chevron slides in from the left on appear, nudges left on dismiss.
 * Pairs semantically with CloseButton spin (exit) vs back (return).
 */
export function useBackButtonEntrance(autoPlayOnMount = true) {
  const progress = useRef(new Animated.Value(autoPlayOnMount ? 0 : 1)).current;

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-14, 0],
  });

  const opacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1],
  });

  const playEntrance = useCallback(() => {
    progress.stopAnimation(() => {
      progress.setValue(0);
      Animated.timing(progress, {
        toValue: 1,
        duration: ENTRANCE_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  }, [progress]);

  const playExit = useCallback(
    (onComplete?: () => void) => {
      progress.stopAnimation();
      Animated.timing(progress, {
        toValue: 0,
        duration: EXIT_DURATION_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          onComplete?.();
        }
      });
    },
    [progress],
  );

  useEffect(() => {
    if (autoPlayOnMount) {
      playEntrance();
    }
  }, [autoPlayOnMount, playEntrance]);

  return { translateX, opacity, scale, playEntrance, playExit };
}
