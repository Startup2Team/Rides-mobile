import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { KandaButton } from '@/components/KandaButton';
import { KIGALI_CENTER } from '@/types';

type Phase = 'pickup' | 'inprogress' | 'done';

const PICKUP = { latitude: -1.9365, longitude: 30.1011, address: 'Kimironko Market' };
const DESTINATION = { latitude: -1.9438, longitude: 30.0616, address: 'Kigali City Tower' };
const CUSTOMER_NAME = 'Amina K.';

export default function DriverNavigateScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('pickup');
  const [driverPos, setDriverPos] = useState(KIGALI_CENTER);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    // Simulate driver moving toward pickup
    intervalRef.current = setInterval(() => {
      setDriverPos(prev => {
        const target = phase === 'pickup' ? PICKUP : DESTINATION;
        const dlat = (target.latitude - prev.latitude) * 0.15;
        const dlng = (target.longitude - prev.longitude) * 0.15;
        return { latitude: prev.latitude + dlat, longitude: prev.longitude + dlng };
      });
    }, 1500);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [phase]);

  const handleArrivedAtPickup = () => {
    setPhase('inprogress');
  };

  const handleCompleteRide = () => {
    Alert.alert('Complete Ride', 'Mark this ride as completed?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Complete',
        onPress: () => {
          if (intervalRef.current) clearInterval(intervalRef.current);
          router.replace('/(driver)/');
        },
      },
    ]);
  };

  const target = phase === 'pickup' ? PICKUP : DESTINATION;
  const etaMin = Math.round(
    Math.sqrt(
      Math.pow((target.latitude - driverPos.latitude) * 111, 2) +
      Math.pow((target.longitude - driverPos.longitude) * 111, 2)
    ) * 3 + 1
  );

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        region={{ ...driverPos, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
        customMapStyle={darkMapStyle}
      >
        <Marker coordinate={driverPos} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={[styles.youMarker, { borderColor: colors.primary }]}>
            <Text style={{ fontSize: 18 }}>🏍</Text>
          </View>
        </Marker>
        <Marker coordinate={PICKUP}>
          <View style={[styles.pinMarker, { backgroundColor: colors.primary }]}>
            <Feather name="user" size={14} color="#fff" />
          </View>
        </Marker>
        <Marker coordinate={DESTINATION}>
          <View style={[styles.pinMarker, { backgroundColor: colors.destructive }]}>
            <Feather name="map-pin" size={14} color="#fff" />
          </View>
        </Marker>
        <Polyline
          coordinates={[driverPos, PICKUP]}
          strokeColor={colors.primary}
          strokeWidth={3}
          lineDashPattern={[8, 4]}
        />
        {phase === 'inprogress' && (
          <Polyline
            coordinates={[PICKUP, DESTINATION]}
            strokeColor={colors.primary}
            strokeWidth={3}
          />
        )}
      </MapView>

      {/* Top info */}
      <View
        style={[
          styles.topBar,
          {
            backgroundColor: colors.background,
            paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) + 12,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.topInfo}>
          <Text style={[styles.topPhase, { color: colors.primary }]}>
            {phase === 'pickup' ? 'Heading to pickup' : 'En route to destination'}
          </Text>
          <Text style={[styles.topEta, { color: colors.foreground }]}>ETA: {etaMin} min</Text>
        </View>
        <TouchableOpacity style={[styles.callBtn, { backgroundColor: colors.muted }]}>
          <Feather name="phone" size={20} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* Bottom action card */}
      <View
        style={[
          styles.bottomCard,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 20),
          },
        ]}
      >
        <View style={styles.routePreview}>
          <View style={styles.routeRow}>
            <View style={[styles.dot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.routeText, { color: colors.foreground }]}>{PICKUP.address}</Text>
          </View>
          <View style={[styles.routeLine, { backgroundColor: colors.border }]} />
          <View style={styles.routeRow}>
            <View style={[styles.dot, { backgroundColor: colors.destructive, borderRadius: 3 }]} />
            <Text style={[styles.routeText, { color: colors.foreground }]}>{DESTINATION.address}</Text>
          </View>
        </View>

        <View style={styles.customerRow}>
          <View style={[styles.customerAvatar, { backgroundColor: colors.muted }]}>
            <Feather name="user" size={20} color={colors.foreground} />
          </View>
          <View>
            <Text style={[styles.customerName, { color: colors.foreground }]}>{CUSTOMER_NAME}</Text>
            <Text style={[styles.fareText, { color: colors.primary }]}>Agreed: 2,200 RWF</Text>
          </View>
        </View>

        {phase === 'pickup' ? (
          <KandaButton
            title="Arrived at Pickup"
            onPress={handleArrivedAtPickup}
            fullWidth
            size="lg"
          />
        ) : (
          <KandaButton
            title="Complete Ride"
            onPress={handleCompleteRide}
            fullWidth
            size="lg"
          />
        )}
      </View>
    </View>
  );
}

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
];

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  topInfo: { flex: 1 },
  topPhase: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  topEta: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  callBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  youMarker: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,200,83,0.15)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
  },
  pinMarker: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  bottomCard: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    borderTopWidth: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingHorizontal: 20,
    gap: 16,
  },
  routePreview: { gap: 6 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  routeLine: { height: 1, marginLeft: 15 },
  routeText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  customerAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  customerName: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  fareText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
