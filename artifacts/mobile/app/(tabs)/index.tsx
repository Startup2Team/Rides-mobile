import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { KandaButton } from '@/components/KandaButton';
import { useColors } from '@/hooks/useColors';
import { useRoute } from '@/hooks/useRoute';
import { useAuth } from '@/context/AuthContext';
import { useRide } from '@/context/RideContext';
import { geocodeAddress, GeocodeSuggestion } from '@/services/geocoding';
import { formatDistance, formatDuration } from '@/utils/mapUtils';
import { KIGALI_CENTER, RideLocation, VehicleType, VEHICLE_BASE_FARE, VEHICLE_MCI, VEHICLE_LABELS } from '@/types';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Compact until ride details/actions appear; expanded when stats and Find Driver are visible.
const COMPACT_PANEL_HEIGHT = Math.min(SCREEN_HEIGHT * 0.42, 330);
const EXPANDED_PANEL_HEIGHT = Math.min(SCREEN_HEIGHT * 0.58, 455);

const VEHICLE_TYPES: VehicleType[] = ['moto', 'cab', 'hilux', 'fuso'];
const SAVED_LOCATIONS_KEY = '@taravelis_saved_locations';
const SAVE_LOCATION_LABELS = ['Home', 'Work', 'School', 'Market', 'Other'];

interface SavedLocation extends RideLocation {
  id: string;
  label: string;
}

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

const VEHICLE_MARKER_IMAGES: Record<VehicleType, any> = {
  moto: require('../../assets/vehicle-markers/moto.png'),
  cab: require('../../assets/vehicle-markers/cab.png'),
  hilux: require('../../assets/vehicle-markers/hilux.png'),
  fuso: require('../../assets/vehicle-markers/fuso.png'),
};

const VEHICLE_IMAGE_STYLES: Record<VehicleType, { width: number; height: number }> = {
  moto: { width: 58, height: 44 },
  cab: { width: 54, height: 40 },
  hilux: { width: 64, height: 40 },
  fuso: { width: 66, height: 44 },
};

function calcEstFare(type: VehicleType, dist: number) {
  const base = VEHICLE_BASE_FARE[type];
  const perKm = type === 'moto' ? 200 : type === 'cab' ? 400 : type === 'hilux' ? 600 : 800;
  return Math.round((base + dist * perKm) / 100) * 100;
}

export default function CustomerHome() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { currentRide, createRide, rideHistory, loadHistory } = useRide();
  const mapRef = useRef<MapView>(null);
  const locationSearchInputRef = useRef<TextInput>(null);

  const [userLocation, setUserLocation] = useState(KIGALI_CENTER);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleType>('moto');
  const [locLoading, setLocLoading] = useState(true);

  // Booking sheet state
  const [showBooking, setShowBooking] = useState(false);
  const [mapPicker, setMapPicker] = useState<'pickup' | 'dropoff' | null>(null);
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
  const [savedPlaces, setSavedPlaces] = useState<SavedLocation[]>([]);
  const [pendingSaveLocation, setPendingSaveLocation] = useState<RideLocation | null>(null);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheetAnim = useRef(new Animated.Value(EXPANDED_PANEL_HEIGHT)).current;
  const hasRideActions = destination !== null || destText.trim().length > 0;
  const activePanelHeight = hasRideActions ? EXPANDED_PANEL_HEIGHT : COMPACT_PANEL_HEIGHT;
  const bookingBottomPadding = insets.bottom + (
    Platform.OS === 'web'
      ? hasRideActions ? 84 : 44
      : hasRideActions ? 80 : 36
  );

  // Redirect if active ride
  useEffect(() => {
    if (currentRide) {
      if (currentRide.status === 'searching') router.push('/searching');
      else if (currentRide.status === 'negotiating') router.push('/negotiation');
      else if (['confirmed', 'arriving', 'arrived', 'in_progress'].includes(currentRide.status)) router.push('/ride');
    }
  }, [currentRide?.status]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    AsyncStorage.getItem(SAVED_LOCATIONS_KEY)
      .then(value => {
        if (value) setSavedPlaces(JSON.parse(value));
      })
      .catch(() => {});
  }, []);

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

  // Real road route via Mapbox Directions API
  const { route, loading: routeLoading } = useRoute(
    showBooking ? { latitude: pickup.latitude, longitude: pickup.longitude } : null,
    showBooking && destination ? { latitude: destination.latitude, longitude: destination.longitude } : null,
  );

  // Mirror route coordinates into local state so MapView children re-render immediately
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  useEffect(() => {
    if (route && route.coordinates.length > 1) {
      setRouteCoords(route.coordinates);
      mapRef.current?.fitToCoordinates(route.coordinates, {
        edgePadding: { top: 80, right: 60, bottom: activePanelHeight + 160, left: 60 },
        animated: true,
      });
    } else {
      setRouteCoords([]);
    }
  }, [route]);

  // Fit map immediately when destination is set (before route loads)
  useEffect(() => {
    if (destination && showBooking) {
      mapRef.current?.fitToCoordinates(
        [
          { latitude: pickup.latitude, longitude: pickup.longitude },
          { latitude: destination.latitude, longitude: destination.longitude },
        ],
        { edgePadding: { top: 80, right: 60, bottom: activePanelHeight + 160, left: 60 }, animated: true },
      );
    }
    if (!destination) setRouteCoords([]);
  }, [destination?.latitude, destination?.longitude]);

  const openBooking = () => {
    setShowBooking(true);
    Animated.spring(sheetAnim, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
  };

  const closeBooking = () => {
    Animated.timing(sheetAnim, { toValue: activePanelHeight, duration: 250, useNativeDriver: true }).start(() => {
      setShowBooking(false);
      setDestText('');
      setDestination(null);
      setSuggestions([]);
    });
  };

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

    const saved: SavedLocation = {
      ...pendingSaveLocation,
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      label,
    };
    const next = [saved, ...savedPlaces.filter(place => place.label !== label)].slice(0, 20);
    setSavedPlaces(next);
    setPendingSaveLocation(null);
    setLocationListTab('saved');
    await AsyncStorage.setItem(SAVED_LOCATIONS_KEY, JSON.stringify(next));
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

  const handleBook = async () => {
    if (!destination && !destText.trim()) return;
    setBookLoading(true);
    // If user typed a name without selecting from autocomplete, use it as a generic location
    const finalDestination: RideLocation = destination
      ? { ...destination, locationType: destination.locationType ?? 'precise' }
      : {
          latitude: userLocation.latitude + 0.02,
          longitude: userLocation.longitude + 0.02,
          address: destText.trim(),
          locationType: 'generic',
        };
    await createRide(pickup, finalDestination, selectedVehicle);
    setBookLoading(false);
    closeBooking();
    router.push('/searching');
  };

  const dist = destination
    ? Math.sqrt(
        Math.pow((destination.latitude - pickup.latitude) * 111, 2) +
        Math.pow((destination.longitude - pickup.longitude) * 111, 2)
      )
    : 0;

  const visibleDrivers = useMemo(() => {
    return DRIVER_OFFSETS.map((offset, i) => ({
      id: `${selectedVehicle}-${i}`,
      latitude: userLocation.latitude + offset.lat,
      longitude: userLocation.longitude + offset.lng,
    }));
  }, [selectedVehicle, userLocation]);

  const savedLocations = useMemo<SavedLocation[]>(() => [
    ...savedPlaces,
    {
      id: 'current-location',
      label: 'Current',
      ...userLocation,
      address: 'Current Location',
      locationType: 'precise',
    },
    {
      id: 'kigali-city-center',
      label: 'City Center',
      latitude: -1.9441,
      longitude: 30.0619,
      address: 'Kigali City Center',
      locationType: 'precise',
    },
    {
      id: 'kigali-convention-centre',
      label: 'Convention Centre',
      latitude: -1.9536,
      longitude: 30.0926,
      address: 'Kigali Convention Centre',
      locationType: 'precise',
    },
  ], [savedPlaces, userLocation]);

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

  if (locLoading) {
    return (
      <View style={[styles.loaderContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loaderText, { color: colors.foreground }]}>
          Resolving precise GPS coordinates...
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
        initialRegion={{ ...userLocation, latitudeDelta: 0.04, longitudeDelta: 0.04 }}
        showsUserLocation={false}
        showsMyLocationButton={false}
        followsUserLocation={false}
        userLocationAnnotationTitle=""
        customMapStyle={darkMapStyle}
      >
        {/* Real road route polyline */}
        {showBooking && routeCoords.length > 1 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor="#FF3B30"
            strokeWidth={4}
            lineCap="round"
            lineJoin="round"
          />
        )}

        {/* Fallback dashed line while route is loading */}
        {showBooking && destination && routeCoords.length < 2 && (
          <Polyline
            coordinates={[
              { latitude: pickup.latitude, longitude: pickup.longitude },
              { latitude: destination.latitude, longitude: destination.longitude },
            ]}
            strokeColor="#FF3B3088"
            strokeWidth={3}
            lineDashPattern={[8, 6]}
          />
        )}

        {/* Pickup marker */}
        {showBooking && (
          <Marker coordinate={{ latitude: pickup.latitude, longitude: pickup.longitude }} anchor={{ x: 0.5, y: 1 }}>
            <View style={styles.routeMarker}>
              <View style={[styles.routeMarkerDot, { backgroundColor: '#00C853' }]} />
            </View>
          </Marker>
        )}

        {/* Dropoff marker */}
        {showBooking && destination && (
          <Marker coordinate={{ latitude: destination.latitude, longitude: destination.longitude }} anchor={{ x: 0.5, y: 1 }}>
            <View style={styles.routeMarker}>
              <View style={[styles.routeMarkerDot, { backgroundColor: '#FF3B30' }]} />
            </View>
          </Marker>
        )}

        {!locLoading && (
          <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 1 }}>
            <View style={styles.youAreHereContainer}>
              <View style={styles.youAreHereBubble}>
                <Text style={styles.youAreHereText}>You're Here</Text>
              </View>
              <View style={styles.youAreHereTail} />
            </View>
          </Marker>
        )}

        {visibleDrivers.map(driver => (
          <Marker
            key={driver.id}
            coordinate={{ latitude: driver.latitude, longitude: driver.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View style={styles.vehicleMarkerWrap}>
              <View style={styles.vehicleImageShadow} />
              <Image
                source={VEHICLE_MARKER_IMAGES[selectedVehicle]}
                style={[
                  styles.vehicleMarkerImage,
                  VEHICLE_IMAGE_STYLES[selectedVehicle],
                ]}
                resizeMode="contain"
              />
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) + 12 }]}>
        <View style={[styles.topCard, { backgroundColor: colors.card }]}>
          <View style={styles.locationRow}>
            <View style={[styles.locationDot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.locationText, { color: colors.foreground }]} numberOfLines={1}>
              {locLoading ? 'Getting location...' : 'Kigali, Rwanda'}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={[styles.notifBtn, { backgroundColor: colors.card }]}>
          <Feather name="bell" size={20} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* Recenter button */}
      <TouchableOpacity
        style={[styles.recenterBtn, { backgroundColor: colors.card, bottom: activePanelHeight + 16 }]}
        onPress={() => mapRef.current?.animateToRegion({ ...userLocation, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 600)}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="crosshairs-gps" size={22} color={colors.primary} />
      </TouchableOpacity>

      {/* Home bottom panel */}
      {!showBooking && (
        <View style={[styles.bottomPanel, { backgroundColor: colors.background, paddingBottom: insets.bottom + (Platform.OS === 'web' ? 28 : 55) }]}>
          <View style={styles.handle} />
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
                <MaterialCommunityIcons name={VEHICLE_MCI[v] as any} size={22} color={selectedVehicle === v ? colors.primaryForeground : colors.foreground} />
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

      {/* Distance & time floating cards — rendered outside booking block so they sit above the overlay */}
      {/* Booking bottom sheet — same height as home panel, sits above tab bar */}
      {showBooking && (
        <>
          <View pointerEvents="none" style={styles.overlay} />

          <KeyboardAvoidingView
            style={[styles.bookingSheetWrapper, { height: activePanelHeight }]}
            behavior={Platform.OS === 'ios' ? 'position' : 'height'}
            keyboardVerticalOffset={0}
          >
          <Animated.View
            style={[
              styles.bookingSheet,
              {
                backgroundColor: colors.background,
                height: activePanelHeight,
                paddingBottom: bookingBottomPadding,
                transform: [{ translateY: sheetAnim }],
              },
            ]}
          >
            {/* Handle + header */}
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Book a Ride</Text>
              <TouchableOpacity onPress={closeBooking}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {/* Pickup / Destination */}
            <View style={[styles.locationCard, { backgroundColor: colors.card }]}>
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
                <Text style={[styles.currentLocText, { color: colors.primary }]}>Use Map</Text>
              </TouchableOpacity>

              {focusedField === 'dropoff' ? (
                <TouchableOpacity
                  style={styles.currentLocBtn}
                  onPress={() => {
                    setDestText('Current Location');
                    setDestination({ latitude: userLocation.latitude, longitude: userLocation.longitude, address: 'Current Location' });
                  }}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="crosshairs-gps" size={16} color={colors.primary} />
                  <Text style={[styles.currentLocText, { color: colors.primary }]}>Use current location as destination</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.currentLocBtn}
                  onPress={() => setPickup({ latitude: userLocation.latitude, longitude: userLocation.longitude, address: 'Current Location' })}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="crosshairs-gps" size={16} color={colors.primary} />
                  <Text style={[styles.currentLocText, { color: colors.primary }]}>Use current location as pickup</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Find Driver — shows when destination selected OR when a name has been typed */}
            {destination && (
              <View style={styles.rideInfoRow}>
                <View style={[styles.rideInfoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <MaterialCommunityIcons name="clock-outline" size={18} color={colors.primary} />
                  <View style={styles.rideInfoText}>
                    <Text style={[styles.rideInfoLabel, { color: colors.mutedForeground }]}>Est. Time</Text>
                    <Text style={[styles.rideInfoValue, { color: colors.foreground }]}>
                      {routeLoading ? '...' : route ? formatDuration(route.durationSeconds) : `~${Math.round(dist * 3 + 5)} min`}
                    </Text>
                  </View>
                </View>
                <View style={[styles.rideInfoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <MaterialCommunityIcons name="map-marker-distance" size={18} color={colors.primary} />
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
              <KandaButton
                title="Find Driver"
                onPress={handleBook}
                fullWidth
                size="lg"
                loading={bookLoading}
              />
            )}
          </Animated.View>
          </KeyboardAvoidingView>
        </>
      )}
      {/* Map picker — full screen pin drag */}
      {locationSearchTarget && (
        <View style={[styles.locationSearchScreen, { backgroundColor: colors.background }]}>
          <View
            style={[
              styles.locationSearchHeader,
              {
                paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) + 12,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <TouchableOpacity style={styles.locationBackBtn} onPress={closeLocationSearch}>
              <Feather name="arrow-left" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.locationSearchTitle, { color: colors.foreground }]}>
              {locationSearchTarget === 'pickup' ? 'Pickup Location' : 'Drop off Location'}
            </Text>
            <View style={styles.locationBackBtn} />
          </View>

          <Pressable style={styles.locationSearchContent} onPress={Keyboard.dismiss}>
            <TouchableOpacity
              style={[styles.locationSearchInputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={event => {
                event.stopPropagation();
                locationSearchInputRef.current?.focus();
              }}
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
              {locationSearchText.length > 0 && (
                <TouchableOpacity
                  style={styles.locationSearchClear}
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
              {locationSearchLoading && <ActivityIndicator size="small" color={colors.primary} />}
            </TouchableOpacity>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              onScrollBeginDrag={Keyboard.dismiss}
              contentContainerStyle={styles.locationSearchList}
            >
              <View style={styles.locationQuickRow}>
                <TouchableOpacity
                  style={[styles.locationQuickCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => applyLocation(locationSearchTarget, { ...userLocation, address: 'Current Location', locationType: 'precise' })}
                  activeOpacity={0.85}
                >
                  <View style={[styles.locationQuickIcon, { backgroundColor: colors.primary + '18' }]}>
                    <MaterialCommunityIcons name="crosshairs-gps" size={16} color={colors.primary} />
                  </View>
                  <View style={styles.locationQuickText}>
                    <Text style={[styles.locationQuickTitle, { color: colors.foreground }]} numberOfLines={1}>Use current location</Text>
                    <Text style={[styles.locationQuickSub, { color: colors.mutedForeground }]} numberOfLines={1}>GPS precise</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.locationQuickCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={handleChooseOnMap}
                  activeOpacity={0.85}
                >
                  <View style={[styles.locationQuickIcon, { backgroundColor: colors.muted }]}>
                    <MaterialCommunityIcons name="map-outline" size={16} color={colors.foreground} />
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
                    locationListTab === 'saved' && { backgroundColor: colors.card },
                  ]}
                  onPress={() => setLocationListTab('saved')}
                  activeOpacity={0.85}
                >
                  <Text style={[
                    styles.locationTabText,
                    { color: locationListTab === 'saved' ? colors.foreground : colors.mutedForeground },
                  ]}>
                    Saved locations
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.locationTab,
                    locationListTab === 'previous' && { backgroundColor: colors.card },
                  ]}
                  onPress={() => setLocationListTab('previous')}
                  activeOpacity={0.85}
                >
                  <Text style={[
                    styles.locationTabText,
                    { color: locationListTab === 'previous' ? colors.foreground : colors.mutedForeground },
                  ]}>
                    Previous rides
                  </Text>
                </TouchableOpacity>
              </View>

              {(locationSearchText.trim().length >= 2 || suggestions.length > 0) && (
                <Text style={[styles.locationSectionTitle, { color: colors.mutedForeground }]}>Search results</Text>
              )}

              {locationSearchText.trim().length >= 2 && (
                <TouchableOpacity
                  style={[styles.locationOption, { borderBottomColor: colors.border }]}
                  onPress={() => applyLocation(locationSearchTarget, buildTypedLocation())}
                >
                  <View style={[styles.locationOptionIcon, { backgroundColor: colors.muted }]}>
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
                  <View style={[styles.locationOptionIcon, { backgroundColor: colors.muted }]}>
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

              {locationListTab === 'saved' && savedLocations.map((location, index) => (
                <TouchableOpacity
                  key={`${location.address}-${index}`}
                  style={[styles.locationOption, { borderBottomColor: colors.border }]}
                  onPress={() => applyLocation(locationSearchTarget, location)}
                >
                  <View style={styles.locationOptionText}>
                    <Text style={[styles.locationOptionTitle, { color: colors.foreground }]} numberOfLines={1}>
                      {location.label}
                    </Text>
                    <Text style={[styles.locationOptionSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {location.address}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}

              {locationListTab === 'previous' && recentLocations.length === 0 && (
                <View style={[styles.locationEmptyState, { borderColor: colors.border }]}>
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
            </ScrollView>
          </Pressable>

          {pendingSaveLocation && (
            <View
              style={[
                styles.saveLocationSheet,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 18),
                },
              ]}
            >
              <View style={styles.saveLocationHeader}>
                <View style={styles.saveLocationHeaderText}>
                  <Text style={[styles.saveLocationTitle, { color: colors.foreground }]}>Save location as</Text>
                  <Text style={[styles.saveLocationAddress, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {pendingSaveLocation.address ?? 'Selected location'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setPendingSaveLocation(null)} style={styles.saveLocationClose}>
                  <Feather name="x" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
              <View style={styles.saveLocationLabels}>
                {SAVE_LOCATION_LABELS.map(label => (
                  <TouchableOpacity
                    key={label}
                    style={[styles.saveLocationLabel, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => saveLocationAs(label)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.saveLocationLabelText, { color: colors.foreground }]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {mapPicker !== null && (
        <View style={styles.mapPickerContainer}>
          <MapView
            style={StyleSheet.absoluteFill}
            provider={PROVIDER_DEFAULT}
            initialRegion={{ ...pinCoords, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
            showsUserLocation={false}
            showsMyLocationButton={false}
            customMapStyle={darkMapStyle}
            onRegionChangeComplete={region => {
              setPinCoords({ latitude: region.latitude, longitude: region.longitude });
            }}
          />

          {/* Fixed center pin */}
          <View style={styles.fixedPinContainer} pointerEvents="none">
            <MaterialCommunityIcons
              name="map-marker"
              size={48}
              color={mapPicker === 'pickup' ? '#00C853' : '#FF4444'}
            />
          </View>

          {/* Top back button */}
          <TouchableOpacity
            style={[
              styles.mapPickerBack,
              { backgroundColor: colors.card, top: insets.top + (Platform.OS === 'web' ? 67 : 0) + 12 },
            ]}
            onPress={() => setMapPicker(null)}
          >
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>

          {/* Instruction label */}
          <View style={[styles.mapPickerHint, { backgroundColor: colors.card }]}>
            <Text style={[styles.mapPickerHintText, { color: colors.foreground }]}>
              {mapPicker === 'pickup'
                ? 'Drag the map to set your pickup location'
                : 'Drag the map to set your drop off location'}
            </Text>
          </View>

          {/* Confirm button */}
          <View style={[
            styles.mapPickerFooter,
            { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 84 : 80) + 16 },
          ]}>
            <KandaButton
              title={mapPicker === 'pickup' ? 'Confirm Pickup Location' : 'Confirm Drop Off Location'}
              fullWidth
              size="lg"
              onPress={async () => {
                let address = mapPicker === 'pickup' ? 'Selected Pickup' : 'Selected Drop Off';
                try {
                  const [geo] = await Location.reverseGeocodeAsync(pinCoords).catch(() => [null]);
                  if (geo) address = `${geo.street ?? ''} ${geo.city ?? ''}`.trim() || address;
                } catch {}
                if (mapPicker === 'pickup') {
                  setPickup({ ...pinCoords, address, locationType: 'precise' });
                } else {
                  setDestText(address);
                  setDestination({ ...pinCoords, address, locationType: 'precise' });
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
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', paddingHorizontal: 16, gap: 10, zIndex: 10 },
  topCard: { flex: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  locationDot: { width: 8, height: 8, borderRadius: 4 },
  locationText: { fontSize: 14, fontFamily: 'Inter_500Medium', flex: 1 },
  notifBtn: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  recenterBtn: { position: 'absolute', right: 16, width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 6 },
  youAreHereContainer: { alignItems: 'center' },
  youAreHereBubble: { backgroundColor: '#00C853', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
  youAreHereText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  youAreHereTail: { width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#00C853' },
  // Home bottom panel
  bottomPanel: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingHorizontal: 20, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 16 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#3A3A3A', alignSelf: 'center', marginBottom: 4 },
  greeting: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  selectRide: { fontSize: 14, fontFamily: 'Inter_500Medium', marginTop: -6 },
  vehicleRow: { flexDirection: 'row', gap: 8 },
  vehicleChip: { flex: 1, flexDirection: 'column', alignItems: 'center', paddingVertical: 10, borderRadius: 14, gap: 6 },
  vehicleLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  continueBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 52, borderRadius: 16, gap: 8 },
  continueBtnText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  // Booking sheet
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 20 },
  bookingSheetWrapper: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 30 },
  bookingSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 24 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#3A3A3A', alignSelf: 'center', marginBottom: 8 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  sheetTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  locationCard: { borderRadius: 16, padding: 16 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  locDot: { width: 12, height: 12, borderRadius: 6 },
  locLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', marginBottom: 2 },
  locInlineLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase' },
  locTextBlock: { flex: 1, gap: 2 },
  locValue: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  locDivider: { height: 1, marginLeft: 24 },
  currentLocBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  currentLocText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  locationActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rideInfoRow: { flexDirection: 'row', gap: 10 },
  rideInfoCard: { flex: 1, minHeight: 54, flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, gap: 10 },
  rideInfoText: { flex: 1, gap: 2 },
  rideInfoValue: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  rideInfoLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase' },
  suggestionsBox: { borderRadius: 10, marginTop: 4, overflow: 'hidden' },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  suggestionText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular' },
  routeMarker: { alignItems: 'center' },
  routeMarkerDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#fff' },
  vehicleMarkerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 70,
    height: 70,
  },
  vehicleMarkerImage: {
    zIndex: 2,
  },
  vehicleImageShadow: {
    position: 'absolute',
    width: 48,
    height: 16,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.28)',
    bottom: 11,
    transform: [{ rotate: '-8deg' }],
    zIndex: 1,
  },
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
  locationSearchScreen: { ...StyleSheet.absoluteFillObject, zIndex: 80 },
  locationSearchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  locationBackBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  locationSearchTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  locationSearchContent: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  locationSearchInputWrap: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  locationSearchInput: { flex: 1, fontSize: 16, fontFamily: 'Inter_500Medium' },
  locationSearchClear: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationSearchList: { paddingTop: 12, paddingBottom: 36 },
  locationQuickRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  locationQuickCard: {
    flex: 1,
    minHeight: 62,
    borderRadius: 12,
    borderWidth: 1,
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
    marginTop: 18,
    marginBottom: 6,
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
    marginTop: 18,
    marginBottom: 6,
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
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationOptionText: { flex: 1, gap: 2 },
  locationOptionTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  locationOptionSub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
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
    borderWidth: StyleSheet.hairlineWidth,
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
  saveLocationSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingHorizontal: 20,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 20,
  },
  saveLocationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  saveLocationHeaderText: { flex: 1, gap: 2 },
  saveLocationTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  saveLocationAddress: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  saveLocationClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveLocationLabels: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  saveLocationLabel: {
    minHeight: 40,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveLocationLabelText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  // Map picker
  mapPickerContainer: { ...StyleSheet.absoluteFillObject, zIndex: 50 },
  fixedPinContainer: { position: 'absolute', top: '50%', left: '50%', marginLeft: -24, marginTop: -48 },
  mapPickerBack: { position: 'absolute', left: 16, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 6 },
  mapPickerHint: { position: 'absolute', top: '18%', alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 },
  mapPickerHintText: { fontSize: 13, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  mapPickerFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20 },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  loaderText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});
