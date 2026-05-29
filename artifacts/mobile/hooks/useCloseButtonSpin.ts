import { useCallback, useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

const OPEN_DURATION_MS = 420;
const SHUT_DURATION_MS = 360;

/**
 * One full clockwise spin on open (left → right), reverse on shut (right → left).
 */
export function useCloseButtonSpin(autoOpenOnMount = true) {
  const spin = useRef(new Animated.Value(0)).current;

  const rotation = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const spinOpen = useCallback(() => {
    spin.stopAnimation(() => {
      Animated.timing(spin, {
        toValue: 1,
        duration: OPEN_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  }, [spin]);

  const spinShut = useCallback(() => {
    spin.stopAnimation();
    Animated.timing(spin, {
      toValue: 0,
      duration: SHUT_DURATION_MS,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [spin]);

  /** 1 = fully open (360°), 0 = shut — follows sheet drag without starting a timed animation. */
  const setSpinProgress = useCallback(
    (progress: number) => {
      spin.stopAnimation();
      spin.setValue(Math.max(0, Math.min(1, progress)));
    },
    [spin],
  );

  useEffect(() => {
    if (autoOpenOnMount) {
      spin.setValue(0);
      spinOpen();
    }
  }, [autoOpenOnMount, spin, spinOpen]);

  return { rotation, spinOpen, spinShut, setSpinProgress };
}
