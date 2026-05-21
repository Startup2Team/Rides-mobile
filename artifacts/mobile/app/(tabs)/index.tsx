import * as Location from 'expo-location';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { KandaButton } from '@/components/KandaButton';
import { KandaInput } from '@/components/KandaInput';
import { useColors } from '@/hooks/useColors';
import { useRoute } from '@/hooks/useRoute';
import { useAuth } from '@/context/AuthContext';
import { useRide } from '@/context/RideContext';
import { geocodeAddress, GeocodeSuggestion } from '@/services/geocoding';
import { formatDistance, formatDuration } from '@/utils/mapUtils';
import { KIGALI_CENTER, RideLocation, VehicleType, VEHICLE_BASE_FARE, VEHICLE_MCI, VEHICLE_LABELS } from '@/types';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Both panels share the same height so the booking sheet matches the home panel
const PANEL_HEIGHT = SCREEN_HEIGHT * 0.42;

const VEHICLE_TYPES: VehicleType[] = ['moto', 'cab', 'hilux', 'fuso'];

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

export default function CustomerHome() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { currentRide, createRide } = useRide();
  const mapRef = useRef<MapView>(null);

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
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheetAnim = useRef(new Animated.Value(PANEL_HEIGHT)).current;

  // Redirect if active ride
  useEffect(() => {
    if (currentRide) {
      if (currentRide.status === 'searching') router.push('/searching');
      else if (currentRide.status === 'negotiating') router.push('/negotiation');
      else if (['confirmed', 'arriving', 'in_progress'].includes(currentRide.status)) router.push('/ride');
    }
  }, [currentRide?.status]);

  // Get user location
  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === 'web') {
          navigator.geolocation?.getCurrentPosition(p => {
            const coords = { latitude: p.coords.latitude, longitude: p.coords.longitude };
            setUserLocation(coords);
            setPickup(prev => ({ ...prev, ...coords }));
            mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 800);
          }, () => {});
        } else {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
            const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
            const [geo] = await Location.reverseGeocodeAsync(loc.coords).catch(() => [null]);
            setUserLocation(coords);
            setPickup({
              ...coords,
              address: geo ? `${geo.street ?? ''} ${geo.city ?? 'Kigali'}`.trim() : 'Current Location',
            });
            mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 800);
          }
        }
      } catch {}
      setLocLoading(false);
    })();
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
        edgePadding: { top: 80, right: 60, bottom: PANEL_HEIGHT + 160, left: 60 },
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
        { edgePadding: { top: 80, right: 60, bottom: PANEL_HEIGHT + 160, left: 60 }, animated: true },
      );
    }
    if (!destination) setRouteCoords([]);
  }, [destination?.latitude, destination?.longitude]);

  const openBooking = () => {
    setShowBooking(true);
    Animated.spring(sheetAnim, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
  };

  const closeBooking = () => {
    Animated.timing(sheetAnim, { toValue: PANEL_HEIGHT, duration: 250, useNativeDriver: true }).start(() => {
      setShowBooking(false);
      setDestText('');
      setDestination(null);
      setSuggestions([]);
    });
  };

  const handleBook = async () => {
    if (!destination) return;
    setBookLoading(true);
    await createRide(pickup, destination, selectedVehicle);
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

        <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 1 }}>
          <View style={styles.youAreHereContainer}>
            <View style={styles.youAreHereBubble}>
              <Text style={styles.youAreHereText}>You're Here</Text>
            </View>
            <View style={styles.youAreHereTail} />
          </View>
        </Marker>

        {visibleDrivers.map(driver => (
          <Marker
            key={driver.id}
            coordinate={{ latitude: driver.latitude, longitude: driver.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <MaterialCommunityIcons name={VEHICLE_MCI[selectedVehicle] as any} size={28} color="#00C853" />
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
        style={[styles.recenterBtn, { backgroundColor: colors.card, bottom: PANEL_HEIGHT + 16 }]}
        onPress={() => mapRef.current?.animateToRegion({ ...userLocation, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 600)}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="crosshairs-gps" size={22} color={colors.primary} />
      </TouchableOpacity>

      {/* Home bottom panel */}
      {!showBooking && (
        <View style={[styles.bottomPanel, { backgroundColor: colors.background, paddingBottom: insets.bottom + (Platform.OS === 'web' ? 84 : 80) }]}>
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
            <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
          </TouchableOpacity>
        </View>
      )}

      {/* Distance & time floating cards — rendered outside booking block so they sit above the overlay */}
      {showBooking && destination && (
        <View style={styles.rideInfoRow}>
          <View style={[styles.rideInfoCard, { backgroundColor: colors.card }]}>
            <MaterialCommunityIcons name="clock-outline" size={18} color={colors.primary} />
            <Text style={[styles.rideInfoValue, { color: colors.foreground }]}>
              {routeLoading ? '...' : route ? formatDuration(route.durationSeconds) : `~${Math.round(dist * 3 + 5)} min`}
            </Text>
            <Text style={[styles.rideInfoLabel, { color: colors.mutedForeground }]}>Est. Time</Text>
          </View>
          <View style={[styles.rideInfoCard, { backgroundColor: colors.card }]}>
            <MaterialCommunityIcons name="map-marker-distance" size={18} color={colors.primary} />
            <Text style={[styles.rideInfoValue, { color: colors.foreground }]}>
              {routeLoading ? '...' : route ? formatDistance(route.distanceMeters) : `${dist.toFixed(1)} km`}
            </Text>
            <Text style={[styles.rideInfoLabel, { color: colors.mutedForeground }]}>Distance</Text>
          </View>
        </View>
      )}

      {/* Booking bottom sheet — same height as home panel, sits above tab bar */}
      {showBooking && (
        <>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => { Keyboard.dismiss(); closeBooking(); }} />

          <KeyboardAvoidingView
            style={styles.bookingSheetWrapper}
            behavior={Platform.OS === 'ios' ? 'position' : 'height'}
            keyboardVerticalOffset={0}
          >
          <Animated.View
            style={[
              styles.bookingSheet,
              {
                backgroundColor: colors.background,
                paddingBottom: insets.bottom + (Platform.OS === 'web' ? 84 : 80),
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
              <View style={styles.locRow}>
                <View style={[styles.locDot, { backgroundColor: colors.primary }]} />
                <Text style={[styles.locInlineLabel, { color: colors.mutedForeground }]}>Pickup</Text>
                <KandaInput
                  placeholder="Enter pickup location"
                  value={pickup.address}
                  onFocus={() => setFocusedField('pickup')}
                  onChangeText={t => {
                    setPickup(prev => ({ ...prev, address: t }));
                    if (t.length === 0) { setSuggestions([]); return; }
                    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
                    geocodeTimer.current = setTimeout(async () => {
                      const results = await geocodeAddress(t, userLocation);
                      setSuggestions(results);
                    }, 400);
                  }}
                  style={{ paddingHorizontal: 0 }}
                />
              </View>

              {/* Pickup autocomplete suggestions */}
              {suggestions.length > 0 && focusedField === 'pickup' && (
                <View style={[styles.suggestionsBox, { backgroundColor: colors.card }]}>
                  {suggestions.map(s => (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.suggestionRow, { borderBottomColor: colors.border }]}
                      onPress={() => {
                        setPickup({ ...s.coords, address: s.place_name });
                        setSuggestions([]);
                        Keyboard.dismiss();
                      }}
                    >
                      <MaterialCommunityIcons name="map-marker-outline" size={16} color={colors.mutedForeground} />
                      <Text style={[styles.suggestionText, { color: colors.foreground }]} numberOfLines={1}>
                        {s.place_name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <View style={[styles.locDivider, { backgroundColor: colors.border }]} />
              <View style={styles.locRow}>
                <View style={[styles.locDot, { backgroundColor: colors.destructive, borderRadius: 3 }]} />
                <Text style={[styles.locInlineLabel, { color: colors.mutedForeground }]}>Drop off</Text>
                <KandaInput
                  placeholder="Where to?"
                  value={destText}
                  onFocus={() => setFocusedField('dropoff')}
                  onChangeText={t => {
                    setDestText(t);
                    if (t.length === 0) {
                      setDestination(null);
                      setSuggestions([]);
                      return;
                    }
                    // Debounce geocoding by 400ms
                    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
                    geocodeTimer.current = setTimeout(async () => {
                      const results = await geocodeAddress(t, userLocation);
                      setSuggestions(results);
                    }, 400);
                  }}
                  style={{ paddingHorizontal: 0 }}
                />
              </View>

              {/* Autocomplete suggestions */}
              {suggestions.length > 0 && focusedField === 'dropoff' && (
                <View style={[styles.suggestionsBox, { backgroundColor: colors.card }]}>
                  {suggestions.map(s => (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.suggestionRow, { borderBottomColor: colors.border }]}
                      onPress={() => {
                        setDestText(s.place_name);
                        setDestination({ ...s.coords, address: s.place_name });
                        setSuggestions([]);
                        Keyboard.dismiss();
                      }}
                    >
                      <MaterialCommunityIcons name="map-marker-outline" size={16} color={colors.mutedForeground} />
                      <Text style={[styles.suggestionText, { color: colors.foreground }]} numberOfLines={1}>
                        {s.place_name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
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

            {/* Find Driver */}
            {destination && (
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
                  setPickup({ ...pinCoords, address });
                } else {
                  setDestText(address);
                  setDestination({ ...pinCoords, address });
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
  bottomPanel: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingHorizontal: 20, gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 16 },
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
  bookingSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, gap: 16, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 24 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#3A3A3A', alignSelf: 'center', marginBottom: 8 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  sheetTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  locationCard: { borderRadius: 16, padding: 16 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  locDot: { width: 12, height: 12, borderRadius: 6 },
  locLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', marginBottom: 2 },
  locInlineLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', width: 72 },
  locDivider: { height: 1, marginLeft: 24 },
  currentLocBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  currentLocText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  locationActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rideInfoRow: { position: 'absolute', bottom: PANEL_HEIGHT, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', zIndex: 40, marginBottom: 127 },
  rideInfoCard: { alignItems: 'center', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 6, gap: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 6 },
  rideInfoValue: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  rideInfoLabel: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  suggestionsBox: { borderRadius: 10, marginTop: 4, overflow: 'hidden' },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  suggestionText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular' },
  routeMarker: { alignItems: 'center' },
  routeMarkerDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#fff' },
  // Map picker
  mapPickerContainer: { ...StyleSheet.absoluteFillObject, zIndex: 50 },
  fixedPinContainer: { position: 'absolute', top: '50%', left: '50%', marginLeft: -24, marginTop: -48 },
  mapPickerBack: { position: 'absolute', left: 16, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 6 },
  mapPickerHint: { position: 'absolute', top: '18%', alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 },
  mapPickerHintText: { fontSize: 13, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  mapPickerFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20 },
});
