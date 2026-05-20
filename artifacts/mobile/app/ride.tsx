import { router } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useRide } from '@/context/RideContext';
import { KandaButton } from '@/components/KandaButton';
import { StatusChip } from '@/components/StatusChip';
import { VEHICLE_LABELS } from '@/types';

const STATUS_MESSAGES: Record<string, string> = {
  confirmed: 'Ride confirmed',
  arriving: 'Driver is on the way',
  in_progress: 'Heading to destination',
  completed: 'Ride completed!',
};

export default function RideScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentRide, driverLocation, completeRide } = useRide();
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (!currentRide) router.replace('/(tabs)/');
    if (currentRide?.status === 'negotiating') router.replace('/negotiation');
  }, [currentRide?.status]);

  useEffect(() => {
    if (driverLocation && mapRef.current && currentRide?.pickup) {
      mapRef.current.fitToCoordinates(
        [driverLocation, currentRide.pickup],
        { edgePadding: { top: 120, right: 40, bottom: 280, left: 40 }, animated: true }
      );
    }
  }, [driverLocation]);

  const handleComplete = () => {
    Alert.alert('End Ride', 'Complete this ride?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Complete',
        onPress: () => {
          completeRide();
          router.replace('/(tabs)/');
        },
      },
    ]);
  };

  if (!currentRide) return null;

  const isInProgress = currentRide.status === 'in_progress';
  const statusMsg = STATUS_MESSAGES[currentRide.status] ?? 'Ride confirmed';

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        initialRegion={
          driverLocation
            ? { ...driverLocation, latitudeDelta: 0.02, longitudeDelta: 0.02 }
            : { ...currentRide.pickup, latitudeDelta: 0.02, longitudeDelta: 0.02 }
        }
        customMapStyle={darkMapStyle}
      >
        {driverLocation && (
          <Marker coordinate={driverLocation} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.driverMarker}>
              <Text style={{ fontSize: 20 }}>🏍</Text>
            </View>
          </Marker>
        )}
        <Marker coordinate={currentRide.pickup} anchor={{ x: 0.5, y: 1 }}>
          <View style={[styles.pinMarker, { backgroundColor: colors.primary }]}>
            <Feather name="circle" size={10} color="#fff" />
          </View>
        </Marker>
        <Marker coordinate={currentRide.destination} anchor={{ x: 0.5, y: 1 }}>
          <View style={[styles.pinMarker, { backgroundColor: colors.destructive }]}>
            <Feather name="map-pin" size={10} color="#fff" />
          </View>
        </Marker>
        {driverLocation && (
          <Polyline
            coordinates={[driverLocation, currentRide.pickup]}
            strokeColor={colors.primary}
            strokeWidth={3}
            lineDashPattern={[8, 4]}
          />
        )}
        {isInProgress && (
          <Polyline
            coordinates={[currentRide.pickup, currentRide.destination]}
            strokeColor={colors.primary}
            strokeWidth={3}
          />
        )}
      </MapView>

      {/* Top status */}
      <View
        style={[
          styles.topStatus,
          {
            paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) + 12,
            backgroundColor: colors.background,
          },
        ]}
      >
        <View style={styles.statusRow}>
          <StatusChip status={currentRide.status} />
          <Text style={[styles.statusMsg, { color: colors.foreground }]}>{statusMsg}</Text>
        </View>
        {currentRide.driver && (
          <Text style={[styles.eta, { color: colors.primary }]}>
            ETA: {currentRide.driver.eta} min
          </Text>
        )}
      </View>

      {/* Bottom driver card */}
      <View
        style={[
          styles.driverCard,
          {
            backgroundColor: colors.background,
            paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 20),
          },
        ]}
      >
        <View style={styles.handle} />

        {/* Driver info */}
        <View style={styles.driverRow}>
          <View style={[styles.driverAvatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.driverInitial}>{currentRide.driver?.name?.[0] ?? 'D'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.driverName, { color: colors.foreground }]}>
              {currentRide.driver?.name ?? 'Driver'}
            </Text>
            <Text style={[styles.driverVehicle, { color: colors.mutedForeground }]}>
              {VEHICLE_LABELS[currentRide.vehicleType]} · {currentRide.driver?.plateNumber}
            </Text>
          </View>
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingText}>★ {currentRide.driver?.rating?.toFixed(1)}</Text>
          </View>
        </View>

        {/* Fare */}
        <View style={[styles.fareRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <View style={styles.fareItem}>
            <Text style={[styles.fareLabel, { color: colors.mutedForeground }]}>Agreed Fare</Text>
            <Text style={[styles.fareValue, { color: colors.primary }]}>
              {currentRide.agreedFare?.toLocaleString()} RWF
            </Text>
          </View>
          <View style={[styles.fareDivider, { backgroundColor: colors.border }]} />
          <View style={styles.fareItem}>
            <Text style={[styles.fareLabel, { color: colors.mutedForeground }]}>Distance</Text>
            <Text style={[styles.fareValue, { color: colors.foreground }]}>{currentRide.distance} km</Text>
          </View>
          <View style={[styles.fareDivider, { backgroundColor: colors.border }]} />
          <View style={styles.fareItem}>
            <Text style={[styles.fareLabel, { color: colors.mutedForeground }]}>ETA</Text>
            <Text style={[styles.fareValue, { color: colors.foreground }]}>{currentRide.duration} min</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.muted }]}>
            <Feather name="phone" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.muted }]}>
            <Feather name="message-circle" size={20} color={colors.foreground} />
          </TouchableOpacity>
          {isInProgress && (
            <KandaButton
              title="Complete Ride"
              onPress={handleComplete}
              style={{ flex: 1 }}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
];

const styles = StyleSheet.create({
  container: { flex: 1 },
  topStatus: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    paddingHorizontal: 20,
    paddingBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusMsg: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  eta: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  driverMarker: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,200,83,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#00C853',
  },
  pinMarker: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  driverCard: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 16,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#3A3A3A', alignSelf: 'center' },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  driverAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  driverInitial: { fontSize: 22, fontFamily: 'Inter_700Bold', color: '#000' },
  driverName: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  driverVehicle: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  ratingBadge: {
    backgroundColor: '#FF9F0A20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  ratingText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#FF9F0A' },
  fareRow: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  fareItem: { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 4 },
  fareDivider: { width: 1 },
  fareLabel: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  fareValue: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  actions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  actionBtn: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
