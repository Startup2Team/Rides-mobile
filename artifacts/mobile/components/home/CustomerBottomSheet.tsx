/**
 * CustomerBottomSheet — V2 card-stack bottom sheet.
 *
 * Architecture:
 *  - One Animated.Value (slideAnim) drives the sheet's translateY during the
 *    booking-close swipe. It is never used for opacity.
 *  - One PanResponder owns the gesture. It activates only when activeCard === 'booking'.
 *  - Exactly one card is rendered at a time (CardStack). No overlapping absolute layers.
 *  - Height is content-driven: onLayout on the inner content View reports the current
 *    card's natural height to the parent via onSheetHeightChange.
 *  - The pan handlers are detached while the sheet is animating closed to avoid
 *    capturing a second gesture mid-flight.
 */
import React, { useCallback, useMemo, useRef } from 'react';
import {
  Animated,
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
const DISMISS_DURATION_MS = 220;

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
  const slideAnim = useRef(new Animated.Value(0)).current;
  const isAnimatingClose = useRef(false);

  // Keep refs so the stable PanResponder closure sees current values.
  const activeCardRef = useRef(activeCard);
  activeCardRef.current = activeCard;
  const onCloseBookingRef = useRef(onCloseBooking);
  onCloseBookingRef.current = onCloseBooking;
  const cardHeightRef = useRef(0);

  // Reset the slide position each time booking opens so the card always enters at 0.
  const prevActiveCard = useRef(activeCard);
  if (prevActiveCard.current !== activeCard) {
    prevActiveCard.current = activeCard;
    if (activeCard === 'booking') {
      slideAnim.setValue(0);
    }
  }

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Never claim the gesture on touch-down (lets children handle taps).
        onStartShouldSetPanResponder: () => false,
        // Claim a downward vertical move only while booking is the active card
        // and no close animation is in flight.
        onMoveShouldSetPanResponder: (_, g) =>
          !isAnimatingClose.current
          && activeCardRef.current === 'booking'
          && g.dy > 6
          && g.dy > Math.abs(g.dx),
        onPanResponderGrant: () => {
          Keyboard.dismiss();
          // slideAnim is driven by setValue during the gesture (no running animation
          // to stop), so we just start from 0 as the resting position.
        },
        onPanResponderMove: (_, g) => {
          // Only allow downward movement.
          slideAnim.setValue(Math.max(0, g.dy));
        },
        onPanResponderRelease: (_, g) => {
          const dy = Math.max(0, g.dy);
          const height = Math.max(1, cardHeightRef.current);
          const shouldDismiss =
            dy > height * DISMISS_THRESHOLD_RATIO || g.vy > DISMISS_VELOCITY;

          if (shouldDismiss) {
            isAnimatingClose.current = true;
            Animated.timing(slideAnim, {
              toValue: height,
              duration: DISMISS_DURATION_MS,
              useNativeDriver: true,
            }).start(() => {
              isAnimatingClose.current = false;
              // Notify the parent — it switches activeCard to 'home', which will
              // re-render this component with activeCard==='home', making the
              // transform irrelevant (style ignores slideAnim in home state).
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
        // Never hand the gesture back to the system (prevents iOS scroll hijack).
        onPanResponderTerminationRequest: () => false,
      }),
    // slideAnim is stable (created once via useRef); this memo never re-runs.
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

  // Only apply the slide transform during booking — the sheet is always at 0
  // in home state, and we do not want a stale slideAnim value to offset it.
  const transform = activeCard === 'booking' ? [{ translateY: slideAnim }] : undefined;

  return (
    <Animated.View
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
          height of whichever card is currently rendered, including the handle. */}
      <View onLayout={handleContentLayout}>
        {/* Sheet-level drag handle — rendered at the top of the sheet, not inside
            the card's horizontal padding, so it is always centered on the full
            sheet width regardless of card content margins. */}
        {activeCard === 'booking' && (
          <View style={sheetStyles.handleBar} testID="booking-sheet-handle">
            <View style={sheetStyles.handlePill} />
          </View>
        )}
        {activeCard === 'home' && (
          <HomeCard
            {...homeCard}
            bottomPadding={bottomPadding}
            colors={colors}
          />
        )}
        {activeCard === 'booking' && (
          <BookingCard
            {...bookingCard}
            bottomPadding={bottomPadding}
            colors={colors}
          />
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
    overflow: 'hidden',
  },
  // Full-width handle area — sits outside card padding so alignItems:'center'
  // centers on the true sheet width, not on the padded content area.
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
