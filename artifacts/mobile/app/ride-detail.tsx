import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { GlassScrollView } from '@/components/GlassScrollView';
import { StatusChip } from '@/components/StatusChip';
import { RouteTimeline } from '@/components/RouteTimeline';
import { ProfileAvatarCircle } from '@/components/ProfileAvatarCircle';
import { FORM_BOTTOM_PADDING } from '@/constants/tabBar';
import { icons } from '@/constants/icons';
import { radius } from '@/constants/radius';
import { sizes } from '@/constants/sizes';
import { spacing, semanticSpacing } from '@/constants/spacing';
import { useColors } from '@/hooks/useColors';
import { RideLocation, VEHICLE_LABELS } from '@/types';
import { AppText } from '@/components/AppText';
import { typography } from '@/constants/typography';
import { useRideDetailQuery } from '@/query/hooks/useRideHistoryQuery';

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
      <Feather name={icon} size={icons.semantic.row} color={color} />
      <AppText variant="bodySmall" style={[styles.detailLabel, { color: colors.mutedForeground }]}>{label}</AppText>
      <AppText variant="bodySmall" style={[styles.detailValue, { color: valueColor ?? colors.foreground }]} numberOfLines={1}>
        {value}
      </AppText>
    </View>
  );
}

function RouteLocationRow({
  label,
  address,
  location,
}: {
  label: string;
  address: string;
  location: RideLocation;
}) {
  const colors = useColors();

  const handleSave = () => {
    router.push({
      pathname: '/saved-place-selector',
      params: {
        mode: 'add',
        label: 'Other',
        initialAddress: address || '',
        initialLatitude: location.latitude.toString(),
        initialLongitude: location.longitude.toString(),
      },
    });
  };

  return (
    <View style={styles.routeItem}>
      <View style={styles.routeItemText}>
        <AppText variant="tiny" style={[styles.routeItemLabel, { color: colors.mutedForeground }]}>{label}</AppText>
        <AppText variant="bodySmall" style={[styles.routeItemValue, { color: colors.foreground }]}>{address}</AppText>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Save ${label.toLowerCase()} location`}
        accessibilityHint="Opens options to save this place for future rides"
        onPress={handleSave}
        style={({ pressed }) => [
          styles.saveLocationButton,
          { borderColor: colors.border, opacity: pressed ? 0.72 : 1 },
        ]}
      >
        <AppText variant="badge" style={[styles.saveLocationButtonText, { color: colors.primary }]}>Save</AppText>
      </Pressable>
    </View>
  );
}

export default function RideDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const { rideId } = useLocalSearchParams<{ rideId: string }>();
  const rideDetailQuery = useRideDetailQuery(rideId);
  const ride = rideDetailQuery.data ?? null;

  if (!ride) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <GlassHeader title="Ride Details" />
        <View style={styles.empty}>
          <Feather name="map" size={sizes.avatar.md} color={colors.mutedForeground} />
          <AppText variant="h3" style={[styles.emptyTitle, { color: colors.foreground }]}>Ride not found</AppText>
          <AppText variant="bodySmall" style={[styles.emptyText, { color: colors.mutedForeground }]}>
            This ride may not be available in your history anymore.
          </AppText>
        </View>
      </View>
    );
  }

  const completedAt = ride.completedAt ?? ride.createdAt;
  const dateStr = formatRideDate(completedAt);
  const timeStr = formatRideTime(completedAt);
  const fare = ride.agreedFare ?? ride.suggestedFare;
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <GlassHeader title="Ride Details" />

      <GlassScrollView
        indicatorTop={headerMetrics.indicatorTop}
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: headerMetrics.contentTop,
            paddingBottom: insets.bottom + FORM_BOTTOM_PADDING,
          },
        ]}
      >
        <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
          <View style={styles.summaryTopRow}>
            <View style={{ flex: 1 }}>
              <AppText variant="caption" style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Total paid</AppText>
              <AppText variant="display" style={[styles.fareValue, { color: colors.foreground }]}>
                {fare.toLocaleString()} RWF
              </AppText>
            </View>
            <StatusChip status={ride.status} variant="history" />
          </View>

          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />

          <View style={styles.summaryMetaRow}>
            <View style={styles.summaryMetaItem}>
              <AppText variant="tiny" style={[styles.summaryMetaLabel, { color: colors.mutedForeground }]}>Vehicle</AppText>
              <AppText variant="caption" style={[styles.summaryMetaValue, { color: colors.foreground }]} numberOfLines={1}>
                {VEHICLE_LABELS[ride.vehicleType]}
              </AppText>
            </View>
            <View style={[styles.summaryMetaItem, styles.summaryMetaDateItem]}>
              <AppText variant="tiny" style={[styles.summaryMetaLabel, { color: colors.mutedForeground }]}>Date</AppText>
              <AppText variant="caption" style={[styles.summaryMetaValue, { color: colors.foreground }]}>
                {dateStr}
              </AppText>
            </View>
            <View style={styles.summaryMetaItem}>
              <AppText variant="tiny" style={[styles.summaryMetaLabel, { color: colors.mutedForeground }]}>Time</AppText>
              <AppText variant="caption" style={[styles.summaryMetaValue, { color: colors.foreground }]} numberOfLines={1}>
                {timeStr}
              </AppText>
            </View>
          </View>
        </View>

        <AppText variant="tiny" style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ROUTE</AppText>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.routeRow}>
            <RouteTimeline />
            <View style={styles.routeLabels}>
              <RouteLocationRow
                label="Pickup"
                address={ride.pickup.address ?? 'Pickup location'}
                location={ride.pickup}
              />
              <View style={[styles.routeDivider, { backgroundColor: colors.border }]} />
              <RouteLocationRow
                label="Drop off"
                address={ride.destination.address ?? 'Destination'}
                location={ride.destination}
              />
            </View>
          </View>
        </View>

        <AppText variant="tiny" style={[styles.sectionLabel, { color: colors.mutedForeground }]}>TRIP SUMMARY</AppText>
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
            <AppText variant="tiny" style={[styles.sectionLabel, { color: colors.mutedForeground }]}>DRIVER</AppText>
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <View style={styles.driverRow}>
                <ProfileAvatarCircle
                  size={sizes.iconButton.md}
                  initial={ride.driver.name.trim()[0]?.toUpperCase() ?? '?'}
                  imageUri={ride.driver.profileImage ?? null}
                  accessibilityLabel={`${ride.driver.name} profile photo`}
                />
                <View style={{ flex: 1 }}>
                  <AppText variant="body" style={[styles.driverName, { color: colors.foreground }]}>{ride.driver.name}</AppText>
                  <AppText variant="caption" style={[styles.driverSub, { color: colors.mutedForeground }]}>
                    {VEHICLE_LABELS[ride.driver.vehicleType]} - {ride.driver.plateNumber}
                  </AppText>
                </View>
                <View style={styles.ratingBadge}>
                  <AppText variant="label" style={[styles.ratingText, { color: colors.star }]}>★ {ride.driver.rating?.toFixed(1)}</AppText>
                </View>
              </View>
            </View>
          </>
        )}
      </GlassScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: semanticSpacing.screenPadding, gap: semanticSpacing.rowGap },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: semanticSpacing.inlineGap, paddingHorizontal: spacing[32] },
  emptyTitle: { ...typography.h3, fontFamily: typography.badge.fontFamily },
  emptyText: { ...typography.bodySmall, textAlign: 'center' },
  summaryCard: {
    borderRadius: radius['3xl'] - spacing[2],
    padding: radius['3xl'] - spacing[2],
    gap: semanticSpacing.cardPadding,
  },
  summaryTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: semanticSpacing.rowGap },
  summaryLabel: { ...typography.caption, fontFamily: typography.title.fontFamily, textTransform: 'uppercase', letterSpacing: 0.5 },
  fareValue: { ...typography.display, marginTop: spacing[4] },
  summaryDivider: { height: StyleSheet.hairlineWidth },
  summaryMetaRow: { flexDirection: 'row', gap: semanticSpacing.rowGap },
  summaryMetaItem: { flex: 1, minWidth: 0 },
  summaryMetaDateItem: { flex: 1.35 },
  summaryMetaLabel: { ...typography.tiny, marginBottom: 3 },
  summaryMetaValue: { ...typography.caption, fontFamily: typography.badge.fontFamily },
  sectionLabel: {
    ...typography.tiny,
    fontFamily: typography.title.fontFamily,
    letterSpacing: 0.8,
    marginTop: spacing[10],
  },
  card: { borderRadius: radius['2xl'], padding: semanticSpacing.cardPadding },
  routeRow: { flexDirection: 'row', gap: semanticSpacing.listItemPadding, alignItems: 'center' },
  routeLabels: { flex: 1, gap: spacing[10] },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: semanticSpacing.rowGap,
    minWidth: 0,
  },
  routeItemText: { flex: 1, gap: 3, minWidth: 0 },
  routeItemLabel: { ...typography.tiny, fontFamily: typography.title.fontFamily, textTransform: 'uppercase' },
  routeItemValue: { ...typography.bodySmall, fontFamily: typography.title.fontFamily },
  saveLocationButton: {
    minWidth: 54,
    height: sizes.iconButton.sm,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: semanticSpacing.rowGap,
    flexShrink: 0,
  },
  saveLocationButtonText: {
    ...typography.badge,
  },
  routeDivider: { height: StyleSheet.hairlineWidth },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: semanticSpacing.rowGap, minHeight: sizes.iconButton.sm },
  detailLabel: { flex: 1, ...typography.bodySmall },
  detailValue: { maxWidth: '48%', ...typography.bodySmall, fontFamily: typography.badge.fontFamily, textAlign: 'right' },
  rowDivider: { height: StyleSheet.hairlineWidth, marginVertical: semanticSpacing.inlineGap },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: semanticSpacing.rowGap },
  driverName: { ...typography.body, fontFamily: typography.badge.fontFamily },
  driverSub: { ...typography.caption, marginTop: spacing[2] },
  ratingBadge: {
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[4],
    borderRadius: radius.full,
  },
  ratingText: { ...typography.label, fontFamily: typography.title.fontFamily },
});
