/**
 * CustomerBottomSheet — V2 card-stack bottom sheet.
 *
 * Architecture:
 *  - One Animated.Value (slideAnim) drives translateY during the booking-close
 *    swipe. It is never used for opacity.
 *  - One PanResponder owns the gesture. It activates only when
 *    activeCard === 'booking'.
 *  - Exactly one card is rendered at a time (CardStack). No overlapping layers.
 *  - Height is content-driven: onLayout on the inner content View reports the
 *    current card's natural height to the parent via onSheetHeightChange.
 *
 * Polish (pre-launch):
 *  - BookingCard entrance: slides up 28 px + fades in, 180/160 ms ease-out.
 *  - Close animation: ease-in-cubic (accelerates away) at 180 ms — natural.
 *  - Termination: returns true so the system can reclaim the gesture; snaps
 *    the sheet back to open if terminated mid-drag.
 */
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  PanResponder,
  StyleSheet,
  View,
} from 'react-native';
import type { useColors } from '@/hooks/useColors';
import { BookingCard, type BookingCardData } from './BookingCard';
import { HomeCard, type HomeCardData } from './HomeCard';

export type { HomeCardData, BookingCardData };

const DISMISS_THRESHOLD_RATIO = 0.28;
const DISMISS_VELOCITY = 0.65;
const DISMISS_DURATION_MS = 180;

const ENTRANCE_TRANSLATE_Y = 28;
const ENTRANCE_SLIDE_MS = 180;
const ENTRANCE_OPACITY_MS = 160;

type Props = {
  activeCard: 'home' | 'booking';
  onCloseBooking: () => void;
  onSheetHeightChange?: (height: number) => void;
  homeCard: HomeCardData;
  bookingCard: BookingCardData;
  colors: ReturnType<typeof useColors>;
  bottomPadding: number;
};

export function CustomerBottomSheet({
  activeCard,
  onCloseBooking,
  onSheetHeightChange,
  homeCard,
  bookingCard,
  colors,
  bottomPadding,
}: Props) {
  // ── Animated values ──────────────────────────────────────────────────────
  const slideAnim = useRef(new Animated.Value(0)).current;
  // Entrance animation for BookingCard — reset before each entry.
  const enterSlide = useRef(new Animated.Value(ENTRANCE_TRANSLATE_Y)).current;
  const enterOpacity = useRef(new Animated.Value(0)).current;

  const isAnimatingClose = useRef(false);

  // ── Stable refs for PanResponder closure ─────────────────────────────────
  const activeCardRef = useRef(activeCard);
  activeCardRef.current = activeCard;
  const onCloseBookingRef = useRef(onCloseBooking);
  onCloseBookingRef.current = onCloseBooking;
  const cardHeightRef = useRef(0);

  // Reset slideAnim and entrance values synchronously during the render where
  // activeCard switches to 'booking', so the very first painted frame is at the
  // correct initial animation state (no flash of the settled position).
  const prevActiveCard = useRef(activeCard);
  if (prevActiveCard.current !== activeCard) {
    prevActiveCard.current = activeCard;
    if (activeCard === 'booking') {
      slideAnim.setValue(0);
      enterSlide.setValue(ENTRANCE_TRANSLATE_Y);
      enterOpacity.setValue(0);
    }
  }

  // ── Entrance animation (runs after the first render of BookingCard) ───────
  useEffect(() => {
    if (activeCard !== 'booking') return;
    // Values already at initial state (set in the render phase above).
    Animated.parallel([
      Animated.timing(enterSlide, {
        toValue: 0,
        duration: ENTRANCE_SLIDE_MS,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
      Animated.timing(enterOpacity, {
        toValue: 1,
        duration: ENTRANCE_OPACITY_MS,
        useNativeDriver: true,
      }),
    ]).start();
  }, [activeCard, enterSlide, enterOpacity]);

  // ── Gesture ───────────────────────────────────────────────────────────────
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Never claim the gesture on touch-down (lets children handle taps).
        onStartShouldSetPanResponder: () => false,
        // Claim a downward vertical move only while booking is active and the
        // close animation is not already in flight.
        onMoveShouldSetPanResponder: (_, g) =>
          !isAnimatingClose.current
          && activeCardRef.current === 'booking'
          && g.dy > 6
          && g.dy > Math.abs(g.dx),
        onPanResponderGrant: () => {
          Keyboard.dismiss();
        },
        onPanResponderMove: (_, g) => {
          slideAnim.setValue(Math.max(0, g.dy));
        },
        onPanResponderRelease: (_, g) => {
          const dy = Math.max(0, g.dy);
          const height = Math.max(1, cardHeightRef.current);
          const shouldDismiss =
            dy > height * DISMISS_THRESHOLD_RATIO || g.vy > DISMISS_VELOCITY;

          if (shouldDismiss) {
            isAnimatingClose.current = true;
            // Ease-in-cubic: the sheet accelerates away naturally, like dropping.
            Animated.timing(slideAnim, {
              toValue: height,
              duration: DISMISS_DURATION_MS,
              useNativeDriver: true,
              easing: Easing.in(Easing.cubic),
            }).start(() => {
              isAnimatingClose.current = false;
              onCloseBookingRef.current();
            });
          } else {
            Animated.spring(slideAnim, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 4,
            }).start();
          }
        },
        // Allow the system to reclaim the gesture (home indicator, modal, etc.).
        // If terminated mid-drag, snap back to the open position so the sheet
        // is never left stuck at a partial translateY.
        onPanResponderTerminationRequest: () => true,
        onPanResponderTerminate: () => {
          if (!isAnimatingClose.current) {
            Animated.spring(slideAnim, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 2,
            }).start();
          }
        },
      }),
    [slideAnim],
  );

  const handleContentLayout = useCallback(
    (e: { nativeEvent: { layout: { height: number } } }) => {
      const h = e.nativeEvent.layout.height;
      if (h > 0) {
        cardHeightRef.current = h;
        onSheetHeightChange?.(h);
      }
    },
    [onSheetHeightChange],
  );

  // Only apply the slide transform while booking is active — the sheet is
  // always at translateY 0 in home state so a stale slideAnim value cannot
  // offset it between sessions.
  const transform = activeCard === 'booking' ? [{ translateY: slideAnim }] : undefined;

  // Entrance style for the Animated.View that wraps booking content.
  // Both values are stable Animated.Values; the style object is created once.
  const entranceStyle = useMemo(
    () => ({ transform: [{ translateY: enterSlide }], opacity: enterOpacity }),
    [enterSlide, enterOpacity],
  );

  return (
    <Animated.View
      testID="booking-sheet"
      style={[
        sheetStyles.shell,
        { backgroundColor: colors.card },
        transform ? { transform } : undefined,
      ]}
      // Attach gesture only while booking card is active and stable.
      {...(activeCard === 'booking' && !isAnimatingClose.current
        ? panResponder.panHandlers
        : undefined)}
    >
      {/* onLayout on the content View (not the Animated.View) gives the natural
          height of the active card including the handle, unaffected by transform. */}
      <View onLayout={handleContentLayout}>
        {activeCard === 'home' && (
          <HomeCard
            {...homeCard}
            bottomPadding={bottomPadding}
            colors={colors}
          />
        )}
        {activeCard === 'booking' && (
          // Animated.View is required here so opacity and translateY run on
          // the native thread (useNativeDriver: true). Opacity on a plain
          // View with a native-driver value is a crash source — do not change.
          <Animated.View style={entranceStyle}>
            {/* Sheet-level drag handle — outside card padding for true centering. */}
            <View style={sheetStyles.handleBar} testID="booking-sheet-handle">
              <View style={sheetStyles.handlePill} />
            </View>
            <BookingCard
              {...bookingCard}
              bottomPadding={bottomPadding}
              colors={colors}
            />
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
}

const sheetStyles = StyleSheet.create({
  shell: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 12,
  },
  handleBar: {
    alignItems: 'center',
    paddingTop: 8,
  },
  handlePill: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3A3A3A',
  },
});
