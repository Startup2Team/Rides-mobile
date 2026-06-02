import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { BackButton } from '@/components/BackButton';
import { AppButton } from '@/components/AppButton';
import {
  LOCATION_MAP_PIN_ANCHOR,
  LOCATION_MAP_PIN_CENTER_OFFSET,
  LocationMapPin,
} from '@/components/maps/LocationMapPin';
import { RoutePolyline } from '@/components/maps/RoutePolyline';
import { useToast } from '@/context/ToastContext';
import { useRide } from '@/context/RideContext';
import { useColors } from '@/hooks/useColors';
import { useRoute } from '@/hooks/useRoute';
import { formatDuration } from '@/utils/mapUtils';
import { VehicleMapMarker } from '@/components/VehicleMapMarker';
import { KIGALI_CENTER, VehicleType } from '@/types';
import * as driverRideService from '@/services/driverRides';

const WAIT_LIMIT_SECONDS = 180;
const ARRIVAL_UNLOCK_KM = 1;
/** Distance from destination at which to proactively re-enter the matching pool. */
const PRE_COMPLETE_KM = 0.5;
/** How often to send GPS updates to the backend while navigating (ms). */
const GPS_SEND_INTERVAL_MS = 5000;

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
  const { currentRide, markArrived, startJourney, completeRide, cancelRide, sendWsLocationUpdate } = useRide();
  const { showToast } = useToast();
  const [driverPos, setDriverPos] = useState(KIGALI_CENTER);
  const [waitSeconds, setWaitSeconds] = useState(WAIT_LIMIT_SECONDS);
  const mapRef = useRef<MapView>(null);
  const fittedMapPhaseRef = useRef<string | null>(null);
  const waitRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const enRouteSentRef = useRef(false);
  const preCompleteSentRef = useRef(false);

  const phase = currentRide?.status === 'in_progress'
    ? 'inprogress'
    : currentRide?.status === 'arrived'
      ? 'waiting'
      : 'pickup';
  const target = phase === 'inprogress' ? currentRide?.destination : currentRide?.pickup;
  const [navigationOrigin, setNavigationOrigin] = useState(KIGALI_CENTER);

  const { route, loading: routeLoading } = useRoute(
    currentRide ? navigationOrigin : null,
    target ? { latitude: target.latitude, longitude: target.longitude } : null,
  );

  // ── Guard: redirect if ride is gone ───────────────────────────────────────
  // router.navigate (not replace) pops everything above the existing '(driver)'
  // base route and returns to it. router.replace fails with "not handled" when
  // the target is already below the current route in the root Stack.
  useEffect(() => {
    if (!currentRide) router.navigate('/(driver)');
  }, [currentRide]);

  // ── Real-device GPS tracking ───────────────────────────────────────────────
  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    let sendTimer: ReturnType<typeof setInterval> | null = null;
    let latestCoords: { latitude: number; longitude: number } | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 5 },
        loc => {
          const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          latestCoords = coords;
          setDriverPos(coords);
        },
      );

      // Throttle WS sends to once every GPS_SEND_INTERVAL_MS to avoid flooding.
      sendTimer = setInterval(() => {
        if (latestCoords) {
          sendWsLocationUpdate(latestCoords.latitude, latestCoords.longitude);
        }
      }, GPS_SEND_INTERVAL_MS);
    })();

    return () => {
      subscription?.remove();
      if (sendTimer) clearInterval(sendTimer);
    };
  }, [sendWsLocationUpdate]);

  // ── Trigger CONFIRMED → DRIVER_EN_ROUTE once on mount ─────────────────────
  useEffect(() => {
    if (!currentRide?.id || enRouteSentRef.current) return;
    if (currentRide.status === 'confirmed' || currentRide.status === 'arriving') {
      enRouteSentRef.current = true;
      driverRideService.markEnRoute(currentRide.id).catch(() => {
        // If the transition already happened (e.g. app restart mid-ride), that's fine.
        enRouteSentRef.current = false;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRide?.id]);

  // ── Reset navigationOrigin when phase changes ──────────────────────────────
  useEffect(() => {
    if (!target || !currentRide) return;
    const origin = phase === 'inprogress' ? currentRide.pickup : driverPos;
    setNavigationOrigin(origin);
    fittedMapPhaseRef.current = null;
    preCompleteSentRef.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRide?.id, phase, target?.latitude, target?.longitude]);

  // ── Pre-complete: re-enter matching pool when nearly at destination ─────────
  // When the driver is within PRE_COMPLETE_KM of the destination during an
  // active trip, call SetAvailability so they can receive the next ride request
  // before tapping "Complete". This prevents dead time between rides.
  const distanceToTargetKm = target ? getDistanceKm(driverPos, target) : 0;
  useEffect(() => {
    if (phase !== 'inprogress' || preCompleteSentRef.current) return;
    if (distanceToTargetKm > 0 && distanceToTargetKm <= PRE_COMPLETE_KM && currentRide?.id) {
      preCompleteSentRef.current = true;
      // Fire-and-forget — don't block the UI if this fails.
      driverRideService.setDriverAvailability(true).catch(() => {});
    }
  }, [phase, distanceToTargetKm, currentRide?.id]);

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

  const canMarkArrived = phase !== 'pickup' || distanceToTargetKm <= ARRIVAL_UNLOCK_KM;
  const pickupDistanceText = formatDistance(distanceToTargetKm);
  const routeEtaText = route && !routeLoading ? formatDuration(route.durationSeconds) : '--';

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
            cancelRide(true);
            showToast('Ride cancelled', 'info');
            router.navigate('/(driver)');
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
        onPress: async () => {
          try {
            await completeRide();
          } catch {
            // Logged by the API interceptor — safe to swallow here.
          }
          // Navigation is deferred to the !currentRide useEffect guard above —
          // avoids a double router.navigate race when setCurrentRide(null) and
          // the explicit call both fire in the same render cycle.
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
          <VehicleMapMarker
            type={currentRide.vehicleType}
            rotationDeg={vehicleRotationDeg}
          />
        </Marker>
        <Marker
          coordinate={pickupPinCoordinate}
          anchor={LOCATION_MAP_PIN_ANCHOR}
          centerOffset={LOCATION_MAP_PIN_CENTER_OFFSET}
          tracksViewChanges
        >
          <LocationMapPin variant="pickup" mapType="standard" />
        </Marker>
        <Marker
          coordinate={destinationPinCoordinate}
          anchor={LOCATION_MAP_PIN_ANCHOR}
          centerOffset={LOCATION_MAP_PIN_CENTER_OFFSET}
          tracksViewChanges
        >
          <LocationMapPin variant="destination" mapType="standard" />
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
              ETA: {routeEtaText}
            </Text>
          )}
        </View>
        <TouchableOpacity style={[styles.callBtn, { backgroundColor: colors.call }]} onPress={handleCall}>
          <Feather name="phone" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {phase === 'inprogress' && (
        <View style={[styles.turnCard, { backgroundColor: colors.card, borderColor: colors.border, top: insets.top + (Platform.OS === 'web' ? 67 : 0) + 82 }]}>
          <MaterialCommunityIcons name="navigation" size={24} color={colors.primary} style={{ transform: [{ rotate: '45deg' }] }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.turnText, { color: colors.foreground }]}>Follow current route to destination</Text>
            <Text style={[styles.turnSubtext, { color: colors.mutedForeground }]}>Navigation powered by live route data</Text>
          </View>
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
                  {routeEtaText}
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
            <Text style={[styles.customerName, { color: colors.foreground }]}>{currentRide.customerName ?? '--'}</Text>
            <Text style={[styles.fareText, { color: colors.primary }]}>
              Agreed: {currentRide.agreedFare?.toLocaleString() ?? '-'} RWF
            </Text>
          </View>
          <View style={styles.contactActions}>
            <TouchableOpacity style={[styles.contactBtn, { backgroundColor: colors.muted }]} onPress={handleMessage}>
              <Feather name="message-circle" size={18} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.contactBtn, { backgroundColor: colors.call }]} onPress={handleCall}>
              <Feather name="phone" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {phase === 'pickup' && (
          <AppButton
            title={canMarkArrived ? 'I Have Arrived' : `Arrive closer (${pickupDistanceText})`}
            onPress={async () => {
              try {
                await markArrived();
              } catch (err: any) {
                const msg =
                  err?.response?.data?.message ??
                  err?.message ??
                  'Could not mark arrival. Please try again.';
                showToast(msg, 'error');
              }
            }}
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
              <AppButton title="Start Journey" onPress={startJourney} style={{ flex: 1 }} size="lg" />
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
            <AppButton title="Complete Ride" onPress={handleCompleteRide} style={{ flex: 1 }} size="lg" />
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
