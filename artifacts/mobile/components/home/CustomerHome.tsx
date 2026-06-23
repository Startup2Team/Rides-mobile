import * as Location from 'expo-location';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import MapView, { type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { HomeTopHeader } from '@/components/HomeTopHeader';
import { useColors } from '@/hooks/useColors';
import { useRoutePreview } from '@/hooks/home/useRoutePreview';
import { useHomeBooking } from '@/hooks/home/useHomeBooking';
import { useHomeLocation } from '@/hooks/home/useHomeLocation';
import type { LocationSearchTarget } from '@/hooks/home/useLocationSearch';
import { useAuth } from '@/context/AuthContext';
import { useRide } from '@/context/RideContext';
import { useSavedLocations } from '@/hooks/useSavedLocations';
import { useToast } from '@/context/ToastContext';
import { canAccessDriverMode, getDriverVerificationStatus } from '@/utils/driverVerification';
import {
  formatReverseGeocodeAddress,
  getCoordDistance,
  hasUsablePickup,
} from '@/utils/locationUtils';
import {
  BookingFormDraft,
  KIGALI_CENTER,
  RideLocation,
  SavedLocation,
} from '@/types';
import { loadStoredDriverOnboardingDraft } from '@/persistence/driverOnboardingPersistence';
import { CustomerBottomSheet } from './CustomerBottomSheet';
import { HomeMap } from './HomeMap';
// Search overlay is navigated via /location-search route
import { MapPickerOverlay } from './MapPickerOverlay';
import { styles } from './homeStyles';
import {
  BOOKING_SHEET_BOTTOM_PADDING,
  DRIVER_OFFSETS,
  HOME_FLOATING_PANEL_FALLBACK_HEIGHT,
  HOME_LOCATION_DELTA,
  MAP_TYPES,
  type AppMapType,
  type MapPickerTarget,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
} from './homeUtils';

export default function CustomerHome() {
  const colors = useColors();
  const isDark = useColorScheme() === 'dark';
  const { savedPlaces, saveLocation, persistSavedPlaces, reload: reloadSavedPlaces } = useSavedLocations();
  const { showToast } = useToast();
  const formSheetSurface = useMemo(
    () => ({
      backgroundColor: colors.card,
      shadowOpacity: isDark ? 0.55 : 0.25,
    }),
    [colors.card, isDark],
  );
  const insets = useSafeAreaInsets();
  const { user, driverProfile } = useAuth();
  const {
    currentRide,
    createRide,
    rideHistory,
    loadHistory,
    cancelledSearchDraft,
    restoreBookingOnHomeFocus,
    clearCancelledSearchDraft,
    clearRestoreBookingOnHomeFocus,
  } = useRide();
  const mapRef = useRef<MapView>(null);
  const pickerMapRef = useRef<MapView>(null);
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
  const openLocationSearchRef = useRef<(target: LocationSearchTarget) => void>(() => {});
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
  const requestLocationSearch = useCallback((target: LocationSearchTarget) => {
    openLocationSearchRef.current(target);
  }, []);
  const {
    bookLoading,
    destText,
    destination,
    distance: dist,
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
    openLocationSearch: requestLocationSearch,
    userLocation,
  });
  pickupSetterRef.current = setPickup;

  const { triggerMapPicker } = useLocalSearchParams<{ triggerMapPicker?: 'pickup' | 'dropoff' }>();

  useEffect(() => {
    if (triggerMapPicker) {
      const target = triggerMapPicker;
      router.setParams({ triggerMapPicker: undefined });
      const coords = target === 'dropoff'
        ? (destination ?? userLocation)
        : { latitude: pickup.latitude, longitude: pickup.longitude };
      setPinCoords({ latitude: coords.latitude, longitude: coords.longitude });
      setMapPicker(target);
    }
  }, [triggerMapPicker, destination, userLocation, pickup]);

  const [mapType, setMapType] = useState<AppMapType>('standard');
  const [isMapReady, setIsMapReady] = useState(false);
  const [driverApplicationDraftUpdatedAt, setDriverApplicationDraftUpdatedAt] = useState<string | null>(null);

  // Overlay state (map picker, location search)
  const [mapPicker, setMapPicker] = useState<MapPickerTarget | null>(null);
  const [pinCoords, setPinCoords] = useState(KIGALI_CENTER);
  const [pickerMapSize, setPickerMapSize] = useState({ width: 0, height: 0 });
  const [isPickerDragging, setIsPickerDragging] = useState(false);
  const [focusedField, setFocusedField] = useState<'pickup' | 'dropoff' | null>(null);
  const [routeRecenterRequest, setRouteRecenterRequest] = useState(0);

  // Animation translation refs
  const pickerTranslateX = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  useEffect(() => {
    if (mapPicker !== null) {
      pickerTranslateX.setValue(SCREEN_WIDTH);
      Animated.timing(pickerTranslateX, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [mapPicker, pickerTranslateX]);



  // ── Derived / layout ──────────────────────────────────────────────────────
  const recenterBottomOffset = sheetHeight + 16;
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

  const centerPickerOnUser = () => {
    if (!gpsLocation) return;
    pickerMapRef.current?.animateToRegion(
      { ...gpsLocation, latitudeDelta: HOME_LOCATION_DELTA, longitudeDelta: HOME_LOCATION_DELTA },
      500,
    );
  };

  const syncPickerCoordsFromMapCenter = useCallback(
    async (regionFallback?: Region) => {
      const map = pickerMapRef.current;
      if (map && pickerMapSize.width > 0 && pickerMapSize.height > 0) {
        try {
          const coord = await map.coordinateForPoint({
            x: pickerMapSize.width / 2,
            y: pickerMapSize.height / 2,
          });
          setPinCoords({ latitude: coord.latitude, longitude: coord.longitude });
          return;
        } catch {
          // fall through to region center
        }
      }
      if (regionFallback) {
        setPinCoords({ latitude: regionFallback.latitude, longitude: regionFallback.longitude });
      }
    },
    [pickerMapSize.height, pickerMapSize.width],
  );

  useEffect(() => {
    if (mapPicker === null) return;
    void syncPickerCoordsFromMapCenter();
  }, [mapPicker, pickerMapSize.height, pickerMapSize.width, syncPickerCoordsFromMapCenter]);

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
  });

  const shouldShowYouAreHere =
    locationStatus === 'available' && mapPicker === null && (!showBooking || !shouldShowBookingRoute);

  const openLocationSearch = (target: 'pickup' | 'dropoff') => {
    setFocusedField(target);
    router.push({
      pathname: '/location-search',
      params: {
        target,
        userLatitude: userLocation.latitude.toString(),
        userLongitude: userLocation.longitude.toString(),
        gpsLatitude: gpsLocation ? gpsLocation.latitude.toString() : '',
        gpsLongitude: gpsLocation ? gpsLocation.longitude.toString() : '',
        gpsAddress: gpsLocation ? gpsLocation.address || '' : '',
      },
    });
  };
  openLocationSearchRef.current = openLocationSearch;

  const closeMapPicker = useCallback(() => {
    Animated.timing(pickerTranslateX, {
      toValue: SCREEN_WIDTH,
      duration: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setMapPicker(null);
      }
    });
  }, [pickerTranslateX]);

  const visibleDrivers = useMemo(() => DRIVER_OFFSETS.map((offset, i) => ({
    id: `nearby-driver-${i}`,
    latitude: userLocation.latitude + offset.lat,
    longitude: userLocation.longitude + offset.lng,
  })), [userLocation.latitude, userLocation.longitude]);

  const savedLocations = useMemo<SavedLocation[]>(() => savedPlaces, [savedPlaces]);
  const recentLocations = useMemo<RideLocation[]>(() => {
    const seen = new Set<string>();
    return rideHistory
      .flatMap(ride => [ride.pickup, ride.destination])
      .filter(location => {
        const key = location.address ?? `${location.latitude},${location.longitude}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 5);
  }, [rideHistory]);

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

  if (locLoading) {
    return (
      <View style={[styles.loaderContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loaderText, { color: colors.foreground }]}>
          Finding your pickup point
        </Text>
      </View>
    );
  }

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

      {mapPicker === null ? (
        <HomeTopHeader
          paddingTop={insets.top + (Platform.OS === 'web' ? 67 : 0) + 12}
          locationText={currentLocationAddress}
          locLoading={locLoading}
          profileInitial={user?.name?.trim()?.[0]?.toUpperCase() ?? '?'}
          driverVerificationStatus={getDriverVerificationStatus(driverProfile)}
          canSwitchToDriverMode={canAccessDriverMode(driverProfile)}
          driverApplicationDraftUpdatedAt={driverApplicationDraftUpdatedAt}
          driverApprovalAcknowledgedAt={driverProfile?.driverApprovalAcknowledgedAt ?? null}
        />
      ) : null}

      {/* Map layer button */}
      <TouchableOpacity
        style={[styles.mapLayerBtn, { backgroundColor: colors.card, bottom: recenterBottomOffset + 56 }]}
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
        style={[styles.recenterBtn, { backgroundColor: colors.card, bottom: recenterBottomOffset }]}
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
        bottomPadding={BOOKING_SHEET_BOTTOM_PADDING}
        homeCard={{
          userName: user?.name?.split(' ')[0] ?? '',
          locationStatus,
          selectedVehicle,
          onSelectVehicle: setSelectedVehicle,
          onContinue: handleOpenBooking,
          onRetryLocation: () => void refreshHereLocation(),
          onSelectPickupManually: () => {
            handleOpenBooking();
            requestLocationSearch('pickup');
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
            setPinCoords({ latitude: location.latitude, longitude: location.longitude });
            setMapPicker(target);
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
          onBook: handleBook,
          booking: bookLoading,
        }}
      />

      {/* Location search is now a separate route page: app/location-search.tsx */}

      <Modal
        visible={mapPicker !== null}
        animationType="none"
        transparent={true}
        onRequestClose={closeMapPicker}
      >
        {mapPicker && (
          <Animated.View style={{ flex: 1, transform: [{ translateX: pickerTranslateX }] }}>
            <MapPickerOverlay
              target={mapPicker}
              mapRef={pickerMapRef}
              pinCoords={pinCoords}
              mapType={mapType}
              colors={colors}
              topInset={insets.top}
              bottomInset={insets.bottom}
              isDragging={isPickerDragging}
              onLayout={(width, height) => setPickerMapSize({ width, height })}
              onDragStart={() => setIsPickerDragging(true)}
              onRegionChangeComplete={region => {
                setIsPickerDragging(false);
                void syncPickerCoordsFromMapCenter(region);
              }}
              onClose={closeMapPicker}
              onCycleMapType={cycleMapType}
              onCenterUser={centerPickerOnUser}
              onConfirm={async () => {
                await syncPickerCoordsFromMapCenter();
                let address = mapPicker === 'pickup' ? 'Selected Pickup' : 'Selected Drop Off';
                try {
                  const [geo] = await Location.reverseGeocodeAsync(pinCoords).catch(() => [null]);
                  if (geo) address = formatReverseGeocodeAddress(geo, address);
                } catch {}
                if (mapPicker === 'pickup') {
                  setPickup({ ...pinCoords, address, locationType: 'precise' });
                } else if (mapPicker === 'dropoff') {
                  setDestText(address);
                  setDestination({ ...pinCoords, address, locationType: 'precise' });
                }
                closeMapPicker();
              }}
            />
          </Animated.View>
        )}
      </Modal>
    </View>
  );
}
