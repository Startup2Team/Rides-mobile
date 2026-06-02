import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useToast } from '@/context/ToastContext';
import { useRide } from '@/context/RideContext';
import { useDriverTracking } from '@/hooks/useDriverTracking';
import { useColors } from '@/hooks/useColors';
import { useRoute } from '@/hooks/useRoute';
import { AppButton } from '@/components/AppButton';
import {
  LOCATION_MAP_PIN_ANCHOR,
  LOCATION_MAP_PIN_CENTER_OFFSET,
  LocationMapPin,
} from '@/components/maps/LocationMapPin';
import { RoutePolyline } from '@/components/maps/RoutePolyline';
import { StatusChip } from '@/components/StatusChip';
import { formatDistance, formatDuration, haversineKm, routeLineEndpoints } from '@/utils/mapUtils';
import { showCancelArrivedRideAlert, showCancelArrivingRideAlert } from '@/utils/cancelArrivingRideAlert';
import { VehicleMapMarker } from '@/components/VehicleMapMarker';
import { FLOATING_PANEL_TOP_RADIUS } from '@/constants/surfaces';
import { Coords, KIGALI_CENTER, VehicleType, VEHICLE_LABELS_FULL } from '@/types';

/** Statuses where the driver can still complete the ride — we poll while in these. */
const POLL_STATUSES = new Set(['arriving', 'arrived', 'in_progress']);

const STATUS_MESSAGES: Record<string, string> = {
  confirmed: 'Ride confirmed',
  arriving: 'Driver is on the way',
  arrived: 'Your driver has arrived!',
  in_progress: 'Heading to destination',
  completed: 'Ride completed!',
};

const ARRIVING_AVERAGE_SPEED_MPS = 8.3;
/** Free wait at pickup before late minutes accrue (matches driver navigate screen). */
const PICKUP_WAIT_LIMIT_SECONDS = 180;
const MAP_TYPES = ['standard', 'satellite', 'hybrid'] as const;
type AppMapType = (typeof MAP_TYPES)[number];
const MAP_EDGE_PADDING = { top: 120, right: 56, bottom: 320, left: 40 };

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
  const { currentRide, driverLocation, cancelRide, refreshCurrentRide } = useRide();
  const { showToast } = useToast();
  const mapRef = useRef<MapView>(null);
  const fittedMapStateRef = useRef<string | null>(null);
  const previousRideStatusRef = useRef<string | null>(null);
  /** Last driver position while arriving — shown on the arrived map (state so markers re-render). */
  const [arrivedDriverCoords, setArrivedDriverCoords] = useState<Coords | null>(null);

  const navigatingToRatingRef = useRef(false);

  const [waitClockTick, setWaitClockTick] = useState(0);
  const [mapType, setMapType] = useState<AppMapType>('standard');
  const [driverCardHeight, setDriverCardHeight] = useState(260);
  const [arrivingRouteOrigin, setArrivingRouteOrigin] = useState(driverLocation ?? KIGALI_CENTER);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelModalReasons, setCancelModalReasons] = useState<string[]>([]);
  const [cancelModalKeepLabel, setCancelModalKeepLabel] = useState('Keep ride');

  const { route: rideRoute } = useRoute(
    currentRide ? { latitude: currentRide.pickup.latitude, longitude: currentRide.pickup.longitude } : null,
    currentRide ? { latitude: currentRide.destination.latitude, longitude: currentRide.destination.longitude } : null,
  );

  const isArriving = currentRide?.status === 'arriving';
  const isArrived = currentRide?.status === 'arrived';
  const isInProgress = currentRide?.status === 'in_progress';

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

  useEffect(() => {
    const status = currentRide?.status ?? null;
    const previousStatus = previousRideStatusRef.current;

    if (status === 'arriving' && previousStatus !== 'arriving') {
      setArrivingRouteOrigin(driverLocation ?? KIGALI_CENTER);
    }

    if (status === 'arrived' && previousStatus === 'arriving' && currentRide) {
      const lockAt = liveDriverCoords ?? driverLocation ?? currentRide.pickup;
      setArrivedDriverCoords(lockAt);
    }

    previousRideStatusRef.current = status;
  }, [currentRide, currentRide?.status, driverLocation, liveDriverCoords]);

  useEffect(() => {
    if (isArriving && activeDriverLocation) {
      setArrivedDriverCoords(activeDriverLocation);
    }
  }, [activeDriverLocation, isArriving]);

  useEffect(() => {
    if (!isInProgress) return;
    setArrivedDriverCoords(null);
  }, [isInProgress]);

  const mapDriverLocation = isArrived
    ? arrivedDriverCoords ?? currentRide?.pickup ?? null
    : activeDriverLocation;
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

  const pickupPinCoordinate = useMemo(() => {
    if (!currentRide) return null;
    const fallback = currentRide.pickup;
    if (isArriving && driverToPickupRoute && driverToPickupRoute.coordinates.length >= 2) {
      return routeLineEndpoints(driverToPickupRoute.coordinates, fallback, fallback).end;
    }
    if (rideRoute && rideRoute.coordinates.length >= 2) {
      return routeLineEndpoints(rideRoute.coordinates, fallback, currentRide.destination).start;
    }
    return fallback;
  }, [currentRide, driverToPickupRoute, isArriving, rideRoute]);

  const destinationPinCoordinate = useMemo(() => {
    if (!currentRide) return null;
    const fallback = currentRide.destination;
    if (rideRoute && rideRoute.coordinates.length >= 2) {
      return routeLineEndpoints(rideRoute.coordinates, currentRide.pickup, fallback).end;
    }
    return fallback;
  }, [currentRide, rideRoute]);

  const activeVehicleType = currentRide?.vehicleType ?? 'moto';
  const vehicleRotationDeg = useMemo(() => {
    const routeForHeading = isArrived && rideRoute && rideRoute.coordinates.length >= 2
      ? rideRoute.coordinates
      : activeRemainingRoute;
    if (!routeForHeading || routeForHeading.length < 2) return 0;
    const bearing = getBearingDegrees(routeForHeading[0], routeForHeading[1]);
    return bearing - VEHICLE_MARKER_DEFAULT_HEADING[activeVehicleType];
  }, [activeRemainingRoute, activeVehicleType, isArrived, rideRoute]);

  const driverPhotoUri = useMemo(() => {
    const driver = currentRide?.driver;
    if (!driver) return undefined;
    return driver.profileImage ?? `https://i.pravatar.cc/160?u=${encodeURIComponent(driver.id)}`;
  }, [currentRide?.driver]);

  useEffect(() => {
    if (currentRide?.status !== 'arrived') return;
    const interval = setInterval(() => {
      setWaitClockTick(tick => tick + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [currentRide?.status]);

  const waitElapsedSeconds = useMemo(() => {
    if (!isArrived || !currentRide?.waitStartedAt) return 0;
    const startedMs = new Date(currentRide.waitStartedAt).getTime();
    if (Number.isNaN(startedMs)) return 0;
    return Math.max(0, Math.floor((Date.now() - startedMs) / 1000));
  }, [currentRide?.waitStartedAt, isArrived, waitClockTick]);

  const waitRemainingSeconds = Math.max(PICKUP_WAIT_LIMIT_SECONDS - waitElapsedSeconds, 0);
  const lateSeconds = Math.max(waitElapsedSeconds - PICKUP_WAIT_LIMIT_SECONDS, 0);
  const isPickupLate = lateSeconds > 0;

  const formatCountdown = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs < 10 ? '0' : ''}${remainingSecs}`;
  };

  const formatLateDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    if (mins === 0) return `${remainingSecs} sec`;
    if (remainingSecs === 0) return `${mins} min`;
    return `${mins}:${remainingSecs < 10 ? '0' : ''}${remainingSecs}`;
  };

  const arrivedBannerMessage = isPickupLate
    ? `Your driver is still waiting. You are ${formatLateDuration(lateSeconds)} late. Please come to the pickup point.`
    : `Your driver has arrived. Please come to the pickup point. (Waiting: ${formatCountdown(waitRemainingSeconds)})`;

  useEffect(() => {
    if (!currentRide && !navigatingToRatingRef.current) router.replace('/(tabs)');
    if (currentRide?.status === 'negotiating') router.replace('/negotiation');
    // When the driver completes the ride (via WS event or polling fallback),
    // automatically send the customer to the rating screen.
    if (currentRide?.status === 'completed' && !navigatingToRatingRef.current) {
      navigateToRating();
    }
  }, [currentRide?.status]);

  // ── WS-miss safety net polling ───────────────────────────────────────────────
  // If the customer WS was disconnected when the driver completed the ride, the
  // `ride_completed` event is lost and the Redis key is deleted so reconnect
  // can't replay it either.  Poll every 30 s while the ride is in a live active
  // state so the stale UI resolves within one poll cycle at most.
  useEffect(() => {
    if (!currentRide || !POLL_STATUSES.has(currentRide.status)) return;
    const interval = setInterval(() => {
      refreshCurrentRide().catch(() => {});
    }, 30_000);
    return () => clearInterval(interval);
  }, [currentRide?.status, refreshCurrentRide]);

  const mapFitEdgePadding = useMemo(
    () => ({
      top: insets.top + (Platform.OS === 'web' ? 67 : 0) + 108,
      right: MAP_EDGE_PADDING.right,
      bottom: driverCardHeight + insets.bottom + (Platform.OS === 'web' ? 24 : 12) + 28,
      left: MAP_EDGE_PADDING.left,
    }),
    [driverCardHeight, insets.bottom, insets.top],
  );

  useEffect(() => {
    if (!mapRef.current || !currentRide) return;
    const status = currentRide.status;

    if (status === 'arriving' && activeDriverLocation) {
      if (fittedMapStateRef.current === 'arriving') return;
      mapRef.current.fitToCoordinates(
        [activeDriverLocation, currentRide.pickup],
        { edgePadding: mapFitEdgePadding, animated: true },
      );
      fittedMapStateRef.current = 'arriving';
      return;
    }

    if (status === 'arrived') {
      const routeReady = Boolean(rideRoute && rideRoute.coordinates.length > 1);
      const fitKey = routeReady ? 'arrived-route' : 'arrived-pickup-dest';
      if (fittedMapStateRef.current === fitKey) return;

      const coordinates = routeReady
        ? rideRoute!.coordinates
        : [currentRide.pickup, currentRide.destination];

      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: mapFitEdgePadding,
        animated: true,
      });
      fittedMapStateRef.current = fitKey;
      return;
    }

    if (status === 'in_progress') {
      // Keep the arrived-screen framing when customer taps Start Journey (no second zoom).
      const alreadyFramedForTrip =
        fittedMapStateRef.current === 'arrived-route' ||
        fittedMapStateRef.current === 'arrived-pickup-dest' ||
        fittedMapStateRef.current === 'in_progress';
      if (alreadyFramedForTrip) {
        fittedMapStateRef.current = 'in_progress';
        return;
      }

      const coordinates =
        rideRoute && rideRoute.coordinates.length > 1
          ? rideRoute.coordinates
          : [currentRide.pickup, currentRide.destination];
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: mapFitEdgePadding,
        animated: true,
      });
      fittedMapStateRef.current = 'in_progress';
    }
  }, [activeDriverLocation, currentRide, mapFitEdgePadding, rideRoute]);

  const navigateToRating = () => {
    if (!currentRide) return;
    const rideId = currentRide.id;
    const driverName = currentRide.driver?.name ?? '';
    const fare = currentRide.agreedFare ?? 0;
    const vehicleType = currentRide.vehicleType;
    navigatingToRatingRef.current = true;
    router.push({
      pathname: '/rating',
      params: { rideId, driverName, fare: String(fare), vehicleType },
    });
  };


  const handleCancelArrived = () => {
    showCancelArrivedRideAlert(doCancelRide);
  };

  const handleCancelArriving = () => {
    showCancelArrivingRideAlert(doCancelRide);
  };

  const doCancelRide = () => {
    cancelRide();
    showToast('Ride cancelled', 'info');
    router.replace('/(tabs)');
  };

  const handleSOS = () => {
    Alert.alert(
      '🆘 Emergency',
      `Driver: ${currentRide?.driver?.name ?? '--'}\nPlate: ${currentRide?.driver?.plateNumber ?? '--'}\n\nWhat do you need?`,
      [
        {
          text: 'Call Police (112)',
          onPress: () => Linking.openURL('tel:112'),
        },
        { text: 'Dismiss', style: 'cancel' },
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

  const showMapControls = isArriving || isArrived || isInProgress;

  const cycleMapType = useCallback(() => {
    setMapType(prev => MAP_TYPES[(MAP_TYPES.indexOf(prev) + 1) % MAP_TYPES.length]);
  }, []);

  const recenterRideMap = useCallback(() => {
    if (!mapRef.current || !currentRide) return;

    const driverCoord = isArrived
      ? arrivedDriverCoords ?? driverLocation ?? currentRide.pickup
      : liveDriverCoords ?? driverLocation;

    if (currentRide.status === 'arriving' && driverCoord) {
      mapRef.current.fitToCoordinates(
        [driverCoord, currentRide.pickup],
        { edgePadding: mapFitEdgePadding, animated: true },
      );
      return;
    }

    if (currentRide.status === 'arrived') {
      const coordinates =
        rideRoute && rideRoute.coordinates.length > 1
          ? rideRoute.coordinates
          : [currentRide.pickup, currentRide.destination];
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: mapFitEdgePadding,
        animated: true,
      });
      return;
    }

    if (currentRide.status === 'in_progress' && driverCoord) {
      mapRef.current.fitToCoordinates(
        [driverCoord, currentRide.destination],
        { edgePadding: mapFitEdgePadding, animated: true },
      );
      return;
    }

    mapRef.current.fitToCoordinates(
      [currentRide.pickup, currentRide.destination],
      { edgePadding: mapFitEdgePadding, animated: true },
    );
  }, [
    arrivedDriverCoords,
    currentRide,
    driverLocation,
    isArrived,
    liveDriverCoords,
    mapFitEdgePadding,
    rideRoute,
  ]);

  if (!currentRide) return null;

  const statusMsg = STATUS_MESSAGES[currentRide.status] ?? 'Ride confirmed';
  const pickupEtaSeconds = isArriving && activeDriverLocation
    ? Math.max(0, Math.ceil((haversineKm(activeDriverLocation, currentRide.pickup) * 1000) / ARRIVING_AVERAGE_SPEED_MPS))
    : null;
  const pickupEtaText = pickupEtaSeconds !== null
    ? formatAwayEta(pickupEtaSeconds)
    : isArriving && currentRide.driver
      ? '--'
      : null;
  const displayEta = pickupEtaText ?? (rideRoute ? formatDuration(rideRoute.durationSeconds) : '--');
  const pickupDistanceText = isArriving && activeDriverLocation
    ? formatDistance(haversineKm(activeDriverLocation, currentRide.pickup) * 1000)
    : null;

  const mapControlsBottomInset =
    driverCardHeight + insets.bottom + (Platform.OS === 'web' ? 24 : 12) + 16;
  const recenterBtnBottom = mapControlsBottomInset;
  const mapLayerBtnBottom = mapControlsBottomInset + 46 + 12;

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
        mapType={mapType}
        customMapStyle={mapType === 'standard' ? darkMapStyle : undefined}
      >
        {mapDriverLocation && (
          <Marker coordinate={mapDriverLocation} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <VehicleMapMarker
              type={currentRide.vehicleType}
              rotationDeg={vehicleRotationDeg}
            />
          </Marker>
        )}
        {!isInProgress && pickupPinCoordinate && (
          <Marker
            coordinate={pickupPinCoordinate}
            anchor={LOCATION_MAP_PIN_ANCHOR}
            centerOffset={LOCATION_MAP_PIN_CENTER_OFFSET}
            tracksViewChanges
          >
            <LocationMapPin variant="pickup" mapType={mapType} />
          </Marker>
        )}
        {(isArrived || isInProgress) && destinationPinCoordinate && (
          <Marker
            coordinate={destinationPinCoordinate}
            anchor={LOCATION_MAP_PIN_ANCHOR}
            centerOffset={LOCATION_MAP_PIN_CENTER_OFFSET}
            tracksViewChanges
          >
            <LocationMapPin variant="destination" mapType={mapType} />
          </Marker>
        )}
        {isArriving && remainingDriverToPickupRoute ? (
          <RoutePolyline coordinates={remainingDriverToPickupRoute} color={colors.destructiveHex} width={4} />
        ) : null}
        {isInProgress && remainingPickupToDestinationRoute ? (
          <RoutePolyline coordinates={remainingPickupToDestinationRoute} color={colors.destructiveHex} width={4} />
        ) : null}
        {isArrived && rideRoute ? (
          <RoutePolyline coordinates={rideRoute.coordinates} color={colors.destructiveHex} width={4} />
        ) : null}
      </MapView>

      {showMapControls && (
        <>
          <TouchableOpacity
            style={[
              styles.mapLayerBtn,
              { backgroundColor: colors.card, bottom: mapLayerBtnBottom },
            ]}
            onPress={cycleMapType}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Change map view"
          >
            <MaterialCommunityIcons
              name={
                mapType === 'standard'
                  ? 'layers-outline'
                  : mapType === 'satellite'
                    ? 'satellite-variant'
                    : 'map'
              }
              size={22}
              color={colors.primary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.recenterBtn,
              { backgroundColor: colors.card, bottom: recenterBtnBottom },
            ]}
            onPress={recenterRideMap}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Recenter map on route"
          >
            <MaterialCommunityIcons name="crosshairs-gps" size={22} color={colors.primary} />
          </TouchableOpacity>
        </>
      )}

      {/* Top status */}
      <View
        style={[
          styles.topStatus,
          (isArriving || isArrived || isInProgress) && styles.topStatusShadow,
          {
            paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) + 12,
            backgroundColor: colors.background,
          },
        ]}
      >
        <View style={styles.topStatusBar}>
          <View style={styles.topStatusSlot}>
            <StatusChip status={currentRide.status} variant="rideHeader" />
          </View>
          <View style={[styles.topStatusSlot, styles.topStatusSlotEnd]}>
            {currentRide.driver && (
              <Text style={[styles.eta, { color: colors.primary }]} numberOfLines={1}>
                {pickupEtaText ?? (rideRoute ? formatDuration(rideRoute.durationSeconds) : `${currentRide.driver.eta} min`)}
              </Text>
            )}
          </View>
          <View style={styles.topStatusTitleOverlay} pointerEvents="none">
            <Text
              style={[styles.statusMsg, { color: colors.foreground }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {statusMsg}
            </Text>
          </View>
        </View>
        {currentRide.driver && (
          <Text style={[styles.eta, { color: colors.primary }]} numberOfLines={1}>
            {pickupEtaText ?? (rideRoute ? formatDuration(rideRoute.durationSeconds) : '--')}
          </Text>
        )}
      </View>

      {isInProgress && (
        <View style={[styles.tbtCard, { backgroundColor: colors.card, top: insets.top + (Platform.OS === 'web' ? 67 : 0) + 70 }]}>
          <MaterialCommunityIcons name="navigation" size={24} color={colors.primary} style={{ transform: [{ rotate: '45deg' }] }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.tbtText, { color: colors.foreground }]}>
              Follow the current route
            </Text>
            <Text style={[styles.tbtSubtext, { color: colors.mutedForeground }]}>
              Live navigation update
            </Text>
          </View>
        </View>
      )}


      {isArrived && (
        <View
          style={[
            styles.arrivedBanner,
            { backgroundColor: isPickupLate ? colors.destructive : colors.primary },
          ]}
        >
          <Feather
            name={isPickupLate ? 'alert-circle' : 'check-circle'}
            size={18}
            color={isPickupLate ? colors.destructiveForeground : colors.primaryForeground}
          />
          <Text
            style={[
              styles.arrivedBannerText,
              { color: isPickupLate ? colors.destructiveForeground : colors.primaryForeground },
            ]}
          >
            {arrivedBannerMessage}
          </Text>
        </View>
      )}
      <View
        onLayout={event => {
          const height = event.nativeEvent.layout.height;
          if (height > 0) setDriverCardHeight(height);
        }}
        style={[styles.driverCard, {
          backgroundColor: colors.background,
          paddingBottom: insets.bottom + (Platform.OS === 'web' ? 24 : 12),
        }]}
      >
        {/* Driver info */}
        <View style={styles.driverRow}>
          {driverPhotoUri ? (
            <Image
              source={{ uri: driverPhotoUri }}
              style={styles.driverAvatarImage}
              accessibilityLabel={`${currentRide.driver?.name ?? 'Driver'} profile photo`}
            />
          ) : (
            <View style={[styles.driverAvatar, { backgroundColor: colors.primary }]}>
              <Text style={[styles.driverInitial, { color: colors.primaryForeground }]}>
                {currentRide.driver?.name?.[0] ?? 'D'}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[styles.driverName, { color: colors.foreground }]}>
              {currentRide.driver?.name ?? '--'}
            </Text>
            <Text style={[styles.driverVehicle, { color: colors.mutedForeground }]}>
              {VEHICLE_LABELS_FULL[currentRide.vehicleType]} · {currentRide.driver?.plateNumber}
            </Text>
          </View>
          <View style={styles.ratingBadge}>
            <Text style={[styles.ratingText, { color: colors.star }]}>★ {currentRide.driver?.rating?.toFixed(1)}</Text>
          </View>
        </View>

        {/* Fare */}
        <View style={[styles.fareRow, { backgroundColor: colors.muted }]}>
          <View style={styles.fareItem}>
            <Text style={[styles.fareLabel, { color: colors.mutedForeground }]}>Agreed Fare</Text>
            <Text style={[styles.fareValue, { color: colors.primary }]}>
              {currentRide.agreedFare ? `${currentRide.agreedFare.toLocaleString()} RWF` : '--'}
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
            <AppButton
              title={isArriving ? 'Call driver' : 'Call'}
              icon="phone"
              variant="call"
              size="sm"
              onPress={handleCallDriver}
              iconOnly={!isArriving}
              style={isArriving ? styles.wideActionBtn : undefined}
            />
          )}
          {isArriving && (
            <AppButton
              title="Cancel"
              icon="x"
              variant="dangerPlain"
              size="sm"
              iconOnly
              onPress={handleCancelArriving}
              accessibilityLabel="Cancel ride"
            />
          )}
          {isArrived && (
            // The driver starts the journey from their own screen.
            // Calling startJourney here would hit a driver-only endpoint with
            // the customer JWT and return 403. Show only the cancel option.
            <AppButton
              title="Cancel Ride"
              icon="x"
              variant="dangerPlain"
              size="sm"
              labelFontSize={14}
              onPress={handleCancelArrived}
              style={{ flex: 1 }}
            />
          )}
          {isInProgress && (
            // While in-progress, only the driver can end the ride.
            // Show an SOS button for genuine emergencies (calls 112).
            // The customer will be auto-navigated to rating when the driver
            // completes the ride via the WS ride_completed event.
            <TouchableOpacity
              style={[styles.sosBtn, { backgroundColor: colors.destructive, flex: 1, borderRadius: 14, height: 48 }]}
              onPress={handleSOS}
              accessibilityLabel="Emergency SOS — calls police 112"
              accessibilityRole="button"
            >
              <Text style={styles.sosBtnText}>🆘 SOS — Emergency</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Cancellation reason modal */}
      <Modal
        visible={cancelModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelModalVisible(false)}
      >
        <View style={styles.cancelOverlay}>
          <View style={[styles.cancelCard, { backgroundColor: colors.background }]}>
            <Text style={[styles.cancelTitle, { color: colors.foreground }]}>Why are you cancelling?</Text>

            <AppButton
              title={cancelModalKeepLabel}
              variant="primary"
              fullWidth
              onPress={() => setCancelModalVisible(false)}
            />

            {cancelModalReasons.map(reason => (
              <AppButton
                key={reason}
                title={reason}
                variant="secondary"
                fullWidth
                onPress={() => { setCancelModalVisible(false); doCancelRide(); }}
              />
            ))}
          </View>
        </View>
      </Modal>

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
  mapLayerBtn: {
    position: 'absolute',
    right: 16,
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  recenterBtn: {
    position: 'absolute',
    right: 16,
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  topStatus: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 14,
    zIndex: 10,
  },
  topStatusShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 8,
  },
  topStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 32,
    position: 'relative',
  },
  topStatusSlot: {
    flex: 1,
    minWidth: 0,
    zIndex: 1,
    justifyContent: 'center',
  },
  topStatusSlotEnd: {
    alignItems: 'flex-end',
  },
  topStatusTitleOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 76,
    zIndex: 0,
  },
  statusMsg: {
    maxWidth: '100%',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
    lineHeight: 17,
  },
  eta: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    textAlign: 'right',
  },
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
  driverCard: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: FLOATING_PANEL_TOP_RADIUS,
    borderTopRightRadius: FLOATING_PANEL_TOP_RADIUS,
    paddingTop: 14,
    paddingHorizontal: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 16,
  },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  driverAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  driverAvatarImage: { width: 40, height: 40, borderRadius: 20 },
  driverInitial: { fontSize: 19, fontFamily: 'Inter_700Bold' },
  driverName: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  driverVehicle: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  ratingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },
  ratingText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  fareRow: {
    flexDirection: 'row',
    borderRadius: 14,
    overflow: 'hidden',
  },
  fareItem: { flex: 1, alignItems: 'center', paddingVertical: 8, gap: 2 },
  fareDivider: { width: 1 },
  fareLabel: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  fareValue: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  actions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  wideActionBtn: { flex: 1 },
  tbtCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    padding: 14,
  },
  tbtText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', lineHeight: 20 },
  tbtSubtext: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  cancelOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: 20,
    paddingBottom: 40,
  },
  cancelCard: {
    width: '100%',
    borderRadius: 20,
    padding: 16,
    gap: 10,
  },
  cancelTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', textAlign: 'center', marginBottom: 4 },
  sosBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  sosBtnText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#FFFFFF', letterSpacing: 0.5 },
});
