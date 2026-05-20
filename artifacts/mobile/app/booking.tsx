import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { KandaButton } from '@/components/KandaButton';
import { KandaInput } from '@/components/KandaInput';
import { VehicleCard } from '@/components/VehicleCard';
import { useColors } from '@/hooks/useColors';
import { useRide } from '@/context/RideContext';
import { KIGALI_CENTER, RideLocation, VehicleType, VEHICLE_BASE_FARE } from '@/types';

const POPULAR: { label: string; address: string; lat: number; lng: number }[] = [
  { label: 'Kigali City Tower', address: 'Kigali City Tower, CBD', lat: -1.9438, lng: 30.0616 },
  { label: 'Kigali Airport', address: 'Kigali Intl Airport', lat: -1.9686, lng: 30.1395 },
  { label: 'Kimironko Market', address: 'Kimironko, Kigali', lat: -1.9365, lng: 30.1011 },
  { label: 'Remera', address: 'Remera, Kigali', lat: -1.9527, lng: 30.0945 },
];

const VEHICLE_TYPES: VehicleType[] = ['moto', 'cab', 'hilux', 'fuso'];

function calcEstFare(type: VehicleType, dist: number) {
  const base = VEHICLE_BASE_FARE[type];
  const perKm = type === 'moto' ? 200 : type === 'cab' ? 400 : type === 'hilux' ? 600 : 800;
  return Math.round((base + dist * perKm) / 100) * 100;
}

export default function BookingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { vehicle } = useLocalSearchParams<{ vehicle: VehicleType }>();
  const { createRide } = useRide();

  const [pickup, setPickup] = useState<RideLocation>({ ...KIGALI_CENTER, address: 'Current Location' });
  const [destText, setDestText] = useState('');
  const [destination, setDestination] = useState<RideLocation | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleType>(vehicle ?? 'moto');
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<'search' | 'confirm'>('search');

  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === 'web') return;
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({});
        const [geo] = await Location.reverseGeocodeAsync(loc.coords).catch(() => [null]);
        setPickup({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          address: geo
            ? `${geo.street ?? ''} ${geo.city ?? 'Kigali'}`.trim()
            : 'Current Location',
        });
      } catch {}
    })();
  }, []);

  const selectDestination = (item: typeof POPULAR[number]) => {
    setDestText(item.label);
    setDestination({ latitude: item.lat, longitude: item.lng, address: item.address });
    setPhase('confirm');
  };

  const handleBook = async () => {
    if (!destination) return;
    setLoading(true);
    await createRide(pickup, destination, selectedVehicle);
    setLoading(false);
    router.push('/searching');
  };

  const dist = destination
    ? Math.sqrt(
        Math.pow((destination.latitude - pickup.latitude) * 111, 2) +
        Math.pow((destination.longitude - pickup.longitude) * 111, 2)
      )
    : 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.background,
            paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) + 16,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Book a Ride</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Pickup */}
        <View style={[styles.locationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.locRow}>
            <View style={[styles.locDot, { backgroundColor: colors.primary }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.locLabel, { color: colors.mutedForeground }]}>Pickup</Text>
              <Text style={[styles.locText, { color: colors.foreground }]} numberOfLines={1}>
                {pickup.address}
              </Text>
            </View>
            <TouchableOpacity>
              <Feather name="edit-2" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <View style={[styles.locDivider, { backgroundColor: colors.border }]} />
          <View style={styles.locRow}>
            <View style={[styles.locDot, { backgroundColor: colors.destructive, borderRadius: 3 }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.locLabel, { color: colors.mutedForeground }]}>Destination</Text>
              <KandaInput
                placeholder="Where to?"
                value={destText}
                onChangeText={t => { setDestText(t); if (!t) { setDestination(null); setPhase('search'); } }}
                style={{ paddingHorizontal: 0 }}
              />
            </View>
          </View>
        </View>

        {/* Popular destinations */}
        {phase === 'search' && (
          <View>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Popular destinations</Text>
            <View style={[styles.popularCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {POPULAR.map((item, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.popularItem,
                    { borderBottomColor: colors.border, borderBottomWidth: i < POPULAR.length - 1 ? 1 : 0 },
                  ]}
                  onPress={() => selectDestination(item)}
                >
                  <View style={[styles.popularIcon, { backgroundColor: colors.muted }]}>
                    <Feather name="map-pin" size={16} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.popularName, { color: colors.foreground }]}>{item.label}</Text>
                    <Text style={[styles.popularAddress, { color: colors.mutedForeground }]}>{item.address}</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Vehicle selection */}
        {phase === 'confirm' && destination && (
          <View>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Choose vehicle</Text>
            {VEHICLE_TYPES.map(v => (
              <VehicleCard
                key={v}
                type={v}
                selected={selectedVehicle === v}
                onSelect={() => setSelectedVehicle(v)}
                estimatedFare={calcEstFare(v, dist)}
              />
            ))}
          </View>
        )}

        {/* Ride summary */}
        {phase === 'confirm' && destination && (
          <View style={[styles.summary, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Distance</Text>
              <Text style={[styles.summaryValue, { color: colors.foreground }]}>{dist.toFixed(1)} km</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Estimated time</Text>
              <Text style={[styles.summaryValue, { color: colors.foreground }]}>
                {Math.round(dist * 3 + 5)} min
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Suggested fare</Text>
              <Text style={[styles.summaryValue, { color: colors.primary }]}>
                {calcEstFare(selectedVehicle, dist).toLocaleString()} RWF
              </Text>
            </View>
            <Text style={[styles.negotiateHint, { color: colors.mutedForeground }]}>
              You can negotiate the fare with the driver
            </Text>
          </View>
        )}

        {phase === 'confirm' && destination && (
          <KandaButton
            title="Find Driver"
            onPress={handleBook}
            fullWidth
            size="lg"
            loading={loading}
            style={styles.bookBtn}
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  content: { padding: 20, gap: 20, paddingBottom: 40 },
  locationCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 0 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  locDot: { width: 12, height: 12, borderRadius: 6 },
  locLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', marginBottom: 2 },
  locText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  locDivider: { height: 1, marginLeft: 24 },
  sectionTitle: { fontSize: 12, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  popularCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  popularItem: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  popularIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  popularName: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  popularAddress: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  summary: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  summaryValue: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  negotiateHint: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 4 },
  bookBtn: { marginTop: 4 },
});
