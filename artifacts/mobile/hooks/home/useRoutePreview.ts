import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react';
import { InteractionManager, Platform } from 'react-native';
import MapView from 'react-native-maps';
import { useRoute } from '@/hooks/useRoute';
import type { RideLocation } from '@/types';
import { routePolylineThroughPinTips, sampleRouteCoordsForFit } from '@/utils/mapUtils';
import {
  BOOKING_MAP_TOP_OVERLAY,
  EXPANDED_PANEL_HEIGHT,
  ROUTE_DRAW_INTERVAL_MS,
  ROUTE_DRAW_STEP,
  ROUTE_FIT_SIDE_PADDING,
  sliceRouteByProgress,
} from '@/components/home/homeUtils';

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
  const { route, loading: routeLoading } = useRoute(
    hasPreciseRouteLocations ? pickup : null,
    hasPreciseRouteLocations ? destination : null,
  );
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [routeAnimProgress, setRouteAnimProgress] = useState(0);
  const clearRoutePreview = useCallback(() => {
    setRouteCoords([]);
    setRouteAnimProgress(0);
  }, []);

  const routePreviewCoords = useMemo(
    () => destination ? [pickup, destination] : [],
    [destination, pickup],
  );
  const visibleRouteCoords = routeCoords.length > 1 ? routeCoords : [];
  const routeCenterCoords = routeCoords.length > 1 ? routeCoords : routePreviewCoords;
  const routeFitCoords = useMemo(() => {
    if (routeCenterCoords.length < 2) return [];
    if (!destination) return sampleRouteCoordsForFit(routeCenterCoords);
    return sampleRouteCoordsForFit([pickup, ...routeCenterCoords, destination]);
  }, [destination, pickup, routeCenterCoords]);

  const centerRouteInVisibleMap = useCallback((
    coords: { latitude: number; longitude: number }[],
    panelHeightOverride?: number,
  ) => {
    if (!isMapReady || !showBooking || coords.length < 2) return;
    const panelHeight = panelHeightOverride ?? (destination ? EXPANDED_PANEL_HEIGHT : bookingPanelMapInset);
    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: {
        top: topInset + (Platform.OS === 'web' ? 96 : BOOKING_MAP_TOP_OVERLAY),
        right: ROUTE_FIT_SIDE_PADDING,
        bottom: panelHeight + bottomInset,
        left: ROUTE_FIT_SIDE_PADDING,
      },
      animated: true,
    });
  }, [bookingPanelMapInset, bottomInset, destination, isMapReady, mapRef, showBooking, topInset]);

  const routeLineCoords = useMemo(() => {
    if (visibleRouteCoords.length < 2) return routePreviewCoords.length > 1 ? routePreviewCoords : [];
    if (!destination) return visibleRouteCoords;
    return routePolylineThroughPinTips(visibleRouteCoords, pickup, destination);
  }, [destination, pickup, routePreviewCoords, visibleRouteCoords]);
  const animatedRouteCoords = useMemo(
    () => routeLineCoords.length < 2
      ? []
      : sliceRouteByProgress(routeLineCoords, 0, Math.min(routeAnimProgress, 1)),
    [routeAnimProgress, routeLineCoords],
  );
  const shouldShowBookingRoute = showBooking && destination !== null && routeLineCoords.length > 1;
  const routePinPositions = useMemo(
    () => ({ pickup, destination }),
    [destination, pickup],
  );

  useEffect(() => {
    if (routeLineCoords.length < 2) {
      setRouteAnimProgress(0);
      return;
    }
    setRouteAnimProgress(0);
    const interval = setInterval(() => {
      setRouteAnimProgress(previous => {
        if (previous >= 1) {
          clearInterval(interval);
          return 1;
        }
        return Math.min(previous + ROUTE_DRAW_STEP, 1);
      });
    }, ROUTE_DRAW_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [routeLineCoords]);

  useEffect(() => {
    setRouteCoords(route && route.coordinates.length > 1 ? route.coordinates : []);
  }, [route, routePreviewCoords]);

  useEffect(() => {
    if (!showBooking || !destination) {
      setRouteCoords([]);
      setRouteAnimProgress(0);
    }
  }, [destination, showBooking]);

  useEffect(() => {
    if (!showBooking || !destination || routeFitCoords.length < 2) return;
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
  }, [centerRouteInVisibleMap, destination, routeFitCoords, routeRecenterRequest, showBooking]);

  return {
    route,
    routeLoading,
    routeFitCoords,
    animatedRouteCoords,
    shouldShowBookingRoute,
    routePinPositions,
    centerRouteInVisibleMap,
    hasPreciseRouteLocations,
    clearRoutePreview,
  };
}
