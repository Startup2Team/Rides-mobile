import React, { useEffect, useMemo, useState } from 'react';
import { Animated, LayoutAnimation, Platform, StyleSheet, UIManager, View } from 'react-native';
import type { PanResponderInstance } from 'react-native';
import type { useColors } from '@/hooks/useColors';
import { assertBottomShellLayerVisibility, assertBottomShellState } from './bottomShellState';

export type BottomShellState = 'home' | 'booking' | 'closingBooking';
const CLOSE_FADE_START_RATIO = 0.18;

/**
 * Returns the point (in px) at which the home layer starts fading in during
 * a swipe-down close. Guaranteed to be strictly less than targetHeight so that
 * Animated.interpolate never receives a duplicate input range value.
 */
function closeFadeStart(targetHeight: number): number {
  const raw = Math.max(1, Math.round(targetHeight * CLOSE_FADE_START_RATIO));
  return Math.min(raw, Math.max(0, targetHeight - 1));
}

export function resolveBottomShellHeight(
  state: BottomShellState,
  homeHeight: number,
  bookingHeight: number,
) {
  const nextHeight = state === 'home' ? homeHeight : bookingHeight;
  return Math.max(1, Math.round(nextHeight || 0));
}

export function resolveBottomShellTranslateY(
  state: BottomShellState,
  translateY: Animated.Value | number,
) {
  return state === 'home' ? 0 : translateY;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function resolveBottomShellLayerOpacity(
  state: BottomShellState,
  layer: 'home' | 'booking',
  translateY: Animated.Value | number,
  bookingHeight: number,
) {
  if (state === 'home') {
    return layer === 'home' ? 1 : 0;
  }

  if (state === 'booking') {
    return layer === 'booking' ? 1 : 0;
  }

  const targetHeight = Math.max(1, bookingHeight || 0);
  const fadeStart = closeFadeStart(targetHeight);
  const fadeStartRatio = fadeStart / targetHeight;

  if (typeof translateY === 'number') {
    const progress = clamp01(translateY / targetHeight);
    if (layer === 'home') {
      if (fadeStartRatio >= 1) return progress >= 1 ? 1 : 0;
      return clamp01((progress - fadeStartRatio) / Math.max(0.001, 1 - fadeStartRatio));
    }
    return clamp01(1 - progress);
  }

  if (layer === 'home') {
    // When targetHeight is so small that no crossfade range exists, use a 2-point range.
    if (fadeStart >= targetHeight) {
      return translateY.interpolate({
        inputRange: [0, targetHeight],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      });
    }
    return translateY.interpolate({
      inputRange: [0, fadeStart, targetHeight],
      outputRange: [0, 0, 1],
      extrapolate: 'clamp',
    });
  }

  return translateY.interpolate({
    inputRange: [0, targetHeight],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
}

export function BottomShell({
  state,
  homeHeight,
  bookingHeight,
  translateY = 0,
  panResponder,
  homeContent,
  bookingContent,
  colors,
}: {
  state: BottomShellState;
  homeHeight: number;
  bookingHeight: number;
  translateY?: Animated.Value | number;
  panResponder?: PanResponderInstance;
  homeContent: React.ReactNode;
  bookingContent: React.ReactNode;
  colors: ReturnType<typeof useColors>;
}) {
  const [shellHeight, setShellHeight] = useState(() => resolveBottomShellHeight(state, homeHeight, bookingHeight));

  const targetHeight = useMemo(
    () => resolveBottomShellHeight(state, homeHeight, bookingHeight),
    [bookingHeight, homeHeight, state],
  );

  useEffect(() => {
    if (Platform?.OS === 'android' && UIManager?.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    if (targetHeight === shellHeight) return;
    // Keep a stable measured height while the native-driven close slide runs.
    if (state === 'closingBooking') return;
    LayoutAnimation?.configureNext?.(LayoutAnimation?.Presets?.easeInEaseOut);
    setShellHeight(targetHeight);
  }, [shellHeight, state, targetHeight]);

  const homeInteractive = state === 'home';
  const bookingInteractive = state === 'booking';
  const homeOpacity = resolveBottomShellLayerOpacity(state, 'home', translateY, bookingHeight);
  const bookingOpacity = resolveBottomShellLayerOpacity(state, 'booking', translateY, bookingHeight);

  useEffect(() => {
    assertBottomShellState(state);
    assertBottomShellLayerVisibility(state, homeInteractive, bookingInteractive);
  }, [bookingInteractive, homeInteractive, state]);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.shell,
        {
          height: shellHeight,
          backgroundColor: colors.card,
          borderColor: colors.border,
          transform: [{ translateY: resolveBottomShellTranslateY(state, translateY) }],
        },
      ]}
      {...(bookingInteractive ? panResponder?.panHandlers : undefined)}
    >
      <View style={styles.surface}>
        <Animated.View pointerEvents={homeInteractive ? 'auto' : 'none'} style={[styles.layer, { opacity: homeOpacity }]}>
          {homeContent}
        </Animated.View>

        <Animated.View
          pointerEvents={bookingInteractive ? 'auto' : 'none'}
          style={[styles.layer, { opacity: bookingOpacity }]}
        >
          {bookingContent}
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  surface: {
    flex: 1,
    overflow: 'hidden',
  },
  layer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
});
