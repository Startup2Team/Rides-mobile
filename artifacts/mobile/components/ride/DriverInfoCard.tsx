import { typography } from '@/constants/typography';
import { AppText } from '@/components/AppText';
import React, { type ReactNode } from 'react';
import { Image, Platform, StyleSheet, View, type ColorValue } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { elevation } from '@/constants/elevation';
import { radius } from '@/constants/radius';
import { sizes } from '@/constants/sizes';
import { spacing } from '@/constants/spacing';
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
            <AppText style={styles.initial}>{driverInitial}</AppText>
          </LinearGradient>
        )}
        <View style={styles.details}>
          <AppText style={[styles.name, { color: colors.foreground }]}>{ride.driver?.name ?? 'Driver'}</AppText>
          <AppText style={[styles.vehicle, { color: colors.mutedForeground }]}>
            {VEHICLE_LABELS_FULL[ride.vehicleType]} · {ride.driver?.plateNumber}
          </AppText>
        </View>
        <View style={styles.ratingBadge}>
          <AppText style={[styles.rating, { color: colors.star }]}>★ {ride.driver?.rating?.toFixed(1)}</AppText>
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
  return <View style={styles.fareItem}><AppText style={[styles.fareLabel, { color: labelColor }]}>{label}</AppText><AppText style={[styles.fareValue, { color: valueColor }]}>{value}</AppText></View>;
}

const styles = StyleSheet.create({
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[10] },
  details: { flex: 1 },
  avatar: { width: sizes.avatar.md, height: sizes.avatar.md, borderRadius: radius['3xl'], alignItems: 'center', justifyContent: 'center', ...elevation.card, ...Platform.select({ web: { boxShadow: '0 4px 12px rgba(0,0,0,0.12)' } }) },
  avatarImage: { width: sizes.avatar.md, height: sizes.avatar.md, borderRadius: radius['3xl'] },
  avatarImageShadow: { borderRadius: radius['3xl'], ...elevation.md, shadowOpacity: 0.16, shadowRadius: 5, ...Platform.select({ web: { boxShadow: '0 4px 12px rgba(0,0,0,0.16)' } }) },
  initial: { ...typography.h2, color: '#FFFFFF', lineHeight: 24 },
  name: { ...typography.body,  },
  vehicle: { ...typography.tiny,  },
  ratingBadge: { paddingHorizontal: spacing[8], paddingVertical: 3, borderRadius: radius.full },
  rating: { ...typography.caption,  },
  fareRow: { flexDirection: 'row', borderRadius: radius.card, overflow: 'hidden' },
  fareItem: { flex: 1, alignItems: 'center', paddingVertical: spacing[8], gap: spacing[2] },
  divider: { width: 1 },
  fareLabel: { ...typography.tiny,  },
  fareValue: { ...typography.label,  },
});
