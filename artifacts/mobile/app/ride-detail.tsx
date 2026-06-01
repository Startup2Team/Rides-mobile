import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { GlassScrollView } from '@/components/GlassScrollView';
import { SaveLocationSheet } from '@/components/SaveLocationSheet';
import { StatusChip } from '@/components/StatusChip';
import { RouteTimeline } from '@/components/RouteTimeline';
import { useColors } from '@/hooks/useColors';
import { useRide } from '@/context/RideContext';
import { RideLocation, VEHICLE_LABELS } from '@/types';

function formatRideDate(value: string) {
  return new Date(value).toLocaleDateString('en-RW', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatRideTime(value: string) {
  return new Date(value).toLocaleTimeString('en-RW', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours} hr ${remaining} min` : `${hours} hr`;
}

function DetailRow({
  icon,
  label,
  value,
  color,
  valueColor,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  color: string;
  valueColor?: string;
}) {
  const colors = useColors();

  return (
    <View style={styles.detailRow}>
      <Feather name={icon} size={18} color={color} />
      <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: valueColor ?? colors.foreground }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function RouteLocationRow({
  label,
  address,
  location,
  onSave,
}: {
  label: string;
  address: string;
  location: RideLocation;
  onSave: (location: RideLocation) => void;
}) {
  const colors = useColors();

  return (
    <View style={styles.routeItem}>
      <View style={styles.routeItemText}>
        <Text style={[styles.routeItemLabel, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[styles.routeItemValue, { color: colors.foreground }]}>{address}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Save ${label.toLowerCase()} location`}
        accessibilityHint="Opens options to save this place for future rides"
        onPress={() => onSave(location)}
        style={({ pressed }) => [
          styles.saveLocationButton,
          { borderColor: colors.border, opacity: pressed ? 0.72 : 1 },
        ]}
      >
        <Text style={[styles.saveLocationButtonText, { color: colors.primary }]}>Save</Text>
      </Pressable>
    </View>
  );
}

export default function RideDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const { rideId } = useLocalSearchParams<{ rideId: string }>();
  const { rideHistory, loadHistory } = useRide();
  const [pendingSaveLocation, setPendingSaveLocation] = useState<RideLocation | null>(null);

  React.useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const ride = rideHistory.find(r => r.id === rideId) ?? null;

  if (!ride) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <GlassHeader title="Ride Details" />
        <View style={styles.empty}>
          <Feather name="map" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Ride not found</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            This ride may not be available in your history anymore.
          </Text>
        </View>
      </View>
    );
  }

  const completedAt = ride.completedAt ?? ride.createdAt;
  const dateStr = formatRideDate(completedAt);
  const timeStr = formatRideTime(completedAt);
  const fare = ride.agreedFare ?? ride.suggestedFare;
  const driverImage = ride.driver
    ? ride.driver.profileImage ?? `https://i.pravatar.cc/160?u=${encodeURIComponent(ride.driver.id)}`
    : null;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <GlassHeader title="Ride Details" />

      <GlassScrollView
        indicatorTop={headerMetrics.indicatorTop}
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: headerMetrics.contentTop,
            paddingBottom: insets.bottom + 40,
          },
        ]}
      >
        <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
          <View style={styles.summaryTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Total paid</Text>
              <Text style={[styles.fareValue, { color: colors.foreground }]}>
                {fare.toLocaleString()} RWF
              </Text>
            </View>
            <StatusChip status={ride.status} variant="history" />
          </View>

          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />

          <View style={styles.summaryMetaRow}>
            <View style={styles.summaryMetaItem}>
              <Text style={[styles.summaryMetaLabel, { color: colors.mutedForeground }]}>Vehicle</Text>
              <Text style={[styles.summaryMetaValue, { color: colors.foreground }]} numberOfLines={1}>
                {VEHICLE_LABELS[ride.vehicleType]}
              </Text>
            </View>
            <View style={[styles.summaryMetaItem, styles.summaryMetaDateItem]}>
              <Text style={[styles.summaryMetaLabel, { color: colors.mutedForeground }]}>Date</Text>
              <Text style={[styles.summaryMetaValue, { color: colors.foreground }]}>
                {dateStr}
              </Text>
            </View>
            <View style={styles.summaryMetaItem}>
              <Text style={[styles.summaryMetaLabel, { color: colors.mutedForeground }]}>Time</Text>
              <Text style={[styles.summaryMetaValue, { color: colors.foreground }]} numberOfLines={1}>
                {timeStr}
              </Text>
            </View>
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ROUTE</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.routeRow}>
            <RouteTimeline />
            <View style={styles.routeLabels}>
              <RouteLocationRow
                label="Pickup"
                address={ride.pickup.address ?? 'Pickup location'}
                location={ride.pickup}
                onSave={setPendingSaveLocation}
              />
              <View style={[styles.routeDivider, { backgroundColor: colors.border }]} />
              <RouteLocationRow
                label="Drop off"
                address={ride.destination.address ?? 'Destination'}
                location={ride.destination}
                onSave={setPendingSaveLocation}
              />
            </View>
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>TRIP SUMMARY</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <DetailRow icon="map" label="Distance" value={`${ride.distance} km`} color={colors.mutedForeground} />
          <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
          <DetailRow icon="clock" label="Duration" value={formatDuration(ride.duration)} color={colors.mutedForeground} />
          <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
          <DetailRow
            icon="credit-card"
            label={ride.agreedFare ? 'Agreed fare' : 'Estimated fare'}
            value={`${fare.toLocaleString()} RWF`}
            color={colors.mutedForeground}
          />
          <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
          <DetailRow icon="hash" label="Ride ID" value={ride.id.slice(-8).toUpperCase()} color={colors.mutedForeground} />
        </View>

        {ride.driver && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>DRIVER</Text>
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <View style={styles.driverRow}>
                {driverImage ? (
                  <Image source={{ uri: driverImage }} style={styles.driverAvatarImage} />
                ) : (
                  <View style={styles.driverAvatar}>
                    <Feather name="user" size={24} color={colors.primaryHex} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.driverName, { color: colors.foreground }]}>{ride.driver.name}</Text>
                  <Text style={[styles.driverSub, { color: colors.mutedForeground }]}>
                    {VEHICLE_LABELS[ride.driver.vehicleType]} - {ride.driver.plateNumber}
                  </Text>
                </View>
                <View style={styles.ratingBadge}>
                  <Text style={[styles.ratingText, { color: colors.star }]}>★ {ride.driver.rating?.toFixed(1)}</Text>
                </View>
              </View>
            </View>
          </>
        )}
      </GlassScrollView>

      <SaveLocationSheet
        location={pendingSaveLocation}
        onClose={() => setPendingSaveLocation(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20, gap: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  summaryCard: {
    borderRadius: 18,
    padding: 18,
    gap: 16,
  },
  summaryTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  summaryLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.5 },
  fareValue: { fontSize: 30, fontFamily: 'Inter_700Bold', marginTop: 4 },
  summaryDivider: { height: StyleSheet.hairlineWidth },
  summaryMetaRow: { flexDirection: 'row', gap: 12 },
  summaryMetaItem: { flex: 1, minWidth: 0 },
  summaryMetaDateItem: { flex: 1.35 },
  summaryMetaLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', marginBottom: 3 },
  summaryMetaValue: { fontSize: 12, fontFamily: 'Inter_700Bold', lineHeight: 16 },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8,
    marginTop: 10,
  },
  card: { borderRadius: 16, padding: 16 },
  routeRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  routeLabels: { flex: 1, gap: 10 },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  routeItemText: { flex: 1, gap: 3, minWidth: 0 },
  routeItemLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase' },
  routeItemValue: { fontSize: 14, fontFamily: 'Inter_600SemiBold', lineHeight: 20 },
  saveLocationButton: {
    minWidth: 54,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    flexShrink: 0,
  },
  saveLocationButtonText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  routeDivider: { height: StyleSheet.hairlineWidth },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 34 },
  detailLabel: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular' },
  detailValue: { maxWidth: '48%', fontSize: 14, fontFamily: 'Inter_700Bold', textAlign: 'right' },
  rowDivider: { height: StyleSheet.hairlineWidth, marginVertical: 8 },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  driverAvatar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  driverAvatarImage: { width: 44, height: 44, borderRadius: 22 },
  driverName: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  driverSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  ratingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  ratingText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
});
