import React, { useEffect, useMemo, useState } from 'react';
import { Animated, LayoutAnimation, Platform, StyleSheet, UIManager, View } from 'react-native';
import type { PanResponderInstance } from 'react-native';
import type { useColors } from '@/hooks/useColors';

export type BottomShellState = 'home' | 'booking' | 'closingBooking';

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
    LayoutAnimation?.configureNext?.(LayoutAnimation?.Presets?.easeInEaseOut);
    setShellHeight(targetHeight);
  }, [shellHeight, targetHeight]);

  const bookingVisible = state !== 'home';
  const homeVisible = state === 'home';

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
      {...(bookingVisible ? panResponder?.panHandlers : undefined)}
    >
      <View style={styles.surface}>
        <View pointerEvents={homeVisible ? 'auto' : 'none'} style={[styles.layer, { opacity: homeVisible ? 1 : 0 }]}>
          {homeContent}
        </View>

        <View pointerEvents={bookingVisible ? 'auto' : 'none'} style={[styles.layer, { opacity: bookingVisible ? 1 : 0 }]}>
          {bookingContent}
        </View>

        {bookingVisible ? (
          <View style={styles.bookingHandle} testID="booking-shell-handle" pointerEvents="none">
            <View style={styles.sheetHandle} />
          </View>
        ) : null}
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
  bookingHandle: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#3A3A3A' },
  layer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
});
