import { useCallback, useEffect, useRef } from 'react';
import { Animated, Keyboard, Platform } from 'react-native';
import {
  computeOverlayFormKeyboardLift,
  computeOverlayFormKeyboardLiftFromFrame,
  SCREEN_HEIGHT,
} from '@/components/home/homeUtils';

export function useKeyboardHandling({
  enabled,
  bottomInset,
  animation,
}: {
  enabled: boolean;
  bottomInset: number;
  animation: Animated.Value;
}) {
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const applyLift = useCallback((lift: number, duration = 220) => {
    if (!enabledRef.current) return;
    Animated.timing(animation, {
      toValue: Math.max(0, lift),
      duration,
      useNativeDriver: true,
    }).start();
  }, [animation]);

  useEffect(() => {
    if (!enabled) {
      animation.setValue(0);
      return;
    }
    if (Platform.OS === 'ios') {
      const subscription = Keyboard.addListener('keyboardWillChangeFrame', event => {
        applyLift(
          computeOverlayFormKeyboardLiftFromFrame(SCREEN_HEIGHT, event.endCoordinates.screenY, bottomInset),
          event.duration ?? 250,
        );
      });
      return () => subscription.remove();
    }
    const showSubscription = Keyboard.addListener('keyboardDidShow', event => {
      applyLift(computeOverlayFormKeyboardLift(event.endCoordinates.height, bottomInset), event.duration ?? 220);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', event => {
      applyLift(0, event.duration ?? 180);
    });
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [animation, applyLift, bottomInset, enabled]);

  return {
    applyLift,
    estimatedKeyboardOffset: Math.max(240, Math.min(SCREEN_HEIGHT * 0.34, 340)),
  };
}
