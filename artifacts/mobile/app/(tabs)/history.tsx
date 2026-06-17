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
import { RouteTimeline } from '@/components/RouteTimeline';
import { OfflineBanner } from '@/components/OfflineBanner';

/** Matches card horizontal padding — space before calendar / after RWF. */
const CARD_CONTENT_INSET = 16;
const INSET_CARD_MARGIN_H = 16;
const CHEVRON_SIZE = 18;
/** Trailing fare slot — keeps large amounts right-aligned without shrinking the status chip row. */
const FARE_COLUMN_WIDTH = 102;
const INSET_CARD_RADIUS = Platform.OS === 'ios' ? 10 : 12;
const CARD_GAP = 12;

function RideHistoryCard({ ride }: { ride: Ride }) {
  const colors = useColors();
  const date = new Date(ride.createdAt);
  const dateStr = date.toLocaleDateString('en-RW', { month: 'short', day: 'numeric', year: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-RW', { hour: '2-digit', minute: '2-digit' });
  const fareLabel =
    ride.agreedFare != null ? `${ride.agreedFare.toLocaleString('en-RW')} RWF` : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ride details for ${ride.destination.address ?? 'destination'}`}
      onPress={() => router.push(`/ride-detail?rideId=${ride.id}` as any)}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card },
        Platform.OS === 'ios' && styles.cardIos,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text
            style={[styles.vehicleLabel, { color: colors.foreground }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {VEHICLE_LABELS[ride.vehicleType]}
          </Text>
          <StatusChip status={ride.status} variant="history" />
        </View>

        <View style={styles.routeRow}>
          <RouteTimeline compact />
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
          <View
            style={[
              styles.metaCluster,
              fareLabel != null && { paddingRight: FARE_COLUMN_WIDTH + 8 },
            ]}
          >
            <View style={[styles.metaItem, styles.metaItemDate]}>
              <Feather name="calendar" size={13} color={colors.mutedForeground} />
              <Text
                style={[styles.metaText, { color: colors.mutedForeground }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {dateStr} · {timeStr}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Feather name="map-pin" size={13} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]} numberOfLines={1}>
                {ride.distance} km
              </Text>
            </View>
          </View>
          {fareLabel != null && (
            <View style={styles.fareColumn} pointerEvents="none">
              <Text style={[styles.fare, { color: colors.foreground }]} numberOfLines={1}>
                {fareLabel}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.chevronAnchor} pointerEvents="none">
        <Feather
          name="chevron-right"
          size={CHEVRON_SIZE}
          color={colors.mutedForeground}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      </View>
    </Pressable>
  );
}

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const { rideHistory, loadHistory } = useRide();

  useEffect(() => { loadHistory().catch(() => {}); }, []);

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
          <View style={styles.cardList}>
            {rideHistory.map((ride) => (
              <RideHistoryCard key={ride.id} ride={ride} />
            ))}
          </View>
        )}
      </GlassScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: {
    paddingHorizontal: INSET_CARD_MARGIN_H,
    paddingBottom: 8,
  },
  cardList: {
    gap: CARD_GAP,
  },
  card: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: INSET_CARD_RADIUS,
    paddingHorizontal: CARD_CONTENT_INSET,
    paddingVertical: 14,
    overflow: 'hidden',
  },
  cardIos: {
    borderCurve: 'continuous',
  },
  cardPressed: {
    opacity: 0.55,
  },
  cardBody: {
    flex: 1,
    gap: 12,
    minWidth: 0,
  },
  chevronAnchor: {
    position: 'absolute',
    right: CARD_CONTENT_INSET,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minWidth: 0,
  },
  vehicleLabel: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    minWidth: 0,
  },
  routeRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  routeLabels: { flex: 1, gap: 10 },
  routeText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  cardBottom: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  metaCluster: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    columnGap: 14,
    minWidth: 0,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  metaItemDate: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  metaText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    flexShrink: 1,
  },
  fareColumn: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: FARE_COLUMN_WIDTH,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  fare: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    textAlign: 'right',
    ...Platform.select({
      ios: { fontVariant: ['tabular-nums'] },
      default: {},
    }),
  },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 20, fontFamily: 'Inter_600SemiBold' },
  emptyDesc: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});
