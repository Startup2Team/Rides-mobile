import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { HomeTopHeader } from '@/components/HomeTopHeader';
import { sizes } from '@/constants/sizes';
import { spacing } from '@/constants/spacing';
import { useColors } from '@/hooks/useColors';
import { computeTabBarHeight } from '@/constants/tabBar';
import { useRoutePreview } from '@/hooks/home/useRoutePreview';
import { useHomeBooking } from '@/hooks/home/useHomeBooking';
import { useHomeLocation } from '@/hooks/home/useHomeLocation';
import { useAuth } from '@/context/AuthContext';
import { useRide } from '@/context/RideContext';
import { useSavedLocations } from '@/hooks/useSavedLocations';
import { canAccessDriverMode, getDriverVerificationStatus } from '@/utils/driverVerification';
import {
  getCoordDistance,
  hasUsablePickup,
} from '@/utils/locationUtils';
import {
  BookingFormDraft,
  KIGALI_CENTER,
  RideLocation,
} from '@/types';
import { loadStoredDriverOnboardingDraft } from '@/persistence/driverOnboardingPersistence';
import { CustomerBottomSheet } from './CustomerBottomSheet';
import { HomeMap } from './HomeMap';
// Search overlay is navigated via /location-search route
import { styles } from './homeStyles';
import {
  BOOKING_SHEET_BOTTOM_PADDING,
  HOME_FLOATING_PANEL_FALLBACK_HEIGHT,
  HOME_LOCATION_DELTA,
  MAP_TYPES,
  type AppMapType,
  SCREEN_HEIGHT,
} from './homeUtils';
import { getNearbyDrivers } from '@/services/nearbyDrivers';
import { useTabBarGlass } from '@/components/navigation/TabBarGlassContext';

export default function CustomerHome() {
  const colors = useColors();
  const { setHasGlassContent } = useTabBarGlass();
  const { reload: reloadSavedPlaces } = useSavedLocations();
  const insets = useSafeAreaInsets();
  const { user, driverProfile } = useAuth();
  const {
    currentRide,
    createRide,
    loadHistory,
    cancelledSearchDraft,
    restoreBookingOnHomeFocus,
    clearCancelledSearchDraft,
    clearRestoreBookingOnHomeFocus,
  } = useRide();
  const mapRef = useRef<MapView>(null);
  const hasCenteredOnUserRef = useRef(false);
  const cancelledSearchDraftRef = useRef(cancelledSearchDraft);
  cancelledSearchDraftRef.current = cancelledSearchDraft;

  // ── V2 card state ─────────────────────────────────────────────────────────
  // One string replaces showBooking + bookingShellState + bookingContentRevision.
  // 'home'    → HomeCard is visible, gesture is disabled on the sheet.
  // 'booking' → BookingCard is visible, swipe-down gesture is active.
  const [activeCard, setActiveCard] = useState<'home' | 'booking'>('home');
  // Height reported from CustomerBottomSheet via onSheetHeightChange.
  // Used to offset map controls and center the map correctly.
  const [sheetHeight, setSheetHeight] = useState(HOME_FLOATING_PANEL_FALLBACK_HEIGHT);
  const showBooking = activeCard === 'booking';

  const pickupSetterRef = useRef<React.Dispatch<React.SetStateAction<RideLocation>>>(() => {});
  const applyInitialPickup = useCallback((location: RideLocation) => {
    pickupSetterRef.current(previous => ({ ...previous, ...location }));
  }, []);
  const preserveInitialPickup = useCallback(() => Boolean(cancelledSearchDraftRef.current), []);
  const {
    currentLocationAddress,
    gpsLocation,
    locLoading,
    locationStatus,
    refreshHereLocation,
    startHereLocationWatch,
    stopHereLocationWatch,
    userLocation,
  } = useHomeLocation({ applyInitialPickup, preserveInitialPickup });
  const [focusedField, setFocusedField] = useState<'pickup' | 'dropoff' | null>(null);
  const [routeRecenterRequest, setRouteRecenterRequest] = useState(0);
  const openLocationSearch = useCallback((target: 'pickup' | 'dropoff') => {
    setFocusedField(target);
    router.push({
      pathname: '/location-search',
      params: {
        target,
        source: 'booking',
        userLatitude: userLocation.latitude.toString(),
        userLongitude: userLocation.longitude.toString(),
        gpsLatitude: gpsLocation ? gpsLocation.latitude.toString() : '',
        gpsLongitude: gpsLocation ? gpsLocation.longitude.toString() : '',
        gpsAddress: gpsLocation ? gpsLocation.address || '' : '',
      },
    });
  }, [gpsLocation, userLocation.latitude, userLocation.longitude]);
  const {
    bookLoading,
    destText,
    destination,
    distance: dist,
    estimatedFare,
    estimatedFareLoading,
    handleBook,
    pickup,
    selectedVehicle,
    setDestText,
    setDestination,
    setPickup,
    setSelectedVehicle,
  } = useHomeBooking({
    createRide,
    gpsLocation,
    onBeforeCreate: useCallback(() => setActiveCard('booking'), []),
    openLocationSearch,
    userLocation,
  });
  pickupSetterRef.current = setPickup;
  const [mapType, setMapType] = useState<AppMapType>('standard');
  const [isMapReady, setIsMapReady] = useState(false);
  const [driverApplicationDraftUpdatedAt, setDriverApplicationDraftUpdatedAt] = useState<string | null>(null);
  // ── Derived / layout ──────────────────────────────────────────────────────
  const recenterBottomOffset = sheetHeight + spacing[16];
  const hasPreciseRouteLocations =
    showBooking
    && destination !== null
    && pickup.locationType !== 'generic'
    && destination.locationType !== 'generic';
  const pickupOverlapsUser = gpsLocation ? getCoordDistance(pickup, gpsLocation) < 20 : false;
  const shouldShowPickupMarker =
    showBooking && hasUsablePickup(pickup) && (!pickupOverlapsUser || destination !== null);

  const cycleMapType = () => {
    setMapType(prev => MAP_TYPES[(MAP_TYPES.indexOf(prev) + 1) % MAP_TYPES.length]);
  };

  const centerMapOnUser = useCallback(
    (duration = 700, panelHeightOverride?: number) => {
      if (!gpsLocation) return;
      const panelHeight = panelHeightOverride ?? sheetHeight;
      const latitudeOffset = (panelHeight / (2 * SCREEN_HEIGHT)) * HOME_LOCATION_DELTA;
      mapRef.current?.animateToRegion(
        {
          latitude: gpsLocation.latitude - latitudeOffset,
          longitude: gpsLocation.longitude,
          latitudeDelta: HOME_LOCATION_DELTA,
          longitudeDelta: HOME_LOCATION_DELTA,
        },
        duration,
      );
    },
    [gpsLocation, sheetHeight],
  );

  // ── Open / close booking ─────────────────────────────────────────────────
  const handleOpenBooking = useCallback(() => {
    setActiveCard('booking');
  }, []);

  const handleCloseBooking = useCallback(() => {
    clearCancelledSearchDraft();
    setActiveCard('home');
    setDestText('');
    setDestination(null);

    clearRoutePreview();
    setPickup(
      gpsLocation
        ? { ...gpsLocation, address: currentLocationAddress || 'Current Location', locationType: 'precise' }
        : { ...KIGALI_CENTER, address: '', locationType: 'generic' },
    );
    if (gpsLocation) requestAnimationFrame(() => centerMapOnUser(400, sheetHeight));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    clearCancelledSearchDraft,
    currentLocationAddress,
    gpsLocation,
    centerMapOnUser,
    sheetHeight,
  ]);
  // clearRoutePreview and setters are stable references — omitted to avoid
  // stale-closure churn in a hot callback.

  const applyCancelledSearchDraft = useCallback(
    (draft: BookingFormDraft) => {
      setSelectedVehicle(draft.vehicleType);
      setPickup({ ...draft.pickup });
      setDestination({ ...draft.destination });
      setDestText(draft.destText);

      setActiveCard('booking');
      setRouteRecenterRequest(value => value + 1);
    },
    [],
  );

  const tryRestoreCancelledSearch = useCallback(() => {
    if (!restoreBookingOnHomeFocus && !cancelledSearchDraft) return;
    if (currentRide?.status === 'searching') return;

    if (cancelledSearchDraft) {
      applyCancelledSearchDraft(cancelledSearchDraft);
    } else if (currentRide?.status === 'cancelled') {
      setSelectedVehicle(currentRide.vehicleType);
      setPickup({ ...currentRide.pickup });
      setDestination({ ...currentRide.destination });
      setDestText(currentRide.destination.address ?? '');

      setActiveCard('booking');
      setRouteRecenterRequest(value => value + 1);
    }

    clearRestoreBookingOnHomeFocus();
  }, [
    applyCancelledSearchDraft,
    cancelledSearchDraft,
    clearRestoreBookingOnHomeFocus,
    currentRide,
    restoreBookingOnHomeFocus,
  ]);

  useLayoutEffect(() => {
    tryRestoreCancelledSearch();
  }, [tryRestoreCancelledSearch]);

  useFocusEffect(
    useCallback(() => {
      tryRestoreCancelledSearch();
      return undefined;
    }, [tryRestoreCancelledSearch]),
  );

  // Focus effects for reloading database states
  useEffect(() => { loadHistory(); }, [loadHistory]);

  useEffect(() => {
    if (locationStatus !== 'available' || hasCenteredOnUserRef.current || hasPreciseRouteLocations) return;
    hasCenteredOnUserRef.current = true;
    requestAnimationFrame(() => centerMapOnUser());
  }, [centerMapOnUser, hasPreciseRouteLocations, locationStatus]);

  useFocusEffect(useCallback(() => { void reloadSavedPlaces(); }, [reloadSavedPlaces]));

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadStoredDriverOnboardingDraft().then(stored => {
        if (!active) return;
        setDriverApplicationDraftUpdatedAt(stored.data?.updatedAt ?? null);
      });
      return () => { active = false; };
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      if (locationStatus !== 'available') return undefined;
      void startHereLocationWatch();
      return stopHereLocationWatch;
    }, [locationStatus, startHereLocationWatch, stopHereLocationWatch]),
  );

  const {
    route,
    routeLoading,
    routeFitCoords,
    routeLineCoords,
    shouldShowBookingRoute,
    routePinPositions,
    centerRouteInVisibleMap,
    clearRoutePreview,
  } = useRoutePreview({
    pickup,
    destination,
    showBooking,
    isMapReady,
    mapRef,
    bookingPanelMapInset: sheetHeight,
    topInset: insets.top,
    bottomInset: insets.bottom,
    routeRecenterRequest,
    vehicleType: selectedVehicle,
  });

  const shouldShowYouAreHere =
    locationStatus === 'available' && (!showBooking || !shouldShowBookingRoute);

  // Real backend: nearby online drivers (POST /customer/location), refreshed as
  // the user moves or changes vehicle type. Approx pins only (privacy).
  const [nearbyDrivers, setNearbyDrivers] = useState<
    { id: string; latitude: number; longitude: number }[]
  >([]);
  useEffect(() => {
    if (locationStatus !== 'available') return;
    let active = true;
    const fetchNearby = () => {
      getNearbyDrivers(userLocation.latitude, userLocation.longitude, selectedVehicle)
        .then(pins => {
          if (!active) return;
          setNearbyDrivers(
            pins.map((pin, i) => ({
              id: `nearby-driver-${i}`,
              latitude: pin.latitude,
              longitude: pin.longitude,
            })),
          );
        })
        .catch(() => {
          if (active) setNearbyDrivers([]);
        });
    };
    fetchNearby();
    // Poll so a driver going offline drops off the map (and a newly-online one
    // appears) within ~10s, instead of only refreshing when the customer moves.
    const intervalId = setInterval(fetchNearby, 10_000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [userLocation.latitude, userLocation.longitude, selectedVehicle, locationStatus]);
  const visibleDrivers = nearbyDrivers;

  const homeInitialRegion = useMemo(() => {
    const latitudeOffset = (sheetHeight / (2 * SCREEN_HEIGHT)) * HOME_LOCATION_DELTA;
    return {
      latitude: userLocation.latitude - latitudeOffset,
      longitude: userLocation.longitude,
      latitudeDelta: HOME_LOCATION_DELTA,
      longitudeDelta: HOME_LOCATION_DELTA,
    };
  }, [sheetHeight, userLocation.latitude, userLocation.longitude]);

  const handleHomeMapReady = useCallback(() => {
    setIsMapReady(true);
    if (routeFitCoords.length > 1 && showBooking && destination) {
      requestAnimationFrame(() => centerRouteInVisibleMap(routeFitCoords, sheetHeight));
    } else if (!hasCenteredOnUserRef.current && !hasPreciseRouteLocations) {
      hasCenteredOnUserRef.current = true;
      centerMapOnUser(300);
    }
  }, [
    centerMapOnUser,
    centerRouteInVisibleMap,
    destination,
    hasPreciseRouteLocations,
    routeFitCoords,
    showBooking,
    sheetHeight,
  ]);

  React.useEffect(() => {
    setHasGlassContent(true);
    return () => setHasGlassContent(false);
  }, [setHasGlassContent]);

  // Deliberately NO full-screen loader while the GPS fix resolves.
  //
  // This used to withhold the entire screen behind "Finding your pickup point"
  // until location resolved — 1 to 15 seconds on every cold start, because
  // acquisition makes three sequential getCurrentPositionAsync attempts with a
  // 5s timeout each, looping until accuracy is within 40m. Worse, the same
  // effect awaited the notification-permission dialog, so denying location kept
  // the spinner up until the user answered a second, unrelated OS prompt.
  //
  // The driver dashboard already does the right thing: it seeds the map with
  // KIGALI_CENTER and refines in the background, so the map is interactive
  // immediately. `userLocation` here defaults to exactly the same constant, and
  // homeInitialRegion above is already derived from it — the default was
  // computed and then thrown away. Render it, and let the existing watcher
  // refine the pin; `locLoading` now only drives the small inline indicator on
  // the pickup field rather than gating the whole screen.

  return (
    <View style={styles.container}>
      <HomeMap
        mapRef={mapRef}
        initialRegion={homeInitialRegion}
        mapType={mapType}
        onMapReady={handleHomeMapReady}
        routeCoordinates={routeLineCoords}
        routeColor={colors.destructiveHex}
        pickup={routePinPositions.pickup}
        destination={routePinPositions.destination}
        showPickup={shouldShowPickupMarker}
        showDestination={showBooking && destination !== null}
        drivers={visibleDrivers}
        selectedVehicle={selectedVehicle}
        showYouAreHere={shouldShowYouAreHere}
        userLocation={gpsLocation}
        primaryColor={colors.primary}
      />

      <HomeTopHeader
        paddingTop={insets.top + (Platform.OS === 'web' ? 67 : spacing[0]) + spacing[12]}
        locationText={currentLocationAddress}
        locLoading={locLoading}
        profileInitial={user?.name?.trim()?.[0]?.toUpperCase() ?? '?'}
        driverVerificationStatus={getDriverVerificationStatus(driverProfile)}
        canSwitchToDriverMode={canAccessDriverMode(driverProfile)}
        driverApplicationDraftUpdatedAt={driverApplicationDraftUpdatedAt}
        driverApprovalAcknowledgedAt={driverProfile?.driverApprovalAcknowledgedAt ?? null}
      />

      {/* Map layer button */}
      <TouchableOpacity
        style={[styles.mapLayerBtn, { backgroundColor: colors.background, bottom: recenterBottomOffset + sizes.thumbnail.sm }]}
        onPress={cycleMapType}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons
          name={mapType === 'standard' ? 'layers-outline' : mapType === 'satellite' ? 'satellite-variant' : 'map'}
          size={22}
          color={colors.primary}
        />
      </TouchableOpacity>

      {/* Recenter button */}
      <TouchableOpacity
        style={[styles.recenterBtn, { backgroundColor: colors.background, bottom: recenterBottomOffset }]}
        onPress={() => { if (gpsLocation) centerMapOnUser(600); else void refreshHereLocation(); }}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="crosshairs-gps" size={22} color={colors.primary} />
      </TouchableOpacity>

      {/* ── V2 Bottom Sheet ─────────────────────────────────────────────── */}
      <CustomerBottomSheet
        activeCard={activeCard}
        onCloseBooking={handleCloseBooking}
        onSheetHeightChange={setSheetHeight}
        colors={colors}
        bottomPadding={BOOKING_SHEET_BOTTOM_PADDING + computeTabBarHeight(insets.bottom)}
        homeCard={{
          userName: user?.name?.split(' ')[0] ?? '',
          locationStatus,
          selectedVehicle,
          onSelectVehicle: setSelectedVehicle,
          onContinue: handleOpenBooking,
          onRetryLocation: () => void refreshHereLocation(),
          onSelectPickupManually: () => {
            handleOpenBooking();
            openLocationSearch('pickup');
          },
        }}
        bookingCard={{
          pickup,
          destination,
          destinationText: destText,
          focusedField,
          userLocation: { ...userLocation, address: '', locationType: 'generic' },
          gpsLocation,
          onOpenLocationSearch: openLocationSearch,
          onUseMap: (target, location) => {
            const selectedLocation = target === 'dropoff'
              ? (destination ?? gpsLocation ?? userLocation ?? location)
              : (pickup.locationType !== 'generic' ? pickup : (gpsLocation ?? userLocation ?? location));
            const selectedAddress = (() => {
              const candidate = selectedLocation as { address?: unknown };
              return typeof candidate.address === 'string' ? candidate.address : '';
            })();

            router.push({
              pathname: '/map-picker',
              params: {
                target,
                mode: 'booking',
                initialLatitude: selectedLocation.latitude.toString(),
                initialLongitude: selectedLocation.longitude.toString(),
                initialAddress: selectedAddress,
              },
            });
          },
          onUseGpsPickup: () => gpsLocation && setPickup({
            ...gpsLocation,
            address: 'Current Location',
            locationType: 'precise',
          }),
          onUseGpsDestination: () => {
            if (!gpsLocation) return;
            setDestText('Current Location');
            setDestination({ ...gpsLocation, address: 'Current Location', locationType: 'precise' });
          },
          route,
          routeLoading,
          distance: dist,
          estimatedFare,
          estimatedFareLoading,
          onBook: handleBook,
          booking: bookLoading,
        }}
      />
      {/* Location search is now a separate route page: app/location-search.tsx */}
    </View>
  );
}
