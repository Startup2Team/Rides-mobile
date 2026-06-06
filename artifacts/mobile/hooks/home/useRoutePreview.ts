import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react';
import { InteractionManager, Platform } from 'react-native';
import MapView from 'react-native-maps';
import { useRoute } from '@/hooks/useRoute';
import type { Coords, RideLocation } from '@/types';
import { routePolylineThroughPinTips, sampleRouteCoordsForFit } from '@/utils/mapUtils';
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
  const { route, loading: routeLoading } = useRoute(
    hasPreciseRouteLocations ? pickupCoords : null,
    hasPreciseRouteLocations ? destinationCoords : null,
  );
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const clearRoutePreview = useCallback(() => {
    setRouteCoords([]);
  }, []);

  const routePreviewCoords = useMemo(
    () => destinationCoords
      ? [pickupCoords, destinationCoords!]
      : EMPTY_COORDINATES,
    [destinationCoords, pickupCoords],
  );
  const visibleRouteCoords = routeCoords.length > 1 ? routeCoords : EMPTY_COORDINATES;
  const routeCenterCoords = routeCoords.length > 1 ? routeCoords : routePreviewCoords;
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
    if (visibleRouteCoords.length < 2) {
      return routePreviewCoords.length > 1 ? routePreviewCoords : EMPTY_COORDINATES;
    }
    if (!destinationCoords) return visibleRouteCoords;
    return routePolylineThroughPinTips(visibleRouteCoords, pickupCoords, destinationCoords);
  }, [destinationCoords, pickupCoords, routePreviewCoords, visibleRouteCoords]);
  const shouldShowBookingRoute = showBooking && destinationCoords !== null && routeLineCoords.length > 1;
  const routePinPositions = useMemo(
    () => ({ pickup: pickupCoords, destination: destinationCoords }),
    [destinationCoords, pickupCoords],
  );

  useEffect(() => {
    setRouteCoords(route && route.coordinates.length > 1 ? route.coordinates : []);
  }, [route, routePreviewCoords]);

  useEffect(() => {
    if (!showBooking || !destinationCoords) {
      setRouteCoords([]);
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
