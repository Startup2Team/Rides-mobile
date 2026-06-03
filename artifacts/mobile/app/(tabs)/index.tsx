import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { router, useFocusEffect, usePathname } from 'expo-router';
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
import { EditSavedLocationSheet } from '@/components/EditSavedLocationSheet';
import { HomeTopHeader } from '@/components/HomeTopHeader';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { GlassScrollView } from '@/components/GlassScrollView';
import { AppButton } from '@/components/AppButton';
import { VehicleTypeIcon } from '@/components/VehicleTypeIcon';
import { buttonCornerRadius, BUTTON_HEIGHT } from '@/constants/buttons';
import { floatingPanelSurface } from '@/constants/surfaces';
import { SheetBackdrop } from '@/components/SheetBackdrop';
import { useColors } from '@/hooks/useColors';
import { useRoute } from '@/hooks/useRoute';
import { useAuth } from '@/context/AuthContext';
import { useRide } from '@/context/RideContext';
import { useSavedLocations } from '@/hooks/useSavedLocations';
import { useToast } from '@/context/ToastContext';
import { geocodeAddress, GeocodeSuggestion } from '@/services/geocoding';
import {
  formatDistance,
  formatDuration,
  routeLineEndpoints,
  sampleRouteCoordsForFit,
} from '@/utils/mapUtils';
import { arePickupAndDropoffSame, formatReverseGeocodeAddress, getCoordDistance } from '@/utils/locationUtils';
import { KIGALI_CENTER, RideLocation, SavedLocation, VehicleType, VEHICLE_BASE_FARE, VEHICLE_LABELS } from '@/types';
import {
  LOCATION_MAP_PIN_ANCHOR,
  LOCATION_MAP_PIN_CENTER_OFFSET,
  LocationMapPin,
} from '@/components/maps/LocationMapPin';
import { VehicleMapMarker } from '@/components/VehicleMapMarker';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Compact until ride details/actions appear; expanded when stats and Find Driver are visible.
// ~0.3 cm shorter than prior compact/expanded sizes (~11pt)
const COMPACT_PANEL_HEIGHT = Math.min(SCREEN_HEIGHT * 0.375, 297);
const EXPANDED_PANEL_HEIGHT = Math.round(SCREEN_HEIGHT * 0.5);
const ROUTE_DRAW_STEP = 0.055;
const ROUTE_DRAW_INTERVAL_MS = 45;
const HOME_LOCATION_DELTA = 0.012;
const ROUTE_FIT_SIDE_PADDING = 32;
/** Space below top location card overlay on booking map. */
const BOOKING_MAP_TOP_OVERLAY = 88;
const HOME_TAB_BAR_HEIGHT = Platform.OS === 'web' ? 84 : 64;
/** Lift save-form overlay (translateY) above the software keyboard. */
function computeOverlayFormKeyboardLift(keyboardHeight: number, bottomInset: number): number {
  return Math.max(0, keyboardHeight - bottomInset);
}

function computeOverlayFormKeyboardLiftFromFrame(screenHeight: number, keyboardScreenY: number, bottomInset: number): number {
  return Math.max(0, screenHeight - keyboardScreenY - bottomInset);
}

const HOME_FLOATING_PANEL_FALLBACK_HEIGHT = 236;
/** ~0.5cm extra inset for floating panel content alignment. */
const GREETING_LEFT_INSET = 14;
const BOOKING_SHEET_PADDING_H = 22;
/** Equal inset from top + right form edges for the booking close control. */
const BOOKING_CLOSE_EDGE_INSET = 16;
/** Extra room so the close icon can spin during sheet drag without clipping. */
const BOOKING_CLOSE_ROTATION_PAD = 10;
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

const DRIVER_OFFSETS = [
  { lat:  0.0018, lng:  0.0022 }, { lat: -0.0025, lng:  0.0015 },
  { lat:  0.0031, lng: -0.0018 }, { lat: -0.0012, lng: -0.0030 },
  { lat:  0.0008, lng:  0.0038 }, { lat: -0.0040, lng:  0.0008 },
  { lat:  0.0022, lng: -0.0035 }, { lat: -0.0035, lng: -0.0020 },
  { lat:  0.0045, lng:  0.0012 }, { lat: -0.0018, lng:  0.0042 },
  { lat:  0.0010, lng: -0.0048 }, { lat: -0.0050, lng:  0.0030 },
  { lat:  0.0038, lng:  0.0040 }, { lat: -0.0028, lng: -0.0045 },
  { lat:  0.0055, lng: -0.0010 }, { lat: -0.0060, lng:  0.0018 },
  { lat:  0.0015, lng:  0.0055 }, { lat: -0.0042, lng: -0.0055 },
  { lat:  0.0062, lng:  0.0032 }, { lat: -0.0070, lng: -0.0025 },
];


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
      shadowOpacity: isDark ? 0.55 : 0.25,
    }),
    [colors.card, isDark],
  );
  const insets = useSafeAreaInsets();
  const locationHeaderMetrics = useGlassHeaderMetrics();
  const { user, driverProfile } = useAuth();
  const { currentRide, createRide, rideHistory, loadHistory, isMatchingPaused } = useRide();
  const pathname = usePathname();
  const lastRideFlowStatusRef = useRef<string | null>(null);
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
  const [isPickerDragging, setIsPickerDragging] = useState(false);
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
  const [editingSavedFocusedField, setEditingSavedFocusedField] = useState<'label' | 'address' | null>(null);
  const [editSavedFieldErrors, setEditSavedFieldErrors] = useState<{
    label?: string;
    address?: string;
  }>({});
  const [routeAnimProgress, setRouteAnimProgress] = useState(0);
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
    if (!currentRide) {
      lastRideFlowStatusRef.current = null;
      return;
    }
    if (currentRide.status === 'negotiating' && !isMatchingPaused) {
      lastRideFlowStatusRef.current = null;
      if (pathname !== '/negotiation') {
        router.push('/negotiation');
      }
      return;
    }
    const rideFlowStatuses = ['confirmed', 'arriving', 'arrived', 'in_progress'] as const;
    if (!rideFlowStatuses.includes(currentRide.status as (typeof rideFlowStatuses)[number])) {
      lastRideFlowStatusRef.current = null;
      return;
    }
    const alreadyInRideFlow =
      lastRideFlowStatusRef.current !== null &&
      rideFlowStatuses.includes(
        lastRideFlowStatusRef.current as (typeof rideFlowStatuses)[number],
      );
    if (!alreadyInRideFlow && pathname !== '/ride') {
      router.replace('/ride');
    }
    lastRideFlowStatusRef.current = currentRide.status;
  }, [currentRide?.status, isMatchingPaused, pathname]);

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

  const shouldLiftSaveFormForKeyboard = Boolean(pendingSaveLocation);
  const shouldLiftSaveFormForKeyboardRef = useRef(shouldLiftSaveFormForKeyboard);
  shouldLiftSaveFormForKeyboardRef.current = shouldLiftSaveFormForKeyboard;

  const applySaveFormKeyboardLift = useCallback(
    (lift: number, duration = 220) => {
      if (!shouldLiftSaveFormForKeyboardRef.current) return;
      const clampedLift = Math.max(0, lift);
      Animated.timing(saveSheetKeyboardAnim, {
        toValue: clampedLift,
        duration,
        useNativeDriver: true,
      }).start();
    },
    [saveSheetKeyboardAnim],
  );

  useEffect(() => {
    if (!shouldLiftSaveFormForKeyboard) {
      saveSheetKeyboardAnim.setValue(0);
      return;
    }

    if (Platform.OS === 'ios') {
      const frameSub = Keyboard.addListener('keyboardWillChangeFrame', event => {
        if (!shouldLiftSaveFormForKeyboardRef.current) return;
        const lift = computeOverlayFormKeyboardLiftFromFrame(
          SCREEN_HEIGHT,
          event.endCoordinates.screenY,
          insets.bottom,
        );
        applySaveFormKeyboardLift(lift, event.duration ?? 250);
      });
      return () => frameSub.remove();
    }

    const showSub = Keyboard.addListener('keyboardDidShow', event => {
      if (!shouldLiftSaveFormForKeyboardRef.current) return;
      applySaveFormKeyboardLift(
        computeOverlayFormKeyboardLift(event.endCoordinates.height, insets.bottom),
        event.duration ?? 220,
      );
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', event => {
      applySaveFormKeyboardLift(0, event.duration ?? 180);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [applySaveFormKeyboardLift, insets.bottom, shouldLiftSaveFormForKeyboard]);

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

      setUserLocation(coords);
      setPickup({
        ...coords,
        address: formatReverseGeocodeAddress(geo),
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
    () => destination
      ? [
          { latitude: pickup.latitude, longitude: pickup.longitude },
          { latitude: destination.latitude, longitude: destination.longitude },
        ]
      : [],
    [
      pickup.latitude,
      pickup.longitude,
      destination?.latitude,
      destination?.longitude,
    ],
  );
  const visibleRouteCoords = routeCoords.length > 1 ? routeCoords : [];
  const routeCenterCoords = routeCoords.length > 1 ? routeCoords : routePreviewCoords;
  const routeFitCoords = useMemo(() => {
    if (routeCenterCoords.length < 2) return [];
    if (!destination) return sampleRouteCoordsForFit(routeCenterCoords);
    const withEndpoints = [
      { latitude: pickup.latitude, longitude: pickup.longitude },
      ...routeCenterCoords,
      { latitude: destination.latitude, longitude: destination.longitude },
    ];
    return sampleRouteCoordsForFit(withEndpoints);
  }, [
    routeCenterCoords,
    destination,
    pickup.latitude,
    pickup.longitude,
  ]);
  const centerRouteInVisibleMap = useCallback((
    coords: { latitude: number; longitude: number }[],
    panelHeightOverride?: number,
  ) => {
    if (!isMapReady || !showBooking || coords.length < 2) return;
    const panelHeight =
      panelHeightOverride ??
      (destination ? EXPANDED_PANEL_HEIGHT : bookingPanelMapInset);
    const topPadding =
      insets.top + (Platform.OS === 'web' ? 96 : BOOKING_MAP_TOP_OVERLAY);
    const bottomPadding = panelHeight + insets.bottom;

    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: {
        top: topPadding,
        right: ROUTE_FIT_SIDE_PADDING,
        bottom: bottomPadding,
        left: ROUTE_FIT_SIDE_PADDING,
      },
      animated: true,
    });
  }, [bookingPanelMapInset, destination, insets.bottom, insets.top, isMapReady, showBooking]);
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

  const routePinPositions = useMemo(() => {
    const fallbackPickup = { latitude: pickup.latitude, longitude: pickup.longitude };
    if (!destination) {
      return { pickup: fallbackPickup, destination: null as { latitude: number; longitude: number } | null };
    }
    const fallbackDestination = {
      latitude: destination.latitude,
      longitude: destination.longitude,
    };
    const routeGeometry =
      visibleRouteCoords.length > 1
        ? visibleRouteCoords
        : routePreviewCoords.length > 1
          ? routePreviewCoords
          : null;
    const { start, end } = routeLineEndpoints(routeGeometry, fallbackPickup, fallbackDestination);
    return { pickup: start, destination: end };
  }, [
    destination,
    pickup.latitude,
    pickup.longitude,
    routePreviewCoords,
    visibleRouteCoords,
  ]);

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
    } else if (routePreviewCoords.length > 1) {
      setRouteCoords([]);
    } else {
      setRouteCoords([]);
    }
  }, [route, routePreviewCoords]);

  useEffect(() => {
    if (!showBooking || !destination) {
      setRouteCoords([]);
      setRouteAnimProgress(0);
    }
  }, [showBooking, destination]);

  // Fit route inside the visible map band (above the booking sheet), centered.
  useEffect(() => {
    if (!showBooking || !destination || routeFitCoords.length < 2) return;

    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let lateRetryTimer: ReturnType<typeof setTimeout> | null = null;

    const runFit = () => {
      centerRouteInVisibleMap(routeFitCoords, EXPANDED_PANEL_HEIGHT);
    };

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
  }, [
    showBooking,
    destination,
    routeFitCoords,
    activePanelHeight,
    routeRecenterRequest,
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
          if (routeFitCoords.length > 1 && showBooking && destination) {
            requestAnimationFrame(() =>
              centerRouteInVisibleMap(routeFitCoords, EXPANDED_PANEL_HEIGHT),
            );
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

        {shouldShowPickupMarker && (
          <Marker
            coordinate={routePinPositions.pickup}
            anchor={LOCATION_MAP_PIN_ANCHOR}
            centerOffset={LOCATION_MAP_PIN_CENTER_OFFSET}
            tracksViewChanges
          >
            <LocationMapPin variant="pickup" mapType={mapType} />
          </Marker>
        )}

        {showBooking && destination && (
          <Marker
            coordinate={routePinPositions.destination!}
            anchor={LOCATION_MAP_PIN_ANCHOR}
            centerOffset={LOCATION_MAP_PIN_CENTER_OFFSET}
            tracksViewChanges
          >
            <LocationMapPin variant="destination" mapType={mapType} />
          </Marker>
        )}

        {visibleDrivers.map(driver => (
          <Marker
            key={driver.id}
            coordinate={{ latitude: driver.latitude, longitude: driver.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            zIndex={1}
          >
            <VehicleMapMarker type={selectedVehicle} />
          </Marker>
        ))}

        {!locLoading && !hasPreciseRouteLocations && mapPicker === null && (
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

      {locationSearchTarget === null && mapPicker === null ? (
        <HomeTopHeader
          paddingTop={insets.top + (Platform.OS === 'web' ? 67 : 0) + 12}
          locationLabel="Current location"
          locationText={pickup.address ?? 'Set pickup location'}
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
                <AppButton
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
                <View
                  key={location.id ?? `${location.address}-${index}`}
                  style={[styles.locationOption, { borderBottomColor: colors.border }]}
                >
                  <TouchableOpacity
                    style={styles.locationOptionMain}
                    onPress={() => applyLocation(locationSearchTarget, location)}
                    onLongPress={() => showSavedLocationActions(location)}
                    delayLongPress={400}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel={`${location.label}, ${location.address ?? 'saved place'}`}
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
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.savedLocationMenuButton}
                    onPress={() => showSavedLocationActions(location)}
                    activeOpacity={0.8}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    accessibilityRole="button"
                    accessibilityLabel={`More options for ${location.label}`}
                  >
                    <Feather name="more-horizontal" size={18} color={colors.foreground} />
                  </TouchableOpacity>
                </View>
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
            onPanDrag={() => setIsPickerDragging(true)}
            onRegionChangeComplete={region => {
              setPinCoords({ latitude: region.latitude, longitude: region.longitude });
              setIsPickerDragging(false);
            }}
          />

          {/* Fixed center pin */}
          <View
            style={[styles.fixedPinContainer, isPickerDragging && styles.fixedPinContainerDragging]}
            pointerEvents="none"
          >
            <View style={[styles.uberPin, isPickerDragging && styles.uberPinDragging]}>
              <View style={styles.uberPinHead}>
                <View style={styles.uberPinSquare} />
              </View>
              <View style={[styles.uberPinStem, isPickerDragging && styles.uberPinStemDragging]} />
            </View>
            {isPickerDragging && <View style={styles.uberPinGroundDot} />}
          </View>

          {/* Top back button */}
          <BackButton
            style={[
              styles.mapPickerBack,
              { top: insets.top + (Platform.OS === 'web' ? 67 : 0) + 12 },
            ]}
            onPress={() => setMapPicker(null)}
          />

          <View style={styles.mapPickerControlsRail} pointerEvents="box-none">
            <TouchableOpacity
              style={[styles.mapPickerControl, { backgroundColor: colors.card }]}
              onPress={cycleMapType}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Change map view"
            >
              <MaterialCommunityIcons
                name={mapType === 'standard' ? 'layers-outline' : mapType === 'satellite' ? 'satellite-variant' : 'map'}
                size={22}
                color={colors.primary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.mapPickerControl, { backgroundColor: colors.card }]}
              onPress={centerPickerOnUser}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Recenter on your location"
            >
              <MaterialCommunityIcons name="crosshairs-gps" size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>

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
            <AppButton
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
                  if (geo) {
                    address = formatReverseGeocodeAddress(geo, address);
                  }
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
  recenterBtn: { position: 'absolute', right: 16, width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 6 },
  mapLayerBtn: { position: 'absolute', right: 16, width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 6 },
  youAreHereContainer: { alignItems: 'center' },
  youAreHereBubble: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
  youAreHereText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  youAreHereTail: { width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
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
    borderTopWidth: 0,
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
  locationSearchEmpty: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
    paddingVertical: 12,
    paddingHorizontal: 4,
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
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
  locationOptionMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
    paddingRight: 4,
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
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
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
  // Map picker
  mapPickerContainer: { ...StyleSheet.absoluteFillObject, zIndex: 120 },
  fixedPinContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 46,
    height: 94,
    marginLeft: -23,
    marginTop: -42,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  fixedPinContainerDragging: {
    marginTop: -60,
  },
  uberPin: {
    width: 20,
    height: 54,
    alignItems: 'center',
  },
  uberPinDragging: {
    transform: [{ translateY: -4 }],
  },
  uberPinHead: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 8,
  },
  uberPinSquare: {
    width: 4,
    height: 4,
    backgroundColor: '#FFFFFF',
  },
  uberPinStem: {
    width: 2,
    height: 22,
    backgroundColor: '#111111',
  },
  uberPinStemDragging: {
    height: 32,
  },
  uberPinGroundDot: {
    position: 'absolute',
    top: 57,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#111111',
  },
  mapPickerBack: { position: 'absolute', left: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 6 },
  mapPickerControlsRail: {
    position: 'absolute',
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    gap: 12,
  },
  mapPickerControl: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  mapPickerHint: { position: 'absolute', top: '18%', alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 },
  mapPickerHintText: { fontSize: 13, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  mapPickerFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20 },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  loaderText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});
