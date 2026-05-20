import * as Location from 'expo-location';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useRide } from '@/context/RideContext';
import { KIGALI_CENTER, MOCK_DRIVERS, VehicleType } from '@/types';

const { height } = Dimensions.get('window');
const VEHICLE_TYPES: VehicleType[] = ['moto', 'cab', 'hilux', 'fuso'];
const VEHICLE_ICONS: Record<VehicleType, string> = { moto: '🏍', cab: '🚕', fuso: '🚛', hilux: '🛻' };
const VEHICLE_LABELS: Record<VehicleType, string> = { moto: 'Moto', cab: 'Cab', fuso: 'Fuso', hilux: 'Hilux' };

export default function CustomerHome() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { currentRide } = useRide();
  const mapRef = useRef<MapView>(null);
  const [userLocation, setUserLocation] = useState(KIGALI_CENTER);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleType>('moto');
  const [locLoading, setLocLoading] = useState(true);
  const pulseAnim = useRef(new Animated.Value(1)).current;

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
          navigator.geolocation?.getCurrentPosition(
            p => setUserLocation({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
            () => {},
          );
        } else {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const loc = await Location.getCurrentPositionAsync({});
            setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
          }
        }
      } catch {}
      setLocLoading(false);
    })();
  }, []);

  // Pulse animation for drivers
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const handleBookRide = () => {
    router.push({ pathname: '/booking', params: { vehicle: selectedVehicle } });
  };

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        initialRegion={{
          ...userLocation,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        }}
        showsUserLocation
        showsMyLocationButton={false}
        customMapStyle={darkMapStyle}
      >
        {MOCK_DRIVERS.map(driver => (
          <Marker
            key={driver.id}
            coordinate={driver.location}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.driverMarker}>
              <Text style={styles.driverEmoji}>
                {VEHICLE_ICONS[driver.vehicleType]}
              </Text>
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

      {/* Bottom panel */}
      <View style={[
        styles.bottomPanel,
        {
          backgroundColor: colors.background,
          paddingBottom: insets.bottom + (Platform.OS === 'web' ? 84 : 80),
        },
      ]}>
        <View style={styles.handle} />

        <Text style={[styles.greeting, { color: colors.foreground }]}>
          Hi {user?.name?.split(' ')[0]} 👋
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Where are you going today?
        </Text>

        {/* Destination input (tappable → booking) */}
        <TouchableOpacity
          style={[styles.destInput, { backgroundColor: colors.muted, borderColor: colors.border }]}
          onPress={handleBookRide}
          activeOpacity={0.8}
        >
          <Feather name="search" size={18} color={colors.mutedForeground} />
          <Text style={[styles.destPlaceholder, { color: colors.mutedForeground }]}>
            Search destination...
          </Text>
        </TouchableOpacity>

        {/* Vehicle selector */}
        <View style={styles.vehicleRow}>
          {VEHICLE_TYPES.map(v => (
            <TouchableOpacity
              key={v}
              style={[
                styles.vehicleChip,
                {
                  backgroundColor: selectedVehicle === v ? colors.primary : colors.muted,
                },
              ]}
              onPress={() => setSelectedVehicle(v)}
              activeOpacity={0.8}
            >
              <Text style={styles.vehicleEmoji}>{VEHICLE_ICONS[v]}</Text>
              <Text style={[
                styles.vehicleLabel,
                { color: selectedVehicle === v ? colors.primaryForeground : colors.foreground },
              ]}>
                {VEHICLE_LABELS[v]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Nearby badge */}
        <View style={styles.nearbyRow}>
          <View style={[styles.nearbyDot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.nearbyText, { color: colors.mutedForeground }]}>
            {MOCK_DRIVERS.length} drivers nearby · Avg {Math.round(MOCK_DRIVERS.reduce((a, d) => a + d.eta, 0) / MOCK_DRIVERS.length)} min away
          </Text>
        </View>
      </View>
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
  topBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    zIndex: 10,
  },
  topCard: {
    flex: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  locationDot: { width: 8, height: 8, borderRadius: 4 },
  locationText: { fontSize: 14, fontFamily: 'Inter_500Medium', flex: 1 },
  notifBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  driverMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,200,83,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#00C853',
  },
  driverEmoji: { fontSize: 18 },
  bottomPanel: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 16,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3A3A3A',
    alignSelf: 'center',
    marginBottom: 4,
  },
  greeting: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: -6 },
  destInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 50,
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  destPlaceholder: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  vehicleRow: { flexDirection: 'row', gap: 8 },
  vehicleChip: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 14,
    gap: 4,
  },
  vehicleEmoji: { fontSize: 22 },
  vehicleLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  nearbyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nearbyDot: { width: 6, height: 6, borderRadius: 3 },
  nearbyText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
});
