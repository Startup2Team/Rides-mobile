import React, { useState, useCallback } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { GlassScrollView } from '@/components/GlassScrollView';
import { useColors } from '@/hooks/useColors';
import { Ride, VEHICLE_LABELS } from '@/types';
import { StatusChip } from '@/components/StatusChip';
import { RouteTimeline } from '@/components/RouteTimeline';
import { OfflineBanner } from '@/components/OfflineBanner';
import { TAB_BAR_SCREEN_BOTTOM_PADDING } from '@/constants/tabBar';
import { AppText } from '@/components/AppText';
import { icons } from '@/constants/icons';
import { radius } from '@/constants/radius';
import { spacing, semanticSpacing } from '@/constants/spacing';
import { typography } from '@/constants/typography';
import { useRideHistoryQuery } from '@/query/hooks/useRideHistoryQuery';

/** Matches card horizontal padding — space before calendar / after RWF. */
const CARD_CONTENT_INSET = semanticSpacing.cardPadding;
const INSET_CARD_MARGIN_H = semanticSpacing.cardPadding;
const CHEVRON_SIZE = icons.semantic.row;
/** Trailing fare slot — keeps large amounts right-aligned without shrinking the status chip row. */
const FARE_COLUMN_WIDTH = 102;
const INSET_CARD_RADIUS = Platform.OS === 'ios' ? radius.md : radius.input;
const CARD_GAP = semanticSpacing.rowGap;

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
          <AppText
            variant="title"
            style={[styles.vehicleLabel, { color: colors.foreground }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {VEHICLE_LABELS[ride.vehicleType]}
          </AppText>
          <StatusChip status={ride.status} variant="history" />
        </View>

        <View style={styles.routeRow}>
          <RouteTimeline compact />
          <View style={styles.routeLabels}>
            <AppText variant="bodySmall" style={[styles.routeText, { color: colors.foreground }]} numberOfLines={1}>
              {ride.pickup.address ?? 'Pickup location'}
            </AppText>
            <AppText variant="bodySmall" style={[styles.routeText, { color: colors.foreground }]} numberOfLines={1}>
              {ride.destination.address ?? 'Destination'}
            </AppText>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.cardBottom}>
          <View
            style={[
              styles.metaCluster,
              fareLabel != null && { paddingRight: FARE_COLUMN_WIDTH + spacing[8] },
            ]}
          >
            <View style={[styles.metaItem, styles.metaItemDate]}>
              <Feather name="calendar" size={13} color={colors.mutedForeground} />
              <AppText
                variant="caption"
                style={[styles.metaText, { color: colors.mutedForeground }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {dateStr} · {timeStr}
              </AppText>
            </View>
            <View style={styles.metaItem}>
              <Feather name="map-pin" size={13} color={colors.mutedForeground} />
              <AppText variant="caption" style={[styles.metaText, { color: colors.mutedForeground }]} numberOfLines={1}>
                {ride.distance} km
              </AppText>
            </View>
          </View>
          {fareLabel != null && (
            <View style={styles.fareColumn} pointerEvents="none">
              <AppText variant="bodySmall" style={[styles.fare, { color: colors.foreground }]} numberOfLines={1}>
                {fareLabel}
              </AppText>
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
  const { data: rideHistory = [], refetch: refetchRideHistory } = useRideHistoryQuery();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    const start = Date.now();
    try {
      await refetchRideHistory();
    } finally {
      const elapsed = Date.now() - start;
      const minDuration = process.env.NODE_ENV === 'test' ? 0 : 800;
      const remaining = minDuration - elapsed;
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }
      setIsRefreshing(false);
    }
  }, [refetchRideHistory]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <OfflineBanner />
      <GlassHeader title="My Trips" showBack={false} />

      <GlassScrollView
        indicatorTop={headerMetrics.indicatorTop}
        contentContainerStyle={[
          styles.list,
          {
            paddingTop: headerMetrics.contentTop,
            paddingBottom: TAB_BAR_SCREEN_BOTTOM_PADDING,
          },
        ]}
        onRefresh={handleRefresh}
        refreshing={isRefreshing}
        refreshIndicatorTop={headerMetrics.headerInset + 44}
      >
        {rideHistory.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="map" size={icons.size.hero} color={colors.mutedForeground} />
            <AppText variant="h2" style={[styles.emptyTitle, { color: colors.foreground }]}>No trips yet</AppText>
            <AppText variant="bodySmall" style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
              Your completed trips will appear here
            </AppText>
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
    paddingBottom: spacing[8],
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
    paddingVertical: semanticSpacing.listItemPadding,
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
    gap: semanticSpacing.rowGap,
    minWidth: 0,
  },
  chevronAnchor: {
    position: 'absolute',
    right: CARD_CONTENT_INSET,
    top: spacing[0],
    bottom: spacing[0],
    justifyContent: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: semanticSpacing.rowGap,
    minWidth: 0,
  },
  vehicleLabel: {
    flex: 1,
    ...typography.title,
    minWidth: 0,
  },
  routeRow: { flexDirection: 'row', gap: semanticSpacing.rowGap, alignItems: 'center' },
  routeLabels: { flex: 1, gap: spacing[10] },
  routeText: { ...typography.bodySmall },
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
    gap: spacing[4],
    flexShrink: 0,
  },
  metaItemDate: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  metaText: {
    ...typography.caption,
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
    ...typography.bodySmall,
    fontFamily: typography.badge.fontFamily,
    textAlign: 'right',
    ...Platform.select({
      ios: { fontVariant: ['tabular-nums'] },
      default: {},
    }),
  },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: spacing[64] + spacing[16], gap: semanticSpacing.rowGap },
  emptyTitle: { ...typography.h2 },
  emptyDesc: { ...typography.bodySmall, textAlign: 'center' },
});
