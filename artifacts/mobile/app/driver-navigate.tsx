import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { BackButton } from '@/components/BackButton';
import { KandaButton } from '@/components/KandaButton';
import { RoutePolyline } from '@/components/maps/RoutePolyline';
import { useRide } from '@/context/RideContext';
import { useColors } from '@/hooks/useColors';
import { useRoute } from '@/hooks/useRoute';
import { formatDuration } from '@/utils/mapUtils';
import { VEHICLE_MAP_IMAGE_SIZE, VEHICLE_MAP_MARKER_IMAGES } from '@/constants/vehicles';
import { KIGALI_CENTER, VehicleType } from '@/types';

const WAIT_LIMIT_SECONDS = 180;
const ARRIVAL_UNLOCK_KM = 1;

const VEHICLE_MARKER_DEFAULT_HEADING: Record<VehicleType, number> = {
  moto: 270,
  cab: 315,
  hilux: 90,
  fuso: 90,
};

function getDistanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  return Math.sqrt(
    Math.pow((b.latitude - a.latitude) * 111, 2) +
    Math.pow((b.longitude - a.longitude) * 111, 2)
  );
}

function formatDistance(km: number) {
  if (km < 1) return `${Math.max(Math.round(km * 1000), 10)} m`;
  return `${km.toFixed(1)} km`;
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

  return [driverPosition, ...routeCoordinates.slice(Math.min(nearestIndex + 1, routeCoordinates.length - 1))];
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

export default function DriverNavigateScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentRide, driverLocation, markArrived, startJourney, completeRide, cancelRide } = useRide();
  const [driverPos, setDriverPos] = useState(driverLocation ?? KIGALI_CENTER);
  const [waitSeconds, setWaitSeconds] = useState(WAIT_LIMIT_SECONDS);
  const [showReroute, setShowReroute] = useState(false);
  const mapRef = useRef<MapView>(null);
  const fittedMapPhaseRef = useRef<string | null>(null);
  const moveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waitRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  useEffect(() => {
    if (!currentRide) router.replace('/(driver)');
  }, [currentRide]);

  useEffect(() => {
    if (!currentRide && driverLocation) {
      setDriverPos(driverLocation);
      setNavigationOrigin(driverLocation);
    }
  }, [currentRide, driverLocation]);

  useEffect(() => {
    if (!target || !currentRide) return;

    const origin = phase === 'inprogress' ? currentRide.pickup : driverPos;
    setNavigationOrigin(origin);
    fittedMapPhaseRef.current = null;
  }, [currentRide?.id, phase, target?.latitude, target?.longitude]);

  useEffect(() => {
    if (moveRef.current) clearInterval(moveRef.current);
    if (!route || route.coordinates.length === 0 || phase === 'waiting') return;

    let step = 0;
    setDriverPos(route.coordinates[0]);

    moveRef.current = setInterval(() => {
      step = Math.min(step + 1, route.coordinates.length - 1);
      setDriverPos(route.coordinates[step]);

      if (step >= route.coordinates.length - 1 && moveRef.current) {
        clearInterval(moveRef.current);
      }
    }, 1500);

    return () => {
      if (moveRef.current) clearInterval(moveRef.current);
    };
  }, [phase, route]);

  useEffect(() => {
    if (phase !== 'waiting') {
      if (waitRef.current) clearInterval(waitRef.current);
      return;
    }

    const elapsed = currentRide?.waitStartedAt
      ? Math.floor((Date.now() - new Date(currentRide.waitStartedAt).getTime()) / 1000)
      : 0;
    setWaitSeconds(Math.max(WAIT_LIMIT_SECONDS - elapsed, 0));
    waitRef.current = setInterval(() => {
      setWaitSeconds(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      if (waitRef.current) clearInterval(waitRef.current);
    };
  }, [phase, currentRide?.waitStartedAt]);

  useEffect(() => {
    if (phase !== 'inprogress') {
      setShowReroute(false);
      return;
    }
    const timer = setTimeout(() => setShowReroute(true), 5000);
    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (!mapRef.current || !target || !currentRide) return;
    if (fittedMapPhaseRef.current === phase) return;

    const coordinates = phase === 'inprogress'
      ? [currentRide.pickup, currentRide.destination]
      : [driverPos, target];

    mapRef.current.fitToCoordinates(coordinates, {
      edgePadding: { top: 120, right: 40, bottom: 330, left: 40 },
      animated: true,
    });
    fittedMapPhaseRef.current = phase;
  }, [currentRide, driverPos, phase, target]);

  if (!currentRide) return null;

  const distanceToTargetKm = target ? getDistanceKm(driverPos, target) : 0;
  const etaMin = target ? Math.round(distanceToTargetKm * 3 + 1) : 0;
  const canMarkArrived = phase !== 'pickup' || distanceToTargetKm <= ARRIVAL_UNLOCK_KM;
  const pickupDistanceText = formatDistance(distanceToTargetKm);

  const phaseLabel =
    phase === 'pickup' ? 'Heading to pickup' :
    phase === 'waiting' ? 'Waiting for customer' :
    'Heading to destination';

  const formatWait = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleCall = () => {
    if (!currentRide.customerPhone) return;
    Linking.openURL(`tel:${currentRide.customerPhone}`).catch(() =>
      Alert.alert('Cannot call', 'Unable to open the phone dialler.')
    );
  };

  const handleMessage = () => {
    if (!currentRide.customerPhone) return;
    Linking.openURL(`sms:${currentRide.customerPhone}`).catch(() =>
      Alert.alert('Cannot message', 'Unable to open messages.')
    );
  };

  const handleCancelRide = () => {
    Alert.alert(
      'Cancel Ride',
      waitSeconds === 0
        ? 'Customer has not arrived. You may cancel this ride.'
        : 'Cancel this ride and return to the queue?',
      [
        { text: 'Back', style: 'cancel' },
        {
          text: 'Cancel Ride',
          onPress: () => {
            cancelRide();
            router.replace('/(driver)');
          },
        },
      ]
    );
  };

  const handleCompleteRide = () => {
    Alert.alert('Complete Ride', 'Mark this ride as completed?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Complete',
        onPress: () => {
          completeRide();
          router.replace('/(driver)');
        },
      },
    ]);
  };

  const handleEmergencyEnd = () => {
    Alert.alert('End Journey', 'End this journey early?', [
      { text: 'Back', style: 'cancel' },
      { text: 'End Journey', onPress: handleCompleteRide },
    ]);
  };

  const timerExpired = waitSeconds === 0;
  const remainingRoute = useMemo(
    () => route ? getRemainingRouteCoordinates(route.coordinates, driverPos) : null,
    [driverPos, route],
  );
  const vehicleRotationDeg = useMemo(() => {
    if (!remainingRoute || remainingRoute.length < 2) return 0;
    const bearing = getBearingDegrees(remainingRoute[0], remainingRoute[1]);
    return bearing - VEHICLE_MARKER_DEFAULT_HEADING[currentRide.vehicleType];
  }, [currentRide.vehicleType, remainingRoute]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        initialRegion={{ ...driverPos, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
        customMapStyle={darkMapStyle}
      >
        <Marker coordinate={driverPos} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={styles.vehicleMarkerWrap}>
            <Image
              source={VEHICLE_MAP_MARKER_IMAGES[currentRide.vehicleType]}
              style={[
                styles.vehicleMarkerImage,
                VEHICLE_MAP_IMAGE_SIZE[currentRide.vehicleType],
                { transform: [{ rotate: `${vehicleRotationDeg}deg` }] },
              ]}
              resizeMode="contain"
            />
          </View>
        </Marker>
        <Marker coordinate={currentRide.pickup}>
          <View style={[styles.pinMarker, { backgroundColor: colors.primary }]}>
            <Feather name="user" size={14} color="#fff" />
          </View>
        </Marker>
        <Marker coordinate={currentRide.destination}>
          <View style={[styles.pinMarker, { backgroundColor: colors.destructive }]}>
            <Feather name="map-pin" size={14} color="#fff" />
          </View>
        </Marker>
        {remainingRoute && <RoutePolyline coordinates={remainingRoute} color={colors.destructiveHex} width={4} />}
      </MapView>

      <View style={[styles.topBar, {
        backgroundColor: colors.background,
        paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) + 12,
        borderBottomColor: colors.border,
      }]}>
        <BackButton onPress={() => router.back()} />
        <View style={styles.topInfo}>
          <Text style={[styles.topPhase, { color: colors.primary }]}>{phaseLabel}</Text>
          {phase !== 'waiting' && (
            <Text style={[styles.topEta, { color: colors.foreground }]}>
              ETA: {route && !routeLoading ? formatDuration(route.durationSeconds) : `${etaMin} min`}
            </Text>
          )}
        </View>
        <TouchableOpacity style={[styles.callBtn, { backgroundColor: colors.muted }]} onPress={handleCall}>
          <Feather name="phone" size={20} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {phase === 'inprogress' && (
        <View style={[styles.turnCard, { backgroundColor: colors.card, borderColor: colors.border, top: insets.top + (Platform.OS === 'web' ? 67 : 0) + 82 }]}>
          <MaterialCommunityIcons name="navigation" size={24} color={colors.primary} style={{ transform: [{ rotate: '45deg' }] }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.turnText, { color: colors.foreground }]}>In 400m, continue on the fastest route</Text>
            <Text style={[styles.turnSubtext, { color: colors.mutedForeground }]}>Turn-by-turn navigation active</Text>
          </View>
        </View>
      )}

      {showReroute && (
        <View style={[styles.rerouteBanner, { backgroundColor: colors.primary, top: insets.top + (Platform.OS === 'web' ? 67 : 0) + 152 }]}>
          <Text style={[styles.rerouteText, { color: colors.primaryForeground }]}>Faster route available</Text>
          <TouchableOpacity style={styles.rerouteBtn} onPress={() => setShowReroute(false)}>
            <Text style={[styles.rerouteBtnText, { color: colors.primaryForeground }]}>Reroute</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.bottomCard, {
        backgroundColor: colors.background,
        borderTopColor: colors.border,
        paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 20),
      }]}>
        <View style={styles.routePreview}>
          <View style={styles.routeRow}>
            <View style={[styles.dot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.routeText, { color: colors.foreground }]} numberOfLines={2}>
              {currentRide.pickup.address}
            </Text>
          </View>
          <View style={[styles.routeLine, { backgroundColor: colors.border }]} />
          <View style={styles.routeRow}>
            <View style={[styles.dot, { backgroundColor: colors.destructive, borderRadius: 3 }]} />
            <Text style={[styles.routeText, { color: colors.foreground }]} numberOfLines={2}>
              {currentRide.destination.address}
            </Text>
          </View>
        </View>

        {phase === 'pickup' && (
          <View style={[styles.arrivingPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.arrivingHeader}>
              <View>
                <Text style={[styles.arrivingEyebrow, { color: colors.primary }]}>Pickup in progress</Text>
                <Text style={[styles.arrivingTitle, { color: colors.foreground }]}>Navigate to the customer</Text>
              </View>
              <View style={[styles.arrivingBadge, { backgroundColor: colors.primaryHex + '18' }]}>
                <Feather name="navigation" size={14} color={colors.primary} />
                <Text style={[styles.arrivingBadgeText, { color: colors.primary }]}>{pickupDistanceText}</Text>
              </View>
            </View>

            <View style={styles.tripMetrics}>
              <View style={[styles.metricBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>ETA</Text>
                <Text style={[styles.metricValue, { color: colors.foreground }]}>
                  {route && !routeLoading ? formatDuration(route.durationSeconds) : `${etaMin} min`}
                </Text>
              </View>
              <View style={[styles.metricBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>Fare</Text>
                <Text style={[styles.metricValue, { color: colors.foreground }]}>
                  {currentRide.agreedFare?.toLocaleString() ?? '-'} RWF
                </Text>
              </View>
            </View>

            {!canMarkArrived && (
              <Text style={[styles.arrivalHint, { color: colors.mutedForeground }]}>
                Arrival unlocks when you are within {formatDistance(ARRIVAL_UNLOCK_KM)} of pickup.
              </Text>
            )}
          </View>
        )}

        <View style={styles.customerRow}>
          <View style={[styles.customerAvatar, { backgroundColor: colors.muted }]}>
            <Feather name="user" size={20} color={colors.foreground} />
          </View>
          <View style={styles.customerInfo}>
            <Text style={[styles.customerName, { color: colors.foreground }]}>{currentRide.customerName ?? 'Customer'}</Text>
            <Text style={[styles.fareText, { color: colors.primary }]}>
              Agreed: {currentRide.agreedFare?.toLocaleString() ?? '-'} RWF
            </Text>
          </View>
          <View style={styles.contactActions}>
            <TouchableOpacity style={[styles.contactBtn, { backgroundColor: colors.muted }]} onPress={handleMessage}>
              <Feather name="message-circle" size={18} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.contactBtn, { backgroundColor: colors.primary }]} onPress={handleCall}>
              <Feather name="phone" size={18} color={colors.primaryForeground} />
            </TouchableOpacity>
          </View>
        </View>

        {phase === 'pickup' && (
          <KandaButton
            title={canMarkArrived ? 'I Have Arrived' : `Arrive closer (${pickupDistanceText})`}
            onPress={markArrived}
            disabled={!canMarkArrived}
            fullWidth
            size="lg"
          />
        )}

        {phase === 'waiting' && (
          <View style={styles.waitingBlock}>
            <View style={[styles.timerBox, {
              backgroundColor: timerExpired ? colors.destructive + '15' : colors.primaryHex + '15',
              borderColor: timerExpired ? colors.destructive + '40' : colors.primaryHex + '30',
            }]}>
              <Feather name="clock" size={18} color={timerExpired ? colors.destructive : colors.primary} />
              <Text style={[styles.timerLabel, { color: colors.mutedForeground }]}>Time remaining</Text>
              <Text style={[styles.timerValue, { color: timerExpired ? colors.destructive : colors.primary }]}>{formatWait(waitSeconds)}</Text>
            </View>
            {timerExpired && (
              <Text style={[styles.cancelPrompt, { color: colors.destructive }]}>
                Customer has not arrived. You may cancel this ride.
              </Text>
            )}
            <View style={styles.waitingActions}>
              <KandaButton title="Start Journey" onPress={startJourney} style={{ flex: 1 }} size="lg" />
              <TouchableOpacity
                style={[
                  styles.cancelRideBtn,
                  {
                    backgroundColor: timerExpired ? colors.destructive + '20' : colors.muted,
                    borderColor: timerExpired ? colors.destructive : colors.border,
                  },
                ]}
                onPress={handleCancelRide}
              >
                <Feather name="x" size={16} color={timerExpired ? colors.destructive : colors.foreground} />
                <Text style={[styles.cancelRideBtnText, { color: timerExpired ? colors.destructive : colors.foreground }]}>Cancel Ride</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {phase === 'inprogress' && (
          <View style={styles.waitingActions}>
            <TouchableOpacity
              style={[styles.cancelRideBtn, { backgroundColor: colors.destructive + '15', borderColor: colors.destructive }]}
              onPress={handleEmergencyEnd}
            >
              <Feather name="alert-octagon" size={16} color={colors.destructive} />
              <Text style={[styles.cancelRideBtnText, { color: colors.destructive }]}>End Journey</Text>
            </TouchableOpacity>
            <KandaButton title="Complete Ride" onPress={handleCompleteRide} style={{ flex: 1 }} size="lg" />
          </View>
        )}
      </View>
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
  topBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  topInfo: { flex: 1 },
  topPhase: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  topEta: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  callBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  turnCard: {
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
  turnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  turnSubtext: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  rerouteBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rerouteText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  rerouteBtn: { borderWidth: 1, borderColor: 'rgba(0,0,0,0.25)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  rerouteBtnText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  vehicleMarkerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 70,
    height: 70,
  },
  vehicleMarkerImage: {
    zIndex: 2,
  },
  pinMarker: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  bottomCard: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    borderTopWidth: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingHorizontal: 20,
    gap: 16,
  },
  routePreview: { gap: 6 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  routeLine: { height: 1, marginLeft: 15 },
  routeText: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium', lineHeight: 19 },
  arrivingPanel: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  arrivingHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  arrivingEyebrow: { fontSize: 12, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  arrivingTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', marginTop: 2 },
  arrivingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  arrivingBadgeText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  tripMetrics: { flexDirection: 'row', gap: 10 },
  metricBox: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  metricLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', marginBottom: 3 },
  metricValue: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  arrivalHint: { fontSize: 12, fontFamily: 'Inter_500Medium', lineHeight: 17 },
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  customerAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  customerInfo: { flex: 1 },
  customerName: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  fareText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  contactActions: { flexDirection: 'row', gap: 8 },
  contactBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  waitingBlock: { gap: 12 },
  waitingActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  cancelRideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 50,
    paddingHorizontal: 16,
    borderRadius: 25,
    borderWidth: 1.5,
  },
  cancelRideBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  cancelPrompt: { fontSize: 12, fontFamily: 'Inter_500Medium', lineHeight: 18 },
  timerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  timerLabel: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium' },
  timerValue: { fontSize: 22, fontFamily: 'Inter_700Bold' },
});
