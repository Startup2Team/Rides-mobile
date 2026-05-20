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
    searching: { bg: '#FFF3E0', text: '#E65100' },
    driver_assigned: { bg: '#E8F5E9', text: '#2E7D32' },
    negotiating: { bg: '#E3F2FD', text: '#1565C0' },
    confirmed: { bg: colors.primary + '20', text: colors.primary },
    arriving: { bg: colors.primary + '20', text: colors.primary },
    in_progress: { bg: colors.primary + '30', text: colors.primary },
    completed: { bg: '#E8F5E9', text: '#2E7D32' },
    cancelled: { bg: '#FFEBEE', text: '#C62828' },
  };

  const chip = chipColors[status];

  return (
    <View style={[styles.chip, { backgroundColor: chip.bg }]}>
      <Text style={[styles.text, { color: chip.text }]}>{STATUS_LABELS[status]}</Text>
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
