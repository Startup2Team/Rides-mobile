import { router } from 'expo-router';
import React from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { BackButton } from '@/components/BackButton';
import { useColors } from '@/hooks/useColors';

const CUSTOMER_NOTIFICATIONS = [
  {
    id: 'location',
    icon: 'map-pin' as const,
    title: 'Pickup point ready',
    message: 'Your current pickup point is set to Kigali, Rwanda.',
    time: 'Now',
    unread: true,
  },
  {
    id: 'drivers',
    icon: 'navigation' as const,
    title: 'Drivers nearby',
    message: 'Moto and cab drivers are available around your area.',
    time: '5 min ago',
    unread: true,
  },
  {
    id: 'safety',
    icon: 'shield' as const,
    title: 'Safety reminder',
    message: 'Confirm the plate number and driver name before starting your ride.',
    time: 'Today',
    unread: false,
  },
];

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) + 12,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <BackButton onPress={() => router.back()} />
        <View style={styles.headerTitleWrap}>
          <Text style={[styles.title, { color: colors.foreground }]}>Notifications</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Customer updates</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 90 : 28) },
        ]}
      >
        {CUSTOMER_NOTIFICATIONS.map(item => (
          <View
            key={item.id}
            style={[styles.notificationRow, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={[styles.iconWrap, { backgroundColor: item.unread ? colors.primary + '18' : colors.muted }]}>
              <Feather
                name={item.icon}
                size={18}
                color={item.unread ? colors.primary : colors.mutedForeground}
              />
            </View>
            <View style={styles.notificationText}>
              <View style={styles.notificationTitleRow}>
                <Text style={[styles.notificationTitle, { color: colors.foreground }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={[styles.notificationTime, { color: colors.mutedForeground }]}>
                  {item.time}
                </Text>
              </View>
              <Text style={[styles.notificationMessage, { color: colors.mutedForeground }]} numberOfLines={2}>
                {item.message}
              </Text>
            </View>
            {item.unread && <View style={[styles.unreadDot, { backgroundColor: colors.destructive }]} />}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  headerSpacer: { width: 44 },
  title: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 2 },
  content: { padding: 16, gap: 10 },
  notificationRow: {
    minHeight: 82,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationText: { flex: 1, gap: 4, minWidth: 0 },
  notificationTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notificationTitle: { flex: 1, fontSize: 14, fontFamily: 'Inter_700Bold' },
  notificationTime: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  notificationMessage: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
});
