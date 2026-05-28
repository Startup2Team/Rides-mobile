import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { GlassScrollView } from '@/components/GlassScrollView';
import { useColors } from '@/hooks/useColors';
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
  ride: '#00C853',
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

  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    const rideNotifs = buildRideNotifications(rideHistory as any);
    const merged = [...STATIC_NOTIFICATIONS, ...rideNotifs].sort(
      (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime(),
    );
    setNotifications(merged);
  }, [rideHistory]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => {
    Haptics.selectionAsync();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const markRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const renderItem = (item: AppNotification) => {
    const accentColor = TYPE_ICON_COLOR[item.type];
    return (
      <TouchableOpacity
        style={[
          styles.row,
          {
            backgroundColor: item.read ? colors.card : colors.primary + '08',
            borderColor: item.read ? colors.border : colors.primary + '30',
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
            <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
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
    );
  };

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
          <EmptyState color={colors.primary} mutedColor={colors.mutedForeground} />
        ) : (
          notifications.map((item, index) => (
            <React.Fragment key={item.id}>
              {index > 0 && <View style={{ height: 8 }} />}
              {renderItem(item)}
            </React.Fragment>
          ))
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 12,
    minHeight: 76,
  },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  textWrap: { flex: 1, gap: 4, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 14, fontFamily: 'Inter_700Bold' },
  time: { fontSize: 11, fontFamily: 'Inter_500Medium', flexShrink: 0 },
  message: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  dot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
});
