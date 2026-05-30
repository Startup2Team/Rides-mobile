import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Feather } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { VehicleType, VEHICLE_BASE_FARE, VEHICLE_LABELS, VEHICLE_MCI } from '@/types';
import { useColors } from '@/hooks/useColors';

interface VehicleCardProps {
  type: VehicleType;
  selected: boolean;
  onSelect: () => void;
  estimatedFare?: number;
  compact?: boolean;
}

const VEHICLE_DATA: Record<VehicleType, { icon: keyof typeof Feather.glyphMap; seats: string; desc: string }> = {
  moto: { icon: 'zap', seats: '1 seat', desc: 'Fast & affordable' },
  cab: { icon: 'navigation', seats: '4 seats', desc: 'Comfortable ride' },
  fuso: { icon: 'truck', seats: '10+ seats', desc: 'Heavy cargo & groups' },
  hilux: { icon: 'truck', seats: '5 seats', desc: 'Light cargo & family' },
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
        <View style={[styles.compactIconBox, { backgroundColor: selected ? colors.primary : colors.muted }]}>
          <MaterialCommunityIcons name={VEHICLE_MCI[type] as any} size={28} color={selected ? colors.primaryForeground : colors.foreground} />
        </View>
        <Text style={[styles.compactName, { color: selected ? colors.primary : colors.foreground }]}>
          {VEHICLE_LABELS[type]}
        </Text>
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
      <View style={[styles.iconBox, { backgroundColor: selected ? colors.primary : colors.muted }]}>
        <Feather name={data.icon} size={20} color={selected ? colors.primaryForeground : colors.foreground} />
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.foreground }]}>{VEHICLE_LABELS[type]}</Text>
        <Text style={[styles.desc, { color: colors.mutedForeground }]}>{data.seats} · {data.desc}</Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.fare, { color: selected ? colors.primary : colors.foreground }]}>
          {estimatedFare ? `${estimatedFare.toLocaleString()} RWF` : `From ${VEHICLE_BASE_FARE[type].toLocaleString()}`}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 12,
    marginBottom: 10,
  },
  compactCard: {
    width: '47%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 10,
  },
  compactIconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactName: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  name: { fontSize: 15, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  desc: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  right: { alignItems: 'flex-end' },
  fare: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
});
