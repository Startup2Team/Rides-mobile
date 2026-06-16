import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import { ProfileAvatarCircle } from '@/components/ProfileAvatarCircle';
import {
  getLocationMapPinCenterOffset,
  LOCATION_MAP_PIN_ANCHOR,
  LocationMapPin,
} from '@/components/maps/LocationMapPin';
import { RoutePolyline } from '@/components/maps/RoutePolyline';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { useRide } from '@/context/RideContext';
import { useColors } from '@/hooks/useColors';
import { useRoute } from '@/hooks/useRoute';
import { useDriverTracking } from '@/hooks/useDriverTracking';
import { useScreenTimerManager } from '@/hooks/useScreenTimerManager';
import { formatDistance, formatDuration, haversineKm, routePolylineThroughPinTips } from '@/utils/mapUtils';
import { VehicleMapMarker } from '@/components/VehicleMapMarker';
import { FLOATING_PANEL_TOP_RADIUS } from '@/constants/surfaces';
import { KIGALI_CENTER, VehicleType } from '@/types';

const WAIT_LIMIT_SECONDS = 180;
const ARRIVAL_UNLOCK_KM = 1;
const MAP_EDGE_PADDING = { top: 120, right: 56, bottom: 320, left: 40 };

const VEHICLE_MARKER_DEFAULT_HEADING: Record<VehicleType, number> = {
  moto: 270,
  rifani: 270,
  cab: 315,
  hilux: 90,
  fuso: 90,
};

function getDistanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  return Math.sqrt(
    Math.pow((b.latitude - a.latitude) * 111, 2) +
    Math.pow((b.longitude - a.longitude) * 111, 2),
  );
}

function getRemainingRouteCoordinates(
  routeCoordinates: Array<{ latitude: number; longitude: number }>,
  driverPosition: { latitude: number; longitude: number },
) {
  if (routeCoordinates.length < 2) return routeCoordinates;
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  routeCoordinates.forEach((coord, index) => {
    const d =
      Math.pow(coord.latitude - driverPosition.latitude, 2) +
      Math.pow(coord.longitude - driverPosition.longitude, 2);
    if (d < nearestDistance) { nearestDistance = d; nearestIndex = index; }
  });
  return [driverPosition, ...routeCoordinates.slice(Math.min(nearestIndex + 1, routeCoordinates.length - 1))];
}

function getBearingDegrees(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) {
  const fromLat = (from.latitude * Math.PI) / 180;
  const toLat = (to.latitude * Math.PI) / 180;
  const deltaLng = ((to.longitude - from.longitude) * Math.PI) / 180;
  const y = Math.sin(deltaLng) * Math.cos(toLat);
  const x = Math.cos(fromLat) * Math.sin(toLat) - Math.sin(fromLat) * Math.cos(toLat) * Math.cos(deltaLng);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

function formatWaitTime(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}:${s < 10 ? '0' : ''}${s}` : `${s} sec`;
}

export default function DriverNavigateScreen() {
  const colors = useColors();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const { currentRide, driverLocation, markArrived, startJourney, completeRide, cancelRide } = useRide();
  const { driverProfile, recordCompletedRide, user } = useAuth();

  const [waitClockTick, setWaitClockTick] = useState(0);
  const [bottomCardHeight, setBottomCardHeight] = useState(260);
  const [mapType, setMapType] = useState<'standard' | 'satellite' | 'hybrid'>('standard');

  const mapRef = useRef<MapView>(null);
  const fittedMapPhaseRef = useRef<string | null>(null);
  const timers = useScreenTimerManager();
  const waitClockRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const phase = currentRide?.status === 'in_progress'
    ? 'inprogress'
    : currentRide?.status === 'arrived'
      ? 'waiting'
      : 'pickup';

  const target = phase === 'inprogress' ? currentRide?.destination : currentRide?.pickup;
  const [navigationOrigin, setNavigationOrigin] = useState(driverLocation ?? KIGALI_CENTER);

  const { route, loading: routeLoading } = useRoute(
    currentRide ? navigationOrigin : null,
    target ? { latitude: target.latitude, longitude: target.longitude } : null,
  );

  const { route: rideRoute } = useRoute(
    phase === 'waiting' && currentRide ? currentRide.pickup : null,
    phase === 'waiting' && currentRide ? currentRide.destination : null,
  );

  const fullRideRouteThroughPins = useMemo(() => {
    if (phase !== 'waiting' || !rideRoute || !currentRide || rideRoute.coordinates.length < 2) return null;
    return routePolylineThroughPinTips(rideRoute.coordinates, currentRide.pickup, currentRide.destination);
  }, [currentRide, phase, rideRoute]);

  useEffect(() => {
    if (!target || !currentRide) return;
    const origin = phase === 'inprogress' ? currentRide.pickup : driverLocation ?? KIGALI_CENTER;
    setNavigationOrigin(origin);
    fittedMapPhaseRef.current = null;
  }, [currentRide?.id, phase, target?.latitude, target?.longitude]);

  const routeCoordinates = route?.coordinates ?? [];
  const liveDriverPos = useDriverTracking({
    enabled: phase === 'pickup' || phase === 'inprogress',
    routeCoordinates,
    stepCount: phase === 'pickup' ? 10 : 24,
  });
  const driverPos = liveDriverPos ?? driverLocation ?? KIGALI_CENTER;

  // Wait clock
  useEffect(() => {
    timers.clearInterval(waitClockRef.current);
    waitClockRef.current = null;
    if (phase !== 'waiting') return;
    waitClockRef.current = timers.scheduleInterval(() => setWaitClockTick(t => t + 1), 1000);
    return () => { timers.clearInterval(waitClockRef.current); waitClockRef.current = null; };
  }, [phase, timers]);

  const pickupWait = useMemo(() => {
    if (phase !== 'waiting' || !currentRide?.waitStartedAt) {
      return { remainingSeconds: WAIT_LIMIT_SECONDS, lateSeconds: 0, isLate: false };
    }
    const startedMs = new Date(currentRide.waitStartedAt).getTime();
    if (Number.isNaN(startedMs)) return { remainingSeconds: WAIT_LIMIT_SECONDS, lateSeconds: 0, isLate: false };
    const elapsed = Math.max(0, Math.floor((Date.now() - startedMs) / 1000));
    const remainingSeconds = Math.max(WAIT_LIMIT_SECONDS - elapsed, 0);
    const lateSeconds = Math.max(elapsed - WAIT_LIMIT_SECONDS, 0);
    return { remainingSeconds, lateSeconds, isLate: lateSeconds > 0 };
  }, [currentRide?.waitStartedAt, phase, waitClockTick]);

  // Map fitting
  const mapFitEdgePadding = useMemo(() => ({
    top: insets.top + (Platform.OS === 'web' ? 67 : 0) + 108,
    right: MAP_EDGE_PADDING.right,
    bottom: bottomCardHeight + insets.bottom + (Platform.OS === 'web' ? 24 : 12) + 28,
    left: MAP_EDGE_PADDING.left,
  }), [bottomCardHeight, insets.bottom, insets.top]);

  useEffect(() => {
    if (!mapRef.current || !currentRide) return;
    if (phase === 'waiting') {
      const routeReady = Boolean(rideRoute && rideRoute.coordinates.length > 1);
      const fitKey = routeReady ? 'waiting-route' : 'waiting-pins';
      if (fittedMapPhaseRef.current === fitKey) return;
      const coordinates = routeReady ? rideRoute!.coordinates : [currentRide.pickup, currentRide.destination];
      mapRef.current.fitToCoordinates(coordinates, { edgePadding: mapFitEdgePadding, animated: true });
      fittedMapPhaseRef.current = fitKey;
      return;
    }
    if (fittedMapPhaseRef.current === phase) return;
    const coordinates = phase === 'inprogress'
      ? [currentRide.pickup, currentRide.destination]
      : target ? [driverPos, target] : null;
    if (!coordinates) return;
    mapRef.current.fitToCoordinates(coordinates, { edgePadding: mapFitEdgePadding, animated: true });
    fittedMapPhaseRef.current = phase;
  }, [currentRide, driverPos, mapFitEdgePadding, phase, rideRoute, target]);

  const remainingRoute = useMemo(() => {
    if (!route) return null;
    const slice = getRemainingRouteCoordinates(route.coordinates, driverPos);
    const endPin = phase === 'inprogress' ? currentRide?.destination : currentRide?.pickup;
    if (!endPin) return slice;
    return routePolylineThroughPinTips(slice, null, endPin);
  }, [currentRide, driverPos, phase, route]);

  const vehicleRotationDeg = useMemo(() => {
    if (!currentRide || !remainingRoute || remainingRoute.length < 2) return 0;
    const bearing = getBearingDegrees(remainingRoute[0], remainingRoute[1]);
    return bearing - VEHICLE_MARKER_DEFAULT_HEADING[currentRide.vehicleType];
  }, [currentRide, remainingRoute]);

  const distanceToTargetKm = target ? getDistanceKm(driverPos, target) : 0;
  const etaText = route && !routeLoading
    ? formatDuration(route.durationSeconds)
    : `${Math.round(distanceToTargetKm * 3 + 1)} min`;
  const distanceText = route
    ? formatDistance(route.distanceMeters)
    : formatDistance(distanceToTargetKm * 1000);
  const canMarkArrived = true;
  const isCustomerLate = pickupWait.isLate;

  const statusMessage =
    phase === 'pickup' ? 'Heading to pickup' :
    phase === 'waiting' ? 'Waiting for customer' :
    'Heading to destination';

  const cycleMapType = useCallback(() => {
    setMapType(prev =>
      prev === 'standard' ? 'satellite' : prev === 'satellite' ? 'hybrid' : 'standard',
    );
  }, []);

  const recenterMap = useCallback(() => {
    if (!mapRef.current || !currentRide) return;
    if (phase === 'waiting') {
      const coordinates = rideRoute && rideRoute.coordinates.length > 1
        ? rideRoute.coordinates
        : [currentRide.pickup, currentRide.destination];
      mapRef.current.fitToCoordinates(coordinates, { edgePadding: mapFitEdgePadding, animated: true });
      return;
    }
    if (!target) return;
    mapRef.current.fitToCoordinates(
      phase === 'inprogress' ? [currentRide.pickup, currentRide.destination] : [driverPos, target],
      { edgePadding: mapFitEdgePadding, animated: true },
    );
  }, [currentRide, driverPos, mapFitEdgePadding, phase, rideRoute, target]);

  const handleCall = useCallback(() => {
    const phone = currentRide?.customerPhone;
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() =>
      Alert.alert('Cannot call', 'Unable to open the phone dialler.'),
    );
  }, [currentRide?.customerPhone]);

  const handleMarkArrived = useCallback(() => {
    fittedMapPhaseRef.current = null;
    markArrived();
  }, [markArrived]);

  const handleCancelRide = () => {
    Alert.alert(
      'Cancel Ride',
      isCustomerLate
        ? `Customer is ${formatWaitTime(pickupWait.lateSeconds)} late. You may cancel this ride.`
        : 'Cancel this ride and return to the queue?',
      [
        {
          text: 'Cancel Ride',
          onPress: () => { cancelRide(); showToast('Ride cancelled', 'info'); router.replace('/(driver)'); },
        },
        { text: 'Back', style: 'cancel' },
      ],
    );
  };

  const handleCompleteRide = () => {
    Alert.alert('Complete Ride', 'Mark this ride as completed?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Complete',
        onPress: () => {
          completeRide('driver', { driverId: user?.id, driverName: user?.name, vehicleType: driverProfile?.vehicleType });
          if (user?.id) void recordCompletedRide(currentRide?.agreedFare ?? 0);
          router.replace('/(driver)');
        },
      },
    ]);
  };

  const handleEmergencyEnd = () => {
    Alert.alert('End Journey Early', 'Are you sure you want to end this journey?', [
      { text: 'End Journey', onPress: handleCompleteRide },
      { text: 'Back', style: 'cancel' },
    ]);
  };

  if (!currentRide) return null;

  const pickupPinCoordinate = currentRide.pickup;
  const destinationPinCoordinate = currentRide.destination;
  const customerInitial = (currentRide.customerName ?? 'C').charAt(0).toUpperCase();
  const mapControlsBottom = bottomCardHeight + insets.bottom + (Platform.OS === 'web' ? 24 : 12) + 16;

  return (
    <View style={styles.container}>
      {/* Fullscreen map */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        initialRegion={{ ...driverPos, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
        mapType={mapType}
        customMapStyle={mapType === 'standard' ? darkMapStyle : undefined}
      >
        <Marker coordinate={driverPos} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges>
          <VehicleMapMarker type={currentRide.vehicleType} rotationDeg={vehicleRotationDeg} />
        </Marker>
        {phase !== 'inprogress' && (
          <Marker coordinate={pickupPinCoordinate} anchor={LOCATION_MAP_PIN_ANCHOR} centerOffset={getLocationMapPinCenterOffset()} tracksViewChanges={false}>
            <LocationMapPin variant="pickup" mapType={mapType} />
          </Marker>
        )}
        {phase !== 'pickup' && (
          <Marker coordinate={destinationPinCoordinate} anchor={LOCATION_MAP_PIN_ANCHOR} centerOffset={getLocationMapPinCenterOffset()} tracksViewChanges={false}>
            <LocationMapPin variant="destination" mapType={mapType} />
          </Marker>
        )}
        {phase !== 'waiting' && remainingRoute && (
          <RoutePolyline coordinates={remainingRoute} color={colors.destructiveHex} width={4} />
        )}
        {phase === 'waiting' && fullRideRouteThroughPins && (
          <RoutePolyline coordinates={fullRideRouteThroughPins} color={colors.destructiveHex} width={4} />
        )}
      </MapView>

      {/* Map controls */}
      <TouchableOpacity
        style={[styles.mapBtn, { backgroundColor: colors.card, bottom: mapControlsBottom + 58 }]}
        onPress={cycleMapType}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Change map view"
      >
        <MaterialCommunityIcons
          name={mapType === 'standard' ? 'layers-outline' : mapType === 'satellite' ? 'satellite-variant' : 'map'}
          size={22}
          color={colors.primary}
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.mapBtn, { backgroundColor: colors.card, bottom: mapControlsBottom }]}
        onPress={recenterMap}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Recenter map"
      >
        <MaterialCommunityIcons name="crosshairs-gps" size={22} color={colors.primary} />
      </TouchableOpacity>

      {/* Floating top header */}
      <View style={[styles.topBar, {
        backgroundColor: colors.background,
        paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) + 12,
      }]}>
        <View style={styles.topBarInner}>
          <View style={styles.topLeft} />
          <View style={styles.topCenter}>
            <Text style={[styles.topStatus, { color: colors.foreground }]} numberOfLines={1}>
              {statusMessage}
            </Text>
          </View>
          <View style={styles.topRight}>
            {phase !== 'waiting' && (
              <Text style={[styles.topEta, { color: colors.primary }]} numberOfLines={1}>
                {etaText}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Bottom card */}
      <View
        style={[styles.bottomCard, {
          backgroundColor: colors.background,
          paddingBottom: insets.bottom + (Platform.OS === 'web' ? 24 : 12),
        }]}
        onLayout={e => { const h = e.nativeEvent.layout.height; if (h > 0) setBottomCardHeight(h); }}
      >
        {/* Customer info row */}
        <View style={styles.customerRow}>
          <ProfileAvatarCircle
            size={42}
            initial={customerInitial}
            imageUri={currentRide.customerImage ?? null}
          />
          <View style={styles.customerInfo}>
            <Text style={[styles.customerName, { color: colors.foreground }]}>
              {currentRide.customerName ?? 'Customer'}
            </Text>
            {currentRide.customerRating != null && (
              <View style={styles.ratingRow}>
                <MaterialCommunityIcons name="star" size={12} color={colors.star} />
                <Text style={[styles.ratingText, { color: colors.star }]}>
                  {currentRide.customerRating.toFixed(1)}
                </Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={[styles.msgBtn, { backgroundColor: colors.muted }]}
            onPress={() => Linking.openURL(`sms:${currentRide.customerPhone ?? ''}`).catch(() => {})}
            accessibilityRole="button"
            accessibilityLabel="Message customer"
          >
            <Feather name="message-circle" size={18} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.msgBtn, { backgroundColor: colors.call }]}
            onPress={handleCall}
            accessibilityRole="button"
            accessibilityLabel="Call customer"
          >
            <Feather name="phone" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Fare / distance / ETA strip */}
        <View style={[styles.fareRow, { backgroundColor: colors.muted }]}>
          <View style={styles.fareItem}>
            <Text style={[styles.fareLabel, { color: colors.mutedForeground }]}>Agreed Fare</Text>
            <Text style={[styles.fareValue, { color: colors.primary }]}>
              {currentRide.agreedFare?.toLocaleString() ?? '-'} RWF
            </Text>
          </View>
          <View style={[styles.fareDivider, { backgroundColor: colors.border }]} />
          <View style={styles.fareItem}>
            <Text style={[styles.fareLabel, { color: colors.mutedForeground }]}>Distance</Text>
            <Text style={[styles.fareValue, { color: colors.foreground }]}>{distanceText}</Text>
          </View>
          <View style={[styles.fareDivider, { backgroundColor: colors.border }]} />
          <View style={styles.fareItem}>
            <Text style={[styles.fareLabel, { color: colors.mutedForeground }]}>ETA</Text>
            <Text style={[styles.fareValue, { color: colors.foreground }]}>
              {phase === 'waiting' ? '—' : etaText}
            </Text>
          </View>
        </View>

        {/* Waiting timer */}
        {phase === 'waiting' && (
          <View style={[styles.timerBox, {
            backgroundColor: isCustomerLate ? colors.destructiveHex + '15' : colors.primaryHex + '12',
            borderColor: isCustomerLate ? colors.destructive : colors.primaryHex + '30',
          }]}>
            <Feather
              name={isCustomerLate ? 'alert-circle' : 'clock'}
              size={18}
              color={isCustomerLate ? colors.destructive : colors.primary}
            />
            <Text style={[styles.timerLabel, { color: isCustomerLate ? colors.destructive : colors.mutedForeground }]}>
              {isCustomerLate ? `Customer ${formatWaitTime(pickupWait.lateSeconds)} late` : 'Time remaining'}
            </Text>
            <Text style={[styles.timerValue, { color: isCustomerLate ? colors.destructive : colors.primary }]}>
              {isCustomerLate ? '' : formatWaitTime(pickupWait.remainingSeconds)}
            </Text>
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.actions}>
          {phase === 'pickup' && (
            <>
              <AppButton title="Cancel" icon="x" variant="dangerPlain" size="sm" iconOnly onPress={handleCancelRide} accessibilityLabel="Cancel ride" />
              <AppButton
                title="I've Arrived"
                onPress={handleMarkArrived}
                disabled={!canMarkArrived}
                style={styles.wide}
                size="sm"
              />
            </>
          )}
          {phase === 'waiting' && (
            <>
              <AppButton title="Cancel Ride" icon="x" variant="dangerPlain" size="sm" onPress={handleCancelRide} style={styles.wide} />
              <AppButton title="Start Journey" size="sm" onPress={startJourney} style={styles.wide} />
            </>
          )}
          {phase === 'inprogress' && (
            <>
              <AppButton title="Emergency" icon="alert-octagon" variant="dangerPlain" size="sm" iconOnly onPress={handleEmergencyEnd} accessibilityLabel="End journey early" />
              <AppButton title="Complete Ride" onPress={handleCompleteRide} style={styles.wide} size="sm" />
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

  mapBtn: {
    position: 'absolute', right: 16, width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center', zIndex: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 6,
  },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    paddingHorizontal: 16, paddingBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14, shadowRadius: 8, elevation: 8,
  },
  topBarInner: { flexDirection: 'row', alignItems: 'center', minHeight: 32 },
  topLeft: { flex: 1, minWidth: 0, zIndex: 1 },
  topCenter: { flex: 2, alignItems: 'center', zIndex: 1 },
  topRight: { flex: 1, alignItems: 'flex-end', zIndex: 1 },
  topStatus: { fontSize: 13, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  topEta: { fontSize: 12, fontFamily: 'Inter_700Bold', textAlign: 'right' },
  callBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', zIndex: 1 },

  bottomCard: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: FLOATING_PANEL_TOP_RADIUS,
    borderTopRightRadius: FLOATING_PANEL_TOP_RADIUS,
    paddingTop: 14, paddingHorizontal: 16, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2, shadowRadius: 16, elevation: 16,
  },

  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  customerInfo: { flex: 1 },
  customerName: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  ratingText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  msgBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },

  fareRow: { flexDirection: 'row', borderRadius: 14, overflow: 'hidden' },
  fareItem: { flex: 1, alignItems: 'center', paddingVertical: 8, gap: 2 },
  fareDivider: { width: 1 },
  fareLabel: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  fareValue: { fontSize: 13, fontFamily: 'Inter_700Bold' },

  timerBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: 14, borderWidth: 1,
  },
  timerLabel: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium' },
  timerValue: { fontSize: 18, fontFamily: 'Inter_700Bold' },

  actions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  wide: { flex: 1 },
});
