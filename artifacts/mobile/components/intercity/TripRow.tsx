import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { SeatsRemaining } from '@/components/intercity/SeatsRemaining';
import { icons } from '@/constants/icons';
import { radius } from '@/constants/radius';
import { semanticSpacing, spacing } from '@/constants/spacing';
import { typography } from '@/constants/typography';
import { formatDepartureTime, formatRwf, isBookable } from '@/domains/intercity';
import type { IntercityTrip } from '@/domains/intercity';
import { useColors } from '@/hooks/useColors';

interface TripRowProps {
  trip: IntercityTrip;
  onPress: (trip: IntercityTrip) => void;
  /** Driver variant drops the "book" affordance and always stays tappable. */
  variant?: 'customer' | 'driver';
}

/**
 * One trip on a corridor. Reading order matches what a passenger decides on:
 * WHEN it leaves, WHO is running it, WHERE it leaves from, WHAT it costs —
 * and, held apart on the right at display size, HOW MANY SEATS ARE LEFT.
 */
export function TripRow({ trip, onPress, variant = 'customer' }: TripRowProps) {
  const colors = useColors();
  const bookable = variant === 'driver' || isBookable(trip);
  const operator = trip.operatorName?.trim() || 'Rides operator';
  const vehicle = [trip.vehicleLabel, trip.plateNumber].filter(Boolean).join(' · ');

  const accessibilityLabel = [
    `Departs ${formatDepartureTime(trip.departAt)}`,
    operator,
    vehicle || null,
    `from ${trip.stagingAddress}`,
    `${formatRwf(trip.pricePerSeatRwf)} per seat`,
    trip.remainingSeats > 0 ? `${trip.remainingSeats} seats left` : 'sold out',
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={
        variant === 'driver'
          ? 'Opens the manifest for this trip'
          : bookable
            ? 'Opens seat selection for this trip'
            : undefined
      }
      accessibilityState={{ disabled: !bookable }}
      activeOpacity={0.78}
      disabled={!bookable}
      onPress={() => onPress(trip)}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: bookable ? 1 : 0.55,
        },
      ]}
    >
      <View style={styles.main}>
        <View style={styles.headline}>
          <AppText style={[styles.time, { color: colors.foreground }]}>
            {formatDepartureTime(trip.departAt)}
          </AppText>
          <AppText numberOfLines={1} style={[styles.operator, { color: colors.foreground }]}>
            {operator}
          </AppText>
        </View>

        {vehicle ? (
          <AppText numberOfLines={1} style={[styles.meta, { color: colors.mutedForeground }]}>
            {vehicle}
          </AppText>
        ) : null}

        <View style={styles.metaRow}>
          <Feather name="map-pin" size={icons.size.xs} color={colors.mutedForeground} />
          <AppText numberOfLines={1} style={[styles.meta, { color: colors.mutedForeground, flex: 1 }]}>
            {trip.stagingAddress}
          </AppText>
        </View>

        <AppText style={[styles.price, { color: colors.foreground }]}>
          {formatRwf(trip.pricePerSeatRwf)}
          <AppText style={[styles.priceUnit, { color: colors.mutedForeground }]}> / seat</AppText>
        </AppText>
      </View>

      <View style={styles.side}>
        <SeatsRemaining remaining={trip.remainingSeats} />
        {variant === 'driver' ? (
          <AppText style={[styles.meta, { color: colors.mutedForeground }]}>
            of {trip.totalSeats}
          </AppText>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: semanticSpacing.rowGap,
    marginHorizontal: semanticSpacing.cardPadding,
    marginBottom: spacing[12],
    padding: semanticSpacing.cardPadding,
    borderRadius: radius.sheetCompact,
    borderWidth: 1,
    minHeight: 96,
  },
  main: { flex: 1, gap: spacing[4] },
  headline: { flexDirection: 'row', alignItems: 'baseline', gap: spacing[8] },
  time: { ...typography.h2, lineHeight: 26 },
  operator: { ...typography.bodySmall, flexShrink: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  meta: { ...typography.tiny, lineHeight: 16 },
  price: { ...typography.label, marginTop: spacing[2] },
  priceUnit: { ...typography.tiny },
  side: { alignItems: 'center', gap: spacing[2] },
});
