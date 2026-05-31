import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { BackButton, CloseButton, type CloseButtonHandle } from '@/components/BackButton';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { GlassScrollView } from '@/components/GlassScrollView';
import { KandaButton } from '@/components/KandaButton';
import { VehicleTypeIcon } from '@/components/VehicleTypeIcon';
import { buttonCornerRadius, BUTTON_HEIGHT } from '@/constants/buttons';
import { SheetBackdrop } from '@/components/SheetBackdrop';
import { useColors } from '@/hooks/useColors';
import { useRoute } from '@/hooks/useRoute';
import { useAuth } from '@/context/AuthContext';
import { useRide } from '@/context/RideContext';
import { useSavedLocations } from '@/hooks/useSavedLocations';
import { useToast } from '@/context/ToastContext';
import { geocodeAddress, GeocodeSuggestion } from '@/services/geocoding';
import { formatDistance, formatDuration } from '@/utils/mapUtils';
import { arePickupAndDropoffSame, getCoordDistance } from '@/utils/locationUtils';
import { KIGALI_CENTER, RideLocation, SavedLocation, VehicleType, VEHICLE_BASE_FARE, VEHICLE_LABELS } from '@/types';
import { VehicleMapMarker } from '@/components/VehicleMapMarker';
import { getNearbyDrivers, NearbyDriverPin } from '@/services/rides';
import { API_TO_LEGACY_VEHICLE, LEGACY_TO_API_VEHICLE } from '@/services/vehicleTypes';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Compact until ride details/actions appear; expanded when stats and Find Driver are visible.
// ~0.3 cm shorter than prior compact/expanded sizes (~11pt)
const COMPACT_PANEL_HEIGHT = Math.min(SCREEN_HEIGHT * 0.375, 297);
const EXPANDED_PANEL_HEIGHT = Math.min(SCREEN_HEIGHT * 0.515, 401);
const ROUTE_DRAW_STEP = 0.055;
const ROUTE_DRAW_INTERVAL_MS = 45;
const HOME_LOCATION_DELTA = 0.012;
const HOME_TAB_BAR_HEIGHT = Platform.OS === 'web' ? 84 : 64;
/** iOS system sheets (AirPods-style) use ~44–47pt continuous corners. */
const FLOATING_PANEL_RADIUS = Platform.OS === 'ios' ? 47 : 28;
const HOME_FLOATING_PANEL_FALLBACK_HEIGHT = 236;
/** ~0.5cm extra inset for floating panel content alignment. */
const GREETING_LEFT_INSET = 14;
const BOOKING_SHEET_PADDING_H = 22;
/** Equal inset from top + right form edges for the booking close control. */
const BOOKING_CLOSE_EDGE_INSET = 16;
/** Extra room so the close icon can spin during sheet drag without clipping. */
const BOOKING_CLOSE_ROTATION_PAD = 10;
const floatingPanelSurface = {
  borderRadius: FLOATING_PANEL_RADIUS,
  ...Platform.select({
    ios: { borderCurve: 'continuous' as const },
    default: {},
  }),
  borderWidth: StyleSheet.hairlineWidth,
  overflow: 'hidden' as const,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.14,
  shadowRadius: 24,
  elevation: 14,
};
const SAVE_LOCATION_LABELS = ['Home', 'Work', 'School', 'Market', 'Other'];
const SAVE_LABEL_GAP = 8;
const SAVE_LABEL_SHEET_HORIZONTAL_PADDING = BOOKING_SHEET_PADDING_H;
const SAVE_LABEL_CONTENT_INSET = GREETING_LEFT_INSET;
const SAVE_LABEL_AVAILABLE_WIDTH =
  SCREEN_WIDTH
  - SAVE_LABEL_SHEET_HORIZONTAL_PADDING * 2
  - SAVE_LABEL_CONTENT_INSET * 2
  - SAVE_LABEL_GAP * (SAVE_LOCATION_LABELS.length - 1);
const SAVE_LABEL_WIDTHS: Record<string, number> = {
  Home: SAVE_LABEL_AVAILABLE_WIDTH * 0.16,
  Work: SAVE_LABEL_AVAILABLE_WIDTH * 0.16,
  School: SAVE_LABEL_AVAILABLE_WIDTH * 0.22,
  Market: SAVE_LABEL_AVAILABLE_WIDTH * 0.23,
  Other: SAVE_LABEL_AVAILABLE_WIDTH * 0.23,
};

const VEHICLE_TYPES: VehicleType[] = ['moto', 'cab', 'hilux', 'fuso'];
const MAP_TYPES = ['standard', 'satellite', 'hybrid'] as const;
type AppMapType = typeof MAP_TYPES[number];
type MapPickerTarget = 'pickup' | 'dropoff' | 'savedLocation';



function calcEstFare(type: VehicleType, dist: number) {
  const base = VEHICLE_BASE_FARE[type];
  const perKm = type === 'moto' ? 200 : type === 'cab' ? 400 : type === 'hilux' ? 600 : 800;
  return Math.round((base + dist * perKm) / 100) * 100;
}

function interpolateCoord(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
  progress: number,
) {
  return {
    latitude: a.latitude + (b.latitude - a.latitude) * progress,
    longitude: a.longitude + (b.longitude - a.longitude) * progress,
  };
}

function sliceRouteByProgress(
  coords: { latitude: number; longitude: number }[],
  startProgress: number,
  endProgress: number,
) {
  if (coords.length < 2) return [];

  const segmentLengths = coords.slice(0, -1).map((coord, index) => getCoordDistance(coord, coords[index + 1]));
  const totalLength = segmentLengths.reduce((sum, length) => sum + length, 0);
  if (totalLength <= 0) return coords.slice(0, 2);

  const startDistance = totalLength * Math.max(0, Math.min(1, startProgress));
  const endDistance = totalLength * Math.max(0, Math.min(1, endProgress));
  const sliced: { latitude: number; longitude: number }[] = [];
  let travelled = 0;

  for (let i = 0; i < segmentLengths.length; i++) {
    const segmentStart = travelled;
    const segmentEnd = travelled + segmentLengths[i];
    const segmentLength = segmentLengths[i];
    const from = coords[i];
    const to = coords[i + 1];

    if (segmentEnd < startDistance) {
      travelled = segmentEnd;
      continue;
    }
    if (segmentStart > endDistance) break;

    const localStart = Math.max(startDistance, segmentStart);
    const localEnd = Math.min(endDistance, segmentEnd);
    const startRatio = segmentLength === 0 ? 0 : (localStart - segmentStart) / segmentLength;
    const endRatio = segmentLength === 0 ? 1 : (localEnd - segmentStart) / segmentLength;
    const startCoord = interpolateCoord(from, to, startRatio);
    const endCoord = interpolateCoord(from, to, endRatio);

    if (sliced.length === 0) sliced.push(startCoord);
    sliced.push(endCoord);
    travelled = segmentEnd;
  }

  return sliced.length > 1 ? sliced : coords.slice(0, 2);
}

export default function CustomerHome() {
  const colors = useColors();
  const isDark = useColorScheme() === 'dark';
  const { savedPlaces, saveLocation, persistSavedPlaces, reload: reloadSavedPlaces } = useSavedLocations();
  const { showToast } = useToast();
  const formSheetSurface = useMemo(
    () => ({
      backgroundColor: colors.card,
      borderTopColor: isDark ? 'rgba(255,255,255,0.14)' : colors.border,
      shadowOpacity: isDark ? 0.55 : 0.25,
    }),
    [colors.card, colors.border, isDark],
  );
  const insets = useSafeAreaInsets();
  const locationHeaderMetrics = useGlassHeaderMetrics();
  const { user } = useAuth();
  const { currentRide, createRide, rideHistory, loadHistory, isMatchingPaused, initCustomerSession } = useRide();
  const mapRef = useRef<MapView>(null);
  const pickerMapRef = useRef<MapView>(null);
  const locationSearchInputRef = useRef<TextInput>(null);
  const hasCenteredOnUserRef = useRef(false);

  const [userLocation, setUserLocation] = useState(KIGALI_CENTER);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleType>('moto');
  const [mapType, setMapType] = useState<AppMapType>('standard');
  const [homePanelHeight, setHomePanelHeight] = useState(HOME_FLOATING_PANEL_FALLBACK_HEIGHT);
  const [locLoading, setLocLoading] = useState(true);
  const [isMapReady, setIsMapReady] = useState(false);

  // Booking sheet state
  const [showBooking, setShowBooking] = useState(false);
  const [mapPicker, setMapPicker] = useState<MapPickerTarget | null>(null);
  const [pinCoords, setPinCoords] = useState(KIGALI_CENTER);
  const [pickup, setPickup] = useState<RideLocation>({ ...KIGALI_CENTER, address: 'Current Location' });
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
  const [routeAnimProgress, setRouteAnimProgress] = useState(0);
  const [routeRecenterRequest, setRouteRecenterRequest] = useState(0);
  const [nearbyDrivers, setNearbyDrivers] = useState<NearbyDriverPin[]>([]);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheetAnim = useRef(new Animated.Value(EXPANDED_PANEL_HEIGHT)).current;
  const sheetDragStart = useRef(0);
  const bookingCloseRef = useRef<CloseButtonHandle>(null);
  const saveFormCloseRef = useRef<CloseButtonHandle>(null);
  const editFormCloseRef = useRef<CloseButtonHandle>(null);
  const activePanelHeightRef = useRef(COMPACT_PANEL_HEIGHT);
  const closeBookingRef = useRef<() => void>(() => {});
  const editSheetKeyboardAnim = useRef(new Animated.Value(0)).current;
  const editSheetEnterAnim = useRef(new Animated.Value(24)).current;
  const editSheetOpacityAnim = useRef(new Animated.Value(0)).current;
  const formSheetDragAnim = useRef(new Animated.Value(0)).current;
  const formSheetDragStart = useRef(0);
  const formSheetHeightRef = useRef(280);
  const [formSheetMeasuredHeight, setFormSheetMeasuredHeight] = useState(280);
  const closePendingSaveLocationRef = useRef<() => void>(() => {});
  const closeEditSavedLocationRef = useRef<() => void>(() => {});
  const dismissFormSheetAnimatedRef = useRef<(close: () => void, onAnimateStart?: () => void) => void>(() => {});
  const estimatedKeyboardOffset = Math.max(240, Math.min(SCREEN_HEIGHT * 0.34, 340));
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

  const centerMapOnUser = (duration = 700, panelHeightOverride?: number) => {
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
  };

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

  // Redirect when ride status changes (do not re-push /searching when only isMatchingPaused toggles — cancel alert)
  useEffect(() => {
    if (!currentRide) return;
    if (currentRide.status === 'searching') {
      router.push('/searching');
    }
  }, [currentRide?.status]);

  useEffect(() => {
    if (!currentRide) return;
    if (currentRide.status === 'negotiating' && !isMatchingPaused) {
      router.push('/negotiation');
    } else if (['confirmed', 'arriving', 'arrived', 'in_progress'].includes(currentRide.status)) {
      router.push('/ride');
    }
  }, [currentRide?.status, isMatchingPaused]);

  useEffect(() => {
    if (currentRide?.status !== 'cancelled') return;

    setSelectedVehicle(currentRide.vehicleType);
    setPickup(currentRide.pickup);
    setDestination(currentRide.destination);
    setDestText(currentRide.destination.address ?? '');
    setSuggestions([]);
    setShowBooking(true);
    sheetAnim.setValue(0);
    setRouteRecenterRequest(value => value + 1);
  }, [currentRide?.status, sheetAnim]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Restore any in-progress customer ride after an app restart or background kill.
  // Hits GET /customer/rides/active, restores currentRide, reconnects the WS.
  // The WS server immediately sends ride_state so navigation fires into the correct screen.
  useEffect(() => {
    initCustomerSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally runs once on mount

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

  useEffect(() => {
    const liftEditSheet = (height: number) => {
      Animated.spring(editSheetKeyboardAnim, {
        toValue: Math.max(0, height - insets.bottom),
        damping: 24,
        stiffness: 260,
        mass: 0.8,
        useNativeDriver: true,
      }).start();
    };

    const willShowSub = Keyboard.addListener('keyboardWillShow', event => {
      liftEditSheet(event.endCoordinates.height);
    });
    const showSub = Keyboard.addListener('keyboardDidShow', event => {
      liftEditSheet(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      Animated.timing(editSheetKeyboardAnim, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }).start();
    });

    return () => {
      willShowSub.remove();
      showSub.remove();
      hideSub.remove();
    };
  }, [editSheetKeyboardAnim, insets.bottom]);

  useEffect(() => {
    if (!pendingSaveLocation) return;
    formSheetDragAnim.setValue(formSheetHeightRef.current);
    Animated.spring(formSheetDragAnim, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
  }, [pendingSaveLocation, formSheetDragAnim]);

  useEffect(() => {
    if (!editingSavedLocation) {
      editSheetKeyboardAnim.setValue(0);
      editSheetEnterAnim.setValue(0);
      editSheetOpacityAnim.setValue(0);
      return;
    }

    formSheetDragAnim.setValue(formSheetHeightRef.current);
    editSheetEnterAnim.setValue(0);
    editSheetOpacityAnim.setValue(0);
    Animated.parallel([
      Animated.spring(formSheetDragAnim, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 4,
      }),
      Animated.timing(editSheetOpacityAnim, {
        toValue: 1,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start();
  }, [editingSavedLocation, editSheetEnterAnim, editSheetKeyboardAnim, editSheetOpacityAnim, formSheetDragAnim]);

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

      setUserLocation(coords);
      setPickup({
        ...coords,
        address: geo ? `${geo.street ?? ''} ${geo.city ?? 'Kigali'}`.trim() : 'Current Location',
        locationType: 'precise',
      });
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
          navigator.geolocation?.getCurrentPosition(p => {
            const coords = { latitude: p.coords.latitude, longitude: p.coords.longitude };
            setUserLocation(coords);
            setPickup(prev => ({ ...prev, ...coords, locationType: 'precise' }));
            setLocLoading(false);
          }, () => {
            setLocLoading(false);
          });
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
  }, []);

  // Nearby drivers — real-time pins on the home screen.
  //
  // Strategy (keeps API usage low):
  //   • Query ALL vehicle types in one backend call — the backend fans out via
  //     Redis GEO and returns a merged list, so zero extra round-trips per type.
  //   • Base poll interval: 12 s.
  //   • Zero-result backoff: after 2 consecutive empty fetches, slow to 30 s.
  //   • Movement gate: skip fetch if user hasn't moved ≥ 40 m and we already
  //     have pins — standing still means the same result.
  //   • Pauses when the booking sheet is open (pins irrelevant mid-booking).
  const nearbyPollRef = useRef<{
    lastFetchLat: number;
    lastFetchLng: number;
    zeroResultStreak: number;
  }>({ lastFetchLat: 0, lastFetchLng: 0, zeroResultStreak: 0 });

  useEffect(() => {
    if (locLoading || showBooking) {
      setNearbyDrivers([]);
      return;
    }

    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const scheduleNext = (delayMs: number) => {
      if (timerId) clearTimeout(timerId);
      timerId = setTimeout(runFetch, delayMs);
    };

    const runFetch = () => {
      const { lastFetchLat, lastFetchLng } = nearbyPollRef.current;
      const isFirstFetch = lastFetchLat === 0 && lastFetchLng === 0;
      const movedM = isFirstFetch ? Infinity : getCoordDistance(
        { latitude: userLocation.latitude, longitude: userLocation.longitude },
        { latitude: lastFetchLat, longitude: lastFetchLng },
      );

      // Skip network call if user hasn't moved ≥ 40 m and we already have pins.
      if (movedM < 40 && nearbyDrivers.length > 0) {
        scheduleNext(12_000);
        return;
      }

      // Omit transport_type → backend returns all vehicle types in one call.
      getNearbyDrivers(userLocation.latitude, userLocation.longitude)
        .then(drivers => {
          if (cancelled) return;
          setNearbyDrivers(drivers);
          nearbyPollRef.current.lastFetchLat = userLocation.latitude;
          nearbyPollRef.current.lastFetchLng = userLocation.longitude;
          nearbyPollRef.current.zeroResultStreak =
            drivers.length === 0 ? nearbyPollRef.current.zeroResultStreak + 1 : 0;
          // Back off to 30 s after 2 consecutive empty fetches.
          scheduleNext(nearbyPollRef.current.zeroResultStreak >= 2 ? 30_000 : 12_000);
        })
        .catch(() => {
          if (!cancelled) scheduleNext(20_000); // retry after network error
        });
    };

    runFetch();
    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
    };
    // nearbyDrivers.length intentionally omitted from deps — we only want to
    // re-bootstrap the loop when location or visibility changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locLoading, showBooking, userLocation.latitude, userLocation.longitude]);

  // Real road route via Mapbox Directions API
  const { route, loading: routeLoading } = useRoute(
    hasPreciseRouteLocations ? { latitude: pickup.latitude, longitude: pickup.longitude } : null,
    hasPreciseRouteLocations && destination
      ? { latitude: destination.latitude, longitude: destination.longitude }
      : null,
  );

  // Mirror route coordinates into local state so MapView children re-render immediately
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const routePreviewCoords = useMemo(
    () => hasPreciseRouteLocations && destination
      ? [
          { latitude: pickup.latitude, longitude: pickup.longitude },
          { latitude: destination.latitude, longitude: destination.longitude },
        ]
      : [],
    [
      hasPreciseRouteLocations,
      pickup.latitude,
      pickup.longitude,
      destination?.latitude,
      destination?.longitude,
    ],
  );
  const visibleRouteCoords = routeCoords.length > 1 ? routeCoords : [];
  const routeCenterCoords = routeCoords.length > 1 ? routeCoords : routePreviewCoords;
  const centerRouteInVisibleMap = useCallback((
    coords: { latitude: number; longitude: number }[],
    panelHeightOverride?: number,
  ) => {
    if (!isMapReady || coords.length < 2) return;
    const panelHeight = panelHeightOverride ?? bookingPanelMapInset;
    const topPadding = insets.top + (Platform.OS === 'web' ? 92 : 42);
    const bottomPadding = panelHeight + insets.bottom + 36;

    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: {
        top: topPadding,
        right: 54,
        bottom: bottomPadding,
        left: 54,
      },
      animated: true,
    });
  }, [bookingPanelMapInset, insets.bottom, insets.top, isMapReady]);
  const animatedRouteCoords = useMemo(
    () => {
      if (visibleRouteCoords.length < 2) return [];
      return sliceRouteByProgress(
        visibleRouteCoords,
        0,
        Math.min(routeAnimProgress, 1),
      );
    },
    [visibleRouteCoords, routeAnimProgress],
  );
  useEffect(() => {
    if (visibleRouteCoords.length < 2) {
      setRouteAnimProgress(0);
      return;
    }

    setRouteAnimProgress(0);
    const interval = setInterval(() => {
      setRouteAnimProgress(prev => {
        if (prev >= 1) {
          clearInterval(interval);
          return 1;
        }
        return Math.min(prev + ROUTE_DRAW_STEP, 1);
      });
    }, ROUTE_DRAW_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [visibleRouteCoords]);

  useEffect(() => {
    if (route && route.coordinates.length > 1) {
      setRouteCoords(route.coordinates);
      centerRouteInVisibleMap(route.coordinates);
    } else if (routePreviewCoords.length > 1) {
      setRouteCoords([]);
      centerRouteInVisibleMap(routePreviewCoords);
    } else {
      setRouteCoords([]);
    }
  }, [route, routePreviewCoords, centerRouteInVisibleMap]);

  // Fit map immediately when destination is set (before route loads)
  useEffect(() => {
    if (routePreviewCoords.length > 1) {
      centerRouteInVisibleMap(routePreviewCoords);
    }
    if (!showBooking || !destination) {
      setRouteCoords([]);
      setRouteAnimProgress(0);
    }
  }, [routePreviewCoords, centerRouteInVisibleMap, showBooking, destination]);

  useEffect(() => {
    if (!routeRecenterRequest || !showBooking || !destination || routeCenterCoords.length < 2) return;

    const task = InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        centerRouteInVisibleMap(routeCenterCoords, EXPANDED_PANEL_HEIGHT);
        setRouteRecenterRequest(0);
      });
    });

    return () => task.cancel();
  }, [
    routeRecenterRequest,
    showBooking,
    destination,
    routeCenterCoords,
    centerRouteInVisibleMap,
  ]);

  useEffect(() => {
    if (!isMapReady || !showBooking || routeCenterCoords.length < 2) return;
    centerRouteInVisibleMap(routeCenterCoords, bookingPanelMapInset);
  }, [
    isMapReady,
    showBooking,
    routeCenterCoords,
    bookingPanelMapInset,
    centerRouteInVisibleMap,
  ]);

  const openBooking = () => {
    setShowBooking(true);
    Animated.spring(sheetAnim, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
  };

  const doCloseBooking = useCallback(() => {
    bookingCloseRef.current?.spinShut();
    Animated.timing(sheetAnim, { toValue: activePanelHeight, duration: 250, useNativeDriver: true }).start(() => {
      setShowBooking(false);
      setDestText('');
      setDestination(null);
      setSuggestions([]);
      setRouteCoords([]);
      setRouteAnimProgress(0);
      setPickup({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        address: 'Current Location',
        locationType: 'precise',
      });
      requestAnimationFrame(() => centerMapOnUser(400, homePanelMapInset));
    });
  }, [activePanelHeight, homePanelMapInset, sheetAnim, userLocation.latitude, userLocation.longitude]);

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

  const handleLocationSearchText = (text: string) => {
    setLocationSearchText(text);
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    if (text.trim().length < 2) {
      setSuggestions([]);
      setLocationSearchLoading(false);
      return;
    }
    setLocationSearchLoading(true);
    geocodeTimer.current = setTimeout(async () => {
      const results = await geocodeAddress(text, userLocation);
      setSuggestions(results);
      setLocationSearchLoading(false);
    }, 350);
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
    editSheetKeyboardAnim.setValue(0);
    setEditingSavedLocation(null);
    setEditingSavedLabel('');
    setEditingSavedAddress('');
    Keyboard.dismiss();
  };

  closePendingSaveLocationRef.current = closePendingSaveLocation;
  closeEditSavedLocationRef.current = closeEditSavedLocation;

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

  const dismissEditFormSheet = useCallback(
    () => dismissFormSheetAnimated(
      () => closeEditSavedLocationRef.current(),
      () => editFormCloseRef.current?.spinShut(),
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

  const editFormSheetPanResponder = useMemo(
    () => createFormSheetPanResponder(
      () => closeEditSavedLocationRef.current(),
      () => editFormCloseRef.current?.spinShut(),
      progress => editFormCloseRef.current?.setSpinProgress(progress),
      () => editFormCloseRef.current?.spinOpen(),
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
    editSheetKeyboardAnim.setValue(0);
    setEditingSavedLocation(location);
    setEditingSavedLabel(location.label);
    setEditingSavedAddress(location.address ?? '');
    setPendingSaveLocation(null);
    setIsCustomSaveLabel(false);
    setCustomSaveLabel('');
    Keyboard.dismiss();
  };

  const renameSavedLocation = async () => {
    const label = editingSavedLabel.trim();
    const address = editingSavedAddress.trim();
    if (!editingSavedLocation || label.length === 0) return;

    const next = savedPlaces.map(place =>
      place.id === editingSavedLocation.id
        ? { ...place, label, address: address || place.address }
        : place
    );
    await persistSavedPlaces(next);
    showToast('Location updated', 'info');
    setEditingSavedLocation(null);
    setEditingSavedLabel('');
    setEditingSavedAddress('');
  };

  const openSavedLocationMap = () => {
    if (!editingSavedLocation) return;
    Keyboard.dismiss();
    setPinCoords(userLocation);
    setMapPicker('savedLocation');
  };

  const deleteSavedLocation = async () => {
    if (!editingSavedLocation) return;

    const next = savedPlaces.filter(place => place.id !== editingSavedLocation.id);
    await persistSavedPlaces(next);
    showToast('Location removed', 'error');
    setEditingSavedLocation(null);
    setEditingSavedLabel('');
    setEditingSavedAddress('');
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
    setBookLoading(true);
    try {
      await createRide(pickup, finalDestination, selectedVehicle);
      router.push('/searching');
    } finally {
      setBookLoading(false);
    }
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

  const dist = destination
    ? Math.sqrt(
        Math.pow((destination.latitude - pickup.latitude) * 111, 2) +
        Math.pow((destination.longitude - pickup.longitude) * 111, 2)
      )
    : 0;

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

  const homeMapLatitudeOffset = (homePanelMapInset / (2 * SCREEN_HEIGHT)) * HOME_LOCATION_DELTA;
  const homeInitialRegion = {
    latitude: userLocation.latitude - homeMapLatitudeOffset,
    longitude: userLocation.longitude,
    latitudeDelta: HOME_LOCATION_DELTA,
    longitudeDelta: HOME_LOCATION_DELTA,
  };

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
      {/* Map — full screen */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        initialRegion={homeInitialRegion}
        onMapReady={() => {
          setIsMapReady(true);
          if (routeCenterCoords.length > 1) {
            requestAnimationFrame(() => centerRouteInVisibleMap(routeCenterCoords, bookingPanelMapInset));
          } else if (!hasCenteredOnUserRef.current && !hasPreciseRouteLocations) {
            hasCenteredOnUserRef.current = true;
            centerMapOnUser(300);
          }
        }}
        showsUserLocation={false}
        showsMyLocationButton={false}
        followsUserLocation={false}
        userLocationAnnotationTitle=""
        mapType={mapType}
        customMapStyle={mapType === 'standard' ? darkMapStyle : undefined}
      >
        {animatedRouteCoords.length > 1 && (
          <Polyline
            coordinates={animatedRouteCoords}
            strokeColor={colors.destructiveHex}
            strokeWidth={4}
            lineCap="round"
            lineJoin="round"
          />
        )}

        {/* Pickup marker */}
        {shouldShowPickupMarker && (
          <Marker coordinate={{ latitude: pickup.latitude, longitude: pickup.longitude }} anchor={{ x: 0.5, y: 1 }}>
            <View style={styles.routeMarker}>
              <View style={[styles.routeMarkerDot, { backgroundColor: colors.primary }]} />
            </View>
          </Marker>
        )}

        {/* Dropoff marker */}
        {showBooking && destination && (
          <Marker coordinate={{ latitude: destination.latitude, longitude: destination.longitude }} anchor={{ x: 0.5, y: 1 }}>
            <View style={styles.routeMarker}>
              <View style={[styles.routeMarkerDot, { backgroundColor: colors.destructive }]} />
            </View>
          </Marker>
        )}

        {!showBooking && nearbyDrivers.map((driver, i) => {
          const legacyType = API_TO_LEGACY_VEHICLE[driver.transport_type as keyof typeof API_TO_LEGACY_VEHICLE] ?? 'moto';
          const isSelected = legacyType === selectedVehicle;
          return (
            <Marker
              key={`nearby-${driver.transport_type}-${i}`}
              coordinate={{ latitude: driver.approx_lat, longitude: driver.approx_lng }}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={false}
              zIndex={isSelected ? 3 : 1}
            >
              <View style={styles.driverPinContainer}>
                <VehicleMapMarker type={legacyType} dimmed={!isSelected} />
                {isSelected && driver.eta_minutes > 0 && (
                  <View style={[styles.driverEtaBadge, { backgroundColor: colors.primary }]}>
                    <Text style={[styles.driverEtaText, { color: colors.primaryForeground }]}>
                      {driver.eta_minutes} min
                    </Text>
                  </View>
                )}
              </View>
            </Marker>
          );
        })}

        {!locLoading && !hasPreciseRouteLocations && (
          <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 0.5 }} zIndex={2}>
            <View style={styles.youAreHereContainer}>
              <View style={[styles.youAreHereBubble, { backgroundColor: colors.primary }]}>
                <Text style={styles.youAreHereText}>You're Here</Text>
              </View>
              <View style={[styles.youAreHereTail, { borderTopColor: colors.primary }]} />
            </View>
          </Marker>
        )}
      </MapView>

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) + 12 }]}>
        <View
          style={[styles.topCard, { backgroundColor: colors.card }]}
        >
          <View style={styles.locationRow}>
            <View style={styles.locationIcon}>
              <Feather name="map-pin" size={16} color={colors.primary} />
            </View>
            <View style={styles.locationCopy}>
              <Text style={[styles.locationLabel, { color: colors.mutedForeground }]}>
                Current location
              </Text>
              <Text style={[styles.locationText, { color: colors.foreground }]} numberOfLines={1}>
                {locLoading ? 'Getting location...' : 'Kigali, Rwanda'}
              </Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.notifBtn, { backgroundColor: colors.card }]}
          onPress={() => router.push('/notifications')}
          activeOpacity={0.82}
        >
          <Feather name="bell" size={20} color={colors.foreground} />
          <View style={[styles.notifBadge, { backgroundColor: colors.destructive, borderColor: colors.card }]} />
        </TouchableOpacity>
      </View>

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
            {VEHICLE_TYPES.map(v => (
              <TouchableOpacity
                key={v}
                style={[styles.vehicleChip, { backgroundColor: selectedVehicle === v ? colors.primary : colors.muted, borderWidth: selectedVehicle === v ? 0 : 1, borderColor: colors.border }]}
                onPress={() => setSelectedVehicle(v)}
                activeOpacity={0.8}
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

      {/* Booking bottom sheet — same height as home panel, sits above tab bar */}
      {showBooking && (
        <>
          <KeyboardAvoidingView
            style={[styles.bookingSheetWrapper, { height: activePanelHeight }]}
            behavior={Platform.OS === 'ios' ? 'position' : 'height'}
            keyboardVerticalOffset={0}
          >
          <Animated.View
            style={[
              styles.bookingSheet,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                height: activePanelHeight,
                paddingBottom: homePanelNavPadding,
                transform: [{ translateY: sheetAnim }],
              },
            ]}
            {...bookingSheetPanResponder.panHandlers}
          >
            <View style={styles.formSheetCloseAnchor} pointerEvents="box-none">
              <CloseButton
                ref={bookingCloseRef}
                shutOnPress={false}
                onPress={closeBooking}
                accessibilityLabel="Close booking"
              />
            </View>
            <View style={styles.formSheetBody}>
            {/* Handle + header */}
            <View style={[styles.sheetDragZone, styles.formSheetDragZone]}>
              <View style={[styles.sheetHandleTouch, styles.formSheetHandleTouch]}>
                <View style={styles.sheetHandle} />
              </View>
              <View style={styles.formSheetHeader}>
                <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Book a Ride</Text>
              </View>
            </View>

            {/* Pickup / Destination */}
            <View style={[styles.locationCard, { backgroundColor: colors.muted }]}>
              <TouchableOpacity style={styles.locRow} onPress={() => openLocationSearch('pickup')} activeOpacity={0.75}>
                <View style={[styles.locDot, { backgroundColor: colors.primary }]} />
                <View style={styles.locTextBlock}>
                  <Text style={[styles.locInlineLabel, { color: colors.mutedForeground }]}>Pickup</Text>
                  <Text style={[styles.locValue, { color: colors.foreground }]} numberOfLines={1}>
                    {pickup.address || 'Enter pickup location'}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>

              <View style={[styles.locDivider, { backgroundColor: colors.border }]} />
              <TouchableOpacity style={styles.locRow} onPress={() => openLocationSearch('dropoff')} activeOpacity={0.75}>
                <View style={[styles.locDot, { backgroundColor: colors.destructive, borderRadius: 3 }]} />
                <View style={styles.locTextBlock}>
                  <Text style={[styles.locInlineLabel, { color: colors.mutedForeground }]}>Drop off</Text>
                  <Text style={[styles.locValue, { color: destination ? colors.foreground : colors.mutedForeground }]} numberOfLines={1}>
                    {destText || 'Where to?'}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>

            </View>

            {/* Contextual action row — changes based on focused field */}
            <View style={styles.locationActions}>
              <TouchableOpacity
                style={styles.currentLocBtn}
                onPress={() => {
                  Keyboard.dismiss();
                  const coords = focusedField === 'dropoff'
                    ? (destination ?? userLocation)
                    : userLocation;
                  setPinCoords({ latitude: coords.latitude, longitude: coords.longitude });
                  setMapPicker(focusedField ?? 'pickup');
                }}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="map-outline" size={16} color={colors.primary} />
                <Text style={[styles.currentLocText, { color: colors.primary }]} numberOfLines={1}>Use Map</Text>
              </TouchableOpacity>

              {focusedField === 'dropoff' ? (
                <TouchableOpacity
                  style={styles.currentLocBtn}
                  onPress={() => {
                    setDestText('Current Location');
                    setDestination({
                      latitude: userLocation.latitude,
                      longitude: userLocation.longitude,
                      address: 'Current Location',
                      locationType: 'precise',
                    });
                  }}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="crosshairs-gps" size={16} color={colors.primary} />
                  <Text style={[styles.currentLocText, { color: colors.primary }]} numberOfLines={1}>
                    Use GPS as destination
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.currentLocBtn}
                  onPress={() => setPickup({
                    latitude: userLocation.latitude,
                    longitude: userLocation.longitude,
                    address: 'Current Location',
                    locationType: 'precise',
                  })}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="crosshairs-gps" size={16} color={colors.primary} />
                  <Text style={[styles.currentLocText, { color: colors.primary }]} numberOfLines={1}>
                    Use GPS as pickup
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Find Driver — shows when destination selected OR when a name has been typed */}
            {destination && (
              <View style={styles.rideInfoRow}>
                <View style={[styles.rideInfoCard, { backgroundColor: colors.muted }]}>
                  <MaterialCommunityIcons name="clock-outline" size={16} color={colors.primary} />
                  <View style={styles.rideInfoText}>
                    <Text style={[styles.rideInfoLabel, { color: colors.mutedForeground }]}>Est. Time</Text>
                    <Text style={[styles.rideInfoValue, { color: colors.foreground }]}>
                      {routeLoading ? '...' : route ? formatDuration(route.durationSeconds) : `~${Math.round(dist * 3 + 5)} min`}
                    </Text>
                  </View>
                </View>
                <View style={[styles.rideInfoCard, { backgroundColor: colors.muted }]}>
                  <MaterialCommunityIcons name="map-marker-distance" size={16} color={colors.primary} />
                  <View style={styles.rideInfoText}>
                    <Text style={[styles.rideInfoLabel, { color: colors.mutedForeground }]}>Distance</Text>
                    <Text style={[styles.rideInfoValue, { color: colors.foreground }]}>
                      {routeLoading ? '...' : route ? formatDistance(route.distanceMeters) : `${dist.toFixed(1)} km`}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {(destination || destText.trim().length > 0) && (
              <View style={styles.findDriverAction}>
                <KandaButton
                  title="Find Driver"
                  onPress={handleBook}
                  fullWidth
                  size="sm"
                  loading={bookLoading}
                />
              </View>
            )}
            </View>
          </Animated.View>
          </KeyboardAvoidingView>
        </>
      )}
      {/* Map picker — full screen pin drag */}
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
                paddingTop: locationHeaderMetrics.contentTop + 12,
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
                placeholder={locationSearchTarget === 'pickup' ? 'Search pickup location' : 'Search drop off location'}
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
                      {suggestion.place_name}
                    </Text>
                    <Text style={[styles.locationOptionSub, { color: colors.mutedForeground }]}>Precise location</Text>
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

              {locationListTab === 'saved' && (
                <Text
                  style={[
                    styles.locationSectionTitle,
                    { color: colors.mutedForeground },
                    (locationSearchText.trim().length >= 2 || suggestions.length > 0) && styles.locationSectionTitleAfterSearch,
                  ]}
                >
                  Saved locations
                </Text>
              )}

              {locationListTab === 'saved' && savedLocations.length === 0 && (
                <View style={[styles.locationEmptyState, { backgroundColor: colors.card }]}>
                  <Feather name="bookmark" size={18} color={colors.mutedForeground} />
                  <Text style={[styles.locationEmptyText, { color: colors.mutedForeground }]}>
                    No saved places yet. Tap "Save" on any search result.
                  </Text>
                </View>
              )}
              {locationListTab === 'saved' && savedLocations.map((location, index) => (
                <TouchableOpacity
                  key={`${location.address}-${index}`}
                  style={[styles.locationOption, { borderBottomColor: colors.border }]}
                  onPress={() => applyLocation(locationSearchTarget, location)}
                  onLongPress={() => {
                    Alert.alert(location.label, location.address ?? '', [
                      { text: 'Edit', onPress: () => openSavedLocationMenu(location) },
                      {
                        text: 'Delete',
                        onPress: async () => {
                          const next = savedPlaces.filter(p => p.id !== location.id);
                          await persistSavedPlaces(next);
                          showToast('Location removed', 'error');
                        },
                      },
                      { text: 'Cancel', style: 'cancel' },
                    ]);
                  }}
                  delayLongPress={400}
                >
                  <View style={styles.locationOptionIcon}>
                    <Feather name="bookmark" size={16} color={colors.primary} />
                  </View>
                  <View style={styles.locationOptionText}>
                    <Text style={[styles.locationOptionTitle, { color: colors.foreground }]} numberOfLines={1}>
                      {location.label}
                    </Text>
                    <Text style={[styles.locationOptionSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {location.address}
                    </Text>
                  </View>
                  {savedPlaces.some(place => place.id === location.id) && (
                    <TouchableOpacity
                      style={styles.savedLocationMenuButton}
                      onPress={event => {
                        event.stopPropagation();
                        openSavedLocationMenu(location);
                      }}
                      activeOpacity={0.8}
                    >
                      <Feather name="more-horizontal" size={18} color={colors.foreground} />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              ))}

              {locationListTab === 'previous' && (
                <Text
                  style={[
                    styles.locationSectionTitle,
                    { color: colors.mutedForeground },
                    (locationSearchText.trim().length >= 2 || suggestions.length > 0) && styles.locationSectionTitleAfterSearch,
                  ]}
                >
                  Previous rides
                </Text>
              )}

              {locationListTab === 'previous' && recentLocations.length === 0 && (
                <View style={[styles.locationEmptyState, { backgroundColor: colors.card }]}>
                  <Feather name="clock" size={18} color={colors.mutedForeground} />
                  <Text style={[styles.locationEmptyText, { color: colors.mutedForeground }]}>
                    Previous ride locations will appear here.
                  </Text>
                </View>
              )}

              {locationListTab === 'previous' && recentLocations.map((location, index) => (
                <TouchableOpacity
                  key={`${location.address}-${index}-recent`}
                  style={[styles.locationOption, { borderBottomColor: colors.border }]}
                  onPress={() => applyLocation(locationSearchTarget, location)}
                >
                  <View style={styles.locationOptionText}>
                    <Text style={[styles.locationOptionTitle, { color: colors.foreground }]} numberOfLines={1}>
                      {location.address ?? 'Recent location'}
                    </Text>
                    <Text style={[styles.locationOptionSub, { color: colors.mutedForeground }]}>Previous ride</Text>
                  </View>
                </TouchableOpacity>
              ))}
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
                          isCustomSaveLabel ? Animated.multiply(editSheetKeyboardAnim, -1) : 0,
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
            <>
              <SheetBackdrop onPress={dismissEditFormSheet} animatedOpacity={formSheetBackdropOpacity} />

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
                    paddingBottom: insets.bottom + (Platform.OS === 'web' ? 78 : 64),
                    opacity: editSheetOpacityAnim,
                    transform: [
                      {
                        translateY: Animated.add(
                          formSheetDragAnim,
                          Animated.multiply(editSheetKeyboardAnim, -1),
                        ),
                      },
                    ],
                  },
                ]}
                {...editFormSheetPanResponder.panHandlers}
              >
                <View style={styles.formSheetCloseAnchor} pointerEvents="box-none">
                  <CloseButton
                    ref={editFormCloseRef}
                    shutOnPress={false}
                    onPress={dismissEditFormSheet}
                    accessibilityLabel="Close edit location"
                  />
                </View>
                <View style={styles.formSheetBody}>
                  <View style={[styles.sheetDragZone, styles.formSheetDragZone]}>
                    <View style={[styles.sheetHandleTouch, styles.formSheetHandleTouch]}>
                      <View style={styles.sheetHandle} />
                    </View>
                    <View style={styles.formSheetHeader}>
                      <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Edit saved location</Text>
                    </View>
                    <View style={styles.formSheetSubheader}>
                      <Text style={[styles.formSheetSubtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
                        {editingSavedLocation.address ?? 'Saved location'}
                      </Text>
                      <Text style={[styles.formSheetHint, { color: colors.mutedForeground }]}>
                        Rename, update, or delete this saved place.
                      </Text>
                    </View>
                  </View>

                <View style={styles.formSheetContent}>
                <View style={[styles.savedLocationEditInputWrap, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                  <Feather name="edit-3" size={16} color={colors.mutedForeground} />
                  <TextInput
                    style={[styles.savedLocationEditInput, { color: colors.foreground }]}
                    value={editingSavedLabel}
                    onChangeText={setEditingSavedLabel}
                    onFocus={() => {
                      Animated.spring(editSheetKeyboardAnim, {
                        toValue: estimatedKeyboardOffset,
                        damping: 24,
                        stiffness: 280,
                        mass: 0.8,
                        useNativeDriver: true,
                      }).start();
                    }}
                    placeholder="Location name"
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>

                <View style={[styles.savedLocationEditInputWrap, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                  <MaterialCommunityIcons name="map-marker-outline" size={18} color={colors.mutedForeground} />
                  <TextInput
                    style={[styles.savedLocationEditInput, { color: colors.foreground }]}
                    value={editingSavedAddress}
                    onChangeText={setEditingSavedAddress}
                    onFocus={() => {
                      Animated.spring(editSheetKeyboardAnim, {
                        toValue: estimatedKeyboardOffset,
                        damping: 24,
                        stiffness: 280,
                        mass: 0.8,
                        useNativeDriver: true,
                      }).start();
                    }}
                    placeholder="Address"
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>

                <View style={styles.savedLocationActions}>
                  <TouchableOpacity
                    style={[styles.savedLocationAction, { backgroundColor: colors.primary }]}
                    onPress={renameSavedLocation}
                    activeOpacity={0.85}
                  >
                    <Feather name="check" size={16} color={colors.primaryForeground} />
                    <Text style={[styles.savedLocationActionText, { color: colors.primaryForeground }]}>Save changes</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.savedLocationAction, { backgroundColor: colors.muted, borderColor: colors.border, borderWidth: 1 }]}
                    onPress={openSavedLocationMap}
                    activeOpacity={0.85}
                  >
                    <MaterialCommunityIcons name="crosshairs-gps" size={16} color={colors.foreground} />
                    <Text style={[styles.savedLocationActionText, { color: colors.foreground }]}>Use GPS</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.savedLocationDelete, { backgroundColor: colors.destructiveHex + '14', borderColor: colors.destructiveHex + '40' }]}
                  onPress={deleteSavedLocation}
                  activeOpacity={0.85}
                >
                  <Feather name="trash-2" size={16} color={colors.destructive} />
                  <Text style={[styles.savedLocationDeleteText, { color: colors.destructive }]}>Delete saved location</Text>
                </TouchableOpacity>
                </View>
                </View>
              </Animated.View>
            </>
          )}
        </View>
      )}

      {mapPicker !== null && (
        <View style={styles.mapPickerContainer}>
          <MapView
            ref={pickerMapRef}
            style={StyleSheet.absoluteFill}
            provider={PROVIDER_DEFAULT}
            initialRegion={{ ...pinCoords, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
            showsUserLocation={false}
            showsMyLocationButton={false}
            mapType={mapType}
            customMapStyle={mapType === 'standard' ? darkMapStyle : undefined}
            onRegionChangeComplete={region => {
              setPinCoords({ latitude: region.latitude, longitude: region.longitude });
            }}
          />

          {/* Fixed center pin */}
          <View style={styles.fixedPinContainer} pointerEvents="none">
            <MaterialCommunityIcons
              name="map-marker"
              size={48}
              color={colors.destructiveHex}
            />
          </View>

          {/* Top back button */}
          <BackButton
            style={[
              styles.mapPickerBack,
              { top: insets.top + (Platform.OS === 'web' ? 67 : 0) + 12 },
            ]}
            onPress={() => setMapPicker(null)}
          />

          <TouchableOpacity
            style={[
              styles.mapPickerControl,
              { backgroundColor: colors.card, top: insets.top + (Platform.OS === 'web' ? 67 : 0) + 12 },
            ]}
            onPress={cycleMapType}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name={mapType === 'standard' ? 'layers-outline' : mapType === 'satellite' ? 'satellite-variant' : 'map'}
              size={22}
              color={colors.primary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.mapPickerControl,
              { backgroundColor: colors.card, top: insets.top + (Platform.OS === 'web' ? 67 : 0) + 68 },
            ]}
            onPress={centerPickerOnUser}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="crosshairs-gps" size={22} color={colors.primary} />
          </TouchableOpacity>

          {/* Instruction label */}
          <View style={[styles.mapPickerHint, { backgroundColor: colors.card }]}>
            <Text style={[styles.mapPickerHintText, { color: colors.foreground }]}>
              {mapPicker === 'pickup'
                ? 'Drag the map to set your pickup location'
                : mapPicker === 'savedLocation'
                  ? 'Drag the map to update this saved location'
                  : 'Drag the map to set your drop off location'}
            </Text>
          </View>

          {/* Confirm button */}
          <View style={[
            styles.mapPickerFooter,
            { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 84 : 80) + 16 },
          ]}>
            <KandaButton
              title={
                mapPicker === 'pickup'
                  ? 'Confirm Pickup Location'
                  : mapPicker === 'savedLocation'
                    ? 'Confirm Saved Location'
                    : 'Confirm Drop Off Location'
              }
              fullWidth
              size="lg"
              onPress={async () => {
                let address =
                  mapPicker === 'pickup'
                    ? 'Selected Pickup'
                    : mapPicker === 'savedLocation'
                      ? 'Selected Saved Location'
                      : 'Selected Drop Off';
                try {
                  const [geo] = await Location.reverseGeocodeAsync(pinCoords).catch(() => [null]);
                  if (geo) address = `${geo.street ?? ''} ${geo.city ?? ''}`.trim() || address;
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
        </View>
      )}
    </View>
  );
}

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#4b6878' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#98a5be' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
];

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, gap: 10, zIndex: 10 },
  topCard: { flex: 1, minHeight: BUTTON_HEIGHT.sm, borderRadius: buttonCornerRadius(BUTTON_HEIGHT.sm), paddingHorizontal: 12, paddingVertical: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  locationRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  locationIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  locationCopy: { flex: 1, alignItems: 'center', minWidth: 0 },
  locationLabel: { fontSize: 9, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase' },
  locationText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', maxWidth: '100%', textAlign: 'center' },
  notifBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  notifBadge: { position: 'absolute', top: 10, right: 11, width: 8, height: 8, borderRadius: 4, borderWidth: 1.5 },
  recenterBtn: { position: 'absolute', right: 16, width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 6 },
  mapLayerBtn: { position: 'absolute', right: 16, width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 6 },
  youAreHereContainer: { alignItems: 'center' },
  youAreHereBubble: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
  youAreHereText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  youAreHereTail: { width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  // Nearby driver pins
  driverPinContainer: { alignItems: 'center' },
  driverEtaBadge: { marginTop: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.22, shadowRadius: 3, elevation: 3 },
  driverEtaText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  // Home bottom panel — edge-to-edge bottom sheet (top corners rounded)
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: SCREEN_WIDTH,
    ...floatingPanelSurface,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingTop: 22,
    paddingHorizontal: 22,
    gap: 10,
  },
  greeting: { fontSize: 20, fontFamily: 'Inter_700Bold', textAlign: 'left', marginLeft: GREETING_LEFT_INSET },
  selectRide: { fontSize: 14, fontFamily: 'Inter_500Medium', textAlign: 'left', marginTop: -4, marginLeft: GREETING_LEFT_INSET },
  vehicleRow: { flexDirection: 'row', gap: 8, marginTop: 2, marginHorizontal: GREETING_LEFT_INSET },
  vehicleChip: { flex: 1, flexDirection: 'column', alignItems: 'center', paddingVertical: 7, borderRadius: 14, gap: 4, minHeight: 56, justifyContent: 'center' },
  vehicleLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  continueBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 50, borderRadius: buttonCornerRadius(50), gap: 8, marginTop: 4, marginHorizontal: GREETING_LEFT_INSET },
  continueBtnText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  // Booking sheet
  bookingSheetWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: SCREEN_WIDTH,
    zIndex: 30,
    overflow: 'visible',
  },
  bookingSheet: {
    ...floatingPanelSurface,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingTop: 0,
    gap: 0,
    overflow: 'visible',
  },
  overlayFormSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    width: SCREEN_WIDTH,
  },
  overlayFormSheetRaised: {
    zIndex: 90,
  },
  formSheetSurface: {
    ...floatingPanelSurface,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingTop: 0,
    gap: 0,
    overflow: 'visible',
  },
  formSheetBody: {
    paddingHorizontal: BOOKING_SHEET_PADDING_H,
    gap: 10,
  },
  formSheetDragZone: { paddingTop: 0, paddingBottom: 0, marginTop: 0 },
  formSheetHandleTouch: { paddingTop: 6, paddingBottom: 4, marginBottom: 0 },
  formSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: GREETING_LEFT_INSET,
    paddingRight: 52,
    minHeight: 44,
  },
  formSheetSubheader: {
    paddingLeft: GREETING_LEFT_INSET,
    paddingRight: 52,
    gap: 4,
    paddingBottom: 2,
  },
  formSheetContent: {
    marginHorizontal: GREETING_LEFT_INSET,
    gap: 10,
  },
  formSheetSubtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  formSheetHint: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  formSheetCloseAnchor: {
    position: 'absolute',
    top: BOOKING_CLOSE_EDGE_INSET - BOOKING_CLOSE_ROTATION_PAD,
    right: BOOKING_CLOSE_EDGE_INSET - BOOKING_CLOSE_ROTATION_PAD,
    width: 44 + BOOKING_CLOSE_ROTATION_PAD * 2,
    height: 44 + BOOKING_CLOSE_ROTATION_PAD * 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  sheetDragZone: { paddingTop: 4, paddingBottom: 2 },
  sheetHandleTouch: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: 10, marginBottom: -2 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#3A3A3A' },
  sheetTitle: { flex: 1, fontSize: 16, fontFamily: 'Inter_600SemiBold', marginRight: 8 },
  locationCard: {
    borderRadius: 15,
    padding: 10,
    marginHorizontal: GREETING_LEFT_INSET,
  },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  locDot: { width: 12, height: 12, borderRadius: 6 },
  locLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', marginBottom: 2 },
  locInlineLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase' },
  locTextBlock: { flex: 1, gap: 2 },
  locValue: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  locDivider: { height: 1, marginLeft: 24 },
  currentLocBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 1, flexShrink: 1, maxWidth: '52%' },
  currentLocText: { fontSize: 12, fontFamily: 'Inter_500Medium', flexShrink: 1 },
  locationActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginHorizontal: GREETING_LEFT_INSET },
  rideInfoRow: { flexDirection: 'row', gap: 6, marginHorizontal: GREETING_LEFT_INSET },
  rideInfoCard: { flex: 1, minHeight: 40, flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 9, borderRadius: 14, gap: 5 },
  findDriverAction: { marginTop: 'auto', paddingTop: 4, paddingBottom: 2, marginHorizontal: GREETING_LEFT_INSET },
  rideInfoText: { flex: 1, gap: 2 },
  rideInfoValue: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  rideInfoLabel: { fontSize: 9, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase' },
  suggestionsBox: { borderRadius: 10, marginTop: 4, overflow: 'hidden' },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  suggestionText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular' },
  routeMarker: { alignItems: 'center' },
  routeMarkerDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#fff' },
  vehicleMarkerShadow: {
    position: 'absolute',
    width: 52,
    height: 18,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.28)',
    transform: [{ translateY: 8 }, { rotate: '-8deg' }],
  },
  motoSprite: {
    width: 58,
    height: 34,
  },
  motoWheel: {
    position: 'absolute',
    bottom: 3,
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: '#101010',
    borderWidth: 3,
    borderColor: '#EDEDED',
  },
  motoRearWheel: { left: 3 },
  motoFrontWheel: { right: 3 },
  motoFrame: {
    position: 'absolute',
    left: 15,
    right: 13,
    bottom: 12,
    height: 6,
    borderRadius: 4,
    backgroundColor: '#F8F8F8',
    borderWidth: 1,
    borderColor: '#CFCFCF',
  },
  motoSeat: {
    position: 'absolute',
    left: 17,
    top: 8,
    width: 23,
    height: 9,
    borderRadius: 8,
    backgroundColor: '#151515',
  },
  motoTank: {
    position: 'absolute',
    left: 31,
    top: 11,
    width: 20,
    height: 14,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  motoTankMark: {
    fontSize: 12,
    lineHeight: 13,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
  motoFrontFork: {
    position: 'absolute',
    right: 12,
    top: 9,
    width: 3,
    height: 19,
    borderRadius: 2,
    backgroundColor: '#F8F8F8',
    transform: [{ rotate: '-22deg' }],
  },
  motoHandlebar: {
    position: 'absolute',
    right: 7,
    top: 4,
    width: 10,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#151515',
    transform: [{ rotate: '-22deg' }],
  },
  carSprite: {
    width: 31,
    height: 54,
    borderRadius: 15,
    backgroundColor: '#ECECEC',
    borderWidth: 2,
    borderColor: '#9CA3AF',
    alignItems: 'center',
    overflow: 'hidden',
  },
  pickupSprite: {
    width: 34,
    height: 60,
    borderRadius: 11,
  },
  truckSprite: {
    width: 38,
    height: 66,
    borderRadius: 8,
  },
  carTopLight: {
    width: 18,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#F9FAFB',
    marginTop: 3,
  },
  carWindshield: {
    width: 22,
    height: 12,
    borderRadius: 5,
    backgroundColor: '#161616',
    marginTop: 3,
  },
  carCabin: {
    width: 24,
    flex: 1,
    borderRadius: 8,
    marginTop: 3,
    borderWidth: 1,
    borderColor: '#C9CED3',
  },
  cargoBed: {
    position: 'absolute',
    bottom: 9,
    width: 26,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#B3BAC1',
    backgroundColor: '#BEC5CB',
  },
  carRearGlass: {
    width: 20,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#333333',
    marginBottom: 3,
  },
  carTailLights: {
    position: 'absolute',
    bottom: 0,
    left: 5,
    right: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  carTailLight: {
    width: 8,
    height: 4,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  // Full-screen location search
  locationSearchScreen: { ...StyleSheet.absoluteFillObject, zIndex: 80, flex: 1 },
  locationSearchBody: { flex: 1 },
  locationSearchFixed: { paddingHorizontal: 20 },
  locationSearchScroll: { flex: 1 },
  locationSearchInputWrap: {
    height: 52,
    borderRadius: buttonCornerRadius(52),
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  locationSearchInput: { flex: 1, fontSize: 16, fontFamily: 'Inter_500Medium' },
  locationSearchClear: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationSearchList: { paddingTop: 8 },
  locationQuickRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    marginBottom: 6,
  },
  locationQuickCard: {
    flex: 1,
    minHeight: 62,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 6,
  },
  locationQuickIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationQuickText: {
    gap: 1,
  },
  locationQuickTitle: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  locationQuickSub: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  locationTabs: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
    marginTop: 12,
    marginBottom: 8,
    gap: 4,
  },
  locationTab: {
    flex: 1,
    minHeight: 38,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  locationTabText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  locationSectionTitle: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
    marginTop: 4,
    marginBottom: 6,
  },
  locationSectionTitleAfterSearch: {
    marginTop: 18,
  },
  locationOption: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
  locationOptionIcon: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationOptionText: { flex: 1, gap: 2 },
  locationOptionTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  locationOptionSub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  savedLocationMenuButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveLocationButton: {
    minWidth: 54,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  saveLocationButtonText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  locationEmptyState: {
    minHeight: 76,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  locationEmptyText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
  saveAsLocationLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  saveAsLocationLabel: {
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveAsLocationLabelText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  saveAsCustomLabelSection: {
    gap: 12,
  },
  saveAsLocationInputWrap: {
    height: 52,
    borderRadius: buttonCornerRadius(52),
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  saveAsLocationInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
  },
  saveAsCustomLabelButton: {
    minHeight: 52,
    borderRadius: buttonCornerRadius(52),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveAsCustomLabelButtonText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  saveLocationLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  saveLocationLabel: {
    minHeight: 36,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveLocationLabelText: {
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
  },
  customSaveLabelSection: {
    gap: 10,
  },
  customSaveLabelButton: {
    minHeight: 46,
    borderRadius: buttonCornerRadius(46),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  customSaveLabelButtonText: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
  },
  savedLocationEditInputWrap: {
    height: 48,
    borderRadius: buttonCornerRadius(48),
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  savedLocationEditInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  savedLocationActions: {
    flexDirection: 'row',
    gap: 10,
  },
  savedLocationAction: {
    flex: 1,
    minHeight: 46,
    borderRadius: buttonCornerRadius(46),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  savedLocationActionText: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
  },
  savedLocationDelete: {
    minHeight: 46,
    borderRadius: buttonCornerRadius(46),
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  savedLocationDeleteText: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
  },
  // Map picker
  mapPickerContainer: { ...StyleSheet.absoluteFillObject, zIndex: 120 },
  fixedPinContainer: { position: 'absolute', top: '50%', left: '50%', marginLeft: -24, marginTop: -48 },
  mapPickerBack: { position: 'absolute', left: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 6 },
  mapPickerControl: { position: 'absolute', right: 16, width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 6 },
  mapPickerHint: { position: 'absolute', top: '18%', alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 },
  mapPickerHintText: { fontSize: 13, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  mapPickerFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20 },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  loaderText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});
