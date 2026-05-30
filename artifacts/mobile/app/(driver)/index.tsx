import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import {
  Animated,
  Image,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useRide } from '@/context/RideContext';
import { KIGALI_CENTER, VehicleType, VEHICLE_LABELS } from '@/types';
import { setDriverAvailability, updateDriverLocation } from '@/services/driverRides';

const VEHICLE_MARKER_IMAGES: Record<VehicleType, any> = {
  moto: require('../../assets/vehicle-markers/moto.png'),
  cab: require('../../assets/vehicle-markers/cab.png'),
  hilux: require('../../assets/vehicle-markers/hilux.png'),
  fuso: require('../../assets/vehicle-markers/fuso.png'),
};

const VEHICLE_IMAGE_STYLES: Record<VehicleType, { width: number; height: number }> = {
  moto: { width: 58, height: 44 },
  cab: { width: 54, height: 40 },
  hilux: { width: 64, height: 40 },
  fuso: { width: 66, height: 44 },
};
const MAP_TYPES = ['standard', 'satellite', 'hybrid'] as const;
type AppMapType = typeof MAP_TYPES[number];

export default function DriverDashboard() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, driverProfile, saveDriverProfile, loadDriverProfile } = useAuth();
  const { pendingRequest, currentRide, simulateIncomingRideRequest, acceptRideRequest, declineRideRequest } = useRide();
  const [isOnline, setIsOnline] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [driverLocation, setDriverLocation] = useState(KIGALI_CENTER);
  const [, setLocLoading] = useState(true);
  const [mapType, setMapType] = useState<AppMapType>('standard');
  const slideAnim = useRef(new Animated.Value(300)).current;
  const mapRef = useRef<MapView | null>(null);

  useEffect(() => {
    loadDriverProfile();
  }, [loadDriverProfile]);

  useEffect(() => {
    let mounted = true;

    const setCoords = (coords: { latitude: number; longitude: number }) => {
      if (!mounted) return;
      setDriverLocation(coords);
      setLocLoading(false);
    };

    const resolveNativeLocation = async () => {
      const permission = await Location.getForegroundPermissionsAsync();
      const finalPermission = permission.granted
        ? permission
        : await Location.requestForegroundPermissionsAsync();

      if (!finalPermission.granted) {
        if (mounted) setLocLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    };

    if (Platform.OS === 'web') {
      navigator.geolocation?.getCurrentPosition(
        p => setCoords({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
        () => {
          if (mounted) setLocLoading(false);
        },
        { enableHighAccuracy: true },
      );
    } else {
      resolveNativeLocation().catch(() => {
        if (mounted) setLocLoading(false);
      });
    }

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isOnline) {
      setShowRequest(false);
      return;
    }
    simulateIncomingRideRequest();
  }, [isOnline, simulateIncomingRideRequest]);

  useEffect(() => {
    if (!isOnline || !pendingRequest) return;
    setShowRequest(true);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }).start();
  }, [isOnline, pendingRequest, slideAnim]);

  useEffect(() => {
    // Guard: stop posting location if user has logged out or gone offline.
    // Without the user guard the interval fires with a revoked token after logout.
    if (!user || !isOnline) return;
    updateDriverLocation(driverLocation.latitude, driverLocation.longitude).catch(() => {});
    const interval = setInterval(() => {
      updateDriverLocation(driverLocation.latitude, driverLocation.longitude).catch(() => {});
    }, 12000);
    return () => clearInterval(interval);
  }, [user, driverLocation.latitude, driverLocation.longitude, isOnline]);

  useEffect(() => {
    if (currentRide?.status === 'negotiating') router.push('/driver-negotiation');
    if (currentRide?.status === 'confirmed' || currentRide?.status === 'arriving') router.push('/driver-navigate');
  }, [currentRide?.status]);

  useEffect(() => {
    mapRef.current?.animateToRegion(
      { ...driverLocation, latitudeDelta: 0.05, longitudeDelta: 0.05 },
      350,
    );
  }, [driverLocation]);

  const handleDecline = () => {
    Animated.timing(slideAnim, { toValue: 300, duration: 300, useNativeDriver: true }).start(() => {
      setShowRequest(false);
    });
    if (driverProfile) {
      saveDriverProfile({
        ...driverProfile,
        dailyDeclines: (driverProfile.dailyDeclines ?? 0) + 1,
      });
    }
    declineRideRequest();
  };

  const handleAccept = () => {
    acceptRideRequest();
    router.push('/driver-negotiation');
  };

  const toggleOnline = (val: boolean) => {
    setIsOnline(val);
    setDriverAvailability(val).catch(() => {});
    if (driverProfile) {
      saveDriverProfile({ ...driverProfile, isOnline: val });
    }
  };

  const recenterMap = () => {
    mapRef.current?.animateToRegion(
      { ...driverLocation, latitudeDelta: 0.05, longitudeDelta: 0.05 },
      350,
    );
  };

  const cycleMapType = () => {
    setMapType(prev => MAP_TYPES[(MAP_TYPES.indexOf(prev) + 1) % MAP_TYPES.length]);
  };

  const driverName = user?.name?.split(' ')[0] ?? '--';

  const activeVehicleType = driverProfile?.vehicleType ?? 'moto';
  const request = pendingRequest;
  const requestDestinationLabel = request?.destination.locationType === 'generic'
    ? 'Unknown - to be negotiated'
    : request?.destination.address;
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.content,
          { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) + 16 },
        ]}
      >
        <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.heroTop}>
            <View style={styles.heroIdentity}>
              <Text style={[styles.greeting, { color: colors.foreground }]}>Hi, {driverName}</Text>
              <View style={styles.vehicleRow}>
                <Feather name="truck" size={13} color={colors.mutedForeground} />
                <Text style={[styles.vehicleText, { color: colors.mutedForeground }]}>
                  {driverProfile ? VEHICLE_LABELS[driverProfile.vehicleType] : 'Driver'}
                </Text>
              </View>
            </View>
            <View style={styles.heroRight}>
              <View style={[styles.statusPill, { backgroundColor: isOnline ? colors.primary + '18' : colors.muted }]}>
                <View style={[styles.statusDot, { backgroundColor: isOnline ? colors.primary : colors.mutedForeground }]} />
                <Text style={[styles.statusPillText, { color: isOnline ? colors.primary : colors.mutedForeground }]}>
                  {isOnline ? 'Online' : 'Offline'}
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.availabilityPanel, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.availabilityCopy}>
              <Text style={[styles.availabilityTitle, { color: colors.foreground }]}>
                {isOnline ? 'Accepting rides' : 'Not accepting rides'}
              </Text>
              <Text style={[styles.availabilityText, { color: colors.mutedForeground }]}>
                {isOnline
                  ? 'You are visible to customers around Kigali and can receive ride requests.'
                  : 'Go online when you are ready to receive ride requests.'}
              </Text>
            </View>
            <Switch
              value={isOnline}
              onValueChange={toggleOnline}
              trackColor={{ false: colors.border, true: colors.primary + '80' }}
              thumbColor={isOnline ? colors.primary : colors.mutedForeground}
            />
          </View>
        </View>

        <View style={[styles.performanceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.performanceHeader}>
            <View>
              <Text style={[styles.performanceTitle, { color: colors.foreground }]}>Performance</Text>
              <Text style={[styles.performanceMeta, { color: colors.mutedForeground }]}>
                {driverProfile?.completedRides ?? 0} total rides
              </Text>
            </View>
            <View style={styles.performanceInline}>
              <Text style={[styles.performanceInlineValue, { color: colors.foreground }]}>{driverProfile?.acceptanceRate ?? 95}%</Text>
              <Text style={[styles.performanceInlineLabel, { color: colors.mutedForeground }]}>acceptance</Text>
            </View>
          </View>
          <View style={styles.performanceRows}>
            <View style={styles.performanceRow}>
              <Feather name="x-circle" size={15} color={colors.destructive} />
              <Text style={[styles.performanceLabel, { color: colors.mutedForeground }]}>Declines today</Text>
              <Text style={[styles.performanceValue, { color: colors.foreground }]}>{driverProfile?.dailyDeclines ?? 0}</Text>
            </View>
          </View>
        </View>

        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            provider={PROVIDER_DEFAULT}
            mapType={mapType}
            initialRegion={{ ...driverLocation, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
            customMapStyle={mapType === 'standard' ? darkMapStyle : undefined}
          >
            <Marker coordinate={driverLocation} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.driverLocationMarker}>
                <View style={styles.youAreHereBubble}>
                  <Text style={styles.youAreHereText}>You're Here</Text>
                </View>
                <View style={styles.youAreHereTail} />
                <View style={styles.vehicleMarkerWrap}>
                  <Image
                    source={VEHICLE_MARKER_IMAGES[activeVehicleType]}
                    style={[styles.vehicleMarkerImage, VEHICLE_IMAGE_STYLES[activeVehicleType]]}
                    resizeMode="contain"
                  />
                </View>
              </View>
            </Marker>
            {request && (
              <>
                <Marker coordinate={request.pickup}>
                  <View style={[styles.pinMarker, { backgroundColor: colors.primary }]}>
                    <Feather name="user" size={12} color={colors.primaryForeground} />
                  </View>
                </Marker>
                <Polyline
                  coordinates={[driverLocation, request.pickup]}
                  strokeColor={colors.primary}
                  strokeWidth={3}
                  lineDashPattern={[8, 4]}
                />
              </>
            )}
          </MapView>
          <TouchableOpacity
            style={[styles.mapLayerBtn, { backgroundColor: colors.card }]}
            onPress={cycleMapType}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name={mapType === 'standard' ? 'layers-outline' : mapType === 'satellite' ? 'satellite-variant' : 'map'}
              size={22}
              color={colors.primary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.recenterBtn, { backgroundColor: colors.card }]}
            onPress={recenterMap}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="crosshairs-gps" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {showRequest && request && (
        <Animated.View
          style={[
            styles.requestCard,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              transform: [{ translateY: slideAnim }],
              paddingBottom: insets.bottom + (Platform.OS === 'web' ? 84 : 50) + 16,
            },
          ]}
        >
          <View style={styles.requestHeader}>
            <View>
              <Text style={[styles.requestEyebrow, { color: colors.primary }]}>Incoming request</Text>
              <Text style={[styles.requestTitle, { color: colors.foreground }]}>
                {request.customerName ?? '--'}
              </Text>
            </View>
            <View style={[styles.countdown, { backgroundColor: colors.primary }]}>
              <Feather name="clock" size={18} color={colors.primaryForeground} />
            </View>
          </View>

          <View style={[styles.farePanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View>
              <Text style={[styles.fareLabel, { color: colors.mutedForeground }]}>Suggested fare</Text>
              <Text style={[styles.fareValue, { color: colors.foreground }]}>
                {request.suggestedFare.toLocaleString()} RWF
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: colors.muted }]}>
              <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>Negotiable</Text>
            </View>
          </View>

          <View style={styles.requestRoute}>
            <View style={styles.routeRow}>
              <View style={[styles.routeDot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.routeText, { color: colors.foreground }]}>{request.pickup.address}</Text>
            </View>
            <View style={[styles.routeLine, { backgroundColor: colors.border }]} />
            <View style={styles.routeRow}>
              <View style={[styles.routeDot, { backgroundColor: colors.destructive, borderRadius: 3 }]} />
              <Text style={[styles.routeText, { color: colors.foreground }]}>{requestDestinationLabel}</Text>
            </View>
          </View>

          <View style={styles.requestMeta}>
            <View style={[styles.metaItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="map-pin" size={14} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{request.distance} km</Text>
            </View>
            <View style={[styles.metaItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="navigation" size={14} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>Pickup first</Text>
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
              style={[styles.reqBtn, { backgroundColor: colors.primary, borderColor: colors.primary, flex: 1 }]}
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
  content: { flex: 1 },
  hero: {
    marginHorizontal: 20,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    gap: 8,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroIdentity: { flex: 1, gap: 4 },
  heroRight: { alignItems: 'flex-end', gap: 8 },
  greeting: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  vehicleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  vehicleText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    height: 32,
    borderRadius: 16,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusPillText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  availabilityPanel: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  availabilityCopy: { flex: 1, gap: 2 },
  availabilityTitle: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  availabilityText: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 15 },
  mapContainer: {
    flex: 1,
    minHeight: 360,
    marginHorizontal: 0,
    marginBottom: 0,
    borderRadius: 0,
    overflow: 'hidden',
  },
  mapLayerBtn: {
    position: 'absolute',
    right: 16,
    top: 14,
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  recenterBtn: {
    position: 'absolute',
    right: 16,
    top: 70,
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  driverLocationMarker: { alignItems: 'center' },
  youAreHereBubble: {
    backgroundColor: '#00C853',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  youAreHereText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  youAreHereTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#00C853',
    marginBottom: -2,
    zIndex: 3,
  },
  vehicleMarkerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 70,
    height: 70,
  },
  vehicleMarkerImage: {
    zIndex: 2,
  },
  pinMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 9 },
  badgeText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  performanceCard: {
    marginHorizontal: 20,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    gap: 8,
  },
  performanceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  performanceTitle: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  performanceMeta: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  performanceRows: { gap: 6 },
  performanceRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  performanceLabel: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular' },
  performanceValue: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  performanceInline: { alignItems: 'flex-end' },
  performanceInlineValue: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  performanceInlineLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase' },
  requestCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingTop: 16,
    paddingHorizontal: 20,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 20,
  },
  requestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  requestEyebrow: { fontSize: 12, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  requestTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  countdown: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownText: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#000' },
  farePanel: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  fareLabel: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  fareValue: { fontSize: 20, fontFamily: 'Inter_700Bold', marginTop: 2 },
  requestRoute: { gap: 8 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  routeDot: { width: 10, height: 10, borderRadius: 5 },
  routeLine: { height: 1, marginLeft: 15 },
  routeText: { fontSize: 15, fontFamily: 'Inter_500Medium', flex: 1 },
  requestMeta: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    height: 32,
  },
  metaText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
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
  reqBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
});
