import React from 'react';
import { StyleSheet, View } from 'react-native';
import { RideStatus } from '@/types';
import { AppText } from '@/components/AppText';
import { radius } from '@/constants/radius';
import { spacing } from '@/constants/spacing';
import { typography } from '@/constants/typography';
import { useColors } from '@/hooks/useColors';

const STATUS_LABELS: Record<RideStatus, string> = {
  idle: 'Idle',
  searching: 'Finding Driver',
  driver_assigned: 'Driver Assigned',
  negotiating: 'Negotiating',
  confirmed: 'Confirmed',
  arriving: 'Driver Arriving',
  arrived: 'Driver Arrived',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

/** Chip copy on the live ride map header (compact layout). */
const RIDE_HEADER_LABELS: Partial<Record<RideStatus, string>> = {
  arriving: 'Driver Arriving',
  arrived: 'Driver Arrived',
  in_progress: 'In Progress',
};

interface StatusChipProps {
  status: RideStatus;
  /**
   * `history` — My Rides / archives: only completed (green) and cancelled (red) use accent colors;
   * other states stay neutral so the list does not read as a rainbow of statuses.
   * `rideHeader` — compact chip on the live ride map screen.
   */
  variant?: 'default' | 'history' | 'rideHeader';
  /** Smaller padding and type (used with `rideHeader`). */
  compact?: boolean;
}

export function StatusChip({ status, variant = 'default', compact = false }: StatusChipProps) {
  const colors = useColors();

  const defaultChipColors: Record<RideStatus, { bg: string; text: string }> = {
    idle: { bg: colors.muted, text: colors.mutedForeground },
    searching: { bg: colors.warningHex + '18', text: colors.warningHex },
    driver_assigned: { bg: colors.successHex + '20', text: colors.successHex },
    negotiating: { bg: colors.primaryHex + '18', text: colors.primaryHex },
    confirmed: { bg: colors.primaryHex + '20', text: colors.primaryHex },
    arriving: { bg: colors.primaryHex + '20', text: colors.primaryHex },
    arrived: { bg: colors.primaryHex + '30', text: colors.primaryHex },
    in_progress: { bg: colors.primaryHex + '30', text: colors.primaryHex },
    completed: { bg: colors.successHex + '20', text: colors.successHex },
    cancelled: { bg: colors.destructiveHex + '14', text: colors.destructiveHex },
  };

  const historyAccent: Partial<Record<RideStatus, { bg: string; text: string }>> = {
    completed: defaultChipColors.completed,
    cancelled: defaultChipColors.cancelled,
  };

  const neutralHistory = { bg: colors.muted, text: colors.mutedForeground };

  const chip =
    variant === 'history'
      ? (historyAccent[status] ?? neutralHistory)
      : defaultChipColors[status];

  const label =
    variant === 'rideHeader'
      ? (RIDE_HEADER_LABELS[status] ?? STATUS_LABELS[status])
      : STATUS_LABELS[status];

  const isCompact = compact || variant === 'rideHeader';

  const isRideHeader = variant === 'rideHeader';

  return (
    <View
      style={[
        styles.chip,
        isCompact && styles.chipCompact,
        isRideHeader && styles.chipPlain,
        { backgroundColor: isRideHeader ? 'transparent' : chip.bg },
      ]}
    >
      <AppText
        variant={isCompact ? 'tiny' : 'badge'}
        style={[styles.text, isCompact && styles.textCompact, { color: chip.text }]}
        numberOfLines={1}
        adjustsFontSizeToFit={isCompact}
        minimumFontScale={0.85}
      >
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[4],
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  text: {
    ...typography.badge,
  },
  chipCompact: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    maxWidth: 108,
  },
  chipPlain: {
    paddingHorizontal: spacing[0],
    paddingVertical: spacing[0],
  },
  textCompact: {
    ...typography.tiny,
  },
});
