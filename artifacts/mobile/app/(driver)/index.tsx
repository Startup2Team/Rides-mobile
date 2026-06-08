import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { useRide } from '@/context/RideContext';
import { VehicleMapMarker } from '@/components/VehicleMapMarker';
import { useScreenTimerManager } from '@/hooks/useScreenTimerManager';
import { KIGALI_CENTER, VEHICLE_LABELS } from '@/types';
import { canDriverGoOnline } from '@/utils/driverVerification';
import { HOME_TAB_BAR_HEIGHT } from '@/components/home/homeUtils';
import { useDriverEntitlement } from '@/context/DriverEntitlementContext';
import { canDriverGoOnlineWithCredits } from '@/domain/driverRidePackages';
import { DriverCreditDashboardCard } from '@/components/driver/DriverCreditDashboardCard';
import { DriverPackageRequiredModal } from '@/components/driver/DriverPackageRequiredModal';

const MAP_TYPES = ['standard', 'satellite', 'hybrid'] as const;
type AppMapType = typeof MAP_TYPES[number];

export default function DriverDashboard() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
  const { user, driverProfile, saveDriverProfile } = useAuth();
  const { entitlement, isLoading: isEntitlementLoading } = useDriverEntitlement();
  const { pendingRequest, simulateIncomingRideRequest, acceptRideRequest, declineRideRequest } = useRide();

  const [isOnline, setIsOnline] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [countdown, setCountdown] = useState(15);
  const [driverLocation, setDriverLocation] = useState(KIGALI_CENTER);
  const [mapType, setMapType] = useState<AppMapType>('standard');
  const [showPackageRequired, setShowPackageRequired] = useState(false);

  const timers = useScreenTimerManager();
  const requestSessionRef = useRef(timers.currentSession());
  const requestTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const slideAnim = useRef(new Animated.Value(300)).current;
  const onlineScale = useRef(new Animated.Value(1)).current;
  const mapRef = useRef<MapView | null>(null);

  const cardFill = isDark ? '#1C1C1E' : '#FFFFFF';
  const tabBarHeight = Platform.OS === 'web' ? HOME_TAB_BAR_HEIGHT : HOME_TAB_BAR_HEIGHT + insets.bottom;

  // Location
  useEffect(() => {
    let mounted = true;
    const setCoords = (coords: { latitude: number; longitude: number }) => {
      if (!mounted) return;
      setDriverLocation(coords);
    };
    const resolveNativeLocation = async () => {
      const permission = await Location.getForegroundPermissionsAsync();
      const finalPermission = permission.granted ? permission : await Location.requestForegroundPermissionsAsync();
      if (!finalPermission.granted) return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    };
    if (Platform.OS === 'web') {
      navigator.geolocation?.getCurrentPosition(
        p => setCoords({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
        () => {},
        { enableHighAccuracy: true },
      );
    } else {
      resolveNativeLocation().catch(() => {});
    }
    return () => { mounted = false; };
  }, []);

  // Recenter on location
  useEffect(() => {
    mapRef.current?.animateToRegion({ ...driverLocation, latitudeDelta: 0.015, longitudeDelta: 0.015 }, 350);
  }, [driverLocation]);

  // Ride request simulation
  useEffect(() => {
    const clearRequestTimers = () => {
      timers.clearTimeout(requestTimeoutRef.current);
      timers.clearInterval(countdownRef.current);
      requestTimeoutRef.current = null;
      countdownRef.current = null;
    };
    clearRequestTimers();
    requestSessionRef.current = timers.startSession();
    if (!isOnline) { setShowRequest(false); setCountdown(15); return; }
    const session = requestSessionRef.current;
    requestTimeoutRef.current = timers.scheduleTimeout(() => {
      requestTimeoutRef.current = null;
      simulateIncomingRideRequest();
      setShowRequest(true);
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }).start();
      setCountdown(15);
      countdownRef.current = timers.scheduleInterval(() => {
        setCountdown(c => {
          if (c <= 1) { timers.clearInterval(countdownRef.current); countdownRef.current = null; handleDecline(); return 0; }
          return c - 1;
        });
      }, 1000, session);
    }, 5000, session);
    return clearRequestTimers;
  }, [isOnline, simulateIncomingRideRequest, timers]);

  const handleDecline = () => {
    timers.clearInterval(countdownRef.current);
    countdownRef.current = null;
    Animated.timing(slideAnim, { toValue: 300, duration: 300, useNativeDriver: true }).start(() => {
      setShowRequest(false);
      setCountdown(15);
    });
    if (driverProfile) saveDriverProfile({ ...driverProfile, dailyDeclines: (driverProfile.dailyDeclines ?? 0) + 1 });
    declineRideRequest();
  };

  const handleAccept = () => {
    timers.clearInterval(countdownRef.current);
    countdownRef.current = null;
    acceptRideRequest();
    router.push('/driver-negotiation');
  };

  const toggleOnline = () => {
    const next = !isOnline;
    if (next && isEntitlementLoading) return;
    if (next && canDriverGoOnline(driverProfile) && !canDriverGoOnlineWithCredits(driverProfile, entitlement)) {
      setShowPackageRequired(true);
      return;
    }
    if (next && !canDriverGoOnline(driverProfile)) {
      return;
    }
    // Pulse animation on toggle
    Animated.sequence([
      Animated.timing(onlineScale, { toValue: 0.93, duration: 80, useNativeDriver: true }),
      Animated.spring(onlineScale, { toValue: 1, useNativeDriver: true, bounciness: 12 }),
    ]).start();
    setIsOnline(next);
    if (driverProfile) saveDriverProfile({ ...driverProfile, isOnline: next });
  };

  const recenterMap = () => {
    mapRef.current?.animateToRegion({ ...driverLocation, latitudeDelta: 0.015, longitudeDelta: 0.015 }, 350);
  };

  const cycleMapType = () => {
    setMapType(prev => MAP_TYPES[(MAP_TYPES.indexOf(prev) + 1) % MAP_TYPES.length]);
  };

  const driverName = user?.name?.split(' ')[0] ?? 'Driver';
  const activeVehicleType = driverProfile?.vehicleType ?? 'moto';
  const dailyDecisionCount = (driverProfile?.dailyRides ?? 0) + (driverProfile?.dailyDeclines ?? 0);
  const acceptanceRateText = dailyDecisionCount > 0 ? `${driverProfile?.acceptanceRate ?? 0}%` : '—';
  const request = pendingRequest;
  const requestDestinationLabel = request?.destination.locationType === 'generic'
    ? 'Unknown — to be negotiated'
    : request?.destination.address;

  return (
    <View style={styles.root}>

      {/* ── Full-screen map ── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        mapType={mapType}
        initialRegion={{ ...driverLocation, latitudeDelta: 0.015, longitudeDelta: 0.015 }}
        customMapStyle={mapType === 'standard' ? darkMapStyle : undefined}
        showsUserLocation={false}
        showsMyLocationButton={false}
      >
        <Marker coordinate={driverLocation} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={styles.driverMarker}>
            <View style={[styles.youAreHereBubble, { backgroundColor: colors.primary }]}>
              <Text style={styles.youAreHereText}>You're Here</Text>
            </View>
            <View style={[styles.youAreHereTail, { borderTopColor: colors.primary }]} />
            <VehicleMapMarker type={activeVehicleType} style={styles.driverVehicleMarker} />
          </View>
        </Marker>
        {request && (
          <>
            <Marker coordinate={request.pickup}>
              <View style={[styles.pickupPin, { backgroundColor: colors.primary }]}>
                <Feather name="user" size={12} color={colors.primaryForeground} />
              </View>
            </Marker>
            <Polyline
              coordinates={[driverLocation, request.pickup]}
              strokeColor={colors.destructiveHex}
              strokeWidth={3}
              lineDashPattern={[8, 4]}
            />
          </>
        )}
      </MapView>

      {/* ── Top floating bar ── */}
      <View style={[styles.topBar, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) + 12 }]}>
        <View style={[styles.topCard, { backgroundColor: cardFill }]}>
          <View style={styles.topCardLeft}>
            <View style={[styles.onlineDot, { backgroundColor: isOnline ? colors.successHex : colors.mutedForeground }]} />
            <View>
              <Text style={[styles.topGreeting, { color: colors.foreground }]}>Hi, {driverName}</Text>
              <Text style={[styles.topSub, { color: colors.mutedForeground }]}>
                {driverProfile ? VEHICLE_LABELS[driverProfile.vehicleType] : 'Driver'} · {isOnline ? 'Accepting rides' : 'Not accepting rides'}
              </Text>
            </View>
          </View>
          <View style={styles.topStats}>
            <View style={styles.topStat}>
              <Text style={[styles.topStatValue, { color: colors.foreground }]}>{driverProfile?.dailyRides ?? 0}</Text>
              <Text style={[styles.topStatLabel, { color: colors.mutedForeground }]}>rides</Text>
            </View>
            <View style={[styles.topStatDivider, { backgroundColor: colors.border }]} />
            <View style={styles.topStat}>
              <Text style={[styles.topStatValue, { color: colors.foreground }]}>{acceptanceRateText}</Text>
              <Text style={[styles.topStatLabel, { color: colors.mutedForeground }]}>rate</Text>
            </View>
          </View>
        </View>
        <DriverCreditDashboardCard
          entitlement={entitlement}
          isLoading={isEntitlementLoading}
          onViewPackages={() => router.push('/driver-packages')}
        />
      </View>

      {/* ── Map controls ── */}
      <View style={[styles.mapControls, { bottom: tabBarHeight + 16 }]}>
        <TouchableOpacity style={[styles.mapBtn, { backgroundColor: cardFill }]} onPress={cycleMapType} activeOpacity={0.8}>
          <MaterialCommunityIcons
            name={mapType === 'standard' ? 'layers-outline' : mapType === 'satellite' ? 'satellite-variant' : 'map'}
            size={22} color={colors.primary}
          />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.mapBtn, { backgroundColor: cardFill }]} onPress={recenterMap} activeOpacity={0.8}>
          <MaterialCommunityIcons name="crosshairs-gps" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* ── Go Online / Offline button above tab bar ── */}
      {!showRequest && (
        <View style={[styles.onlineBtnWrap, { bottom: tabBarHeight - 8 }]}>
          <Animated.View style={{ transform: [{ scale: onlineScale }] }}>
            <TouchableOpacity
              style={[
                styles.onlineBtn,
                {
                  backgroundColor: isOnline ? colors.destructive : colors.primary,
                  borderColor: isOnline ? colors.destructive : colors.primary,
                },
              ]}
              onPress={toggleOnline}
              disabled={isEntitlementLoading}
              activeOpacity={0.85}
            >
              <View style={[styles.onlineBtnDot, { backgroundColor: '#fff' }]} />
              <Text style={[styles.onlineBtnText, { color: '#fff' }]}>
                {isOnline ? 'Go Offline' : 'Go Online'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}

      {/* ── Incoming ride request sheet ── */}
      {showRequest && request && (
        <Animated.View
          style={[
            styles.requestSheet,
            {
              backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
              transform: [{ translateY: slideAnim }],
              paddingBottom: tabBarHeight + 16,
            },
          ]}
        >
          {/* Handle */}
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

          <View style={styles.requestHeader}>
            <View>
              <Text style={[styles.requestEyebrow, { color: colors.primary }]}>Incoming Ride</Text>
              <Text style={[styles.requestTitle, { color: colors.foreground }]}>{request.customerName ?? 'Customer'}</Text>
            </View>
            <View style={[styles.countdown, { backgroundColor: countdown <= 5 ? colors.destructive : colors.primary }]}>
              <Text style={styles.countdownText}>{countdown}s</Text>
            </View>
          </View>

          <View style={[styles.farePanel, { backgroundColor: isDark ? '#2C2C2E' : colors.muted }]}>
            <View>
              <Text style={[styles.fareLabel, { color: colors.mutedForeground }]}>Suggested fare</Text>
              <Text style={[styles.fareValue, { color: colors.foreground }]}>{request.suggestedFare.toLocaleString()} RWF</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: colors.primaryHex + '18', borderColor: colors.primaryHex + '30', borderWidth: 1 }]}>
              <Text style={[styles.badgeText, { color: colors.primary }]}>Negotiable</Text>
            </View>
          </View>

          <View style={styles.requestRoute}>
            <View style={styles.routeRow}>
              <View style={[styles.routeDot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.routeText, { color: colors.foreground }]} numberOfLines={1}>{request.pickup.address}</Text>
            </View>
            <View style={[styles.routeConnector, { borderColor: colors.border }]} />
            <View style={styles.routeRow}>
              <View style={[styles.routeSquare, { backgroundColor: colors.destructive }]} />
              <Text style={[styles.routeText, { color: colors.foreground }]} numberOfLines={1}>{requestDestinationLabel}</Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={[styles.metaChip, { backgroundColor: isDark ? '#2C2C2E' : colors.muted }]}>
              <Feather name="map-pin" size={13} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{request.distance} km</Text>
            </View>
            <View style={[styles.metaChip, { backgroundColor: isDark ? '#2C2C2E' : colors.muted }]}>
              <Feather name="clock" size={13} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>~{request.duration ?? '—'} min</Text>
            </View>
          </View>

          <View style={styles.requestActions}>
            <TouchableOpacity
              style={[styles.reqBtn, { backgroundColor: colors.destructiveHex + '12', borderColor: colors.destructive }]}
              onPress={handleDecline}
              activeOpacity={0.8}
            >
              <Feather name="x" size={20} color={colors.destructive} />
              <Text style={[styles.reqBtnText, { color: colors.destructive }]}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.reqBtn, { backgroundColor: colors.primary, borderColor: colors.primary, flex: 1 }]}
              onPress={handleAccept}
              activeOpacity={0.8}
            >
              <Feather name="check" size={20} color={colors.primaryForeground} />
              <Text style={[styles.reqBtnText, { color: colors.primaryForeground }]}>Accept</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      <DriverPackageRequiredModal
        visible={showPackageRequired}
        bottomInset={insets.bottom}
        onClose={() => setShowPackageRequired(false)}
        onViewPackages={() => {
          setShowPackageRequired(false);
          router.push('/driver-packages');
        }}
      />
    </View>
  );
}

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
];

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Top bar
  topBar: { position: 'absolute', top: 0, left: 16, right: 16, zIndex: 10 },
  topCard: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    ...Platform.select({ ios: { borderCurve: 'continuous' } }),
  },
  topCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  onlineDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  topGreeting: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  topSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  topStats: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  topStat: { alignItems: 'center' },
  topStatValue: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  topStatLabel: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  topStatDivider: { width: 1, height: 24 },

  // Map controls
  mapControls: { position: 'absolute', right: 16, gap: 10 },
  mapBtn: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 6, elevation: 6,
  },

  // Go Online button
  onlineBtnWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  onlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 36,
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  onlineBtnDot: { width: 9, height: 9, borderRadius: 5 },
  onlineBtnText: { fontSize: 17, fontFamily: 'Inter_700Bold' },

  // Driver marker
  driverMarker: { alignItems: 'center' },
  driverVehicleMarker: { marginTop: -14 },
  youAreHereBubble: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 4,
  },
  youAreHereText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  youAreHereTail: {
    width: 0, height: 0,
    borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 7,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    marginBottom: -2,
  },
  pickupPin: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  // Request sheet
  requestSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, paddingHorizontal: 20, gap: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.18, shadowRadius: 20, elevation: 20,
    ...Platform.select({ ios: { borderCurve: 'continuous' } }),
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  requestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  requestEyebrow: { fontSize: 11, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 0.6 },
  requestTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', marginTop: 2 },
  countdown: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  countdownText: { fontSize: 17, fontFamily: 'Inter_700Bold', color: '#fff' },
  farePanel: {
    borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    ...Platform.select({ ios: { borderCurve: 'continuous' } }),
  },
  fareLabel: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  fareValue: { fontSize: 22, fontFamily: 'Inter_700Bold', marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  badgeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  requestRoute: { gap: 6 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  routeDot: { width: 11, height: 11, borderRadius: 6, flexShrink: 0 },
  routeSquare: { width: 11, height: 11, borderRadius: 3, flexShrink: 0 },
  routeConnector: { height: 18, borderLeftWidth: 2, borderStyle: 'dashed', marginLeft: 5 },
  routeText: { fontSize: 14, fontFamily: 'Inter_500Medium', flex: 1 },
  metaRow: { flexDirection: 'row', gap: 10 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 32, borderRadius: 16 },
  metaText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  requestActions: { flexDirection: 'row', gap: 12 },
  reqBtn: {
    flex: 0.45, flexDirection: 'row', height: 56,
    borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    gap: 8, borderWidth: 1.5,
  },
  reqBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
});
