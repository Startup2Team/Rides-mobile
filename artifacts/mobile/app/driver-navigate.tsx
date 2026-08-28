import { typography } from '@/constants/typography';
import { AppText } from '@/components/AppText';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import { AppMap, AppMarker, type AppMapHandle, type AppMapType } from '@/components/map';
import { ProfileAvatarCircle } from '@/components/ProfileAvatarCircle';
import { CustomerLocationMarker } from '@/components/maps/CustomerLocationMarker';
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
import { useDeviceLocation } from '@/hooks/useDeviceLocation';
import { useScreenTimerManager } from '@/hooks/useScreenTimerManager';
import { getEntitlementVehicleForProfile } from '@/domain/driverRidePackages';
import { formatDistance, formatDuration, routePolylineThroughPinTips } from '@/utils/mapUtils';
import { VehicleMapMarker } from '@/components/VehicleMapMarker';
import { FLOATING_PANEL_TOP_RADIUS } from '@/constants/surfaces';
import { KIGALI_CENTER, VehicleType } from '@/types';
import { getArrivalVerification } from '@/domain/driverNavigateArrival';
import { elevation } from '@/constants/elevation';
import { icons } from '@/constants/icons';
import { radius } from '@/constants/radius';
import { sizes } from '@/constants/sizes';
import { spacing, semanticSpacing } from '@/constants/spacing';
import { zIndex } from '@/constants/zIndex';
import { navigateToDriverHomeAfterCompletion } from '@/navigation/navigationPolicy';

const WAIT_LIMIT_SECONDS = 180;
const MAP_EDGE_PADDING = { top: 120, right: 56, bottom: 320, left: 40 };
// Beyond this, the customer marker is shown dimmed — the fix is old enough
// that its position may no longer be trustworthy (app backgrounded, GPS lost).
const CUSTOMER_LOCATION_STALE_MS = 30_000;
const WAITING_CANCEL_REASONS = [
  'Passenger did not show up',
  'Wrong pickup location',
  'Could not reach passenger',
  'Safety concern',
  'Other reason',
];
const IN_PROGRESS_CANCEL_REASONS = [
  'Safety concern',
  'Passenger misconduct',
  'Harassment or abuse',
  'Vehicle issue',
  'Medical or emergency',
  'Other reason',
];

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

function formatArrivalTime(value?: string) {
  if (!value) return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just now';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatLiveRemainingEta(seconds: number) {
  const safeSeconds = Math.max(60, Math.round(seconds));
  return formatDuration(safeSeconds);
}

export default function DriverNavigateScreen() {
  const colors = useColors();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const { currentRide, driverLocation, customerLocation, markArrived, startJourney, cancelRide } = useRide();
  const { driverProfile, user } = useAuth();

  const [waitClockTick, setWaitClockTick] = useState(0);
  const [bottomCardHeight, setBottomCardHeight] = useState(260);
  const [mapType, setMapType] = useState<AppMapType>('standard');
  const [completionInProgress, setCompletionInProgress] = useState(false);

  const mapRef = useRef<AppMapHandle>(null);
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
    { vehicleType: currentRide?.vehicleType ?? null },
  );

  const { route: rideRoute } = useRoute(
    phase === 'waiting' && currentRide ? currentRide.pickup : null,
    phase === 'waiting' && currentRide ? currentRide.destination : null,
    { vehicleType: currentRide?.vehicleType ?? null },
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

  // Driver's own marker = their REAL device GPS (not a simulated walk along the
  // route). Falls back to the last context location, then Kigali centre.
  const liveDriverPos = useDeviceLocation(phase === 'pickup' || phase === 'inprogress');
  const driverPos = liveDriverPos ?? driverLocation ?? KIGALI_CENTER;

  // Customer's live marker: track when each fix actually arrived (Coords has
  // no timestamp of its own) so a stalled feed can be shown dimmed instead of
  // silently pinning the customer at a position that may no longer be real.
  const customerLocationUpdatedAtRef = useRef<number | null>(null);
  const customerStaleTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [, forceCustomerStaleTick] = useState(0);
  useEffect(() => {
    if (customerLocation) customerLocationUpdatedAtRef.current = Date.now();
  }, [customerLocation]);
  useEffect(() => {
    timers.clearInterval(customerStaleTickRef.current);
    customerStaleTickRef.current = null;
    if (!customerLocation) return;
    // Re-render periodically purely to re-evaluate staleness against the
    // clock — the coordinate itself may not change tick to tick.
    customerStaleTickRef.current = timers.scheduleInterval(() => forceCustomerStaleTick(t => t + 1), 5000);
    return () => { timers.clearInterval(customerStaleTickRef.current); customerStaleTickRef.current = null; };
  }, [customerLocation, timers]);
  const isCustomerLocationStale =
    customerLocation != null &&
    customerLocationUpdatedAtRef.current != null &&
    Date.now() - customerLocationUpdatedAtRef.current > CUSTOMER_LOCATION_STALE_MS;

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
  const etaText = useMemo(() => {
    if (phase === 'pickup' || phase === 'inprogress') {
      if (distanceToTargetKm <= 0.01) return '1 min';
      if (route && !routeLoading && route.distanceMeters > 0) {
        const secondsPerKm = route.durationSeconds / (route.distanceMeters / 1000);
        return formatLiveRemainingEta(distanceToTargetKm * secondsPerKm);
      }
    }
    if (route && !routeLoading) return formatDuration(route.durationSeconds);
    return `${Math.max(1, Math.round(distanceToTargetKm * 3 + 1))} min`;
  }, [distanceToTargetKm, phase, route, routeLoading]);
  const arrivalVerification = currentRide
    ? getArrivalVerification(driverPos, currentRide.pickup)
    : null;
  const canMarkArrived = arrivalVerification?.canMarkArrived ?? false;
  const distanceText = phase === 'pickup' && arrivalVerification
    ? arrivalVerification.distanceText
    : phase === 'inprogress'
      ? formatDistance(distanceToTargetKm * 1000)
      : route
      ? formatDistance(route.distanceMeters)
      : formatDistance(distanceToTargetKm * 1000);
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

  const handleSOS = useCallback(() => {
    Alert.alert(
      'Emergency SOS',
      `Passenger: ${currentRide?.customerName ?? 'Unknown'}\nPickup: ${currentRide?.pickup.address ?? 'Pickup unavailable'}\nDestination: ${currentRide?.destination.address ?? 'Destination unavailable'}`,
      [
        { text: 'Dismiss', style: 'cancel' },
        {
          text: 'Cancel Trip',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
                'Why are you cancelling?',
                'Choose a reason so the trip can be logged correctly.',
                [
                  { text: 'Keep Riding', style: 'cancel' },
                ...IN_PROGRESS_CANCEL_REASONS.map(reason => ({
                  text: reason,
                  style: reason === 'Safety concern' ? 'destructive' as const : 'default' as const,
                  onPress: async () => {
                    // cancelRide already surfaces its own Alert and leaves the
                    // trip untouched on a backend rejection — only leave once
                    // it actually confirmed.
                    if (!(await cancelRide())) return;
                    showToast(`Ride cancelled: ${reason}`, 'info');
                    navigateToDriverHomeAfterCompletion(router);
                  },
                })),
              ],
            );
          },
        },
        { text: 'Call Police (112)', onPress: () => Linking.openURL('tel:112') },
      ],
    );
  }, [cancelRide, currentRide?.customerName, currentRide?.destination.address, currentRide?.pickup.address, showToast]);

  const handleMarkArrived = useCallback(() => {
    if (!canMarkArrived) {
      showToast('Move closer to the pickup location to mark arrival.', 'info');
      return;
    }
    fittedMapPhaseRef.current = null;
    markArrived();
  }, [canMarkArrived, markArrived, showToast]);

  const handleCancelAfterWait = useCallback(() => {
    Alert.alert(
      'Why are you cancelling?',
      `Customer is ${formatWaitTime(pickupWait.lateSeconds)} late. Select a reason or keep waiting.`,
      [
        { text: 'Keep Waiting', style: 'cancel' },
        ...WAITING_CANCEL_REASONS.map(reason => ({
          text: reason,
          style: reason === 'Safety concern' ? 'destructive' as const : 'default' as const,
          onPress: async () => {
            // cancelRide already surfaces its own Alert and leaves the ride
            // untouched on a backend rejection — only leave once it actually
            // confirmed.
            if (!(await cancelRide())) return;
            showToast(`Ride cancelled: ${reason}`, 'info');
            navigateToDriverHomeAfterCompletion(router);
          },
        })),
      ],
    );
  }, [cancelRide, pickupWait.lateSeconds, showToast]);

  const handleCompleteRide = () => {
    Alert.alert('Complete Ride', 'Mark this ride as completed?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Complete',
        onPress: () => {
          const fare = currentRide?.agreedFare ?? 0;
          const selectedVehicle = getEntitlementVehicleForProfile(driverProfile);
          const identity = {
            driverId: user?.id,
            driverName: user?.name,
            vehicleId: selectedVehicle?.id,
            vehicleType: selectedVehicle?.vehicleType ?? driverProfile?.vehicleType,
          };
          const fareForRecord = fare;
          const userId = user?.id;
          setCompletionInProgress(true);
          router.push({
            pathname: '/driver-ride-complete',
            params: {
              fare: String(fare),
              driverId: identity.driverId ?? '',
              driverName: identity.driverName ?? '',
              vehicleId: identity.vehicleId ?? '',
              vehicleType: identity.vehicleType ?? '',
              recordFare: userId ? String(fareForRecord) : '',
            },
          });
        },
      },
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
      <AppMap
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={{ ...driverPos, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
        mapType={mapType}
      >
        <AppMarker coordinate={driverPos} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges>
          <VehicleMapMarker type={currentRide.vehicleType} rotationDeg={vehicleRotationDeg} />
        </AppMarker>
        {phase !== 'inprogress' && (
          <AppMarker coordinate={pickupPinCoordinate} anchor={LOCATION_MAP_PIN_ANCHOR} centerOffset={getLocationMapPinCenterOffset()} tracksViewChanges={false}>
            <LocationMapPin variant="pickup" mapType={mapType} />
          </AppMarker>
        )}
        {phase !== 'pickup' && (
          <AppMarker coordinate={destinationPinCoordinate} anchor={LOCATION_MAP_PIN_ANCHOR} centerOffset={getLocationMapPinCenterOffset()} tracksViewChanges={false}>
            <LocationMapPin variant="destination" mapType={mapType} />
          </AppMarker>
        )}
        {/* Customer's LIVE position (customer_location WS events) — separate from
            the static pickup pin above, which just marks where the trip starts.
            Rendered through the whole trip (product decision: whole-trip
            tracking) to match how long the customer side actually publishes
            (CUSTOMER_LOCATION_ACTIVE_STATUSES includes in_progress) — showing
            it stops in_progress while publishing kept going would just be a
            marker that silently freezes instead of disappearing. */}
        {customerLocation && (
          <AppMarker
            coordinate={customerLocation}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            zIndex={2}
            title="Customer"
            description={isCustomerLocationStale ? 'Location may be out of date' : 'Live location'}
            accessibilityLabel={isCustomerLocationStale ? 'Customer location, may be out of date' : 'Customer, live location'}
          >
            <CustomerLocationMarker
              initial={customerInitial}
              imageUri={currentRide.customerImage ?? null}
              stale={isCustomerLocationStale}
            />
          </AppMarker>
        )}
        {phase !== 'waiting' && remainingRoute && (
          <RoutePolyline coordinates={remainingRoute} color={colors.destructiveHex} width={4} />
        )}
        {phase === 'waiting' && fullRideRouteThroughPins && (
          <RoutePolyline coordinates={fullRideRouteThroughPins} color={colors.destructiveHex} width={4} />
        )}
      </AppMap>

      {/* Map controls */}
      <TouchableOpacity
        style={[styles.mapBtn, { backgroundColor: colors.background, bottom: mapControlsBottom + 58 }]}
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
        style={[styles.mapBtn, { backgroundColor: colors.background, bottom: mapControlsBottom }]}
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
        paddingTop: insets.top + (Platform.OS === 'web' ? 67 : spacing[0]) + semanticSpacing.rowGap,
      }]}>
        <View style={styles.topBarInner}>
          <View style={styles.topLeft} />
          <View style={styles.topCenter}>
            <AppText style={[styles.topStatus, { color: colors.foreground }]} numberOfLines={1}>
              {statusMessage}
            </AppText>
          </View>
          <View style={styles.topRight} />
        </View>
      </View>

      {/* Bottom card */}
      <View
        style={[styles.bottomCard, {
          backgroundColor: colors.background,
          paddingBottom: insets.bottom + (Platform.OS === 'web' ? semanticSpacing.sectionGap : semanticSpacing.rowGap),
        }]}
        onLayout={e => { const h = e.nativeEvent.layout.height; if (h > 0) setBottomCardHeight(h); }}
      >
        {/* Customer info row */}
        <View style={styles.customerRow}>
          <ProfileAvatarCircle
            size={sizes.avatar.md + spacing[2]}
            initial={customerInitial}
            imageUri={currentRide.customerImage ?? null}
          />
          <View style={styles.customerInfo}>
            <AppText style={[styles.customerName, { color: colors.foreground }]}>
              {currentRide.customerName ?? 'Customer'}
            </AppText>
            {currentRide.customerRating != null && (
              <View style={styles.ratingRow}>
                <MaterialCommunityIcons name="star" size={icons.size.xxs} color={colors.star} />
                <AppText style={[styles.ratingText, { color: colors.star }]}>
                  {currentRide.customerRating.toFixed(1)}
                </AppText>
              </View>
            )}
          </View>
          {phase === 'inprogress' ? (
            <TouchableOpacity
              style={[styles.sosAction, { backgroundColor: colors.destructive }]}
              onPress={handleSOS}
              accessibilityRole="button"
              accessibilityLabel="Emergency SOS"
            >
              <AppText style={styles.sosActionText}>SOS</AppText>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.callAction, { backgroundColor: colors.call }]}
              onPress={handleCall}
              accessibilityRole="button"
              accessibilityLabel="Call customer"
            >
              <Feather name="phone" size={icons.semantic.row} color="#FFFFFF" />
              <AppText style={styles.callActionText}>Call</AppText>
            </TouchableOpacity>
          )}
        </View>

        {phase === 'pickup' && (
          <View style={styles.phaseContent}>
            <View style={[styles.locationCard, { backgroundColor: colors.muted }]}>
              <View style={styles.locRow}>
                <View style={[styles.locDot, { backgroundColor: colors.primary }]} />
                <View style={styles.locTextBlock}>
                  <AppText style={[styles.locInlineLabel, { color: colors.mutedForeground }]}>Pickup</AppText>
                  <AppText style={[styles.locValue, { color: colors.foreground }]} numberOfLines={1}>
                    {currentRide.pickup.address || 'Pickup unavailable'}
                  </AppText>
                </View>
              </View>
              <View style={[styles.locDivider, { backgroundColor: colors.border }]} />
              <View style={styles.locRow}>
                <View style={[styles.locDot, styles.locDotSquare, { backgroundColor: colors.destructive }]} />
                <View style={styles.locTextBlock}>
                  <AppText style={[styles.locInlineLabel, { color: colors.mutedForeground }]}>Destination</AppText>
                  <AppText style={[styles.locValue, { color: colors.foreground }]} numberOfLines={1}>
                    {currentRide.destination.address || 'Destination unavailable'}
                  </AppText>
                </View>
              </View>
            </View>
            <View style={styles.metricGrid}>
              <View style={[styles.metricBox, { backgroundColor: colors.muted }]}>
                <AppText style={[styles.metricLabel, { color: colors.mutedForeground }]}>Distance to Pickup</AppText>
                <AppText style={[styles.metricValue, { color: colors.foreground }]}>{distanceText}</AppText>
              </View>
              <View style={[styles.metricBox, { backgroundColor: colors.muted }]}>
                <AppText style={[styles.metricLabel, { color: colors.mutedForeground }]}>ETA to Pickup</AppText>
                <AppText style={[styles.metricValue, { color: colors.foreground }]}>{etaText}</AppText>
              </View>
            </View>
          </View>
        )}


        {phase === 'waiting' && (
          <View style={styles.phaseContent}>
            <View style={[styles.waitingPanel, { backgroundColor: colors.primaryHex + '12', borderColor: colors.primaryHex + '30' }]}>
              <Feather name="user-check" size={icons.size.lg} color={colors.primary} />
              <View style={styles.waitingCopy}>
                <AppText style={[styles.waitingTitle, { color: colors.foreground }]}>Customer waiting for pickup</AppText>
                <AppText style={[styles.waitingMeta, { color: colors.mutedForeground }]}>
                  Arrived at {formatArrivalTime(currentRide.arrivedAt)}
                </AppText>
              </View>
            </View>
            <View style={[styles.locationCard, { backgroundColor: colors.muted }]}>
              <View style={styles.locRow}>
                <View style={[styles.locDot, { backgroundColor: colors.primary }]} />
                <View style={styles.locTextBlock}>
                  <AppText style={[styles.locInlineLabel, { color: colors.mutedForeground }]}>Pickup</AppText>
                  <AppText style={[styles.locValue, { color: colors.foreground }]} numberOfLines={1}>
                    {currentRide.pickup.address || 'Pickup unavailable'}
                  </AppText>
                </View>
              </View>
              <View style={[styles.locDivider, { backgroundColor: colors.border }]} />
              <View style={styles.locRow}>
                <View style={[styles.locDot, styles.locDotSquare, { backgroundColor: colors.destructive }]} />
                <View style={styles.locTextBlock}>
                  <AppText style={[styles.locInlineLabel, { color: colors.mutedForeground }]}>Destination</AppText>
                  <AppText style={[styles.locValue, { color: colors.foreground }]} numberOfLines={1}>
                    {currentRide.destination.address || 'Destination unavailable'}
                  </AppText>
                </View>
              </View>
            </View>
            <View style={[styles.timerBox, {
              backgroundColor: pickupWait.isLate ? colors.destructiveHex + '15' : colors.muted,
              borderColor: pickupWait.isLate ? colors.destructive : colors.border,
            }]}>
              <Feather
                name={pickupWait.isLate ? 'alert-circle' : 'clock'}
                size={icons.semantic.row}
                color={pickupWait.isLate ? colors.destructive : colors.primary}
              />
              <AppText style={[styles.timerLabel, { color: pickupWait.isLate ? colors.destructive : colors.mutedForeground }]}>
                {pickupWait.isLate ? `Customer ${formatWaitTime(pickupWait.lateSeconds)} late` : 'Pickup wait time remaining'}
              </AppText>
              <AppText style={[styles.timerValue, { color: pickupWait.isLate ? colors.destructive : colors.primary }]}>
                {pickupWait.isLate ? '' : formatWaitTime(pickupWait.remainingSeconds)}
              </AppText>
            </View>
          </View>
        )}

        {phase === 'inprogress' && (
          <View style={styles.phaseContent}>
            <View style={[styles.locationCard, { backgroundColor: colors.muted }]}>
              <View style={styles.locRow}>
                <View style={[styles.locDot, { backgroundColor: colors.primary }]} />
                <View style={styles.locTextBlock}>
                  <AppText style={[styles.locInlineLabel, { color: colors.mutedForeground }]}>Pickup</AppText>
                  <AppText style={[styles.locValue, { color: colors.foreground }]} numberOfLines={1}>
                    {currentRide.pickup.address || 'Pickup unavailable'}
                  </AppText>
                </View>
              </View>
              <View style={[styles.locDivider, { backgroundColor: colors.border }]} />
              <View style={styles.locRow}>
                <View style={[styles.locDot, styles.locDotSquare, { backgroundColor: colors.destructive }]} />
                <View style={styles.locTextBlock}>
                  <AppText style={[styles.locInlineLabel, { color: colors.mutedForeground }]}>Destination</AppText>
                  <AppText style={[styles.locValue, { color: colors.foreground }]} numberOfLines={1}>
                    {currentRide.destination.address || 'Destination unavailable'}
                  </AppText>
                </View>
              </View>
            </View>
            <View style={styles.metricGrid}>
              <View style={[styles.metricBox, { backgroundColor: colors.muted }]}>
                <AppText style={[styles.metricLabel, { color: colors.mutedForeground }]}>Distance Remaining</AppText>
                <AppText style={[styles.metricValue, { color: colors.foreground }]}>{distanceText}</AppText>
              </View>
              <View style={[styles.metricBox, { backgroundColor: colors.muted }]}>
                <AppText style={[styles.metricLabel, { color: colors.mutedForeground }]}>ETA Remaining</AppText>
                <AppText style={[styles.metricValue, { color: colors.foreground }]}>{etaText}</AppText>
              </View>
            </View>
          </View>
        )}

        <View style={styles.actions}>
          {phase === 'pickup' && (
            <AppButton
              title="I've Arrived"
              onPress={handleMarkArrived}
              disabled={!canMarkArrived}
              fullWidth
              size="lg"
            />
          )}
          {phase === 'waiting' && (
            <>
              {pickupWait.isLate && (
                <AppButton
                  title="Cancel Ride"
                  variant="dangerPlain"
                  size="lg"
                  onPress={handleCancelAfterWait}
                  style={styles.actionButton}
                />
              )}
              <AppButton
                title="Start Journey"
                size="lg"
                onPress={startJourney}
                style={pickupWait.isLate ? styles.actionButton : styles.actionFullWidth}
                fullWidth={!pickupWait.isLate}
              />
            </>
          )}
          {phase === 'inprogress' && (
            <AppButton title="Complete Ride" onPress={handleCompleteRide} fullWidth size="lg" disabled={completionInProgress} />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mapBtn: {
    position: 'absolute', right: semanticSpacing.cardPadding, width: sizes.mapControl.md, height: sizes.mapControl.md, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center', zIndex: zIndex.sticky,
    ...elevation.mapControl,
  },

  topBar: {
    position: 'absolute', top: spacing[0], left: spacing[0], right: spacing[0], zIndex: zIndex.header,
    paddingHorizontal: semanticSpacing.cardPadding, paddingBottom: spacing[14],
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14, shadowRadius: 8, elevation: 8,
  },
  topBarInner: { flexDirection: 'row', alignItems: 'center', minHeight: 32 },
  topLeft: { flex: 1, minWidth: spacing[0], zIndex: zIndex.raised },
  topCenter: { flex: 2, alignItems: 'center', zIndex: zIndex.raised },
  topRight: { flex: 1, alignItems: 'flex-end', zIndex: zIndex.raised },
  topStatus: { ...typography.label, textAlign: 'center' },

  bottomCard: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: FLOATING_PANEL_TOP_RADIUS,
    borderTopRightRadius: FLOATING_PANEL_TOP_RADIUS,
    paddingTop: spacing[14], paddingHorizontal: semanticSpacing.cardPadding, gap: spacing[10],
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2, shadowRadius: 16, elevation: 16,
  },

  customerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[10] },
  customerInfo: { flex: 1 },
  customerName: { ...typography.body,  },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: spacing[2] },
  ratingText: { ...typography.caption,  },
  callAction: {
    height: 42,
    borderRadius: 21,
    paddingHorizontal: spacing[14],
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing[6],
  },
  callActionText: {
    color: '#FFFFFF',
    ...typography.label,
  },
  sosAction: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosActionText: {
    color: '#FFFFFF',
    ...typography.label,
    letterSpacing: 0.5,
  },

  phaseContent: { gap: spacing[10] },
  locationCard: {
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  locRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[10],
    paddingHorizontal: semanticSpacing.rowGap,
    paddingVertical: 9,
  },
  locDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  locDotSquare: { borderRadius: 3 },
  locTextBlock: { flex: 1, minWidth: 0 },
  locInlineLabel: {
    ...typography.tiny,
    textTransform: 'uppercase',
    letterSpacing: 0.35,
    marginBottom: 2,
  },
  locValue: { ...typography.bodySmall, lineHeight: 19 },
  locDivider: { height: StyleSheet.hairlineWidth, marginLeft: 32 },
  metricGrid: { flexDirection: 'row', gap: semanticSpacing.inlineGap },
  metricBox: { flex: 1, borderRadius: radius.input, paddingHorizontal: spacing[10], paddingVertical: 9, gap: 3 },
  metricLabel: { ...typography.tiny,  },
  metricValue: { ...typography.body,  },
  waitingPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[10],
    borderRadius: radius.card,
    borderWidth: 1,
    padding: semanticSpacing.rowGap,
  },
  waitingCopy: { flex: 1, minWidth: 0 },
  waitingTitle: { ...typography.body,  },
  waitingMeta: { ...typography.caption, marginTop: 2 },

  timerBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[10],
    padding: semanticSpacing.rowGap, borderRadius: radius.card, borderWidth: 1,
  },
  timerLabel: { flex: 1, ...typography.label,  },
  timerValue: { ...typography.h3,  },

  actions: { flexDirection: 'row', gap: semanticSpacing.inlineGap, alignItems: 'center' },
  actionButton: { flex: 1 },
  actionFullWidth: { flex: 1 },
});
