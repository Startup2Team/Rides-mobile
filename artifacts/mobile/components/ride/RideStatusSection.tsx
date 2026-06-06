import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { useColors } from '@/hooks/useColors';

export function RideStatusSection({ colors, isLate, message }: {
  colors: ReturnType<typeof useColors>;
  isLate: boolean;
  message: string;
}) {
  return (
    <View style={[styles.banner, { backgroundColor: isLate ? colors.destructive : colors.primary }]}>
      <Feather name={isLate ? 'alert-circle' : 'check-circle'} size={18} color={isLate ? colors.destructiveForeground : colors.primaryForeground} />
      <Text style={[styles.text, { color: isLate ? colors.destructiveForeground : colors.primaryForeground }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { position: 'absolute', top: 110, left: 20, right: 20, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  text: { flex: 1, fontSize: 14, fontFamily: 'Inter_600SemiBold', lineHeight: 20 },
});
