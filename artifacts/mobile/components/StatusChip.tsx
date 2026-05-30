import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RideStatus } from '@/types';
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

interface StatusChipProps {
  status: RideStatus;
}

export function StatusChip({ status }: StatusChipProps) {
  const colors = useColors();

  const chipColors: Record<RideStatus, { bg: string; text: string }> = {
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

  const chip = chipColors[status];

  return (
    <View style={[styles.chip, { backgroundColor: chip.bg }]}>
      <Text style={[styles.text, { color: chip.text }]} numberOfLines={1}>{STATUS_LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
});
