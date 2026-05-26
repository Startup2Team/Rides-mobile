import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useRoute } from '@/hooks/useRoute';
import { useDriverTracking } from '@/hooks/useDriverTracking';
import { useRide } from '@/context/RideContext';
import { KandaButton } from '@/components/KandaButton';
import { RoutePolyline } from '@/components/maps/RoutePolyline';
import { StatusChip } from '@/components/StatusChip';
import { formatDistance, formatDuration, haversineKm } from '@/utils/mapUtils';
import { KIGALI_CENTER, VehicleType, VEHICLE_LABELS, VEHICLE_LABELS_FULL } from '@/types';

const STATUS_MESSAGES: Record<string, string> = {
  confirmed: 'Ride confirmed',
  arriving: 'Driver is on the way',
  arrived: 'Your driver has arrived!',
  in_progress: 'Heading to destination',
  completed: 'Ride completed!',
};

const ARRIVING_AVERAGE_SPEED_MPS = 8.3;
const ARRIVING_ROUTE_COLOR = '#FF3B30';

const VEHICLE_MARKER_IMAGES: Record<VehicleType, any> = {
  moto: require('../assets/vehicle-markers/moto.png'),
  cab: require('../assets/vehicle-markers/cab.png'),
  hilux: require('../assets/vehicle-markers/hilux.png'),
  fuso: require('../assets/vehicle-markers/fuso.png'),
};

const VEHICLE_IMAGE_STYLES: Record<VehicleType, { width: number; height: number }> = {
  moto: { width: 58, height: 44 },
  cab: { width: 54, height: 40 },
  hilux: { width: 64, height: 40 },
  fuso: { width: 66, height: 44 },
};

const VEHICLE_MARKER_DEFAULT_HEADING: Record<VehicleType, number> = {
  moto: 270,
  cab: 315,
  hilux: 90,
  fuso: 90,
};

function formatAwayEta(seconds: number) {
  if (seconds <= 0) return '0 secs away';
  if (seconds < 60) return `${seconds} ${seconds === 1 ? 'sec' : 'secs'} away`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} ${minutes === 1 ? 'min' : 'mins'} away`;
}

function getRemainingRouteCoordinates(routeCoordinates: Array<{ latitude: number; longitude: number }>, driverPosition: { latitude: number; longitude: number }) {
  if (routeCoordinates.length < 2) return routeCoordinates;

  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  routeCoordinates.forEach((coord, index) => {
    const distance =
      Math.pow(coord.latitude - driverPosition.latitude, 2) +
      Math.pow(coord.longitude - driverPosition.longitude, 2);

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });

  return routeCoordinates.slice(Math.min(nearestIndex + 1, routeCoordinates.length - 1));
}

function getBearingDegrees(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) {
  const fromLat = (from.latitude * Math.PI) / 180;
  const toLat = (to.latitude * Math.PI) / 180;
  const deltaLng = ((to.longitude - from.longitude) * Math.PI) / 180;
  const y = Math.sin(deltaLng) * Math.cos(toLat);
  const x =
    Math.cos(fromLat) * Math.sin(toLat) -
    Math.sin(fromLat) * Math.cos(toLat) * Math.cos(deltaLng);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

export default function RideScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentRide, driverLocation, completeRide, startJourney, cancelRide } = useRide();
  const mapRef = useRef<MapView>(null);
  const fittedMapStateRef = useRef<string | null>(null);
  const previousRideStatusRef = useRef<string | null>(null);

  const [waitTimer, setWaitTimer] = useState(180);
  const [arrivingRouteOrigin, setArrivingRouteOrigin] = useState(driverLocation ?? KIGALI_CENTER);

  const { route: rideRoute } = useRoute(
    currentRide ? { latitude: currentRide.pickup.latitude, longitude: currentRide.pickup.longitude } : null,
    currentRide ? { latitude: currentRide.destination.latitude, longitude: currentRide.destination.longitude } : null,
  );

  const isArriving = currentRide?.status === 'arriving';
  useEffect(() => {
    const status = currentRide?.status ?? null;
    if (status === 'arriving' && previousRideStatusRef.current !== 'arriving') {
      setArrivingRouteOrigin(driverLocation ?? KIGALI_CENTER);
    }
    previousRideStatusRef.current = status;
  }, [currentRide?.status, driverLocation]);

  const { route: driverToPickupRoute } = useRoute(
    isArriving ? arrivingRouteOrigin : null,
    isArriving && currentRide ? { latitude: currentRide.pickup.latitude, longitude: currentRide.pickup.longitude } : null,
  );
  const driverNavigationRoute = isArriving
    ? driverToPickupRoute?.coordinates ?? []
    : rideRoute?.coordinates ?? [];

  const liveDriverCoords = useDriverTracking({
    enabled: currentRide?.status === 'arriving' || currentRide?.status === 'in_progress',
    routeCoordinates: driverNavigationRoute,
    stepCount: isArriving ? 10 : 24,
  });

  const activeDriverLocation = liveDriverCoords ?? driverLocation;
  const isArrived = currentRide?.status === 'arrived';
  const isInProgress = currentRide?.status === 'in_progress';
  const remainingDriverToPickupRoute = useMemo(
    () => {
      if (!isArriving || !activeDriverLocation || !currentRide) return null;
      if (!driverToPickupRoute) return null;
      return getRemainingRouteCoordinates(driverToPickupRoute.coordinates, activeDriverLocation);
    },
    [activeDriverLocation, currentRide?.pickup.latitude, currentRide?.pickup.longitude, driverToPickupRoute, isArriving],
  );
  const remainingPickupToDestinationRoute = useMemo(
    () => {
      if (!isInProgress || !activeDriverLocation || !rideRoute) return null;
      return getRemainingRouteCoordinates(rideRoute.coordinates, activeDriverLocation);
    },
    [activeDriverLocation, isInProgress, rideRoute],
  );
  const activeRemainingRoute = isArriving ? remainingDriverToPickupRoute : remainingPickupToDestinationRoute;
  const activeVehicleType = currentRide?.vehicleType ?? 'moto';
  const vehicleRotationDeg = useMemo(() => {
    if (!activeRemainingRoute || activeRemainingRoute.length < 2) return 0;
    const bearing = getBearingDegrees(activeRemainingRoute[0], activeRemainingRoute[1]);
    return bearing - VEHICLE_MARKER_DEFAULT_HEADING[activeVehicleType];
  }, [activeRemainingRoute, activeVehicleType]);

  // Geofencing calculation: straight-line distance in meters to destination
  const distToDest = activeDriverLocation && currentRide?.destination
    ? Math.sqrt(
        Math.pow((currentRide.destination.latitude - activeDriverLocation.latitude) * 111000, 2) +
        Math.pow((currentRide.destination.longitude - activeDriverLocation.longitude) * 111000, 2)
      )
    : 9999;

  const canCompleteRide = distToDest <= 200;

  useEffect(() => {
    if (currentRide?.status !== 'arrived') return;
    const interval = setInterval(() => {
      setWaitTimer(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [currentRide?.status]);

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs < 10 ? '0' : ''}${remainingSecs}`;
  };

  useEffect(() => {
    if (!currentRide) router.replace('/(tabs)');
    if (currentRide?.status === 'negotiating') router.replace('/negotiation');
    if (currentRide?.status === 'completed') router.replace('/(tabs)');
  }, [currentRide?.status]);

  useEffect(() => {
    if (!mapRef.current || !currentRide) return;
    if (fittedMapStateRef.current === currentRide.status) return;

    if (isArriving && activeDriverLocation) {
      mapRef.current.fitToCoordinates(
        [activeDriverLocation, currentRide.pickup],
        { edgePadding: { top: 120, right: 40, bottom: 300, left: 40 }, animated: true }
      );
      fittedMapStateRef.current = currentRide.status;
      return;
    }

    if (isArrived || isInProgress) {
      mapRef.current.fitToCoordinates(
        [currentRide.pickup, currentRide.destination],
        { edgePadding: { top: 120, right: 40, bottom: 300, left: 40 }, animated: true }
      );
      fittedMapStateRef.current = currentRide.status;
    }
  }, [activeDriverLocation, currentRide, isArrived, isArriving, isInProgress]);

  const handleComplete = () => {
    Alert.alert('Complete Ride', 'Confirm that you have arrived at your destination?', [
      { text: 'Not yet', style: 'cancel' },
      {
        text: 'Complete',
        onPress: () => {
          completeRide();
          router.replace('/(tabs)');
        },
      },
    ]);
  };

  const handleEmergencyEnd = () => {
    Alert.alert('End Journey', 'End this journey early?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Journey',
        style: 'destructive',
        onPress: () => {
          completeRide();
          router.replace('/(tabs)');
        },
      },
    ]);
  };

  const handleCancelArrived = () => {
    Alert.alert(
      'Cancel Ride',
      'The driver has arrived. Are you sure you want to cancel?',
      [
        { text: 'No, keep ride', style: 'cancel' },
        {
          text: 'Cancel Ride',
          style: 'destructive',
          onPress: () => {
            cancelRide();
            router.replace('/(tabs)');
          },
        },
      ]
    );
  };

  const handleCallDriver = () => {
    const phone = currentRide?.driver?.phone;
    if (!phone) {
      Alert.alert('Cannot call', 'No driver phone number is available.');
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Cannot call', 'Unable to open the phone dialler.');
    });
  };

  if (!currentRide) return null;

  const statusMsg = STATUS_MESSAGES[currentRide.status] ?? 'Ride confirmed';
  const pickupEtaSeconds = isArriving && activeDriverLocation
    ? Math.max(0, Math.ceil((haversineKm(activeDriverLocation, currentRide.pickup) * 1000) / ARRIVING_AVERAGE_SPEED_MPS))
    : null;
  const pickupEtaText = pickupEtaSeconds !== null
    ? formatAwayEta(pickupEtaSeconds)
    : isArriving && currentRide.driver
      ? `${currentRide.driver.eta} min away`
      : null;
  const displayEta = pickupEtaText ?? (rideRoute ? formatDuration(rideRoute.durationSeconds) : `${currentRide.duration} min`);
  const pickupDistanceText = isArriving && activeDriverLocation
    ? formatDistance(haversineKm(activeDriverLocation, currentRide.pickup) * 1000)
    : null;

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        initialRegion={
          driverLocation
            ? { ...driverLocation, latitudeDelta: 0.02, longitudeDelta: 0.02 }
            : { ...currentRide.pickup, latitudeDelta: 0.02, longitudeDelta: 0.02 }
        }
        customMapStyle={darkMapStyle}
      >
        {activeDriverLocation && (
          <Marker coordinate={activeDriverLocation} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <View style={styles.vehicleMarkerWrap}>
              <Image
                source={VEHICLE_MARKER_IMAGES[currentRide.vehicleType]}
                style={[
                  styles.vehicleMarkerImage,
                  VEHICLE_IMAGE_STYLES[currentRide.vehicleType],
                  { transform: [{ rotate: `${vehicleRotationDeg}deg` }] },
                ]}
                resizeMode="contain"
              />
            </View>
          </Marker>
        )}
        {!isInProgress && (
          <Marker coordinate={currentRide.pickup} anchor={{ x: 0.5, y: 1 }}>
            <View style={styles.pickupMarker}>
              <View style={[styles.pickupMarkerRing, { borderColor: colors.primary }]}>
                <View style={[styles.pickupMarkerDot, { backgroundColor: colors.primary }]} />
              </View>
              <View style={[styles.pickupMarkerStem, { backgroundColor: colors.primary }]} />
            </View>
          </Marker>
        )}
        {!isArriving && (
          <Marker coordinate={currentRide.destination} anchor={{ x: 0.5, y: 1 }}>
            <View style={[styles.pinMarker, { backgroundColor: colors.destructive }]}>
              <Feather name="map-pin" size={10} color="#fff" />
            </View>
          </Marker>
        )}
        {/* Real road route */}
        {isArriving ? (
          remainingDriverToPickupRoute && (
            <RoutePolyline coordinates={remainingDriverToPickupRoute} color={ARRIVING_ROUTE_COLOR} width={4} />
          )
        ) : isInProgress ? (
          remainingPickupToDestinationRoute && (
            <RoutePolyline coordinates={remainingPickupToDestinationRoute} color={ARRIVING_ROUTE_COLOR} width={4} />
          )
        ) : (
          rideRoute && <RoutePolyline coordinates={rideRoute.coordinates} color={ARRIVING_ROUTE_COLOR} width={4} />
        )}
      </MapView>

      {/* Top status */}
      <View
        style={[
          styles.topStatus,
          {
            paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) + 12,
            backgroundColor: colors.background,
          },
        ]}
      >
        <View style={styles.statusRow}>
          <StatusChip status={currentRide.status} />
          <View style={styles.statusTextWrap}>
            <Text style={[styles.statusMsg, { color: colors.foreground }]} numberOfLines={1}>
              {statusMsg}
            </Text>
          </View>
        </View>
        {currentRide.driver && (
          <Text style={[styles.eta, { color: colors.primary }]} numberOfLines={1}>
            {pickupEtaText ?? (rideRoute ? formatDuration(rideRoute.durationSeconds) : `${currentRide.driver.eta} min`)}
          </Text>
        )}
      </View>

      {isInProgress && (
        <View style={[styles.tbtCard, { backgroundColor: colors.card, borderColor: colors.border, top: insets.top + (Platform.OS === 'web' ? 67 : 0) + 70 }]}>
          <MaterialCommunityIcons name="navigation" size={24} color={colors.primary} style={{ transform: [{ rotate: '45deg' }] }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.tbtText, { color: colors.foreground }]}>
              In 400m, turn left onto Boulevard de l'OUA
            </Text>
            <Text style={[styles.tbtSubtext, { color: colors.mutedForeground }]}>
              Continuing toward destination
            </Text>
          </View>
        </View>
      )}

      {isArrived && (
        <View style={[styles.arrivedBanner, { backgroundColor: colors.primary }]}>
          <Feather name="check-circle" size={18} color={colors.primaryForeground} />
          <Text style={[styles.arrivedBannerText, { color: colors.primaryForeground }]}>
            Your rider has arrived. Please come to the pickup point. (Waiting timer: {formatTimer(waitTimer)})
          </Text>
        </View>
      )}
      <View style={[styles.driverCard, {
        backgroundColor: colors.background,
        paddingBottom: insets.bottom + (Platform.OS === 'web' ? 24 : 12),
      }]}>
        <View style={styles.handle} />

        {/* Driver info */}
        <View style={styles.driverRow}>
          <View style={[styles.driverAvatar, { backgroundColor: colors.primary }]}>
            <Text style={[styles.driverInitial, { color: colors.primaryForeground }]}>
              {currentRide.driver?.name?.[0] ?? 'D'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.driverName, { color: colors.foreground }]}>
              {currentRide.driver?.name ?? 'Driver'}
            </Text>
            <Text style={[styles.driverVehicle, { color: colors.mutedForeground }]}>
              {VEHICLE_LABELS_FULL[currentRide.vehicleType]} · {currentRide.driver?.plateNumber}
            </Text>
          </View>
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingText}>★ {currentRide.driver?.rating?.toFixed(1)}</Text>
          </View>
        </View>

        {/* Fare */}
        <View style={[styles.fareRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <View style={styles.fareItem}>
            <Text style={[styles.fareLabel, { color: colors.mutedForeground }]}>Agreed Fare</Text>
            <Text style={[styles.fareValue, { color: colors.primary }]}>
              {currentRide.agreedFare?.toLocaleString()} RWF
            </Text>
          </View>
          <View style={[styles.fareDivider, { backgroundColor: colors.border }]} />
          <View style={[styles.fareItem]}>
            <Text style={[styles.fareLabel, { color: colors.mutedForeground }]}>Distance</Text>
            <Text style={[styles.fareValue, { color: colors.foreground }]}>
              {pickupDistanceText ?? (rideRoute ? formatDistance(rideRoute.distanceMeters) : `${currentRide.distance} km`)}
            </Text>
          </View>
          <View style={[styles.fareDivider, { backgroundColor: colors.border }]} />
          <View style={styles.fareItem}>
            <Text style={[styles.fareLabel, { color: colors.mutedForeground }]}>ETA</Text>
            <Text style={[styles.fareValue, { color: colors.foreground }]}>
              {displayEta}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {(isArriving || isArrived) && (
            <TouchableOpacity
              style={[
                styles.actionBtn,
                isArriving && styles.wideActionBtn,
                { backgroundColor: colors.muted },
              ]}
              onPress={handleCallDriver}
            >
              <Feather name="phone" size={20} color={colors.foreground} />
              {isArriving && (
                <Text style={[styles.callBtnText, { color: colors.foreground }]}>Call driver</Text>
              )}
            </TouchableOpacity>
          )}
          {isArrived && (
            <>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.destructive + '20', borderWidth: 1, borderColor: colors.destructive, flex: 1 }]}
                onPress={handleCancelArrived}
              >
                <Feather name="x" size={18} color={colors.destructive} />
                <Text style={[styles.cancelBtnText, { color: colors.destructive }]}>Cancel Ride</Text>
              </TouchableOpacity>
              <KandaButton
                title="Start Journey"
                onPress={startJourney}
                style={{ flex: 1 }}
              />
            </>
          )}
          {isInProgress && (
            <>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.destructive + '20', borderWidth: 1, borderColor: colors.destructive }]}
                onPress={handleEmergencyEnd}
              >
                <Feather name="alert-octagon" size={20} color={colors.destructive} />
              </TouchableOpacity>
              {canCompleteRide ? (
                <KandaButton
                  title="Complete Ride"
                  onPress={handleComplete}
                  style={{ flex: 1 }}
                />
              ) : (
                <View style={[styles.geofenceNotice, { backgroundColor: colors.muted }]}>
                  <Text style={[styles.geofenceText, { color: colors.mutedForeground }]}>
                    Arriving shortly...
                  </Text>
                </View>
              )}
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
];

const styles = StyleSheet.create({
  container: { flex: 1 },
  topStatus: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  statusRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusTextWrap: { flex: 1, minWidth: 0, alignItems: 'center' },
  statusMsg: { fontSize: 13, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  statusEtaText: { fontSize: 15, fontFamily: 'Inter_700Bold', marginTop: 2 },
  eta: { flexShrink: 0, fontSize: 13, fontFamily: 'Inter_700Bold' },
  arrivedBanner: {
    position: 'absolute',
    top: 110,
    left: 20,
    right: 20,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
  },
  arrivedBannerText: { flex: 1, fontSize: 14, fontFamily: 'Inter_600SemiBold', lineHeight: 20 },
  pinMarker: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  pickupMarker: { alignItems: 'center' },
  pickupMarkerRing: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupMarkerDot: { width: 6, height: 6, borderRadius: 3 },
  pickupMarkerStem: { width: 2, height: 10, borderRadius: 1, marginTop: -1 },
  vehicleMarkerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 70,
    height: 70,
  },
  vehicleMarkerImage: {
    zIndex: 2,
  },
  driverCard: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingHorizontal: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 16,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#3A3A3A', alignSelf: 'center' },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  driverAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  driverInitial: { fontSize: 19, fontFamily: 'Inter_700Bold' },
  driverName: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  driverVehicle: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  ratingBadge: {
    backgroundColor: '#FF9F0A20',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },
  ratingText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#FF9F0A' },
  fareRow: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  fareItem: { flex: 1, alignItems: 'center', paddingVertical: 8, gap: 2 },
  fareDivider: { width: 1 },
  fareLabel: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  fareValue: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  actions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  actionBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  wideActionBtn: { flex: 1, width: undefined, flexDirection: 'row', gap: 8 },
  callBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  cancelBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  tbtCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  tbtText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', lineHeight: 20 },
  tbtSubtext: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  geofenceNotice: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  geofenceText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
});
