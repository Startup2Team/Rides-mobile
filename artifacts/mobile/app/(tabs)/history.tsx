import React, { useEffect } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { GlassScrollView } from '@/components/GlassScrollView';
import { useColors } from '@/hooks/useColors';
import { useRide } from '@/context/RideContext';
import { Ride, VEHICLE_LABELS } from '@/types';
import { StatusChip } from '@/components/StatusChip';
import { OfflineBanner } from '@/components/OfflineBanner';

function RideHistoryCard({ ride }: { ride: Ride }) {
  const colors = useColors();
  const date = new Date(ride.createdAt);
  const dateStr = date.toLocaleDateString('en-RW', { month: 'short', day: 'numeric', year: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-RW', { hour: '2-digit', minute: '2-digit' });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ride details for ${ride.destination.address ?? 'destination'}`}
      onPress={() => router.push(`/ride-detail?rideId=${ride.id}` as any)}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.78 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
      ]}
    >
      <View style={styles.cardTop}>
        <View style={styles.vehicleBadge}>
          <Text style={[styles.vehicleLabel, { color: colors.foreground }]}>
            {VEHICLE_LABELS[ride.vehicleType]}
          </Text>
        </View>
        <StatusChip status={ride.status} />
      </View>

      <View style={styles.routeRow}>
        <View style={styles.routeIcons}>
          <View style={[styles.dot, { backgroundColor: colors.primary }]} />
          <View style={[styles.line, { backgroundColor: colors.border }]} />
          <View style={[styles.dot, { backgroundColor: colors.destructive, borderRadius: 3 }]} />
        </View>
        <View style={styles.routeLabels}>
          <Text style={[styles.routeText, { color: colors.foreground }]} numberOfLines={1}>
            {ride.pickup.address ?? 'Pickup location'}
          </Text>
          <Text style={[styles.routeText, { color: colors.foreground }]} numberOfLines={1}>
            {ride.destination.address ?? 'Destination'}
          </Text>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.cardBottom}>
        <View style={styles.metaItem}>
          <Feather name="calendar" size={13} color={colors.mutedForeground} />
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{dateStr} · {timeStr}</Text>
        </View>
        <View style={styles.metaItem}>
          <Feather name="map-pin" size={13} color={colors.mutedForeground} />
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{ride.distance} km</Text>
        </View>
        {ride.agreedFare && (
          <Text style={[styles.fare, { color: colors.primary }]}>
            {ride.agreedFare.toLocaleString()} RWF
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const { rideHistory, loadHistory } = useRide();

  useEffect(() => { loadHistory(); }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <OfflineBanner />
      <GlassHeader title="My Rides" showBack={false} />

      <GlassScrollView
        indicatorTop={headerMetrics.indicatorTop}
        contentContainerStyle={[
          styles.list,
          {
            paddingTop: headerMetrics.contentTop,
            paddingBottom: insets.bottom + (Platform.OS === 'web' ? 84 : 80) + 16,
          },
        ]}
        scrollEnabled={rideHistory.length > 0}
      >
        {rideHistory.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="map" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No rides yet</Text>
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
              Your completed rides will appear here
            </Text>
          </View>
        ) : (
          rideHistory.map((ride, index) => (
            <React.Fragment key={ride.id}>
              {index > 0 && <View style={{ height: 12 }} />}
              <RideHistoryCard ride={ride} />
            </React.Fragment>
          ))
        )}
      </GlassScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 20 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  vehicleBadge: {},
  vehicleLabel: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  routeRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  routeIcons: { alignItems: 'center', gap: 4, paddingVertical: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  line: { width: 1.5, height: 20 },
  routeLabels: { flex: 1, gap: 10 },
  routeText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  divider: { height: 1 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  fare: { marginLeft: 'auto', fontSize: 15, fontFamily: 'Inter_700Bold' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 20, fontFamily: 'Inter_600SemiBold' },
  emptyDesc: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});
