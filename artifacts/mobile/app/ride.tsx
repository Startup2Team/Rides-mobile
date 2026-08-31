import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppMap, AppMarker, MAP_TYPES, type AppMapHandle, type AppMapType } from '@/components/map';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useToast } from '@/context/ToastContext';
import { useRide } from '@/context/RideContext';
import { useColors } from '@/hooks/useColors';
import { useRoute } from '@/hooks/useRoute';
import { useRideActions } from '@/hooks/ride/useRideActions';
import { useRideStatus } from '@/hooks/ride/useRideStatus';
import { DriverInfoCard } from '@/components/ride/DriverInfoCard';
import { ActiveRideProjectionSummary } from '@/components/ride/ActiveRideProjectionSummary';
import { RideActionsSection } from '@/components/ride/RideActionsSection';
import { RideHeader } from '@/components/ride/RideHeader';
import { RideStatusSection } from '@/components/ride/RideStatusSection';
import {
  getLocationMapPinCenterOffset,
  LOCATION_MAP_PIN_ANCHOR,
  LocationMapPin,
} from '@/components/maps/LocationMapPin';
import { RoutePolyline } from '@/components/maps/RoutePolyline';
import { resolveDriverProfileImage } from '@/utils/driverProfileImage';
import { formatDistance, formatDuration, routePolylineThroughPinTips } from '@/utils/mapUtils';
import { VehicleMapMarker } from '@/components/VehicleMapMarker';
import { FLOATING_PANEL_TOP_RADIUS } from '@/constants/surfaces';
import { Coords, KIGALI_CENTER, VehicleType } from '@/types';
import { useActiveRideReadModel } from '@/domains/ride/dualRead/rideDualReadAdapter';

const MAP_EDGE_PADDING = { top: 120, right: 56, bottom: 320, left: 40 };

const VEHICLE_MARKER_DEFAULT_HEADING: Record<VehicleType, number> = {
  moto: 270,
  rifani: 270,
  cab: 315,
  hilux: 90,
  fuso: 90,
};

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
  const { currentRide, driverLocation, cancelRide } = useRide();
  const activeRideReadModel = useActiveRideReadModel();
  const { showToast } = useToast();
  const mapRef = useRef<AppMapHandle>(null);
  const fittedMapStateRef = useRef<string | null>(null);
  const previousRideStatusRef = useRef<string | null>(null);
  /** Last driver position while arriving — shown on the arrived map (state so markers re-render). */
  const [arrivedDriverCoords, setArrivedDriverCoords] = useState<Coords | null>(null);

  const [mapType, setMapType] = useState<AppMapType>('standard');
  const [driverCardHeight, setDriverCardHeight] = useState(260);
  const [arrivingRouteOrigin, setArrivingRouteOrigin] = useState(driverLocation ?? KIGALI_CENTER);

  const { route: rideRoute } = useRoute(
    currentRide ? { latitude: currentRide.pickup.latitude, longitude: currentRide.pickup.longitude } : null,
    currentRide ? { latitude: currentRide.destination.latitude, longitude: currentRide.destination.longitude } : null,
    { vehicleType: currentRide?.vehicleType ?? null },
  );

  const { arrivedBannerMessage, isArrived, isArriving, isInProgress, isPickupLate, statusMessage } =
    useRideStatus(currentRide);
  // The ride is confirmed (driver assigned, before they mark "en route"). The
  // rider should already have map controls + a Call-driver button in this state.
  const isConfirmed = currentRide?.status === 'confirmed';
  const {
    handleCallDriver,
    handleCancelArrived,
    handleCancelArriving,
    handleEmergency,
    handleSOS,
  } = useRideActions({ cancelRide, currentRide, showToast });

  const { route: driverToPickupRoute } = useRoute(
    isArriving ? arrivingRouteOrigin : null,
    isArriving && currentRide ? { latitude: currentRide.pickup.latitude, longitude: currentRide.pickup.longitude } : null,
    { vehicleType: currentRide?.vehicleType ?? null },
  );
  // The driver marker comes ONLY from the driver's real position pushed over the
  // WS (context driverLocation) — no simulated walk along the route polyline.
  const activeDriverLocation = driverLocation;

  useEffect(() => {
    const status = currentRide?.status ?? null;
    const previousStatus = previousRideStatusRef.current;

    if (status === 'arriving' && previousStatus !== 'arriving') {
      setArrivingRouteOrigin(driverLocation ?? KIGALI_CENTER);
    }

    if (status === 'arrived' && previousStatus === 'arriving' && currentRide) {
      const lockAt = driverLocation ?? currentRide.pickup;
      setArrivedDriverCoords(lockAt);
    }

    previousRideStatusRef.current = status;
  }, [currentRide, currentRide?.status, driverLocation]);

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
      const remaining = getRemainingRouteCoordinates(
        driverToPickupRoute.coordinates,
        activeDriverLocation,
      );
      return routePolylineThroughPinTips(remaining, null, currentRide.pickup);
    },
    [activeDriverLocation, currentRide, driverToPickupRoute, isArriving],
  );
  const remainingPickupToDestinationRoute = useMemo(
    () => {
      if (!isInProgress || !activeDriverLocation || !currentRide || !rideRoute) return null;
      const remaining = getRemainingRouteCoordinates(rideRoute.coordinates, activeDriverLocation);
      return routePolylineThroughPinTips(remaining, null, currentRide.destination);
    },
    [activeDriverLocation, currentRide, isInProgress, rideRoute],
  );
  const fullRideRouteThroughPins = useMemo(
    () => {
      if (!rideRoute || !currentRide || rideRoute.coordinates.length < 2) return null;
      return routePolylineThroughPinTips(
        rideRoute.coordinates,
        currentRide.pickup,
        currentRide.destination,
      );
    },
    [currentRide, rideRoute],
  );
  const activeRemainingRoute = isArriving ? remainingDriverToPickupRoute : remainingPickupToDestinationRoute;

  const pickupPinCoordinate = currentRide?.pickup ?? null;
  const destinationPinCoordinate = currentRide?.destination ?? null;

  const activeVehicleType = currentRide?.vehicleType ?? 'moto';
  const vehicleRotationDeg = useMemo(() => {
    const routeForHeading = isArrived && rideRoute && rideRoute.coordinates.length >= 2
      ? rideRoute.coordinates
      : activeRemainingRoute;
    if (!routeForHeading || routeForHeading.length < 2) return 0;
    const bearing = getBearingDegrees(routeForHeading[0], routeForHeading[1]);
    return bearing - VEHICLE_MARKER_DEFAULT_HEADING[activeVehicleType];
  }, [activeRemainingRoute, activeVehicleType, isArrived, rideRoute]);

  const driverPhotoUri = useMemo(
    () => resolveDriverProfileImage(currentRide?.driver),
    [currentRide?.driver],
  );

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

  const showMapControls = isConfirmed || isArriving || isArrived || isInProgress;

  const cycleMapType = useCallback(() => {
    setMapType(prev => MAP_TYPES[(MAP_TYPES.indexOf(prev) + 1) % MAP_TYPES.length]);
  }, []);

  const recenterRideMap = useCallback(() => {
    if (!mapRef.current || !currentRide) return;

    const driverCoord = isArrived
      ? arrivedDriverCoords ?? driverLocation ?? currentRide.pickup
      : driverLocation;

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
    mapFitEdgePadding,
    rideRoute,
  ]);

  if (!currentRide) return null;

  // Live, real distance + ETA to the driver's current target (pickup while
  // arriving, destination in progress). RideProvider recomputes these on every
  // real `driver_location` event — the SAME source the driver screen uses — so
  // the customer sees a moving value, not the frozen estimate or a "secs away"
  // placeholder. Fall back to the route/estimate only until the first fix.
  const liveDistanceKm = currentRide.driver?.distanceKm ?? null;
  const liveEtaMinutes = currentRide.driver?.eta ?? null;
  const distanceText = liveDistanceKm != null
    ? formatDistance(liveDistanceKm * 1000)
    : rideRoute
      ? formatDistance(rideRoute.distanceMeters)
      : formatDistance(currentRide.distance * 1000);
  const liveEtaText = liveEtaMinutes != null ? `${liveEtaMinutes} min` : null;
  const displayEta = liveEtaText ?? (rideRoute ? formatDuration(rideRoute.durationSeconds) : `${currentRide.duration} min`);
  // When the driver has arrived / is waiting, there is no meaningful countdown —
  // the header shows the arrived status, not a stale ETA.
  const headerEtaText = isArrived ? null : displayEta;

  // Always hand the map a valid, defined center (driver → last-known → pickup)
  // so it renders real tiles immediately instead of a blank background while we
  // wait for the first driver fix. Mirrors the driver screen's initial region.
  const mapCenter = activeDriverLocation ?? mapDriverLocation ?? currentRide.pickup;
  const mapInitialRegion = {
    latitude: mapCenter.latitude,
    longitude: mapCenter.longitude,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  };

  const mapControlsBottomInset =
    driverCardHeight + insets.bottom + (Platform.OS === 'web' ? 24 : 12) + 16;
  const recenterBtnBottom = mapControlsBottomInset;
  const mapLayerBtnBottom = mapControlsBottomInset + 46 + 12;

  return (
    <View style={styles.container}>
      {/* Map */}
      <AppMap
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={mapInitialRegion}
        mapType={mapType}
      >
        {mapDriverLocation && (
          <AppMarker coordinate={mapDriverLocation} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <VehicleMapMarker
              type={currentRide.vehicleType}
              rotationDeg={vehicleRotationDeg}
            />
          </AppMarker>
        )}
        {!isInProgress && pickupPinCoordinate && (
          <AppMarker
            coordinate={pickupPinCoordinate}
            anchor={LOCATION_MAP_PIN_ANCHOR}
            centerOffset={getLocationMapPinCenterOffset()}
            tracksViewChanges={false}
          >
            <LocationMapPin variant="pickup" mapType={mapType} />
          </AppMarker>
        )}
        {(isArrived || isInProgress) && destinationPinCoordinate && (
          <AppMarker
            coordinate={destinationPinCoordinate}
            anchor={LOCATION_MAP_PIN_ANCHOR}
            centerOffset={getLocationMapPinCenterOffset()}
            tracksViewChanges={false}
          >
            <LocationMapPin variant="destination" mapType={mapType} />
          </AppMarker>
        )}
        {isArriving && remainingDriverToPickupRoute ? (
          <RoutePolyline coordinates={remainingDriverToPickupRoute} color={colors.destructiveHex} width={4} />
        ) : null}
        {isInProgress && remainingPickupToDestinationRoute ? (
          <RoutePolyline coordinates={remainingPickupToDestinationRoute} color={colors.destructiveHex} width={4} />
        ) : null}
        {isArrived && fullRideRouteThroughPins ? (
          <RoutePolyline coordinates={fullRideRouteThroughPins} color={colors.destructiveHex} width={4} />
        ) : null}
      </AppMap>

      {showMapControls && (
        <>
          <TouchableOpacity
            style={[
              styles.mapLayerBtn,
              { backgroundColor: colors.background, bottom: mapLayerBtnBottom },
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
              { backgroundColor: colors.background, bottom: recenterBtnBottom },
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

      <RideHeader
        colors={colors}
        etaText={headerEtaText}
        isElevated={isArriving || isArrived || isInProgress}
        ride={currentRide}
        safeAreaTop={insets.top}
        statusMessage={statusMessage}
      />
      {currentRide && (
        <ActiveRideProjectionSummary
          colors={colors}
          summary={activeRideReadModel.summary}
        />
      )}
      {isArrived && <RideStatusSection colors={colors} isLate={isPickupLate} message={arrivedBannerMessage} />}
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
        <DriverInfoCard
          colors={colors}
          distanceText={distanceText}
          driverPhotoUri={driverPhotoUri}
          etaText={displayEta}
          ride={currentRide}
        />
        <RideActionsSection
          colors={colors}
          isConfirmed={isConfirmed}
          isArrived={isArrived}
          isArriving={isArriving}
          isInProgress={isInProgress}
          onCall={handleCallDriver}
          onCancelArrived={handleCancelArrived}
          onCancelArriving={handleCancelArriving}
          onEmergency={handleEmergency}
          onSOS={handleSOS}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mapLayerBtn: {
    position: 'absolute', right: 16, width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center', zIndex: 5, shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 6,
  },
  recenterBtn: {
    position: 'absolute', right: 16, width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center', zIndex: 5, shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 6,
  },
  driverCard: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: FLOATING_PANEL_TOP_RADIUS, borderTopRightRadius: FLOATING_PANEL_TOP_RADIUS,
    paddingTop: 14, paddingHorizontal: 16, gap: 10, shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 16,
  },
});
