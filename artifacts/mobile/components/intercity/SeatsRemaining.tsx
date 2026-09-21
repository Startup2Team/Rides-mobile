import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { radius } from '@/constants/radius';
import { spacing } from '@/constants/spacing';
import { typography } from '@/constants/typography';
import { useColors } from '@/hooks/useColors';

interface SeatsRemainingProps {
  remaining: number;
  /** `lg` on a trip row (the headline number), `sm` inline. */
  size?: 'sm' | 'lg';
}

/**
 * The headline number of the whole product: how many seats are left.
 *
 * This is ALWAYS `total − booked − held` as mapped in `services/intercity.ts`.
 * It is never `sellable_seats` — that value is clamped by the operator's
 * credit balance and publishing it would be a live oracle of a rival's
 * balance (INTERCITY_DESIGN §11 D3).
 *
 * Colour is a second channel, never the only one: the count and the word
 * "left"/"Sold out" carry the meaning for anyone who cannot distinguish the
 * hues, and the accessibility label spells it out.
 */
export function SeatsRemaining({ remaining, size = 'lg' }: SeatsRemainingProps) {
  const colors = useColors();
  const seats = Math.max(0, Math.trunc(remaining));
  const soldOut = seats === 0;
  const scarce = !soldOut && seats <= 3;
  const tint = soldOut ? colors.mutedForeground : scarce ? colors.warning : colors.success;
  const tintHex = soldOut ? colors.mutedForeground : scarce ? colors.warningHex : colors.successHex;

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={soldOut ? 'Sold out' : `${seats} ${seats === 1 ? 'seat' : 'seats'} left`}
      style={[
        styles.badge,
        size === 'sm' ? styles.badgeSm : styles.badgeLg,
        { backgroundColor: soldOut ? colors.muted : `${tintHex}18` },
      ]}
    >
      {soldOut ? (
        <AppText style={[styles.soldOut, { color: colors.mutedForeground }]}>Sold out</AppText>
      ) : (
        <>
          <AppText style={[size === 'sm' ? styles.countSm : styles.countLg, { color: tint }]}>
            {seats}
          </AppText>
          <AppText style={[styles.caption, { color: tint }]}>
            {seats === 1 ? 'seat left' : 'seats left'}
          </AppText>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
  },
  badgeLg: { minWidth: 76, paddingHorizontal: spacing[10], paddingVertical: spacing[8] },
  badgeSm: { paddingHorizontal: spacing[10], paddingVertical: spacing[6] },
  countLg: { ...typography.display, lineHeight: 34 },
  countSm: { ...typography.title, lineHeight: 22 },
  caption: { ...typography.tiny, textAlign: 'center' },
  soldOut: { ...typography.label, textAlign: 'center' },
});
