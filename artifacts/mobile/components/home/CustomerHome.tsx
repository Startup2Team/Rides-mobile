import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Keyboard,
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
import { type CloseButtonHandle } from '@/components/BackButton';
import { EditSavedLocationSheet } from '@/components/EditSavedLocationSheet';
import { HomeTopHeader } from '@/components/HomeTopHeader';
import { CUSTOMER_VEHICLE_TYPES } from '@/constants/vehicles';
import { VehicleTypeIcon } from '@/components/VehicleTypeIcon';
import { useColors } from '@/hooks/useColors';
import { useRoutePreview } from '@/hooks/home/useRoutePreview';
import { useKeyboardHandling } from '@/hooks/home/useKeyboardHandling';
import { useHomeBooking } from '@/hooks/home/useHomeBooking';
import { useHomeLocation } from '@/hooks/home/useHomeLocation';
import { useLocationSearch, type LocationSearchTarget } from '@/hooks/home/useLocationSearch';
import { useSavedLocationEditor } from '@/hooks/home/useSavedLocationEditor';
import { useAuth } from '@/context/AuthContext';
import { useRide } from '@/context/RideContext';
import { useSavedLocations } from '@/hooks/useSavedLocations';
import { useToast } from '@/context/ToastContext';
import { getDriverVerificationStatus } from '@/utils/driverVerification';
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
  VEHICLE_LABELS,
} from '@/types';
import { BookingSheet } from './BookingSheet';
import { HomeMap } from './HomeMap';
import { LocationSearchOverlay } from './LocationSearchOverlay';
import { MapPickerOverlay } from './MapPickerOverlay';
import { SaveLocationSheet } from './SaveLocationSheet';
import { styles } from './homeStyles';
import {
  COMPACT_PANEL_HEIGHT,
  DRIVER_OFFSETS,
  EXPANDED_PANEL_HEIGHT,
  HOME_FLOATING_PANEL_FALLBACK_HEIGHT,
  HOME_LOCATION_DELTA,
  HOME_TAB_BAR_HEIGHT,
  MAP_TYPES,
  type AppMapType,
  type MapPickerTarget,
  SCREEN_HEIGHT,
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
  const locationSearchInputRef = useRef<TextInput>(null);
  const hasCenteredOnUserRef = useRef(false);
  const cancelledSearchDraftRef = useRef(cancelledSearchDraft);
  cancelledSearchDraftRef.current = cancelledSearchDraft;
  const [showBooking, setShowBooking] = useState(false);
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
  const locationSearch = useLocationSearch(userLocation);
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
    onBeforeCreate: useCallback(() => setShowBooking(true), []),
    openLocationSearch: requestLocationSearch,
    userLocation,
  });
  pickupSetterRef.current = setPickup;
  const {
    buildTypedLocation,
    cancelPendingSearch,
    clearText: clearLocationSearchText,
    close: closeLocationSearchState,
    handleTextChange: handleLocationSearchText,
    listTab: locationListTab,
    loading: locationSearchLoading,
    open: openLocationSearchState,
    resetResults: resetLocationSearchResults,
    scheduleSearch: schedulePlaceSearch,
    setListTab: setLocationListTab,
    setLoading: setLocationSearchLoading,
    setSuggestions,
    suggestions,
    target: locationSearchTarget,
    text: locationSearchText,
  } = locationSearch;
  const {
    applyEditSavedAddressSuggestion,
    applyEditTypedAddress,
    closeEditSavedLocation,
    closePendingSaveLocation,
    confirmDeleteSavedLocation,
    customSaveLabel,
    editSavedFieldErrors,
    editingSavedAddress,
    editingSavedFocusedField,
    editingSavedLabel,
    editingSavedLocation,
    handleEditSavedAddressText,
    handleSaveLocationLabelPress,
    isCustomSaveLabel,
    pendingSaveLocation,
    renameSavedLocation,
    resetEditor: resetSavedLocationEditor,
    saveLocationAs,
    setCustomSaveLabel,
    setEditSavedFieldErrors,
    setEditingSavedAddress,
    setEditingSavedFocusedField,
    setEditingSavedLabel,
    setEditingSavedLocation,
    setPendingSaveLocation,
    showEditAddressSuggestions,
    showSavedLocationActions,
  } = useSavedLocationEditor({
    onLocationSaved: useCallback(() => setLocationListTab('saved'), [setLocationListTab]),
    persistSavedPlaces,
    resetSearchResults: resetLocationSearchResults,
    saveLocation,
    savedPlaces,
    schedulePlaceSearch,
    setSearchLoading: setLocationSearchLoading,
    setSuggestions,
    showToast,
    userLocation,
  });
  const [mapType, setMapType] = useState<AppMapType>('standard');
  const [homePanelHeight, setHomePanelHeight] = useState(HOME_FLOATING_PANEL_FALLBACK_HEIGHT);
  const [isMapReady, setIsMapReady] = useState(false);

  // Booking sheet state
  const [mapPicker, setMapPicker] = useState<MapPickerTarget | null>(null);
  const [pinCoords, setPinCoords] = useState(KIGALI_CENTER);
  const [pickerMapSize, setPickerMapSize] = useState({ width: 0, height: 0 });
  const [isPickerDragging, setIsPickerDragging] = useState(false);
  const [focusedField, setFocusedField] = useState<'pickup' | 'dropoff' | null>(null);
  const [routeRecenterRequest, setRouteRecenterRequest] = useState(0);
  const sheetAnim = useRef(new Animated.Value(EXPANDED_PANEL_HEIGHT)).current;
  const sheetDragStart = useRef(0);
  const bookingCloseRef = useRef<CloseButtonHandle>(null);
  const saveFormCloseRef = useRef<CloseButtonHandle>(null);
  const activePanelHeightRef = useRef(COMPACT_PANEL_HEIGHT);
  const closeBookingRef = useRef<() => void>(() => {});
  const saveSheetKeyboardAnim = useRef(new Animated.Value(0)).current;
  const formSheetDragAnim = useRef(new Animated.Value(0)).current;
  const formSheetDragStart = useRef(0);
  const formSheetHeightRef = useRef(280);
  const [formSheetMeasuredHeight, setFormSheetMeasuredHeight] = useState(280);
  const closePendingSaveLocationRef = useRef<() => void>(() => {});
  const dismissFormSheetAnimatedRef = useRef<(close: () => void, onAnimateStart?: () => void) => void>(() => {});
  const formSheetBackdropOpacity = useMemo(
    () =>
      formSheetDragAnim.interpolate({
        inputRange: [0, Math.max(formSheetMeasuredHeight, 1)],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      }),
    [formSheetDragAnim, formSheetMeasuredHeight],
  );
  const hasRideActions = destination !== null || destText.trim().length > 0;
  const activePanelHeight = hasRideActions ? EXPANDED_PANEL_HEIGHT : COMPACT_PANEL_HEIGHT;
  const bookingPanelMapInset = activePanelHeight;
  const homePanelNavPadding = Platform.OS === 'web'
    ? HOME_TAB_BAR_HEIGHT + 20
    : HOME_TAB_BAR_HEIGHT + insets.bottom;
  const homePanelBottomInset = 0;
  const homePanelMapInset = homePanelHeight + homePanelBottomInset;
  const recenterBottomOffset = showBooking ? bookingPanelMapInset + 16 : homePanelMapInset + 16;
  const hasPreciseRouteLocations =
    showBooking &&
    destination !== null &&
    pickup.locationType !== 'generic' &&
    destination.locationType !== 'generic';
  const pickupOverlapsUser = gpsLocation
    ? getCoordDistance(pickup, gpsLocation) < 20
    : false;
  const shouldShowPickupMarker =
    showBooking
    && hasUsablePickup(pickup)
    && (!pickupOverlapsUser || destination !== null);
  const cycleMapType = () => {
    setMapType(prev => MAP_TYPES[(MAP_TYPES.indexOf(prev) + 1) % MAP_TYPES.length]);
  };

  const centerMapOnUser = useCallback((duration = 700, panelHeightOverride?: number) => {
    if (!gpsLocation) return;
    const panelHeight = panelHeightOverride ?? (showBooking ? bookingPanelMapInset : homePanelMapInset);
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
  }, [
    bookingPanelMapInset,
    homePanelMapInset,
    gpsLocation,
    showBooking,
  ]);

  const centerPickerOnUser = () => {
    if (!gpsLocation) return;
    pickerMapRef.current?.animateToRegion(
      {
        ...gpsLocation,
        latitudeDelta: HOME_LOCATION_DELTA,
        longitudeDelta: HOME_LOCATION_DELTA,
      },
      500,
    );
  };

  /** Map center under the picker pin stem tip (matches LocationMapPin anchor 0.5, 1). */
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
        setPinCoords({
          latitude: regionFallback.latitude,
          longitude: regionFallback.longitude,
        });
      }
    },
    [pickerMapSize.height, pickerMapSize.width],
  );

  useEffect(() => {
    if (mapPicker === null) return;
    void syncPickerCoordsFromMapCenter();
  }, [mapPicker, pickerMapSize.height, pickerMapSize.width, syncPickerCoordsFromMapCenter]);

  const applyCancelledSearchDraft = useCallback(
    (draft: BookingFormDraft) => {
      setSelectedVehicle(draft.vehicleType);
      setPickup({ ...draft.pickup });
      setDestination({ ...draft.destination });
      setDestText(draft.destText);
      setSuggestions([]);
      setShowBooking(true);
      sheetAnim.setValue(0);
      setRouteRecenterRequest(value => value + 1);
    },
    [sheetAnim],
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
      setSuggestions([]);
      setShowBooking(true);
      sheetAnim.setValue(0);
      setRouteRecenterRequest(value => value + 1);
    }

    clearRestoreBookingOnHomeFocus();
  }, [
    applyCancelledSearchDraft,
    cancelledSearchDraft,
    clearRestoreBookingOnHomeFocus,
    currentRide,
    restoreBookingOnHomeFocus,
    sheetAnim,
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

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (locationStatus !== 'available' || hasCenteredOnUserRef.current || hasPreciseRouteLocations) return;
    hasCenteredOnUserRef.current = true;
    requestAnimationFrame(() => centerMapOnUser());
  }, [centerMapOnUser, hasPreciseRouteLocations, locationStatus]);

  useFocusEffect(
    useCallback(() => {
      void reloadSavedPlaces();
    }, [reloadSavedPlaces]),
  );

  useFocusEffect(
    useCallback(() => {
      if (locationStatus !== 'available') return undefined;
      void startHereLocationWatch();
      return stopHereLocationWatch;
    }, [
      locationStatus,
      startHereLocationWatch,
      stopHereLocationWatch,
    ]),
  );

  const {
    applyLift: applySaveFormKeyboardLift,
    estimatedKeyboardOffset,
  } = useKeyboardHandling({
    enabled: Boolean(pendingSaveLocation),
    bottomInset: insets.bottom,
    animation: saveSheetKeyboardAnim,
  });

  useEffect(() => {
    if (!pendingSaveLocation) return;
    formSheetDragAnim.setValue(formSheetHeightRef.current);
    Animated.spring(formSheetDragAnim, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
  }, [pendingSaveLocation, formSheetDragAnim]);

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
    bookingPanelMapInset,
    topInset: insets.top,
    bottomInset: insets.bottom,
    routeRecenterRequest,
  });
  const shouldShowYouAreHere =
    locationStatus === 'available'
    && mapPicker === null
    && (!showBooking || !shouldShowBookingRoute);

  const openBooking = () => {
    setShowBooking(true);
    Animated.spring(sheetAnim, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
  };

  const doCloseBooking = useCallback(() => {
    clearCancelledSearchDraft();
    bookingCloseRef.current?.spinShut();
    Animated.timing(sheetAnim, { toValue: activePanelHeight, duration: 250, useNativeDriver: true }).start(() => {
      setShowBooking(false);
      setDestText('');
      setDestination(null);
      setSuggestions([]);
      clearRoutePreview();
      setPickup(gpsLocation
        ? {
            ...gpsLocation,
            address: currentLocationAddress || 'Current Location',
            locationType: 'precise',
          }
        : { ...KIGALI_CENTER, address: '', locationType: 'generic' });
      if (gpsLocation) requestAnimationFrame(() => centerMapOnUser(400, homePanelMapInset));
    });
  }, [
    activePanelHeight,
    clearCancelledSearchDraft,
    clearRoutePreview,
    currentLocationAddress,
    gpsLocation,
    homePanelMapInset,
    sheetAnim,
  ]);

  const snapBookingSheetOpen = () => {
    bookingCloseRef.current?.spinOpen();
    Animated.spring(sheetAnim, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
  };

  const closeBooking = () => {
    sheetAnim.stopAnimation();
    if (destination !== null || destText.trim().length > 0) {
      Alert.alert(
        'Cancel search?',
        'Why are you closing the booking form?',
        [
          { text: 'Changed my plans', onPress: doCloseBooking },
          { text: 'Wrong location selected', onPress: doCloseBooking },
          { text: 'Need a different vehicle', onPress: doCloseBooking },
          { text: 'Keep searching', style: 'cancel', onPress: snapBookingSheetOpen },
        ],
      );
    } else {
      doCloseBooking();
    }
  };

  closeBookingRef.current = closeBooking;
  activePanelHeightRef.current = activePanelHeight;

  const bookingSheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          gestureState.dy > 6 && gestureState.dy > Math.abs(gestureState.dx),
        onMoveShouldSetPanResponderCapture: (_, gestureState) =>
          gestureState.dy > 8 && gestureState.dy > Math.abs(gestureState.dx) * 1.2,
        onPanResponderGrant: () => {
          Keyboard.dismiss();
          sheetAnim.stopAnimation(value => {
            sheetDragStart.current = value;
          });
        },
        onPanResponderMove: (_, gestureState) => {
          const max = activePanelHeightRef.current;
          const next = Math.max(0, Math.min(max, sheetDragStart.current + gestureState.dy));
          sheetAnim.setValue(next);
          if (max > 0) {
            bookingCloseRef.current?.setSpinProgress(1 - next / max);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          const max = activePanelHeightRef.current;
          const current = Math.max(0, Math.min(max, sheetDragStart.current + gestureState.dy));
          const shouldClose = current > max * 0.28 || gestureState.vy > 0.65;
          const hadVerticalDrag = Math.abs(gestureState.dy) > 8;
          if (shouldClose) {
            closeBookingRef.current();
          } else if (hadVerticalDrag) {
            snapBookingSheetOpen();
          }
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [sheetAnim],
  );

  const openLocationSearch = (target: 'pickup' | 'dropoff') => {
    setFocusedField(target);
    openLocationSearchState(target, target === 'pickup' ? pickup.address ?? '' : destText);
  };
  openLocationSearchRef.current = openLocationSearch;

  const closeLocationSearch = () => {
    closeLocationSearchState();
    resetSavedLocationEditor();
    Keyboard.dismiss();
  };

  const applyLocation = (target: 'pickup' | 'dropoff', location: RideLocation) => {
    if (target === 'pickup') {
      setPickup(location);
    } else {
      setDestText(location.address ?? '');
      setDestination(location);
    }
    closeLocationSearch();
  };

  closePendingSaveLocationRef.current = closePendingSaveLocation;

  const snapFormSheetOpen = useCallback((onSnapOpen?: () => void) => {
    onSnapOpen?.();
    Animated.spring(formSheetDragAnim, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
  }, [formSheetDragAnim]);

  const dismissFormSheetAnimated = useCallback(
    (close: () => void, onAnimateStart?: () => void) => {
      onAnimateStart?.();
      const max = formSheetHeightRef.current;
      Animated.timing(formSheetDragAnim, {
        toValue: max,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        close();
      });
    },
    [formSheetDragAnim],
  );

  dismissFormSheetAnimatedRef.current = dismissFormSheetAnimated;

  const createFormSheetPanResponder = useCallback(
    (
      close: () => void,
      onDismissStart?: () => void,
      onDragProgress?: (progress: number) => void,
      onSnapOpen?: () => void,
    ) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          gestureState.dy > 6 && gestureState.dy > Math.abs(gestureState.dx),
        onMoveShouldSetPanResponderCapture: (_, gestureState) =>
          gestureState.dy > 8 && gestureState.dy > Math.abs(gestureState.dx) * 1.2,
        onPanResponderGrant: () => {
          Keyboard.dismiss();
          formSheetDragAnim.stopAnimation(value => {
            formSheetDragStart.current = value;
          });
        },
        onPanResponderMove: (_, gestureState) => {
          const max = formSheetHeightRef.current;
          const next = Math.max(0, Math.min(max, formSheetDragStart.current + gestureState.dy));
          formSheetDragAnim.setValue(next);
          if (max > 0) {
            onDragProgress?.(1 - next / max);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          const max = formSheetHeightRef.current;
          const current = Math.max(0, Math.min(max, formSheetDragStart.current + gestureState.dy));
          const shouldClose = current > max * 0.28 || gestureState.vy > 0.65;
          const hadVerticalDrag = Math.abs(gestureState.dy) > 8;
          if (shouldClose) {
            dismissFormSheetAnimatedRef.current(close, onDismissStart);
          } else if (hadVerticalDrag) {
            snapFormSheetOpen(onSnapOpen);
          }
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [formSheetDragAnim, snapFormSheetOpen],
  );

  const dismissSaveFormSheet = useCallback(
    () => dismissFormSheetAnimated(
      () => closePendingSaveLocationRef.current(),
      () => saveFormCloseRef.current?.spinShut(),
    ),
    [dismissFormSheetAnimated],
  );

  const saveFormSheetPanResponder = useMemo(
    () => createFormSheetPanResponder(
      () => closePendingSaveLocationRef.current(),
      () => saveFormCloseRef.current?.spinShut(),
      progress => saveFormCloseRef.current?.setSpinProgress(progress),
      () => saveFormCloseRef.current?.spinOpen(),
    ),
    [createFormSheetPanResponder],
  );

  const openSavedLocationMap = () => {
    if (!editingSavedLocation) return;
    Keyboard.dismiss();
    setPinCoords(userLocation);
    setMapPicker('savedLocation');
  };

  const deleteSavedLocation = () => {
    if (!editingSavedLocation) return;
    confirmDeleteSavedLocation(editingSavedLocation);
  };

  const handleChooseOnMap = () => {
    if (!locationSearchTarget) return;
    const coords = locationSearchTarget === 'dropoff'
      ? (destination ?? userLocation)
      : { latitude: pickup.latitude, longitude: pickup.longitude };
    setPinCoords({ latitude: coords.latitude, longitude: coords.longitude });
    setMapPicker(locationSearchTarget);
    closeLocationSearch();
  };

  const visibleDrivers = useMemo(() => {
    return DRIVER_OFFSETS.map((offset, i) => ({
      id: `nearby-driver-${i}`,
      latitude: userLocation.latitude + offset.lat,
      longitude: userLocation.longitude + offset.lng,
    }));
  }, [userLocation.latitude, userLocation.longitude]);

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
    const latitudeOffset = (homePanelMapInset / (2 * SCREEN_HEIGHT)) * HOME_LOCATION_DELTA;
    return {
      latitude: userLocation.latitude - latitudeOffset,
      longitude: userLocation.longitude,
      latitudeDelta: HOME_LOCATION_DELTA,
      longitudeDelta: HOME_LOCATION_DELTA,
    };
  }, [homePanelMapInset, userLocation.latitude, userLocation.longitude]);
  const handleHomeMapReady = useCallback(() => {
    setIsMapReady(true);
    if (routeFitCoords.length > 1 && showBooking && destination) {
      requestAnimationFrame(() =>
        centerRouteInVisibleMap(routeFitCoords, EXPANDED_PANEL_HEIGHT),
      );
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

      {locationSearchTarget === null && mapPicker === null ? (
        <HomeTopHeader
          paddingTop={insets.top + (Platform.OS === 'web' ? 67 : 0) + 12}
          locationText={currentLocationAddress}
          locLoading={locLoading}
          profileInitial={user?.name?.trim()?.[0]?.toUpperCase() ?? '?'}
          driverVerificationStatus={getDriverVerificationStatus(driverProfile)}
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
        onPress={() => {
          if (gpsLocation) centerMapOnUser(600);
          else void refreshHereLocation();
        }}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="crosshairs-gps" size={22} color={colors.primary} />
      </TouchableOpacity>

      {/* Home bottom panel */}
      {!showBooking && (
        <View
          onLayout={event => {
            const height = event.nativeEvent.layout.height;
            if (height > 0) setHomePanelHeight(height);
          }}
          style={[
            styles.bottomPanel,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              paddingBottom: homePanelNavPadding,
            },
          ]}
        >
          <Text style={[styles.greeting, { color: colors.foreground }]}>
            Hi {user?.name?.split(' ')[0]} 👋
          </Text>
          <Text style={[styles.selectRide, { color: colors.mutedForeground }]}>
            Select your ride
          </Text>
          {locationStatus === 'unavailable' ? (
            <View style={[styles.locationUnavailable, { backgroundColor: colors.muted }]}>
              <Text style={[styles.locationUnavailableText, { color: colors.foreground }]}>
                Unable to determine your location.
              </Text>
              <View style={styles.locationUnavailableActions}>
                <TouchableOpacity onPress={() => void refreshHereLocation()} activeOpacity={0.75}>
                  <Text style={[styles.locationUnavailableAction, { color: colors.primary }]}>
                    Retry location
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    openBooking();
                    requestLocationSearch('pickup');
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.locationUnavailableAction, { color: colors.primary }]}>
                    Select pickup manually
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
          <View style={styles.vehicleRow}>
            {CUSTOMER_VEHICLE_TYPES.map(v => (
              <TouchableOpacity
                key={v}
                style={[styles.vehicleChip, { backgroundColor: selectedVehicle === v ? colors.primary : colors.muted, borderWidth: selectedVehicle === v ? 0 : 1, borderColor: colors.border }]}
                onPress={() => setSelectedVehicle(v)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={VEHICLE_LABELS[v]}
                accessibilityState={{ selected: selectedVehicle === v }}
              >
                <VehicleTypeIcon type={v} selected={selectedVehicle === v} />
                <Text style={[styles.vehicleLabel, { color: selectedVehicle === v ? colors.primaryForeground : colors.foreground }]}>
                  {VEHICLE_LABELS[v]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={[styles.continueBtn, { backgroundColor: colors.primary }]} onPress={openBooking} activeOpacity={0.85}>
            <Text style={[styles.continueBtnText, { color: colors.primaryForeground }]}>
              Continue with {VEHICLE_LABELS[selectedVehicle]}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <BookingSheet
        visible={showBooking}
        height={activePanelHeight}
        bottomPadding={homePanelNavPadding}
        colors={colors}
        animation={sheetAnim}
        panResponder={bookingSheetPanResponder}
        closeButtonRef={bookingCloseRef}
        onClose={closeBooking}
        pickup={pickup}
        destination={destination}
        destinationText={destText}
        focusedField={focusedField}
        userLocation={{ ...userLocation, address: '', locationType: 'generic' }}
        gpsLocation={gpsLocation}
        onOpenLocationSearch={openLocationSearch}
        onUseMap={(target, location) => {
          setPinCoords({ latitude: location.latitude, longitude: location.longitude });
          setMapPicker(target);
        }}
        onUseGpsPickup={() => gpsLocation && setPickup({
          ...gpsLocation,
          address: 'Current Location',
          locationType: 'precise',
        })}
        onUseGpsDestination={() => {
          if (!gpsLocation) return;
          setDestText('Current Location');
          setDestination({
            ...gpsLocation,
            address: 'Current Location',
            locationType: 'precise',
          });
        }}
        route={route}
        routeLoading={routeLoading}
        distance={dist}
        onBook={handleBook}
        booking={bookLoading}
      />
      {/* Map picker â€” full screen pin drag */}
      {locationSearchTarget && (
        <LocationSearchOverlay
          bottomInset={insets.bottom}
          buildTypedLocation={buildTypedLocation}
          colors={colors}
          inputRef={locationSearchInputRef}
          listTab={locationListTab}
          loading={locationSearchLoading}
          onApplyLocation={applyLocation}
          onChooseMap={handleChooseOnMap}
          onClear={clearLocationSearchText}
          onClose={closeLocationSearch}
          onSaveCandidate={setPendingSaveLocation}
          onSetListTab={setLocationListTab}
          onShowSavedLocationActions={showSavedLocationActions}
          onTextChange={handleLocationSearchText}
          recentLocations={recentLocations}
          savedLocations={savedLocations}
          suggestions={suggestions}
          target={locationSearchTarget}
          text={locationSearchText}
          userLocation={userLocation}
          gpsLocation={gpsLocation}
        >
          <SaveLocationSheet
            animatedOpacity={formSheetBackdropOpacity}
            bottomInset={insets.bottom}
            closeButtonRef={saveFormCloseRef}
            colors={colors}
            customLabel={customSaveLabel}
            dragAnimation={formSheetDragAnim}
            estimatedKeyboardOffset={estimatedKeyboardOffset}
            keyboardAnimation={saveSheetKeyboardAnim}
            onClose={dismissSaveFormSheet}
            onCustomLabelChange={setCustomSaveLabel}
            onKeyboardLift={applySaveFormKeyboardLift}
            onLayoutHeight={height => {
              formSheetHeightRef.current = height;
              setFormSheetMeasuredHeight(height);
            }}
            onSave={label => { void saveLocationAs(label); }}
            onSelectLabel={handleSaveLocationLabelPress}
            panResponder={saveFormSheetPanResponder}
            pendingLocation={pendingSaveLocation}
            showCustomLabel={isCustomSaveLabel}
            surfaceStyle={formSheetSurface}
          />
          {editingSavedLocation && (
            <EditSavedLocationSheet
              location={editingSavedLocation}
              label={editingSavedLabel}
              address={editingSavedAddress}
              fieldErrors={editSavedFieldErrors}
              suggestions={suggestions}
              searchLoading={locationSearchLoading}
              showAddressSuggestions={showEditAddressSuggestions}
              onLabelChange={text => {
                setEditingSavedLabel(text);
                setEditSavedFieldErrors(prev => ({ ...prev, label: undefined }));
              }}
              onAddressChange={text => {
                handleEditSavedAddressText(text);
                setEditSavedFieldErrors(prev => ({ ...prev, address: undefined }));
              }}
              onLabelFocus={() => setEditingSavedFocusedField('label')}
              onAddressFocus={() => {
                setEditingSavedFocusedField('address');
                if (editingSavedAddress.trim().length >= 2) {
                  schedulePlaceSearch(editingSavedAddress);
                }
              }}
              onClearAddress={() => {
                cancelPendingSearch();
                setEditingSavedAddress('');
                setEditSavedFieldErrors(prev => ({ ...prev, address: undefined }));
                setSuggestions([]);
                setLocationSearchLoading(false);
              }}
              onSelectSuggestion={applyEditSavedAddressSuggestion}
              onUseTypedAddress={applyEditTypedAddress}
              onSave={renameSavedLocation}
              onDelete={deleteSavedLocation}
              onUseGps={openSavedLocationMap}
              onClose={closeEditSavedLocation}
            />
          )}
        </LocationSearchOverlay>
      )}

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
        onClose={() => setMapPicker(null)}
        onCycleMapType={cycleMapType}
        onCenterUser={centerPickerOnUser}
        onConfirm={async () => {
          await syncPickerCoordsFromMapCenter();
          let address =
            mapPicker === 'pickup'
              ? 'Selected Pickup'
              : mapPicker === 'savedLocation'
                ? 'Selected Saved Location'
                : 'Selected Drop Off';
          try {
            const [geo] = await Location.reverseGeocodeAsync(pinCoords).catch(() => [null]);
            if (geo) address = formatReverseGeocodeAddress(geo, address);
          } catch {}
          if (mapPicker === 'pickup') {
            setPickup({ ...pinCoords, address, locationType: 'precise' });
          } else if (mapPicker === 'dropoff') {
            setDestText(address);
            setDestination({ ...pinCoords, address, locationType: 'precise' });
          } else if (editingSavedLocation) {
            const updated: SavedLocation = {
              ...editingSavedLocation,
              ...pinCoords,
              address,
              locationType: 'precise',
            };
            const next = savedPlaces.map(place =>
              place.id === editingSavedLocation.id ? updated : place
            );
            await persistSavedPlaces(next);
            setEditingSavedLocation(updated);
            setEditingSavedAddress(address);
            showToast('Location updated', 'info');
          }
          setMapPicker(null);
        }}
      />
    </View>
  );
}
