import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react';
import { InteractionManager, Platform } from 'react-native';
import MapView from 'react-native-maps';
import { getRouteKey, useRoute } from '@/hooks/useRoute';
import type { Coords, RideLocation, VehicleType } from '@/types';
import { homeRoutePolyline, sampleRouteCoordsForFit } from '@/utils/mapUtils';
import {
  BOOKING_MAP_TOP_OVERLAY,
  EXPANDED_PANEL_HEIGHT,
  ROUTE_FIT_SIDE_PADDING,
} from '@/components/home/homeUtils';

const EMPTY_COORDINATES: Coords[] = [];

export function useRoutePreview({
  pickup,
  destination,
  showBooking,
  isMapReady,
  mapRef,
  bookingPanelMapInset,
  topInset,
  bottomInset,
  routeRecenterRequest,
  vehicleType,
}: {
  pickup: RideLocation;
  destination: RideLocation | null;
  showBooking: boolean;
  isMapReady: boolean;
  mapRef: RefObject<MapView | null>;
  bookingPanelMapInset: number;
  topInset: number;
  bottomInset: number;
  routeRecenterRequest: number;
  /** Selected vehicle — lets the shared backend route cache answer first. */
  vehicleType?: VehicleType | null;
}) {
  const hasPreciseRouteLocations =
    showBooking &&
    destination !== null &&
    pickup.locationType !== 'generic' &&
    destination.locationType !== 'generic';
  const pickupCoords = useMemo(
    () => ({ latitude: pickup.latitude, longitude: pickup.longitude }),
    [pickup.latitude, pickup.longitude],
  );
  const destinationCoords = useMemo(
    () => destination
      ? { latitude: destination.latitude, longitude: destination.longitude }
      : null,
    [destination?.latitude, destination?.longitude],
  );
  const { route, routeKey, loading: routeLoading } = useRoute(
    hasPreciseRouteLocations ? pickupCoords : null,
    hasPreciseRouteLocations ? destinationCoords : null,
    { vehicleType },
  );
  const routeRequestKey = hasPreciseRouteLocations && destinationCoords
    ? getRouteKey(pickupCoords, destinationCoords)
    : null;
  const [loadedRoute, setLoadedRoute] = useState<{
    key: string;
    coordinates: Coords[];
  } | null>(null);
  const clearRoutePreview = useCallback(() => {
    setLoadedRoute(null);
  }, []);

  const routePreviewCoords = useMemo(
    () => destinationCoords
      ? [pickupCoords, destinationCoords!]
      : EMPTY_COORDINATES,
    [destinationCoords, pickupCoords],
  );
  const visibleRouteCoords =
    loadedRoute?.key === routeRequestKey && loadedRoute.coordinates.length > 1
      ? loadedRoute.coordinates
      : EMPTY_COORDINATES;
  const routeCenterCoords = visibleRouteCoords.length > 1 ? visibleRouteCoords : routePreviewCoords;
  const routeFitCoords = useMemo(() => {
    if (routeCenterCoords.length < 2) return EMPTY_COORDINATES;
    if (!destinationCoords) return sampleRouteCoordsForFit(routeCenterCoords);
    return sampleRouteCoordsForFit([pickupCoords, ...routeCenterCoords, destinationCoords]);
  }, [destinationCoords, pickupCoords, routeCenterCoords]);

  const centerRouteInVisibleMap = useCallback((
    coords: { latitude: number; longitude: number }[],
    panelHeightOverride?: number,
  ) => {
    if (!isMapReady || !showBooking || coords.length < 2) return;
    const panelHeight = panelHeightOverride ?? (destinationCoords ? EXPANDED_PANEL_HEIGHT : bookingPanelMapInset);
    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: {
        top: topInset + (Platform.OS === 'web' ? 96 : BOOKING_MAP_TOP_OVERLAY),
        right: ROUTE_FIT_SIDE_PADDING,
        bottom: panelHeight + bottomInset,
        left: ROUTE_FIT_SIDE_PADDING,
      },
      animated: true,
    });
  }, [bookingPanelMapInset, bottomInset, destinationCoords, isMapReady, mapRef, showBooking, topInset]);

  const routeLineCoords = useMemo(() => {
    if (visibleRouteCoords.length < 2) return EMPTY_COORDINATES;
    if (!destinationCoords) return visibleRouteCoords;
    return homeRoutePolyline(visibleRouteCoords, pickupCoords, destinationCoords);
  }, [destinationCoords, pickupCoords, visibleRouteCoords]);
  const shouldShowBookingRoute = showBooking && destinationCoords !== null && routeLineCoords.length > 1;
  const routePinPositions = useMemo(
    () => ({ pickup: pickupCoords, destination: destinationCoords }),
    [destinationCoords, pickupCoords],
  );

  useEffect(() => {
    setLoadedRoute(
      routeRequestKey && routeKey === routeRequestKey && route && route.coordinates.length > 1
        ? { key: routeRequestKey, coordinates: route.coordinates }
        : null,
    );
  }, [route, routeKey, routeRequestKey]);

  useEffect(() => {
    if (!showBooking || !destinationCoords) {
      setLoadedRoute(null);
    }
  }, [destinationCoords, showBooking]);

  useEffect(() => {
    if (!showBooking || !destinationCoords || routeFitCoords.length < 2) return;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let lateRetryTimer: ReturnType<typeof setTimeout> | null = null;
    const runFit = () => centerRouteInVisibleMap(routeFitCoords, EXPANDED_PANEL_HEIGHT);
    const task = InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(runFit);
      retryTimer = setTimeout(runFit, 220);
      lateRetryTimer = setTimeout(runFit, 480);
    });
    return () => {
      task.cancel();
      if (retryTimer) clearTimeout(retryTimer);
      if (lateRetryTimer) clearTimeout(lateRetryTimer);
    };
  }, [centerRouteInVisibleMap, destinationCoords, routeFitCoords, routeRecenterRequest, showBooking]);

  return {
    route,
    routeLoading,
    routeFitCoords,
    routeLineCoords,
    shouldShowBookingRoute,
    routePinPositions,
    centerRouteInVisibleMap,
    hasPreciseRouteLocations,
    clearRoutePreview,
  };
}
