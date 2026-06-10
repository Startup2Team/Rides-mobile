import React, { type ReactNode } from 'react';
import { Image, Platform, StyleSheet, Text, View, type ColorValue } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Ride } from '@/types';
import { VEHICLE_LABELS_FULL } from '@/types';
import type { useColors } from '@/hooks/useColors';

export function DriverInfoCard({
  colors,
  distanceText,
  driverPhotoUri,
  etaText,
  ride,
}: {
  colors: ReturnType<typeof useColors>;
  distanceText: string;
  driverPhotoUri: string | null | undefined;
  etaText: string;
  ride: Ride;
}) {
  const driverInitial = ride.driver?.name?.trim()?.[0]?.toUpperCase() ?? 'D';
  return (
    <>
      <View style={styles.driverRow}>
        {driverPhotoUri ? (
          <View style={styles.avatarImageShadow}>
            <Image source={{ uri: driverPhotoUri }} style={styles.avatarImage} accessibilityLabel={`${ride.driver?.name ?? 'Driver'} profile photo`} />
          </View>
        ) : (
          <LinearGradient colors={['#9DBBE0', '#7984C3']} style={styles.avatar} accessibilityLabel={ride.driver?.name ?? 'Driver'} accessibilityRole="image">
            <Text style={styles.initial}>{driverInitial}</Text>
          </LinearGradient>
        )}
        <View style={styles.details}>
          <Text style={[styles.name, { color: colors.foreground }]}>{ride.driver?.name ?? 'Driver'}</Text>
          <Text style={[styles.vehicle, { color: colors.mutedForeground }]}>
            {VEHICLE_LABELS_FULL[ride.vehicleType]} · {ride.driver?.plateNumber}
          </Text>
        </View>
        <View style={styles.ratingBadge}>
          <Text style={[styles.rating, { color: colors.star }]}>★ {ride.driver?.rating?.toFixed(1)}</Text>
        </View>
      </View>
      <View style={[styles.fareRow, { backgroundColor: colors.muted }]}>
        <FareItem label="Agreed Fare" labelColor={colors.mutedForeground} value={<>{ride.agreedFare?.toLocaleString()} RWF</>} valueColor={colors.primary} />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <FareItem label="Distance" labelColor={colors.mutedForeground} value={distanceText} valueColor={colors.foreground} />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <FareItem label="ETA" labelColor={colors.mutedForeground} value={etaText} valueColor={colors.foreground} />
      </View>
    </>
  );
}

function FareItem({ label, labelColor, value, valueColor }: {
  label: string;
  labelColor: ColorValue;
  value: ReactNode;
  valueColor: ColorValue;
}) {
  return <View style={styles.fareItem}><Text style={[styles.fareLabel, { color: labelColor }]}>{label}</Text><Text style={[styles.fareValue, { color: valueColor }]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  details: { flex: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 5, elevation: 3, ...Platform.select({ web: { boxShadow: '0 4px 12px rgba(0,0,0,0.12)' } }) },
  avatarImage: { width: 40, height: 40, borderRadius: 20 },
  avatarImageShadow: { borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.16, shadowRadius: 5, elevation: 4, ...Platform.select({ web: { boxShadow: '0 4px 12px rgba(0,0,0,0.16)' } }) },
  initial: { fontSize: 20, fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', lineHeight: 24 },
  name: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  vehicle: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  ratingBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  rating: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  fareRow: { flexDirection: 'row', borderRadius: 14, overflow: 'hidden' },
  fareItem: { flex: 1, alignItems: 'center', paddingVertical: 8, gap: 2 },
  divider: { width: 1 },
  fareLabel: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  fareValue: { fontSize: 13, fontFamily: 'Inter_700Bold' },
});
