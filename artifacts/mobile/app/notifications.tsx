import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { GlassScrollView } from '@/components/GlassScrollView';
import { useColors } from '@/hooks/useColors';
import { useToast } from '@/context/ToastContext';
import { APPLE_SYSTEM_BLUE_HEX } from '@/constants/systemColors';
import { useRide } from '@/context/RideContext';

type NotifType = 'ride' | 'promo' | 'system' | 'safety';

interface AppNotification {
  id: string;
  type: NotifType;
  icon: keyof typeof Feather.glyphMap;
  title: string;
  message: string;
  time: string;
  read: boolean;
  rideId?: string;
}

const TYPE_ICON_COLOR: Record<NotifType, string> = {
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

function getDayBucket(time: string): 'today' | 'yesterday' | 'previous' {
  const notificationDate = new Date(time);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfNotificationDay = new Date(
    notificationDate.getFullYear(),
    notificationDate.getMonth(),
    notificationDate.getDate(),
  ).getTime();
  const diffDays = Math.floor((startOfToday - startOfNotificationDay) / 86400000);

  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  return 'previous';
}

function buildRideNotifications(rideHistory: { id: string; destination?: { address?: string }; agreedFare?: number; completedAt?: string }[]): AppNotification[] {
  return rideHistory.slice(0, 5).map(ride => ({
    id: `ride_${ride.id}`,
    type: 'ride' as const,
    icon: 'check-circle' as const,
    title: 'Ride completed',
    message: `Your ride to ${ride.destination?.address ?? 'destination'} was completed. Fare: ${ride.agreedFare?.toLocaleString() ?? '—'} RWF`,
    time: ride.completedAt ?? new Date().toISOString(),
    read: true,
    rideId: ride.id,
  }));
}

const STATIC_NOTIFICATIONS: AppNotification[] = [
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

function EmptyState({ color, mutedColor }: { color: string; mutedColor: string }) {
  return (
    <View style={emptyStyles.wrap}>
      <View style={emptyStyles.iconCircle}>
        <Feather name="bell-off" size={32} color={color} />
      </View>
      <Text style={[emptyStyles.title, { color }]}>No notifications yet</Text>
      <Text style={[emptyStyles.desc, { color: mutedColor }]}>
        We'll notify you when your driver is confirmed, on the way, or has arrived.
      </Text>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingVertical: 60 },
  iconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 18, fontFamily: 'Inter_700Bold', marginBottom: 8 },
  desc: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22 },
});

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const { rideHistory } = useRide();
  const { showToast } = useToast();
  const screenWidth = Dimensions.get('window').width;

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [swipeResetKey, setSwipeResetKey] = useState(0);
  const swipeRefs = useRef<Record<string, Swipeable | null>>({});
  const openRowId = useRef<string | null>(null);
  const autoSwipeLockRef = useRef<Record<string, 'read' | 'delete' | undefined>>({});
  const horizontalListPadding = 28;
  const halfCardSwipeThreshold = Math.max(44, (screenWidth - horizontalListPadding) / 2);

  useEffect(() => {
    const rideNotifs = buildRideNotifications(rideHistory as any);
    const merged = [...STATIC_NOTIFICATIONS, ...rideNotifs].sort(
      (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime(),
    );
    setNotifications(merged);
  }, [rideHistory]);

  const unreadCount = notifications.filter(n => !n.read).length;
  const todayNotifications = notifications.filter(n => getDayBucket(n.time) === 'today');
  const yesterdayNotifications = notifications.filter(n => getDayBucket(n.time) === 'yesterday');
  const previousNotifications = notifications.filter(n => getDayBucket(n.time) === 'previous');

  const markAllRead = () => {
    const hadUnread = notifications.some(n => !n.read);
    if (!hadUnread) return;
    Haptics.selectionAsync();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    showToast('All notifications marked as read');
  };

  const markRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const toggleReadState = (id: string) => {
    const item = notifications.find(n => n.id === id);
    if (!item) return;
    const nextRead = !item.read;
    Haptics.selectionAsync();
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: nextRead } : n));
    showToast(nextRead ? 'Marked as read' : 'Marked as unread', nextRead ? 'success' : 'info');
  };

  const deleteNotification = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNotifications(prev => prev.filter(n => n.id !== id));
    showToast('Notification deleted', 'error');
  };

  const confirmDeleteNotification = (id: string) => {
    Alert.alert(
      'Delete notification',
      'Are you sure you want to delete this notification?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          onPress: () => deleteNotification(id),
        },
      ],
      { cancelable: true },
    );
  };

  const closeAllRows = (exceptId?: string) => {
    Object.entries(swipeRefs.current).forEach(([rowId, row]) => {
      if (!row || rowId === exceptId) return;
      row.close();
    });
  };

  const renderItem = (item: AppNotification) => {
    const accentColor = TYPE_ICON_COLOR[item.type];

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
        dragOffsetFromLeftEdge={22}
        dragOffsetFromRightEdge={22}
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
          // direction 'left' = swiped right (reveals mail / read toggle)
          // direction 'right' = swiped left (reveals delete)
          if (direction === 'left') {
            if (autoSwipeLockRef.current[item.id] === 'read') return;
            autoSwipeLockRef.current[item.id] = 'read';
            swipeRefs.current[item.id]?.close();
            openRowId.current = null;
            setSwipeResetKey(prev => prev + 1);
            toggleReadState(item.id);
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
                  marginRight: 8,
                },
              ]}
              onPress={() => {
                swipeRefs.current[item.id]?.close();
                openRowId.current = null;
                setSwipeResetKey(prev => prev + 1);
                toggleReadState(item.id);
              }}
              accessibilityRole="button"
              accessibilityLabel={item.read ? 'Mark notification unread' : 'Mark notification read'}
              accessibilityHint={item.read ? 'Marks this notification as unread' : 'Marks this notification as read'}
            >
              <Feather name="mail" size={14} color="#fff" />
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
                  marginLeft: 8,
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
              <Feather name="trash-2" size={14} color="#fff" />
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
            markRead(item.id);
            if (item.type === 'ride' && item.rideId) {
              router.push(`/ride-detail?rideId=${item.rideId}` as any);
            }
          }}
          activeOpacity={0.75}
        >
          <View style={styles.iconWrap}>
            <Feather name={item.icon} size={18} color={accentColor} />
          </View>
          <View style={styles.textWrap}>
            <View style={styles.titleRow}>
              <Text
                style={[
                  styles.title,
                  { color: item.read ? colors.foreground : colors.primary },
                ]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              <Text style={[styles.time, { color: colors.mutedForeground }]}>
                {timeAgo(item.time)}
              </Text>
            </View>
            <Text style={[styles.message, { color: colors.mutedForeground }]} numberOfLines={2}>
              {item.message}
            </Text>
          </View>
          {!item.read && <View style={[styles.dot, { backgroundColor: colors.primary }]} />}
        </TouchableOpacity>
      </Swipeable>
    );
  };

  const renderSection = (title: string, items: AppNotification[]) => (
    <>
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{title}</Text>
      {items.length === 0 ? (
        <Text style={[styles.emptySectionText, { color: colors.mutedForeground }]}>
          No notifications
        </Text>
      ) : (
        items.map((item, index) => (
          <React.Fragment key={item.id}>
            {index > 0 && <View style={{ height: 8 }} />}
            {renderItem(item)}
          </React.Fragment>
        ))
      )}
    </>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <GlassHeader
        title="Notifications"
        titleAccessory={unreadCount > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.primary }]}>
            <Text style={styles.badgeText}>{unreadCount}</Text>
          </View>
        )}
        right={unreadCount > 0 ? (
          <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn}>
            <Text style={[styles.markAllText, { color: colors.primary }]}>Mark all read</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 80 }} />
        )}
      />

      <GlassScrollView
        indicatorTop={headerMetrics.indicatorTop}
        contentContainerStyle={[
          styles.list,
          { paddingTop: headerMetrics.contentTop, paddingBottom: insets.bottom + 28 },
          notifications.length === 0 && { flex: 1 },
        ]}
      >
        {notifications.length === 0 ? (
          <EmptyState color={colors.primaryHex} mutedColor={colors.mutedForeground} />
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
  badge: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: '#000' },
  markAllBtn: { width: 80, alignItems: 'flex-end' },
  markAllText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  list: { padding: 14 },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 16,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  emptySectionText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 12,
    minHeight: 76,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  leftActionTrack: {
    minHeight: 76,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  rightActionTrack: {
    minHeight: 76,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  textWrap: { flex: 1, gap: 4, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 14, fontFamily: 'Inter_700Bold' },
  time: { fontSize: 11, fontFamily: 'Inter_500Medium', flexShrink: 0 },
  message: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  dot: { width: 9, height: 9, borderRadius: 5, flexShrink: 0 },
});
