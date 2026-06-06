import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Keyboard,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import MapView, { type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { CloseButton, type CloseButtonHandle } from '@/components/BackButton';
import { EditSavedLocationSheet } from '@/components/EditSavedLocationSheet';
import { HomeTopHeader } from '@/components/HomeTopHeader';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { GlassScrollView } from '@/components/GlassScrollView';
import { CUSTOMER_VEHICLE_TYPES } from '@/constants/vehicles';
import { VehicleTypeIcon } from '@/components/VehicleTypeIcon';
import { SheetBackdrop } from '@/components/SheetBackdrop';
import { useColors } from '@/hooks/useColors';
import { useRoutePreview } from '@/hooks/home/useRoutePreview';
import { useKeyboardHandling } from '@/hooks/home/useKeyboardHandling';
import { useAuth } from '@/context/AuthContext';
import { useRide } from '@/context/RideContext';
import { useSavedLocations } from '@/hooks/useSavedLocations';
import { useToast } from '@/context/ToastContext';
import { geocodeAddress, GeocodeSuggestion } from '@/services/geocoding';
import {
  arePickupAndDropoffSame,
  formatReverseGeocodeAddress,
  getCoordDistance,
  isPickupFarFromUserGps,
} from '@/utils/locationUtils';
import {
  BookingFormDraft,
  KIGALI_CENTER,
  RideLocation,
  SavedLocation,
  VehicleType,
  VEHICLE_LABELS,
} from '@/types';
import { BookingSheet } from './BookingSheet';
import { HomeMap } from './HomeMap';
import { MapPickerOverlay } from './MapPickerOverlay';
import { SavedLocationsSection } from './SavedLocationsSection';
import { styles } from './homeStyles';
import {
  calcEstFare,
  COMPACT_PANEL_HEIGHT,
  DRIVER_OFFSETS,
  EXPANDED_PANEL_HEIGHT,
  HOME_FLOATING_PANEL_FALLBACK_HEIGHT,
  HOME_LOCATION_DELTA,
  HOME_TAB_BAR_HEIGHT,
  MAP_TYPES,
  type AppMapType,
  type MapPickerTarget,
  SAVE_LABEL_CONTENT_INSET,
  SAVE_LABEL_GAP,
  SAVE_LABEL_SHEET_HORIZONTAL_PADDING,
  SAVE_LABEL_WIDTHS,
  SAVE_LOCATION_LABELS,
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
  const locationHeaderMetrics = useGlassHeaderMetrics();
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

  const [userLocation, setUserLocation] = useState(KIGALI_CENTER);
  /** GPS "where you are now" for the home header â€” independent of booking pickup. */
  const [currentLocationAddress, setCurrentLocationAddress] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleType>('moto');
  const [mapType, setMapType] = useState<AppMapType>('standard');
  const [homePanelHeight, setHomePanelHeight] = useState(HOME_FLOATING_PANEL_FALLBACK_HEIGHT);
  const [locLoading, setLocLoading] = useState(true);
  const [isMapReady, setIsMapReady] = useState(false);

  // Booking sheet state
  const [showBooking, setShowBooking] = useState(false);
  const [mapPicker, setMapPicker] = useState<MapPickerTarget | null>(null);
  const [pinCoords, setPinCoords] = useState(KIGALI_CENTER);
  const [pickerMapSize, setPickerMapSize] = useState({ width: 0, height: 0 });
  const [isPickerDragging, setIsPickerDragging] = useState(false);
  const [pickup, setPickup] = useState<RideLocation>({ ...KIGALI_CENTER, address: '' });
  const [destText, setDestText] = useState('');
  const [destination, setDestination] = useState<RideLocation | null>(null);
  const [bookLoading, setBookLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<'pickup' | 'dropoff' | null>(null);
  const [locationSearchTarget, setLocationSearchTarget] = useState<'pickup' | 'dropoff' | null>(null);
  const [locationSearchText, setLocationSearchText] = useState('');
  const [locationSearchLoading, setLocationSearchLoading] = useState(false);
  const [locationListTab, setLocationListTab] = useState<'saved' | 'previous'>('saved');
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [pendingSaveLocation, setPendingSaveLocation] = useState<RideLocation | null>(null);
  const [isCustomSaveLabel, setIsCustomSaveLabel] = useState(false);
  const [customSaveLabel, setCustomSaveLabel] = useState('');
  const [editingSavedLocation, setEditingSavedLocation] = useState<SavedLocation | null>(null);
  const [editingSavedLabel, setEditingSavedLabel] = useState('');
  const [editingSavedAddress, setEditingSavedAddress] = useState('');
  const [editingSavedFocusedField, setEditingSavedFocusedField] = useState<'label' | 'address' | null>(null);
  const [editSavedFieldErrors, setEditSavedFieldErrors] = useState<{
    label?: string;
    address?: string;
  }>({});
  const [routeRecenterRequest, setRouteRecenterRequest] = useState(0);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geocodeRequestId = useRef(0);
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
  const pickupOverlapsUser = getCoordDistance(pickup, userLocation) < 20;
  const shouldShowPickupMarker = showBooking && (!pickupOverlapsUser || destination !== null);
  const cycleMapType = () => {
    setMapType(prev => MAP_TYPES[(MAP_TYPES.indexOf(prev) + 1) % MAP_TYPES.length]);
  };

  const centerMapOnUser = useCallback((duration = 700, panelHeightOverride?: number) => {
    const panelHeight = panelHeightOverride ?? (showBooking ? bookingPanelMapInset : homePanelMapInset);
    const latitudeOffset = (panelHeight / (2 * SCREEN_HEIGHT)) * HOME_LOCATION_DELTA;
    mapRef.current?.animateToRegion(
      {
        latitude: userLocation.latitude - latitudeOffset,
        longitude: userLocation.longitude,
        latitudeDelta: HOME_LOCATION_DELTA,
        longitudeDelta: HOME_LOCATION_DELTA,
      },
      duration,
    );
  }, [
    bookingPanelMapInset,
    homePanelMapInset,
    showBooking,
    userLocation.latitude,
    userLocation.longitude,
  ]);

  const centerPickerOnUser = () => {
    pickerMapRef.current?.animateToRegion(
      {
        ...userLocation,
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
    if (locLoading || hasCenteredOnUserRef.current || hasPreciseRouteLocations) return;
    hasCenteredOnUserRef.current = true;
    requestAnimationFrame(() => centerMapOnUser());
  }, [locLoading, hasPreciseRouteLocations, userLocation.latitude, userLocation.longitude]);

  useFocusEffect(
    useCallback(() => {
      void reloadSavedPlaces();
    }, [reloadSavedPlaces]),
  );

  const applyHereFromCoords = useCallback(
    (coords: typeof KIGALI_CENTER, geo?: Location.LocationGeocodedAddress | null) => {
      setUserLocation(coords);
      setCurrentLocationAddress(formatReverseGeocodeAddress(geo, ''));
    },
    [],
  );

  const refreshHereLocation = useCallback(async () => {
    try {
      const permission = await Location.getForegroundPermissionsAsync();
      const granted = permission.granted
        || (permission.canAskAgain && (await Location.requestForegroundPermissionsAsync()).granted);
      if (!granted) return;

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      const [geo] = await Location.reverseGeocodeAsync(coords).catch(() => [null]);
      applyHereFromCoords(coords, geo);
    } catch {
      // keep last known here address
    }
  }, [applyHereFromCoords]);

  useFocusEffect(
    useCallback(() => {
      if (locationSearchTarget !== null || mapPicker !== null) return undefined;
      void refreshHereLocation();
      return undefined;
    }, [locationSearchTarget, mapPicker, refreshHereLocation]),
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

  // Get user location and notification permissions using native OS prompts only.
  useEffect(() => {
    let mounted = true;

    const resolveLocation = async () => {
      const permission = await Location.getForegroundPermissionsAsync();
      const finalPermission = permission.granted
        ? permission
        : permission.canAskAgain
          ? await Location.requestForegroundPermissionsAsync()
          : permission;

      if (!finalPermission.granted) return false;

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      const [geo] = await Location.reverseGeocodeAsync(loc.coords).catch(() => [null]);
      if (!mounted) return true;

      const address = formatReverseGeocodeAddress(geo, '');
      applyHereFromCoords(coords, geo);
      if (!cancelledSearchDraftRef.current) {
        setPickup({
          ...coords,
          address,
          locationType: 'precise',
        });
      }
      return true;
    };

    const requestNotificationPermission = async () => {
      const permission = await Notifications.getPermissionsAsync();
      if (permission.granted || !permission.canAskAgain) return;
      await Notifications.requestPermissionsAsync();
    };

    (async () => {
      try {
        if (Platform.OS === 'web') {
          navigator.geolocation?.getCurrentPosition(
            async p => {
              const coords = { latitude: p.coords.latitude, longitude: p.coords.longitude };
              if (!mounted) return;
              try {
                const [geo] = await Location.reverseGeocodeAsync(coords);
                if (!mounted) return;
                const address = formatReverseGeocodeAddress(geo, '');
                applyHereFromCoords(coords, geo);
                if (!cancelledSearchDraftRef.current) {
                  setPickup({
                    ...coords,
                    address,
                    locationType: 'precise',
                  });
                }
              } catch {
                if (mounted && !cancelledSearchDraftRef.current) {
                  applyHereFromCoords(coords, null);
                  setPickup(prev => ({ ...prev, ...coords, locationType: 'precise' }));
                } else if (mounted) {
                  applyHereFromCoords(coords, null);
                }
              }
              setLocLoading(false);
            },
            () => {
              if (mounted) setLocLoading(false);
            },
          );
        } else {
          await resolveLocation();
          await requestNotificationPermission();
          if (mounted) setLocLoading(false);
        }
      } catch (e) {
        if (mounted) setLocLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [applyHereFromCoords]);

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
    !locLoading && mapPicker === null && (!showBooking || !shouldShowBookingRoute);

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
      setPickup({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        address: currentLocationAddress || 'Current Location',
        locationType: 'precise',
      });
      requestAnimationFrame(() => centerMapOnUser(400, homePanelMapInset));
    });
  }, [
    activePanelHeight,
    clearCancelledSearchDraft,
    clearRoutePreview,
    currentLocationAddress,
    homePanelMapInset,
    sheetAnim,
    userLocation.latitude,
    userLocation.longitude,
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
    setLocationSearchTarget(target);
    setFocusedField(target);
    setLocationSearchText(target === 'pickup' ? pickup.address ?? '' : destText);
    setLocationListTab('saved');
    setSuggestions([]);
  };

  const closeLocationSearch = () => {
    setLocationSearchTarget(null);
    setLocationSearchText('');
    setLocationSearchLoading(false);
    setSuggestions([]);
    setPendingSaveLocation(null);
    setIsCustomSaveLabel(false);
    setCustomSaveLabel('');
    setEditingSavedLocation(null);
    setEditingSavedLabel('');
    setEditingSavedAddress('');
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

  const schedulePlaceSearch = useCallback(
    (text: string) => {
      if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
      const trimmed = text.trim();
      if (trimmed.length < 2) {
        setSuggestions([]);
        setLocationSearchLoading(false);
        return;
      }
      setLocationSearchLoading(true);
      const requestId = geocodeRequestId.current + 1;
      geocodeRequestId.current = requestId;
      geocodeTimer.current = setTimeout(async () => {
        const results = await geocodeAddress(text, userLocation);
        if (geocodeRequestId.current !== requestId) return;
        setSuggestions(results);
        setLocationSearchLoading(false);
      }, 350);
    },
    [userLocation],
  );

  const handleLocationSearchText = (text: string) => {
    setLocationSearchText(text);
    schedulePlaceSearch(text);
  };

  const handleEditSavedAddressText = (text: string) => {
    setEditingSavedAddress(text);
    schedulePlaceSearch(text);
  };

  const applyEditSavedAddressSuggestion = (suggestion: GeocodeSuggestion) => {
    setEditSavedFieldErrors(prev => ({ ...prev, address: undefined }));
    setEditingSavedAddress(suggestion.place_name);
    setEditingSavedLocation(prev =>
      prev
        ? {
            ...prev,
            ...suggestion.coords,
            address: suggestion.place_name,
            locationType: 'precise',
          }
        : prev,
    );
    setSuggestions([]);
    setLocationSearchLoading(false);
    setEditingSavedFocusedField(null);
    Keyboard.dismiss();
  };

  const applyEditTypedAddress = () => {
    const address = editingSavedAddress.trim();
    if (!editingSavedLocation || address.length < 2) return;
    setEditSavedFieldErrors(prev => ({ ...prev, address: undefined }));
    setEditingSavedLocation({
      ...editingSavedLocation,
      latitude: userLocation.latitude + 0.02,
      longitude: userLocation.longitude + 0.02,
      address,
      locationType: 'generic',
    });
    setSuggestions([]);
    setLocationSearchLoading(false);
    setEditingSavedFocusedField(null);
    Keyboard.dismiss();
  };

  const buildTypedLocation = (): RideLocation => ({
    latitude: userLocation.latitude + 0.02,
    longitude: userLocation.longitude + 0.02,
    address: locationSearchText.trim(),
    locationType: 'generic',
  });

  const saveLocationAs = async (label: string) => {
    if (!pendingSaveLocation) return;
    const cleanLabel = label.trim();
    if (!cleanLabel) return;
    await saveLocation(pendingSaveLocation, cleanLabel);
    showToast(`Saved as ${cleanLabel}`);
    setPendingSaveLocation(null);
    setIsCustomSaveLabel(false);
    setCustomSaveLabel('');
    setLocationListTab('saved');
  };

  const closePendingSaveLocation = () => {
    setPendingSaveLocation(null);
    setIsCustomSaveLabel(false);
    setCustomSaveLabel('');
    Keyboard.dismiss();
  };

  const closeEditSavedLocation = () => {
    setEditingSavedLocation(null);
    setEditingSavedLabel('');
    setEditingSavedAddress('');
    setEditSavedFieldErrors({});
    setSuggestions([]);
    setLocationSearchLoading(false);
    setEditingSavedFocusedField(null);
    Keyboard.dismiss();
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

  const handleSaveLocationLabelPress = (label: string) => {
    if (label === 'Other') {
      setIsCustomSaveLabel(true);
      setCustomSaveLabel('');
      return;
    }
    saveLocationAs(label);
  };

  const openSavedLocationMenu = (location: SavedLocation) => {
    setEditingSavedLocation(location);
    setEditingSavedLabel(location.label);
    setEditingSavedAddress(location.address ?? '');
    setEditSavedFieldErrors({});
    setSuggestions([]);
    setLocationSearchLoading(false);
    setEditingSavedFocusedField(null);
    setPendingSaveLocation(null);
    setIsCustomSaveLabel(false);
    setCustomSaveLabel('');
    Keyboard.dismiss();
  };

  const performDeleteSavedLocation = async (location: SavedLocation) => {
    const next = savedPlaces.filter(place => place.id !== location.id);
    await persistSavedPlaces(next);
    showToast('Location removed', 'error');
    if (editingSavedLocation?.id === location.id) {
      setEditingSavedLocation(null);
      setEditingSavedLabel('');
      setEditingSavedAddress('');
      setEditSavedFieldErrors({});
      setSuggestions([]);
      setLocationSearchLoading(false);
      setEditingSavedFocusedField(null);
    }
  };

  const confirmDeleteSavedLocation = (location: SavedLocation) => {
    Alert.alert(
      `Delete "${location.label}"?`,
      'This saved place will be removed from your list. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void performDeleteSavedLocation(location);
          },
        },
      ],
    );
  };

  const showSavedLocationActions = (location: SavedLocation) => {
    Alert.alert(location.label, location.address ?? '', [
      { text: 'Edit', onPress: () => openSavedLocationMenu(location) },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => confirmDeleteSavedLocation(location),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const renameSavedLocation = async () => {
    if (!editingSavedLocation) return;

    const label = editingSavedLabel.trim();
    const address = editingSavedAddress.trim();
    const errors: { label?: string; address?: string } = {};

    if (label.length === 0) {
      errors.label = 'Enter a name for this saved place';
    }
    if (address.length < 2) {
      errors.address = 'Enter an address or pick one from the suggestions';
    }

    if (errors.label || errors.address) {
      setEditSavedFieldErrors(errors);
      const toastMessage =
        errors.label && errors.address
          ? 'Add a name and address before saving'
          : (errors.label ?? errors.address)!;
      showToast(toastMessage, 'error');
      return;
    }

    setEditSavedFieldErrors({});
    const next = savedPlaces.map(place =>
      place.id === editingSavedLocation.id
        ? { ...editingSavedLocation, label, address }
        : place
    );
    await persistSavedPlaces(next);
    showToast('Location updated', 'info');
    setEditingSavedLocation(null);
    setEditingSavedLabel('');
    setEditingSavedAddress('');
    setEditSavedFieldErrors({});
    setSuggestions([]);
    setLocationSearchLoading(false);
    setEditingSavedFocusedField(null);
  };

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

  const proceedWithBooking = async (finalDestination: RideLocation) => {
    const dropoffDisplayText = destination?.address?.trim() || destText.trim();
    setShowBooking(true);
    setBookLoading(true);
    try {
      await createRide(pickup, finalDestination, selectedVehicle, dropoffDisplayText);
      router.push('/searching');
    } finally {
      setBookLoading(false);
    }
  };

  const confirmAndProceedWithBooking = (finalDestination: RideLocation) => {
    if (arePickupAndDropoffSame(pickup, finalDestination)) {
      Alert.alert(
        'Same location',
        'Pickup and drop off locations are the same. Are you sure you want to continue?',
        [
          { text: 'Change pickup', onPress: () => openLocationSearch('pickup') },
          { text: 'Change drop off', onPress: () => openLocationSearch('dropoff') },
          { text: 'Continue anyway', onPress: () => { void proceedWithBooking(finalDestination); } },
        ],
      );
      return;
    }

    void proceedWithBooking(finalDestination);
  };

  const handleBook = () => {
    if (!destination && !destText.trim()) return;

    const finalDestination: RideLocation = destination
      ? { ...destination, locationType: destination.locationType ?? 'precise' }
      : {
          latitude: userLocation.latitude + 0.02,
          longitude: userLocation.longitude + 0.02,
          address: destText.trim(),
          locationType: 'generic',
        };

    if (!locLoading && isPickupFarFromUserGps(pickup, userLocation)) {
      Alert.alert(
        'Pickup seems far away',
        'Your pickup location seems far from your GPS location. Are you sure you want to continue?',
        [
          { text: 'Change pickup', onPress: () => openLocationSearch('pickup') },
          { text: 'Continue', onPress: () => confirmAndProceedWithBooking(finalDestination) },
        ],
      );
      return;
    }

    confirmAndProceedWithBooking(finalDestination);
  };

  const dist = destination
    ? Math.sqrt(
        Math.pow((destination.latitude - pickup.latitude) * 111, 2) +
        Math.pow((destination.longitude - pickup.longitude) * 111, 2)
      )
    : 0;

  const visibleDrivers = useMemo(() => {
    return DRIVER_OFFSETS.map((offset, i) => ({
      id: `nearby-driver-${i}`,
      latitude: userLocation.latitude + offset.lat,
      longitude: userLocation.longitude + offset.lng,
    }));
  }, [userLocation.latitude, userLocation.longitude]);

  const savedLocations = useMemo<SavedLocation[]>(() => savedPlaces, [savedPlaces]);
  const showEditAddressSuggestions = useMemo(
    () => editingSavedFocusedField === 'address' && editingSavedAddress.trim().length >= 2,
    [editingSavedAddress, editingSavedFocusedField],
  );

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
        userLocation={userLocation}
        primaryColor={colors.primary}
      />

      {locationSearchTarget === null && mapPicker === null ? (
        <HomeTopHeader
          paddingTop={insets.top + (Platform.OS === 'web' ? 67 : 0) + 12}
          locationText={currentLocationAddress}
          locLoading={locLoading}
          profileInitial={user?.name?.trim()?.[0]?.toUpperCase() ?? '?'}
          isRegisteredDriver={Boolean(driverProfile)}
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
        onPress={() => centerMapOnUser(600)}
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
        userLocation={{ ...userLocation, address: 'Current Location', locationType: 'precise' }}
        onOpenLocationSearch={openLocationSearch}
        onUseMap={(target, location) => {
          setPinCoords({ latitude: location.latitude, longitude: location.longitude });
          setMapPicker(target);
        }}
        onUseGpsPickup={() => setPickup({
          ...userLocation,
          address: 'Current Location',
          locationType: 'precise',
        })}
        onUseGpsDestination={() => {
          setDestText('Current Location');
          setDestination({
            ...userLocation,
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
        <View style={[styles.locationSearchScreen, { backgroundColor: colors.background }]}>
          <GlassHeader
            title={locationSearchTarget === 'pickup' ? 'Pickup Location' : 'Drop off Location'}
            onBackPress={closeLocationSearch}
          />

          <View
            style={[
              styles.locationSearchBody,
              {
                paddingTop: locationHeaderMetrics.contentTop - 8,
                paddingBottom: insets.bottom,
              },
            ]}
          >
            <View style={styles.locationSearchFixed}>
            <TouchableOpacity
              style={[styles.locationSearchInputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => locationSearchInputRef.current?.focus()}
              activeOpacity={1}
            >
              <Feather name="search" size={18} color={colors.mutedForeground} />
              <TextInput
                ref={locationSearchInputRef}
                style={[styles.locationSearchInput, { color: colors.foreground }]}
                value={locationSearchText}
                onChangeText={handleLocationSearchText}
                placeholder={
                  locationSearchTarget === 'pickup'
                    ? 'Address, hotel, or 1 KG 185 ST'
                    : 'Address, hotel, or 1 KG 185 ST'
                }
                placeholderTextColor={colors.mutedForeground}
                returnKeyType="search"
              />
              {locationSearchLoading ? (
                <View style={styles.locationSearchClear}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : locationSearchText.length > 0 && (
                <TouchableOpacity
                  style={[styles.locationSearchClear, { backgroundColor: colors.muted, borderColor: colors.border }]}
                  onPress={event => {
                    event.stopPropagation();
                    setLocationSearchText('');
                    setSuggestions([]);
                    setLocationSearchLoading(false);
                    locationSearchInputRef.current?.focus();
                  }}
                  activeOpacity={0.75}
                >
                  <Feather name="x" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            <View style={styles.locationQuickRow}>
              <TouchableOpacity
                style={[styles.locationQuickCard, { backgroundColor: colors.card }]}
                onPress={() => applyLocation(locationSearchTarget, { ...userLocation, address: 'Current Location', locationType: 'precise' })}
                activeOpacity={0.85}
              >
                <View style={[styles.locationQuickIcon, { backgroundColor: colors.primaryHex + '18' }]}>
                  <MaterialCommunityIcons name="crosshairs-gps" size={16} color={colors.primary} />
                </View>
                <View style={styles.locationQuickText}>
                  <Text style={[styles.locationQuickTitle, { color: colors.foreground }]} numberOfLines={1}>Use current location</Text>
                  <Text style={[styles.locationQuickSub, { color: colors.mutedForeground }]} numberOfLines={1}>GPS precise</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.locationQuickCard, { backgroundColor: colors.card }]}
                onPress={handleChooseOnMap}
                activeOpacity={0.85}
              >
                <View style={[styles.locationQuickIcon, { backgroundColor: colors.primaryHex + '18' }]}>
                  <MaterialCommunityIcons name="map-outline" size={16} color={colors.primary} />
                </View>
                <View style={styles.locationQuickText}>
                  <Text style={[styles.locationQuickTitle, { color: colors.foreground }]} numberOfLines={1}>Choose on map</Text>
                  <Text style={[styles.locationQuickSub, { color: colors.mutedForeground }]} numberOfLines={1}>Drag map</Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={[styles.locationTabs, { backgroundColor: colors.muted }]}>
              <TouchableOpacity
                style={[
                  styles.locationTab,
                  locationListTab === 'saved' && { backgroundColor: colors.primary },
                ]}
                onPress={() => setLocationListTab('saved')}
                activeOpacity={0.85}
              >
                <Text style={[
                  styles.locationTabText,
                  { color: locationListTab === 'saved' ? colors.primaryForeground : colors.mutedForeground },
                ]}>
                  Saved locations
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.locationTab,
                  locationListTab === 'previous' && { backgroundColor: colors.primary },
                ]}
                onPress={() => setLocationListTab('previous')}
                activeOpacity={0.85}
              >
                <Text style={[
                  styles.locationTabText,
                  { color: locationListTab === 'previous' ? colors.primaryForeground : colors.mutedForeground },
                ]}>
                  Previous rides
                </Text>
              </TouchableOpacity>
            </View>
            </View>

            <GlassScrollView
              style={styles.locationSearchScroll}
              indicatorTop={8}
              indicatorBottom={insets.bottom + 20}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              onScrollBeginDrag={Keyboard.dismiss}
              contentContainerStyle={[
                styles.locationSearchList,
                { paddingHorizontal: 20, paddingBottom: insets.bottom + 20 },
              ]}
            >
              {(locationSearchText.trim().length >= 2 || suggestions.length > 0) && (
                <>
                <Text style={[styles.locationSectionTitle, { color: colors.mutedForeground }]}>Search results</Text>

              {locationSearchText.trim().length >= 2 && (
                <TouchableOpacity
                  style={[styles.locationOption, { borderBottomColor: colors.border }]}
                  onPress={() => applyLocation(locationSearchTarget, buildTypedLocation())}
                >
                  <View style={styles.locationOptionIcon}>
                    <Feather name="edit-3" size={16} color={colors.foreground} />
                  </View>
                  <View style={styles.locationOptionText}>
                    <Text style={[styles.locationOptionTitle, { color: colors.foreground }]} numberOfLines={1}>
                      Use "{locationSearchText.trim()}"
                    </Text>
                    <Text style={[styles.locationOptionSub, { color: colors.mutedForeground }]}>Confirm exact details in chat</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.saveLocationButton, { borderColor: colors.border }]}
                    onPress={event => {
                      event.stopPropagation();
                      setPendingSaveLocation(buildTypedLocation());
                      Keyboard.dismiss();
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.saveLocationButtonText, { color: colors.primary }]}>Save</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              )}

              {locationSearchText.trim().length >= 2 &&
                !locationSearchLoading &&
                suggestions.length === 0 && (
                  <Text style={[styles.locationSearchEmpty, { color: colors.mutedForeground }]}>
                    No matches yet. Try the full name (e.g. Serena Hotel) or a grid address with ST/AV, or pin on the map.
                  </Text>
                )}

              {suggestions.map(suggestion => (
                <TouchableOpacity
                  key={suggestion.id}
                  style={[styles.locationOption, { borderBottomColor: colors.border }]}
                  onPress={() => applyLocation(locationSearchTarget, {
                    ...suggestion.coords,
                    address: suggestion.place_name,
                    locationType: 'precise',
                  })}
                >
                  <View style={styles.locationOptionIcon}>
                    <MaterialCommunityIcons name="map-marker-outline" size={18} color={colors.foreground} />
                  </View>
                  <View style={styles.locationOptionText}>
                    <Text style={[styles.locationOptionTitle, { color: colors.foreground }]} numberOfLines={1}>
                      {suggestion.title}
                    </Text>
                    <Text style={[styles.locationOptionSub, { color: colors.mutedForeground }]} numberOfLines={2}>
                      {suggestion.subtitle ?? suggestion.place_name}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.saveLocationButton, { borderColor: colors.border }]}
                    onPress={event => {
                      event.stopPropagation();
                      setPendingSaveLocation({
                        ...suggestion.coords,
                        address: suggestion.place_name,
                        locationType: 'precise',
                      });
                      Keyboard.dismiss();
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.saveLocationButtonText, { color: colors.primary }]}>Save</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
                </>
              )}

              <SavedLocationsSection
                tab={locationListTab}
                colors={colors}
                hasSearchResults={locationSearchText.trim().length >= 2 || suggestions.length > 0}
                savedLocations={savedLocations}
                recentLocations={recentLocations}
                onSelect={location => applyLocation(locationSearchTarget, location)}
                onShowActions={showSavedLocationActions}
              />
            </GlassScrollView>
          </View>

          {pendingSaveLocation && (
            <>
              <SheetBackdrop onPress={dismissSaveFormSheet} animatedOpacity={formSheetBackdropOpacity} />

              <Animated.View
                onLayout={event => {
                  const height = event.nativeEvent.layout.height;
                  formSheetHeightRef.current = height;
                  setFormSheetMeasuredHeight(height);
                }}
                style={[
                  styles.overlayFormSheet,
                  styles.formSheetSurface,
                  styles.overlayFormSheetRaised,
                  formSheetSurface,
                  {
                    paddingBottom: insets.bottom + (Platform.OS === 'web' ? 88 : 72),
                    transform: [
                      {
                        translateY: Animated.add(
                          formSheetDragAnim,
                          Animated.multiply(saveSheetKeyboardAnim, -1),
                        ),
                      },
                    ],
                  },
                ]}
                {...saveFormSheetPanResponder.panHandlers}
              >
                <View style={styles.formSheetCloseAnchor} pointerEvents="box-none">
                  <CloseButton
                    ref={saveFormCloseRef}
                    shutOnPress={false}
                    onPress={dismissSaveFormSheet}
                    accessibilityLabel="Close save location"
                  />
                </View>
                <View style={styles.formSheetBody}>
                  <View style={[styles.sheetDragZone, styles.formSheetDragZone]}>
                    <View style={[styles.sheetHandleTouch, styles.formSheetHandleTouch]}>
                      <View style={styles.sheetHandle} />
                    </View>
                    <View style={styles.formSheetHeader}>
                      <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Save location as</Text>
                    </View>
                    <View style={styles.formSheetSubheader}>
                      <Text style={[styles.formSheetSubtitle, { color: colors.mutedForeground }]} numberOfLines={2}>
                        {pendingSaveLocation.address ?? 'Selected location'}
                      </Text>
                      <Text style={[styles.formSheetHint, { color: colors.mutedForeground }]}>
                        {isCustomSaveLabel ? 'Type a custom label to finish saving.' : 'Choose one label to finish saving.'}
                      </Text>
                    </View>
                  </View>
                <View style={styles.formSheetContent}>
                <View style={styles.saveAsLocationLabels}>
                  {SAVE_LOCATION_LABELS.map(label => (
                    <TouchableOpacity
                      key={label}
                      style={[
                        styles.saveAsLocationLabel,
                        { width: SAVE_LABEL_WIDTHS[label] },
                        { backgroundColor: colors.muted, borderColor: colors.border },
                      ]}
                      onPress={() => handleSaveLocationLabelPress(label)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.saveAsLocationLabelText, { color: colors.foreground }]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {isCustomSaveLabel && (
                  <View style={styles.saveAsCustomLabelSection}>
                    <View style={[styles.saveAsLocationInputWrap, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                      <Feather name="tag" size={18} color={colors.mutedForeground} />
                      <TextInput
                        style={[styles.saveAsLocationInput, { color: colors.foreground }]}
                        value={customSaveLabel}
                        onChangeText={setCustomSaveLabel}
                        placeholder="Custom label"
                        placeholderTextColor={colors.mutedForeground}
                        autoFocus
                        returnKeyType="done"
                        onFocus={() => {
                          if (Platform.OS === 'web') {
                            applySaveFormKeyboardLift(estimatedKeyboardOffset, 0);
                          }
                        }}
                        onBlur={() => {
                          if (Platform.OS === 'web') {
                            applySaveFormKeyboardLift(0, 0);
                          }
                        }}
                        onSubmitEditing={() => saveLocationAs(customSaveLabel)}
                      />
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.saveAsCustomLabelButton,
                        {
                          backgroundColor: customSaveLabel.trim() ? colors.primary : colors.muted,
                          opacity: customSaveLabel.trim() ? 1 : 0.6,
                        },
                      ]}
                      onPress={() => saveLocationAs(customSaveLabel)}
                      disabled={!customSaveLabel.trim()}
                      activeOpacity={0.85}
                    >
                      <Feather
                        name="check"
                        size={18}
                        color={customSaveLabel.trim() ? colors.primaryForeground : colors.mutedForeground}
                      />
                      <Text
                        style={[
                          styles.saveAsCustomLabelButtonText,
                          { color: customSaveLabel.trim() ? colors.primaryForeground : colors.mutedForeground },
                        ]}
                      >
                        Save custom label
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
                </View>
                </View>
              </Animated.View>
            </>
          )}

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
                if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
                geocodeRequestId.current += 1;
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
        </View>
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

