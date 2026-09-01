import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { AppText } from '@/components/AppText';
import type { AppMapHandle } from '@/components/map';
import { MapPickerOverlay } from '@/components/home/MapPickerOverlay';
import { useMapPicker } from '@/context/MapPickerContext';
import type { MapPickerBookingTarget } from '@/context/MapPickerContext';
import { useRide } from '@/context/RideContext';
import { useSavedLocations } from '@/hooks/useSavedLocations';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatReverseGeocodeAddress } from '@/utils/locationUtils';
import { KIGALI_CENTER, type RideLocation } from '@/types';
import type { MapPickerSavedPlaceMode } from '@/context/MapPickerContext';
import { MAP_TYPES, type AppMapType, type MapPickerTarget } from '@/components/home/homeUtils';

type MapPickerRouteTarget = 'pickup' | 'dropoff' | 'saved-place';
type MapPickerRouteMode = 'booking' | MapPickerSavedPlaceMode;

function isMapPickerRouteTarget(value: string | undefined): value is MapPickerRouteTarget {
  return value === 'pickup' || value === 'dropoff' || value === 'saved-place';
}

function isMapPickerRouteMode(value: string | undefined): value is MapPickerRouteMode {
  return value === 'booking' || value === 'saved-place-add' || value === 'saved-place-edit';
}

function parseCoords(latitude?: string, longitude?: string) {
  if (!latitude || !longitude) return null;
  const lat = Number.parseFloat(latitude);
  const lng = Number.parseFloat(longitude);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { latitude: lat, longitude: lng };
}

function buildLocation(coords: { latitude: number; longitude: number }, address: string): RideLocation {
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    address,
    locationType: 'precise',
  };
}

export default function MapPickerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<AppMapHandle>(null);
  const { setBookingSelection, setResult } = useMapPicker();
  const { pickup, destination, setPickup, setDestination, setDestText } = useRide();
  const { savedPlaces } = useSavedLocations();

  const params = useLocalSearchParams<{
    target?: string;
    mode?: string;
    sessionId?: string;
    savedPlaceId?: string;
    initialLatitude?: string;
    initialLongitude?: string;
    initialAddress?: string;
    label?: string;
  }>();

  const routeTarget = params.target;
  const routeMode = params.mode;
  const sessionId = params.sessionId;
  const initialCoordsFromParams = parseCoords(params.initialLatitude, params.initialLongitude);

  const existingSavedPlace = useMemo(() => {
    if (routeMode !== 'saved-place-edit' || !params.savedPlaceId) return undefined;
    return savedPlaces.find(place => place.id === params.savedPlaceId);
  }, [params.savedPlaceId, routeMode, savedPlaces]);

  const routeConfig = useMemo(() => {
    if (!isMapPickerRouteTarget(routeTarget) || !isMapPickerRouteMode(routeMode)) {
      return null;
    }
    if (routeMode === 'booking' && routeTarget === 'saved-place') return null;
    if (routeMode !== 'booking' && routeTarget !== 'saved-place') return null;
    if (routeMode !== 'booking' && !sessionId) return null;
    if (routeMode === 'saved-place-edit' && !params.savedPlaceId) return null;
    return { target: routeTarget, mode: routeMode, sessionId: sessionId ?? null };
  }, [params.savedPlaceId, routeMode, routeTarget, sessionId]);

  const initialCoords = useMemo(() => {
    if (initialCoordsFromParams) return initialCoordsFromParams;
    if (existingSavedPlace) {
      return {
        latitude: existingSavedPlace.latitude,
        longitude: existingSavedPlace.longitude,
      };
    }
    if (routeConfig?.mode === 'booking') {
      return routeConfig.target === 'pickup'
        ? { latitude: pickup.latitude, longitude: pickup.longitude }
        : destination
          ? { latitude: destination.latitude, longitude: destination.longitude }
          : { latitude: pickup.latitude, longitude: pickup.longitude };
    }
    return KIGALI_CENTER;
  }, [destination, existingSavedPlace, initialCoordsFromParams, pickup.latitude, pickup.longitude, routeConfig]);

  const initialAddress = useMemo(() => {
    if (params.initialAddress) return params.initialAddress;
    if (existingSavedPlace) return existingSavedPlace.address ?? '';
    if (routeConfig?.mode === 'booking') {
      const source = routeConfig.target === 'pickup' ? pickup : destination;
      return source?.address ?? '';
    }
    return '';
  }, [destination, existingSavedPlace, params.initialAddress, pickup, routeConfig]);

  const savedLocationLabel = useMemo(() => {
    if (routeMode === 'saved-place-edit' && existingSavedPlace) return existingSavedPlace.label;
    return params.label || 'Other';
  }, [existingSavedPlace, params.label, routeMode]);

  const [mapCoords, setMapCoords] = useState<RideLocation>(() => buildLocation(initialCoords, initialAddress || 'Selected location'));
  const [mapAddress, setMapAddress] = useState(initialAddress);
  const [isDragging, setIsDragging] = useState(false);
  const [mapType, setMapType] = useState<AppMapType>('standard');
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const [isResolving, setIsResolving] = useState(false);
  const [hasConfirmed, setHasConfirmed] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const hasConfirmedRef = useRef(false);

  const syncMapAddress = useCallback(async (coords: RideLocation) => {
    setIsResolving(true);
    try {
      const [geo] = await Location.reverseGeocodeAsync(coords).catch(() => [null]);
      setMapAddress(formatReverseGeocodeAddress(geo, 'Selected location'));
    } finally {
      setIsResolving(false);
    }
  }, []);

  // Resolves the coordinate under the fixed center pin RIGHT NOW — queries the
  // map's true screen-center coordinate rather than trusting `mapCoords`
  // state, which can be stale if `onRegionChangeComplete` hasn't landed yet
  // (e.g. the user taps Confirm mid-gesture, or the native event is still in
  // flight). Falls back to the last known coordinate so this always resolves
  // to *something* — never leaves the user unable to place a pin.
  const resolveCenterCoordinate = useCallback(async (): Promise<{ latitude: number; longitude: number }> => {
    const map = mapRef.current;
    if (map && mapSize.width > 0 && mapSize.height > 0) {
      try {
        const coord = await map.coordinateForPoint({
          x: mapSize.width / 2,
          y: mapSize.height / 2,
        });
        if (Number.isFinite(coord.latitude) && Number.isFinite(coord.longitude)) {
          return { latitude: coord.latitude, longitude: coord.longitude };
        }
      } catch {
        // Native measurement can reject mid-layout — fall through to the
        // last known center below instead of throwing.
      }
    }
    return { latitude: mapCoords.latitude, longitude: mapCoords.longitude };
  }, [mapCoords.latitude, mapCoords.longitude, mapSize.height, mapSize.width]);

  const syncCoordsFromCenter = useCallback(async () => {
    const center = await resolveCenterCoordinate();
    setMapCoords(prev => ({ ...prev, latitude: center.latitude, longitude: center.longitude }));
  }, [resolveCenterCoordinate]);

  useEffect(() => {
    if (mapSize.width === 0 || mapSize.height === 0) return;
    void syncCoordsFromCenter();
  }, [mapSize.height, mapSize.width, syncCoordsFromCenter]);

  const centerOnCurrentLocation = useCallback(async () => {
    try {
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords: RideLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        address: mapAddress,
        locationType: 'precise',
      };
      setPermissionDenied(false);
      setMapCoords(coords);
      mapRef.current?.animateToRegion(
        {
          latitude: coords.latitude,
          longitude: coords.longitude,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        },
        500,
      );
    } catch {
      setPermissionDenied(true);
    }
  }, [mapAddress]);

  const closeScreen = useCallback(() => {
    router.back();
  }, []);

  const confirmSelection = useCallback(async () => {
    if (!routeConfig) return;
    if (hasConfirmedRef.current) return;
    hasConfirmedRef.current = true;
    setHasConfirmed(true);

    // Always resolve fresh — never trust `mapCoords` alone, it can be a tick
    // behind the pin the user is actually looking at (see resolveCenterCoordinate).
    const center = await resolveCenterCoordinate();
    const location = buildLocation(center, mapAddress || 'Selected location');

    if (routeConfig.mode === 'booking') {
      if (routeConfig.target === 'pickup') {
        setPickup(location);
      } else {
        setDestText(location.address ?? '');
        setDestination(location);
      }
      const bookingTarget: MapPickerBookingTarget = routeConfig.target === 'dropoff' ? 'dropoff' : 'pickup';
      setBookingSelection({
        flow: 'booking',
        target: bookingTarget,
        location,
      });
    } else {
      const savedPlaceSessionId = routeConfig.sessionId;
      if (!savedPlaceSessionId) return;
      const result = {
        sessionId: savedPlaceSessionId,
        mode: routeConfig.mode,
        savedPlaceId: params.savedPlaceId,
        address: location.address ?? 'Selected location',
        latitude: location.latitude,
        longitude: location.longitude,
        createdAt: Date.now(),
        target: 'saved-place' as const,
      };
      setResult(result);
    }

    router.back();
  }, [
    mapAddress,
    params.savedPlaceId,
    resolveCenterCoordinate,
    routeConfig,
    setResult,
    setBookingSelection,
    setDestText,
    setDestination,
    setPickup,
  ]);

  if (!routeConfig) {
    return (
      <View style={[styles.errorRoot, { backgroundColor: colors.background }]}>
        <AppText variant="h2" style={[styles.errorTitle, { color: colors.foreground }]}>
          Map picker unavailable
        </AppText>
        <AppText variant="bodySmall" style={[styles.errorBody, { color: colors.mutedForeground }]}>
          This route could not be opened safely.
        </AppText>
        <AppButton title="Go back" variant="secondary" size="md" onPress={closeScreen} />
      </View>
    );
  }

  const activeRoute = routeConfig;
  const overlayTarget: MapPickerTarget = activeRoute.mode === 'booking'
    ? (activeRoute.target === 'dropoff' ? 'dropoff' : 'pickup')
    : 'savedLocation';

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <MapPickerOverlay
        target={overlayTarget}
        mapRef={mapRef}
        pinCoords={mapCoords}
        mapType={mapType}
        colors={colors}
        topInset={insets.top}
        bottomInset={insets.bottom}
        isDragging={isDragging}
        onLayout={(width, height) => setMapSize({ width, height })}
        onDragStart={() => setIsDragging(true)}
        onRegionChangeComplete={region => {
          const coords: RideLocation = {
            latitude: region.latitude,
            longitude: region.longitude,
            address: mapAddress,
            locationType: 'precise',
          };
          setIsDragging(false);
          setMapCoords(coords);
          void syncMapAddress(coords);
        }}
        onClose={closeScreen}
        onCycleMapType={() => setMapType(previous => MAP_TYPES[(MAP_TYPES.indexOf(previous) + 1) % MAP_TYPES.length])}
        onCenterUser={centerOnCurrentLocation}
        onConfirm={confirmSelection}
        savedLocationConfirmTitle={
          activeRoute.mode === 'saved-place-edit'
            ? `Confirm ${savedLocationLabel} Location`
            : activeRoute.mode === 'saved-place-add'
              ? `Confirm ${savedLocationLabel} Location`
              : undefined
        }
        savedLocationHint={
          activeRoute.mode === 'saved-place-edit'
            ? `Drag the map to set your ${savedLocationLabel.toLowerCase()} location`
            : activeRoute.mode === 'saved-place-add'
              ? `Drag the map to set your ${savedLocationLabel.toLowerCase()} location`
              : undefined
        }
      />

      {(isResolving || hasConfirmed) && (
        <View pointerEvents="none" style={[styles.loadingOverlay, { paddingTop: insets.top }]}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}

      {permissionDenied ? (
        <View pointerEvents="none" style={styles.permissionBanner}>
          <AppText variant="caption" style={{ color: colors.foreground }}>
            Location access is unavailable. The map will stay centered here.
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = {
  screen: { flex: 1 },
  errorRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 12 },
  errorTitle: { textAlign: 'center' },
  errorBody: { textAlign: 'center', maxWidth: 360 },
  loadingOverlay: { position: 'absolute' as const, top: 0, left: 0, right: 0, alignItems: 'center' as const },
  permissionBanner: { position: 'absolute' as const, left: 16, right: 16, bottom: 16, padding: 12 },
} as const;
