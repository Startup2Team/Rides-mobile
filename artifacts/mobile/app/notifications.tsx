import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { GlassScrollView } from '@/components/GlassScrollView';
import { useColors } from '@/hooks/useColors';
import { FORM_BOTTOM_PADDING } from '@/constants/tabBar';
import { useToast } from '@/context/ToastContext';
import { APPLE_SYSTEM_BLUE_HEX } from '@/constants/systemColors';
import { useRide } from '@/context/RideContext';
import { useAuth } from '@/context/AuthContext';
import { getPackagePurchaseSnapshot, type DriverEntitlement } from '@/domain/driverRidePackages';
import type { Ride } from '@/types';
import { AppText } from '@/components/AppText';
import { icons } from '@/constants/icons';
import { radius } from '@/constants/radius';
import { sizes } from '@/constants/sizes';
import { spacing, semanticSpacing } from '@/constants/spacing';
import { typography } from '@/constants/typography';
import {
  getNotificationAccentColor,
  getNotificationDayBucket,
  useNotifications,
  type NotificationItem,
} from '@/domains/notifications';

const TYPE_ICON_COLOR: Record<NotificationItem['type'], string> = {
  ride: APPLE_SYSTEM_BLUE_HEX.light,
  promo: '#FFB800',
  system: '#007AFF',
  safety: '#FF3B30',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function buildRideNotifications(rideHistory: { id: string; destination?: { address?: string }; agreedFare?: number; completedAt?: string }[]): NotificationItem[] {
  return rideHistory.slice(0, 5).map(ride => ({
    id: `ride_${ride.id}`,
    type: 'ride' as const,
    icon: 'check-circle',
    title: 'Ride completed',
    message: `Your ride to ${ride.destination?.address ?? 'destination'} was completed. Fare: ${ride.agreedFare?.toLocaleString() ?? '—'} RWF`,
    time: ride.completedAt ?? new Date().toISOString(),
    read: true,
    rideId: ride.id,
  }));
}

function buildDriverNotifications({
  currentRide,
  driverId,
  entitlement,
  pendingRequest,
  rideHistory,
  rideCredits,
}: {
  currentRide: Ride | null;
  driverId?: string;
  entitlement: DriverEntitlement;
  pendingRequest: Ride | null;
  rideHistory: Ride[];
  rideCredits: number;
}): NotificationItem[] {
  const tripNotifications = rideHistory
    .filter(ride => ride.status === 'completed' && ride.driverId === driverId)
    .slice(0, 5)
    .map(ride => ({
      id: `driver_ride_${ride.id}`,
      type: 'ride' as const,
      icon: 'check-circle' as const,
      title: 'Trip completed',
      message: `Trip to ${ride.destination?.address ?? 'destination'} completed. Ride revenue: ${ride.agreedFare?.toLocaleString() ?? '—'} RWF`,
      time: ride.completedAt ?? ride.createdAt,
      read: true,
      rideId: ride.id,
    }));

  const liveTripNotifications: NotificationItem[] = [];
  if (pendingRequest) {
    liveTripNotifications.push({
      id: `driver_request_${pendingRequest.id}`,
      type: 'ride',
      icon: 'bell',
      title: 'New ride request',
      message: `${pendingRequest.pickup.address ?? 'Pickup'} to ${pendingRequest.destination.address ?? 'destination'}`,
      time: pendingRequest.createdAt,
      read: false,
      rideId: pendingRequest.id,
    });
  } else if (currentRide && !['completed', 'cancelled', 'idle'].includes(currentRide.status)) {
    liveTripNotifications.push({
      id: `driver_active_${currentRide.id}`,
      type: 'ride',
      icon: 'navigation',
      title: 'Active trip',
      message: `${currentRide.pickup.address ?? 'Pickup'} to ${currentRide.destination.address ?? 'destination'}`,
      time: currentRide.createdAt,
      read: false,
      rideId: currentRide.id,
    });
  }

  const packageNotifications = entitlement.purchaseHistory.slice(0, 3).map(purchase => {
    const purchaseSnapshot = getPackagePurchaseSnapshot(purchase);
    const successful = purchase.status === 'successful';
    return {
      id: `driver_package_${purchase.transactionId}`,
      type: successful ? 'system' as const : 'safety' as const,
      icon: successful ? 'package' as const : 'alert-circle' as const,
      title: successful ? 'Ride package activated' : 'Ride package update',
      message: successful
        ? `${purchaseSnapshot?.packageName ?? purchase.packageId} is active with ${purchaseSnapshot?.ridesGranted ?? purchase.ridesGranted ?? 0} rides.`
        : `${purchaseSnapshot?.packageName ?? purchase.packageId} payment status: ${purchase.status}.`,
      time: purchase.completedAt ?? purchase.purchasedAt ?? purchase.createdAt,
      read: successful,
    };
  });

  const creditNotifications: NotificationItem[] = [];
  if (rideCredits <= 5) {
    creditNotifications.push({
      id: `driver_low_credits_${rideCredits}`,
      type: rideCredits === 0 ? 'safety' : 'system',
      icon: 'alert-circle',
      title: rideCredits === 0 ? 'No rides left' : 'Rides running low',
      message: rideCredits === 0
        ? 'View ride packages to continue receiving ride requests.'
        : `${rideCredits} rides left. View packages before they run out.`,
      time: entitlement.updatedAt || new Date().toISOString(),
      read: false,
    });
  }

  return [...liveTripNotifications, ...creditNotifications, ...packageNotifications, ...tripNotifications];
}

const STATIC_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'safety_1',
    type: 'safety',
    icon: 'shield',
    title: 'Safety reminder',
    message: 'Always confirm the plate number and driver name before starting your ride.',
    time: new Date(Date.now() - 3600000).toISOString(),
    read: false,
  },
  {
    id: 'system_1',
    type: 'system',
    icon: 'map-pin',
    title: 'Drivers nearby',
    message: 'Moto and cab drivers are available around your area right now.',
    time: new Date(Date.now() - 7200000).toISOString(),
    read: true,
  },
  {
    id: 'promo_1',
    type: 'promo',
    icon: 'gift',
    title: 'Weekend promo',
    message: 'Get 15% off your next 2 rides this weekend.',
    time: new Date(Date.now() - 26 * 3600000).toISOString(),
    read: true,
  },
  {
    id: 'system_2',
    type: 'system',
    icon: 'clock',
    title: 'App update',
    message: 'Performance and reliability improvements are now live.',
    time: new Date(Date.now() - 4 * 24 * 3600000).toISOString(),
    read: true,
  },
];

function EmptyState({ color, driverMode, mutedColor }: { color: string; driverMode: boolean; mutedColor: string }) {
  return (
    <View style={emptyStyles.wrap}>
      <View style={emptyStyles.iconCircle}>
        <Feather name="bell-off" size={icons.size.xxl} color={color} />
      </View>
      <AppText variant="h3" style={[emptyStyles.title, { color }]}>No notifications yet</AppText>
      <AppText variant="bodySmall" style={[emptyStyles.desc, { color: mutedColor }]}>
        {driverMode
          ? "We'll notify you about ride requests, completed trips, and ride package updates."
          : "We'll notify you when your driver is confirmed, on the way, or has arrived."}
      </AppText>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[40], paddingVertical: spacing[64] - spacing[4] },
  iconCircle: { width: sizes.thumbnail.md, height: sizes.thumbnail.md, borderRadius: spacing[32] + spacing[4], alignItems: 'center', justifyContent: 'center', marginBottom: semanticSpacing.cardPadding },
  title: { ...typography.h3, fontFamily: typography.badge.fontFamily, marginBottom: semanticSpacing.inlineGap },
  desc: { ...typography.bodySmall, textAlign: 'center', lineHeight: 22 },
});

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const { user } = useAuth();
  const { loadHistory } = useRide();
  const { showToast } = useToast();
  const { notifications, unreadCount, refreshNotifications, markNotificationRead, markNotificationUnread, markAllNotificationsRead } = useNotifications();
  const driverMode = user?.mode === 'driver';
  const screenWidth = Dimensions.get('window').width;

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [swipeResetKey, setSwipeResetKey] = useState(0);
  const swipeRefs = useRef<Record<string, Swipeable | null>>({});
  const openRowId = useRef<string | null>(null);
  const autoSwipeLockRef = useRef<Record<string, 'read' | 'delete' | undefined>>({});
  const horizontalListPadding = spacing[28];
  const halfCardSwipeThreshold = Math.max(sizes.iconButton.md, (screenWidth - horizontalListPadding) / 2);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    const start = Date.now();
    try {
      await loadHistory();
      await refreshNotifications();
    } finally {
      const elapsed = Date.now() - start;
      const minDuration = process.env.NODE_ENV === 'test' ? 0 : 800;
      const remaining = minDuration - elapsed;
      if (remaining > 0) {
        await new Promise(resolve => setTimeout(resolve, remaining));
      }
      setIsRefreshing(false);
    }
  }, [loadHistory, refreshNotifications]);

  const visibleNotifications = useMemo(
    () => notifications.filter(notification => !dismissedIds.has(notification.id)),
    [dismissedIds, notifications],
  );

  const todayNotifications = useMemo(
    () => visibleNotifications.filter(notification => getNotificationDayBucket(notification.time) === 'today'),
    [visibleNotifications],
  );
  const yesterdayNotifications = useMemo(
    () => visibleNotifications.filter(notification => getNotificationDayBucket(notification.time) === 'yesterday'),
    [visibleNotifications],
  );
  const previousNotifications = useMemo(
    () => visibleNotifications.filter(notification => getNotificationDayBucket(notification.time) === 'previous'),
    [visibleNotifications],
  );

  const closeAllRows = useCallback((exceptId?: string) => {
    Object.entries(swipeRefs.current).forEach(([rowId, row]) => {
      if (!row || rowId === exceptId) return;
      row.close();
    });
  }, []);

  const markRead = useCallback(async (id: string) => {
    await markNotificationRead(id);
  }, [markNotificationRead]);

  const toggleReadState = useCallback(async (id: string) => {
    const item = notifications.find(notification => notification.id === id);
    if (!item) return;
    await (item.read ? markNotificationUnread(id) : markNotificationRead(id));
    showToast(item.read ? 'Marked as unread' : 'Marked as read', item.read ? 'info' : 'success');
  }, [markNotificationRead, markNotificationUnread, notifications, showToast]);

  const markAllRead = useCallback(async () => {
    if (unreadCount <= 0) return;
    Haptics.selectionAsync();
    await markAllNotificationsRead();
    showToast('All notifications marked as read');
  }, [markAllNotificationsRead, showToast, unreadCount]);

  const deleteNotification = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDismissedIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    showToast('Notification deleted', 'error');
  }, [showToast]);

  const confirmDeleteNotification = useCallback((id: string) => {
    Alert.alert(
      'Delete notification',
      'Are you sure you want to delete this notification?',
      [
        {
          text: 'Delete',
          onPress: () => deleteNotification(id),
        },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true },
    );
  }, [deleteNotification]);

  const renderItem = (item: NotificationItem) => {
    const accentColor = item.icon === 'check-circle' ? colors.foreground : getNotificationAccentColor(item.type);

    return (
      <Swipeable
        key={`${item.id}-${swipeResetKey}`}
        ref={ref => {
          swipeRefs.current[item.id] = ref;
        }}
        overshootLeft={false}
        overshootRight={false}
        friction={1}
        leftThreshold={halfCardSwipeThreshold}
        rightThreshold={halfCardSwipeThreshold}
        dragOffsetFromLeftEdge={radius.sheetCompact}
        dragOffsetFromRightEdge={radius.sheetCompact}
        onSwipeableWillOpen={() => {
          closeAllRows(item.id);
          openRowId.current = item.id;
        }}
        onSwipeableWillClose={() => {
          if (openRowId.current === item.id) {
            openRowId.current = null;
          }
          autoSwipeLockRef.current[item.id] = undefined;
        }}
        onSwipeableOpen={(direction) => {
          if (direction === 'left') {
            if (autoSwipeLockRef.current[item.id] === 'read') return;
            autoSwipeLockRef.current[item.id] = 'read';
            swipeRefs.current[item.id]?.close();
            openRowId.current = null;
            setSwipeResetKey(prev => prev + 1);
            void toggleReadState(item.id);
            return;
          }
          if (direction === 'right') {
            if (autoSwipeLockRef.current[item.id] === 'delete') return;
            autoSwipeLockRef.current[item.id] = 'delete';
            swipeRefs.current[item.id]?.close();
            openRowId.current = null;
            setSwipeResetKey(prev => prev + 1);
            confirmDeleteNotification(item.id);
          }
        }}
        renderLeftActions={() => (
          <View style={[styles.leftActionTrack, { width: halfCardSwipeThreshold }]}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                {
                  backgroundColor: colors.primary,
                  marginRight: semanticSpacing.inlineGap,
                },
              ]}
              onPress={() => {
                swipeRefs.current[item.id]?.close();
                openRowId.current = null;
                setSwipeResetKey(prev => prev + 1);
                void toggleReadState(item.id);
              }}
              accessibilityRole="button"
              accessibilityLabel={item.read ? 'Mark notification unread' : 'Mark notification read'}
              accessibilityHint={item.read ? 'Marks this notification as unread' : 'Marks this notification as read'}
            >
              <Feather name="mail" size={icons.size.xs} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
        renderRightActions={() => (
          <View style={[styles.rightActionTrack, { width: halfCardSwipeThreshold }]}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                {
                  backgroundColor: colors.destructive,
                  marginLeft: semanticSpacing.inlineGap,
                },
              ]}
              onPress={() => {
                swipeRefs.current[item.id]?.close();
                openRowId.current = null;
                setSwipeResetKey(prev => prev + 1);
                confirmDeleteNotification(item.id);
              }}
              accessibilityRole="button"
              accessibilityLabel="Delete notification"
              accessibilityHint="Removes this notification from the list"
            >
              <Feather name="trash-2" size={icons.size.xs} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      >
        <TouchableOpacity
          style={[
            styles.row,
            {
              backgroundColor: item.read ? colors.card : colors.primaryHex + '16',
              borderColor: item.read ? colors.border : colors.primaryHex + '45',
              borderWidth: item.read ? StyleSheet.hairlineWidth : 1,
            },
          ]}
          onPress={() => {
            void markRead(item.id);
            if (item.type === 'ride' && item.rideId && item.icon === 'check-circle') {
              router.push(`/ride-detail?rideId=${item.rideId}` as any);
            } else if (item.title === 'Ride package activated') {
              router.push('/(driver)/stats');
            }
          }}
          activeOpacity={0.75}
        >
          <View style={styles.iconWrap}>
            <Feather name={item.icon} size={icons.semantic.row} color={accentColor} />
          </View>
          <View style={styles.textWrap}>
            <View style={styles.titleRow}>
              <AppText
                variant="bodySmall"
                style={[
                  styles.title,
                  { color: item.read ? colors.foreground : colors.primary },
                ]}
                numberOfLines={1}
              >
                {item.title}
              </AppText>
              <AppText variant="tiny" style={[styles.time, { color: colors.mutedForeground }]}>
                {timeAgo(item.time)}
              </AppText>
            </View>
            <AppText variant="label" style={[styles.message, { color: colors.mutedForeground }]} numberOfLines={2}>
              {item.message}
            </AppText>
          </View>
          {!item.read && <View style={[styles.dot, { backgroundColor: colors.primary }]} />}
        </TouchableOpacity>
      </Swipeable>
    );
  };

  const renderSection = (title: string, items: NotificationItem[]) => (
    <>
      <AppText variant="label" style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{title}</AppText>
      {items.length === 0 ? (
        <AppText variant="label" style={[styles.emptySectionText, { color: colors.mutedForeground }]}>
          No notifications
        </AppText>
      ) : (
        items.map((item, index) => (
          <React.Fragment key={item.id}>
            {index > 0 && <View style={{ height: semanticSpacing.inlineGap }} />}
            {renderItem(item)}
          </React.Fragment>
        ))
      )}
    </>
  );

  const derivedUnreadCount = unreadCount > 0 ? unreadCount : notifications.filter(notification => !notification.read).length;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <GlassHeader
        title="Notifications"
        titleAccessory={derivedUnreadCount > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.primary }]}>
            <AppText variant="badge" style={styles.badgeText}>{derivedUnreadCount}</AppText>
          </View>
        )}
        right={derivedUnreadCount > 0 ? (
          <View style={styles.markAllSlot}>
            <TouchableOpacity onPress={() => { void markAllRead(); }} style={styles.markAllBtn}>
              <AppText variant="label" style={[styles.markAllText, { color: colors.primary }]}>Mark all read</AppText>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ width: sizes.avatar.xxl }} />
        )}
      />

      <GlassScrollView
        indicatorTop={headerMetrics.indicatorTop}
        contentContainerStyle={[
          styles.list,
          { paddingTop: headerMetrics.contentTop, paddingBottom: insets.bottom + FORM_BOTTOM_PADDING },
          visibleNotifications.length === 0 && { flex: 1 },
        ]}
        onRefresh={handleRefresh}
        refreshing={isRefreshing}
        refreshIndicatorTop={headerMetrics.headerInset + 44}
      >
        {visibleNotifications.length === 0 ? (
          <EmptyState color={colors.primaryHex} driverMode={driverMode} mutedColor={colors.mutedForeground} />
        ) : (
          <>
            {renderSection('Today', todayNotifications)}
            {renderSection('Yesterday', yesterdayNotifications)}
            {renderSection('Previous', previousNotifications)}
          </>
        )}
      </GlassScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  badge: { minWidth: spacing[20], height: spacing[20], borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { ...typography.badge, color: '#000' },
  markAllSlot: { flex: 1, alignItems: 'flex-end', justifyContent: 'center' },
  markAllBtn: { minWidth: sizes.avatar.xxl, alignItems: 'flex-end' },
  markAllText: { ...typography.label },
  list: { padding: semanticSpacing.listItemPadding },
  sectionTitle: {
    ...typography.label,
    fontFamily: typography.title.fontFamily,
    marginTop: semanticSpacing.cardPadding,
    marginBottom: spacing[10],
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  emptySectionText: {
    ...typography.label,
    fontFamily: typography.caption.fontFamily,
    marginBottom: semanticSpacing.inlineGap,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: semanticSpacing.rowGap,
    gap: semanticSpacing.rowGap,
    minHeight: sizes.thumbnail.lg,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: radius['3xl'] - spacing[2],
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  leftActionTrack: {
    minHeight: sizes.thumbnail.lg,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  rightActionTrack: {
    minHeight: sizes.thumbnail.lg,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  iconWrap: { width: sizes.avatar.md, height: sizes.avatar.md, borderRadius: radius['3xl'], alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  textWrap: { flex: 1, gap: spacing[4], minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: semanticSpacing.inlineGap },
  title: { flex: 1, ...typography.bodySmall, fontFamily: typography.badge.fontFamily },
  time: { ...typography.tiny, flexShrink: 0 },
  message: { ...typography.label, fontFamily: typography.caption.fontFamily },
  dot: { width: 9, height: 9, borderRadius: 5, flexShrink: 0 },
});
