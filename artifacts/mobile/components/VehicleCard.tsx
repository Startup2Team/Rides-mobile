import { typography } from '@/constants/typography';
import { AppText } from '@/components/AppText';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { radius } from '@/constants/radius';
import { sizes } from '@/constants/sizes';
import { spacing, semanticSpacing } from '@/constants/spacing';
import { VehicleTypeIcon } from '@/components/VehicleTypeIcon';
import { useColors } from '@/hooks/useColors';
import { VehicleType, VEHICLE_BASE_FARE, VEHICLE_LABELS } from '@/types';

interface VehicleCardProps {
  type: VehicleType;
  selected: boolean;
  onSelect: () => void;
  estimatedFare?: number;
  compact?: boolean;
}

const VEHICLE_DATA: Record<VehicleType, { seats: string; desc: string }> = {
  moto: { seats: '1 seat', desc: 'Fast & affordable' },
  rifani: { seats: '1–2 seats', desc: 'Three-wheel ride' },
  cab: { seats: '4 seats', desc: 'Comfortable ride' },
  fuso: { seats: '10+ seats', desc: 'Heavy cargo & groups' },
  hilux: { seats: '5 seats', desc: 'Light cargo & family' },
};

export function VehicleCard({ type, selected, onSelect, estimatedFare, compact }: VehicleCardProps) {
  const colors = useColors();
  const data = VEHICLE_DATA[type];

  if (compact) {
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onSelect}
        style={[
          styles.compactCard,
          {
            backgroundColor: selected ? colors.primaryHex + '15' : colors.card,
            borderColor: selected ? colors.primary : colors.border,
          },
        ]}
      >
        <View style={styles.compactIconBox}>
          <VehicleTypeIcon type={type} selected={selected} />
        </View>
        <AppText style={[styles.compactName, { color: selected ? colors.primary : colors.foreground }]}>
          {VEHICLE_LABELS[type]}
        </AppText>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onSelect}
      style={[
        styles.card,
        {
          backgroundColor: selected ? colors.primaryHex + '15' : colors.card,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <View style={styles.iconBox}>
        <VehicleTypeIcon type={type} selected={selected} />
      </View>
      <View style={styles.info}>
        <AppText style={[styles.name, { color: colors.foreground }]}>{VEHICLE_LABELS[type]}</AppText>
        <AppText style={[styles.desc, { color: colors.mutedForeground }]}>{data.seats} · {data.desc}</AppText>
      </View>
      <View style={styles.right}>
        <AppText style={[styles.fare, { color: selected ? colors.primary : colors.foreground }]}>
          {estimatedFare ? `${estimatedFare.toLocaleString()} RWF` : `From ${VEHICLE_BASE_FARE[type].toLocaleString()}`}
        </AppText>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: semanticSpacing.listItemPadding,
    borderRadius: radius.card,
    borderWidth: 1.5,
    gap: semanticSpacing.rowGap,
    marginBottom: spacing[10],
  },
  compactCard: {
    width: '47%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[20],
    borderRadius: radius['2xl'],
    borderWidth: 1.5,
    gap: spacing[10],
  },
  compactIconBox: {
    width: sizes.thumbnail.sm,
    height: sizes.avatar.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactName: { ...typography.body,  },
  iconBox: {
    width: sizes.avatar.lg,
    height: sizes.avatar.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  name: { ...typography.body, marginBottom: spacing[2] },
  desc: { ...typography.caption,  },
  right: { alignItems: 'flex-end' },
  fare: { ...typography.label,  },
});
