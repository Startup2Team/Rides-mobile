import { router, useLocalSearchParams } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  Animated,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { BackButton } from '@/components/BackButton';
import { StatusChip } from '@/components/StatusChip';
import { useColors } from '@/hooks/useColors';
import { useRide } from '@/context/RideContext';
import { VEHICLE_LABELS } from '@/types';

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

function Header({ title }: { title: string }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const materialRgb = scheme === 'dark' ? '0,0,0' : '245,245,245';
  const glassTint = scheme === 'dark' ? 'dark' : 'light';

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) + 12,
        },
      ]}
    >
      <BlurView intensity={60} tint={glassTint} style={StyleSheet.absoluteFill} />
      <LinearGradient
        pointerEvents="none"
        colors={[
          `rgba(${materialRgb},0.52)`,
          `rgba(${materialRgb},0.22)`,
          `rgba(${materialRgb},0)`,
        ]}
        locations={[0, 0.48, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.headerContent}>
        <BackButton onPress={() => router.back()} />
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{title}</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>
    </View>
  );
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

export default function RideDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { rideId } = useLocalSearchParams<{ rideId: string }>();
  const { rideHistory, loadHistory } = useRide();
  const headerInset = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const scrollY = React.useRef(new Animated.Value(0)).current;
  const scrollIndicatorOpacity = React.useRef(new Animated.Value(0)).current;
  const hideScrollIndicatorTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scrollMetrics, setScrollMetrics] = React.useState({
    contentHeight: 1,
    viewportHeight: 1,
    indicatorTrackHeight: 1,
  });

  React.useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const ride = rideHistory.find(r => r.id === rideId) ?? null;

  if (!ride) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <Header title="Ride Details" />
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
  const canScroll = scrollMetrics.contentHeight > scrollMetrics.viewportHeight + 12;
  const indicatorHeight = Math.max(
    24,
    Math.min(
      80,
      (scrollMetrics.viewportHeight / scrollMetrics.contentHeight) * scrollMetrics.indicatorTrackHeight,
    ),
  );
  const indicatorTravel = Math.max(0, scrollMetrics.indicatorTrackHeight - indicatorHeight);
  const indicatorTranslateY = scrollY.interpolate({
    inputRange: [0, Math.max(1, scrollMetrics.contentHeight - scrollMetrics.viewportHeight)],
    outputRange: [0, indicatorTravel],
    extrapolate: 'clamp',
  });

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.setValue(event.nativeEvent.contentOffset.y);
    scrollIndicatorOpacity.setValue(1);
    if (hideScrollIndicatorTimeout.current) clearTimeout(hideScrollIndicatorTimeout.current);
    hideScrollIndicatorTimeout.current = setTimeout(() => {
      Animated.timing(scrollIndicatorOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }, 700);
  };

  React.useEffect(() => {
    return () => {
      if (hideScrollIndicatorTimeout.current) clearTimeout(hideScrollIndicatorTimeout.current);
    };
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Header title="Ride Details" />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: headerInset + 90,
            paddingBottom: insets.bottom + 40,
          },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        onContentSizeChange={(_, contentHeight) => {
          setScrollMetrics(prev => ({ ...prev, contentHeight }));
        }}
        onLayout={event => {
          const viewportHeight = event.nativeEvent.layout.height;
          setScrollMetrics(prev => ({ ...prev, viewportHeight }));
        }}
      >
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.summaryTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Total paid</Text>
              <Text style={[styles.fareValue, { color: colors.foreground }]}>
                {fare.toLocaleString()} RWF
              </Text>
            </View>
            <StatusChip status={ride.status} />
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
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.routeRow}>
            <View style={styles.routeIcons}>
              <View style={[styles.dot, { backgroundColor: colors.primary }]} />
              <View style={[styles.routeLine, { backgroundColor: colors.border }]} />
              <View style={[styles.dot, styles.destinationDot, { backgroundColor: colors.destructive }]} />
            </View>
            <View style={styles.routeLabels}>
              <View style={styles.routeItem}>
                <Text style={[styles.routeItemLabel, { color: colors.mutedForeground }]}>Pickup</Text>
                <Text style={[styles.routeItemValue, { color: colors.foreground }]}>
                  {ride.pickup.address ?? 'Pickup location'}
                </Text>
              </View>
              <View style={[styles.routeDivider, { backgroundColor: colors.border }]} />
              <View style={styles.routeItem}>
                <Text style={[styles.routeItemLabel, { color: colors.mutedForeground }]}>Drop off</Text>
                <Text style={[styles.routeItemValue, { color: colors.foreground }]}>
                  {ride.destination.address ?? 'Destination'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>TRIP SUMMARY</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <DetailRow icon="map" label="Distance" value={`${ride.distance} km`} color={colors.primary} />
          <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
          <DetailRow icon="clock" label="Duration" value={formatDuration(ride.duration)} color={colors.primary} />
          <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
          <DetailRow
            icon="credit-card"
            label={ride.agreedFare ? 'Agreed fare' : 'Estimated fare'}
            value={`${fare.toLocaleString()} RWF`}
            color={colors.primary}
            valueColor={colors.primary}
          />
          <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
          <DetailRow icon="hash" label="Ride ID" value={ride.id.slice(-8).toUpperCase()} color={colors.primary} />
        </View>

        {ride.driver && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>DRIVER</Text>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.driverRow}>
                {driverImage ? (
                  <Image source={{ uri: driverImage }} style={styles.driverAvatarImage} />
                ) : (
                  <View style={styles.driverAvatar}>
                    <Feather name="user" size={24} color={colors.primary} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.driverName, { color: colors.foreground }]}>{ride.driver.name}</Text>
                  <Text style={[styles.driverSub, { color: colors.mutedForeground }]}>
                    {VEHICLE_LABELS[ride.driver.vehicleType]} - {ride.driver.plateNumber}
                  </Text>
                </View>
                <View style={styles.ratingBadge}>
                  <Text style={[styles.ratingText, { color: colors.primary }]}>★ {ride.driver.rating?.toFixed(1)}</Text>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
      {canScroll && (
        <View
          pointerEvents="none"
          style={[
            styles.scrollIndicatorTrack,
            {
              top: headerInset + 88,
              bottom: insets.bottom + 24,
            },
          ]}
          onLayout={event => {
            const indicatorTrackHeight = event.nativeEvent.layout.height;
            setScrollMetrics(prev => ({ ...prev, indicatorTrackHeight }));
          }}
        >
          <Animated.View
            style={[
              styles.scrollIndicatorThumb,
              {
                height: indicatorHeight,
                backgroundColor: colors.foreground,
                opacity: scrollIndicatorOpacity,
                transform: [{ translateY: indicatorTranslateY }],
              },
            ]}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingBottom: 14,
    overflow: 'hidden',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    textShadowColor: 'rgba(0,0,0,0.16)',
    textShadowRadius: 8,
  },
  scroll: { paddingHorizontal: 20, gap: 12 },
  scrollIndicatorTrack: {
    position: 'absolute',
    right: 1,
    width: 2,
  },
  scrollIndicatorThumb: {
    width: 2,
    borderRadius: 2,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  summaryCard: {
    borderRadius: 18,
    borderWidth: 1,
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
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },
  routeRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  routeIcons: { alignItems: 'center', gap: 4, paddingVertical: 2 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  destinationDot: { borderRadius: 3 },
  routeLine: { width: 1.5, height: 34 },
  routeLabels: { flex: 1, gap: 10 },
  routeItem: { gap: 3 },
  routeItemLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase' },
  routeItemValue: { fontSize: 14, fontFamily: 'Inter_600SemiBold', lineHeight: 20 },
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
