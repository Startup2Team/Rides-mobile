import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { KIGALI_CENTER, MOCK_DRIVERS, VEHICLE_LABELS } from '@/types';

const MOCK_RIDE_REQUEST = {
  id: 'req1',
  customerName: 'Amina K.',
  pickup: { address: 'Kimironko Market', latitude: -1.9365, longitude: 30.1011 },
  destination: { address: 'Kigali City Tower', latitude: -1.9438, longitude: 30.0616 },
  distance: 4.2,
  suggestedFare: 2500,
  vehicleType: 'moto' as const,
};

export default function DriverDashboard() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, driverProfile, saveDriverProfile } = useAuth();
  const [isOnline, setIsOnline] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [countdown, setCountdown] = useState(15);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const slideAnim = useRef(new Animated.Value(300)).current;

  // Simulate incoming request when online
  useEffect(() => {
    if (!isOnline) {
      setShowRequest(false);
      setCountdown(15);
      if (countdownRef.current) clearInterval(countdownRef.current);
      return;
    }
    const t = setTimeout(() => {
      setShowRequest(true);
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }).start();
      setCountdown(15);
      countdownRef.current = setInterval(() => {
        setCountdown(c => {
          if (c <= 1) {
            clearInterval(countdownRef.current!);
            handleDecline();
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    }, 5000);
    return () => clearTimeout(t);
  }, [isOnline]);

  const handleDecline = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    Animated.timing(slideAnim, { toValue: 300, duration: 300, useNativeDriver: true }).start(() => {
      setShowRequest(false);
      setCountdown(15);
    });
    if (driverProfile) {
      const updated = {
        ...driverProfile,
        dailyDeclines: (driverProfile.dailyDeclines ?? 0) + 1,
      };
      saveDriverProfile(updated);
    }
  };

  const handleAccept = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    router.push('/driver-navigate');
  };

  const toggleOnline = (val: boolean) => {
    setIsOnline(val);
    if (driverProfile) {
      saveDriverProfile({ ...driverProfile, isOnline: val });
    }
  };

  const stats = [
    { label: 'Today\'s Rides', value: driverProfile?.dailyRides ?? 0, icon: 'navigation' as const },
    { label: 'Acceptance Rate', value: `${driverProfile?.acceptanceRate ?? 95}%`, icon: 'check-circle' as const },
    { label: 'Total Rides', value: driverProfile?.completedRides ?? 0, icon: 'award' as const },
    { label: 'Declines Today', value: driverProfile?.dailyDeclines ?? 0, icon: 'x-circle' as const },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) + 16,
          paddingBottom: insets.bottom + (Platform.OS === 'web' ? 84 : 80) + 20,
        }}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: colors.foreground }]}>
              {isOnline ? '🟢 Online' : '⚫ Offline'}
            </Text>
            <Text style={[styles.name, { color: colors.mutedForeground }]}>
              {user?.name?.split(' ')[0]} ·{' '}
              {driverProfile ? VEHICLE_LABELS[driverProfile.vehicleType] : 'Driver'}
            </Text>
          </View>
          <View style={styles.toggleRow}>
            <Text style={[styles.toggleLabel, { color: colors.mutedForeground }]}>
              {isOnline ? 'Go Offline' : 'Go Online'}
            </Text>
            <Switch
              value={isOnline}
              onValueChange={toggleOnline}
              trackColor={{ false: colors.border, true: colors.primary + '80' }}
              thumbColor={isOnline ? colors.primary : colors.mutedForeground}
            />
          </View>
        </View>

        {/* Status banner */}
        <View
          style={[
            styles.statusBanner,
            {
              backgroundColor: isOnline ? colors.primary + '15' : colors.muted,
              borderColor: isOnline ? colors.primary + '40' : colors.border,
            },
          ]}
        >
          <Feather
            name={isOnline ? 'radio' : 'wifi-off'}
            size={16}
            color={isOnline ? colors.primary : colors.mutedForeground}
          />
          <Text style={[styles.statusText, { color: isOnline ? colors.primary : colors.mutedForeground }]}>
            {isOnline
              ? 'You are visible to customers — ride requests will appear here'
              : 'Go online to start accepting rides'}
          </Text>
        </View>

        {/* Map */}
        <View style={styles.mapContainer}>
          <MapView
            style={StyleSheet.absoluteFill}
            provider={PROVIDER_DEFAULT}
            initialRegion={{ ...KIGALI_CENTER, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
            customMapStyle={darkMapStyle}
          >
            {MOCK_DRIVERS.slice(0, 3).map(d => (
              <Marker key={d.id} coordinate={d.location}>
                <View style={[styles.miniMarker, { borderColor: colors.primary }]}>
                  <Text style={{ fontSize: 12 }}>🏍</Text>
                </View>
              </Marker>
            ))}
          </MapView>
          <View style={[styles.mapOverlay, { backgroundColor: colors.background + '60' }]}>
            <Text style={[styles.mapLabel, { color: colors.foreground }]}>Kigali Heat Map</Text>
            <Text style={[styles.mapSub, { color: colors.mutedForeground }]}>
              {MOCK_DRIVERS.length} active drivers nearby
            </Text>
          </View>
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          {stats.map((s, i) => (
            <View key={i} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name={s.icon} size={18} color={colors.primary} />
              <Text style={[styles.statValue, { color: colors.foreground }]}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Earnings placeholder */}
        <View style={[styles.earningsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.earningsHeader}>
            <Text style={[styles.earningsTitle, { color: colors.foreground }]}>Today's Earnings</Text>
            <View style={[styles.badge, { backgroundColor: colors.muted }]}>
              <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>MoMo</Text>
            </View>
          </View>
          <Text style={[styles.earningsAmount, { color: colors.primary }]}>
            {((driverProfile?.dailyRides ?? 0) * 2800).toLocaleString()} RWF
          </Text>
          <Text style={[styles.earningsHint, { color: colors.mutedForeground }]}>
            Payments processed via MoMo · {driverProfile?.momoCode ?? 'N/A'}
          </Text>
        </View>
      </ScrollView>

      {/* Incoming ride request */}
      {showRequest && (
        <Animated.View
          style={[
            styles.requestCard,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              transform: [{ translateY: slideAnim }],
              paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 16),
            },
          ]}
        >
          <View style={styles.requestHeader}>
            <Text style={[styles.requestTitle, { color: colors.foreground }]}>New Ride Request</Text>
            <View style={[styles.countdown, { backgroundColor: countdown <= 5 ? colors.destructive : colors.primary }]}>
              <Text style={styles.countdownText}>{countdown}s</Text>
            </View>
          </View>

          <View style={styles.requestRoute}>
            <View style={styles.routeRow}>
              <View style={[styles.routeDot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.routeText, { color: colors.foreground }]}>{MOCK_RIDE_REQUEST.pickup.address}</Text>
            </View>
            <View style={[styles.routeLine, { backgroundColor: colors.border }]} />
            <View style={styles.routeRow}>
              <View style={[styles.routeDot, { backgroundColor: colors.destructive, borderRadius: 3 }]} />
              <Text style={[styles.routeText, { color: colors.foreground }]}>{MOCK_RIDE_REQUEST.destination.address}</Text>
            </View>
          </View>

          <View style={styles.requestMeta}>
            <View style={styles.metaItem}>
              <Feather name="map-pin" size={14} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{MOCK_RIDE_REQUEST.distance} km</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={[styles.fareAmt, { color: colors.primary }]}>
                ~{MOCK_RIDE_REQUEST.suggestedFare.toLocaleString()} RWF
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                {MOCK_RIDE_REQUEST.customerName}
              </Text>
            </View>
          </View>

          <View style={styles.requestActions}>
            <TouchableOpacity
              style={[styles.reqBtn, { backgroundColor: colors.destructive + '20', borderColor: colors.destructive }]}
              onPress={handleDecline}
            >
              <Feather name="x" size={22} color={colors.destructive} />
              <Text style={[styles.reqBtnText, { color: colors.destructive }]}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.reqBtn, { backgroundColor: colors.primary, flex: 1 }]}
              onPress={handleAccept}
            >
              <Feather name="check" size={22} color={colors.primaryForeground} />
              <Text style={[styles.reqBtnText, { color: colors.primaryForeground }]}>Accept</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
];

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  greeting: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  name: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleLabel: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  statusText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular' },
  mapContainer: {
    height: 180,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  mapOverlay: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    padding: 12,
  },
  mapLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  mapSub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  miniMarker: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(0,200,83,0.15)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  statCard: {
    width: '47%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 8,
    alignItems: 'center',
  },
  statValue: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  earningsCard: {
    marginHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 8,
  },
  earningsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  earningsTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  earningsAmount: { fontSize: 36, fontFamily: 'Inter_700Bold' },
  earningsHint: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  requestCard: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingTop: 16,
    paddingHorizontal: 20,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 20,
  },
  requestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  requestTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  countdown: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  countdownText: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#000' },
  requestRoute: { gap: 8 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  routeDot: { width: 10, height: 10, borderRadius: 5 },
  routeLine: { height: 1, marginLeft: 15 },
  routeText: { fontSize: 15, fontFamily: 'Inter_500Medium', flex: 1 },
  requestMeta: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  fareAmt: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  requestActions: { flexDirection: 'row', gap: 12 },
  reqBtn: {
    flex: 0.5,
    flexDirection: 'row',
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
  },
  reqBtnText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});
