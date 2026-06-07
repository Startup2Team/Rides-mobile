import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, PanResponder, type LayoutChangeEvent } from 'react-native';
import type { CloseButtonHandle } from '@/components/BackButton';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type Params = {
  locationId: string;
  onClose: () => void;
  keyboardOpenRef: React.MutableRefObject<boolean>;
  dismissKeyboard: () => void;
  resetKeyboard: () => void;
  resetForEntrance: () => void;
  keyboardLiftAnim: Animated.Value;
};

export function useEditSavedLocationSheetAnimation({
  locationId,
  onClose,
  keyboardOpenRef,
  dismissKeyboard,
  resetKeyboard,
  resetForEntrance,
  keyboardLiftAnim,
}: Params) {
  const [measuredHeight, setMeasuredHeight] = useState(280);
  const closeRef = useRef<CloseButtonHandle>(null);
  const closeSheetRef = useRef<() => void>(() => {});
  const dragAnim = useRef(new Animated.Value(0)).current;
  const dragStart = useRef(0);
  const sheetHeightRef = useRef(280);

  const backdropOpacity = useMemo(
    () =>
      dragAnim.interpolate({
        inputRange: [0, Math.max(measuredHeight, 1)],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      }),
    [dragAnim, measuredHeight],
  );

  const closeSheet = useCallback(() => {
    resetKeyboard();
    onClose();
  }, [onClose, resetKeyboard]);

  closeSheetRef.current = closeSheet;

  const updateCloseSpinForDrag = useCallback((offset: number) => {
    const max = sheetHeightRef.current;
    if (max <= 0) return;
    closeRef.current?.setSpinProgress(1 - Math.min(1, offset / max));
  }, []);

  const snapOpen = useCallback(() => {
    closeRef.current?.spinOpen();
    Animated.spring(dragAnim, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 4,
      speed: 18,
    }).start();
  }, [dragAnim]);

  const dismissAnimated = useCallback(
    (onAnimateStart?: () => void, releaseVelocity = 0) => {
      onAnimateStart?.();
      const max = sheetHeightRef.current;
      Animated.spring(dragAnim, {
        toValue: max,
        velocity: Math.max(releaseVelocity, 0),
        useNativeDriver: true,
        bounciness: 0,
        speed: 22,
      }).start(() => closeSheetRef.current());
    },
    [dragAnim],
  );

  const dismissSheet = useCallback(
    () => dismissAnimated(() => closeRef.current?.spinShut()),
    [dismissAnimated],
  );

  const shouldBeginSheetDrag = useCallback(
    (gestureDy: number, gestureDx: number) =>
      gestureDy > 4 && gestureDy > Math.abs(gestureDx),
    [],
  );

  /** Sheet dismiss drag - handle/header only; never on the suggestions list. */
  const chromePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) => {
          if (!shouldBeginSheetDrag(gesture.dy, gesture.dx)) return false;
          return true;
        },
        onMoveShouldSetPanResponderCapture: () => false,
        onPanResponderGrant: () => {
          if (keyboardOpenRef.current) {
            dismissKeyboard();
            return;
          }
          dragAnim.stopAnimation(value => {
            dragStart.current = value;
          });
        },
        onPanResponderMove: (_, gesture) => {
          if (keyboardOpenRef.current) return;
          const max = sheetHeightRef.current;
          const next = Math.max(0, Math.min(max, dragStart.current + gesture.dy));
          dragAnim.setValue(next);
          updateCloseSpinForDrag(next);
        },
        onPanResponderRelease: (_, gesture) => {
          if (keyboardOpenRef.current) return;
          const max = sheetHeightRef.current;
          const current = Math.max(0, Math.min(max, dragStart.current + gesture.dy));
          const shouldClose = current > max * 0.28 || gesture.vy > 0.65;
          if (shouldClose) {
            dismissAnimated(() => closeRef.current?.spinShut(), gesture.vy);
          } else if (Math.abs(gesture.dy) > 8) {
            snapOpen();
          } else {
            closeRef.current?.setSpinProgress(1);
          }
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [
      dismissAnimated,
      dismissKeyboard,
      dragAnim,
      keyboardOpenRef,
      shouldBeginSheetDrag,
      snapOpen,
      updateCloseSpinForDrag,
    ],
  );

  useEffect(() => {
    resetForEntrance();
    const enterFrom = Math.min(sheetHeightRef.current, SCREEN_HEIGHT * 0.45);
    dragAnim.setValue(enterFrom);
    closeRef.current?.setSpinProgress(0);
    Animated.spring(dragAnim, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 5,
      speed: 16,
    }).start(() => {
      closeRef.current?.spinOpen();
    });
  }, [dragAnim, locationId, resetForEntrance]);

  const onSheetLayout = useCallback((event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    sheetHeightRef.current = height;
    setMeasuredHeight(height);
  }, []);

  const translateY = useMemo(
    () => Animated.add(dragAnim, Animated.multiply(keyboardLiftAnim, -1)),
    [dragAnim, keyboardLiftAnim],
  );

  return {
    closeRef,
    backdropOpacity,
    chromePanResponder,
    dismissSheet,
    onSheetLayout,
    translateY,
  };
}
