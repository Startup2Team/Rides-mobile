import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { BackButton } from '@/components/BackButton';
import { KandaButton } from '@/components/KandaButton';
import { RoutePolyline } from '@/components/maps/RoutePolyline';
import { useRide } from '@/context/RideContext';
import { useColors } from '@/hooks/useColors';
import { useRoute } from '@/hooks/useRoute';
import { formatDuration } from '@/utils/mapUtils';
import { KIGALI_CENTER, VEHICLE_MCI } from '@/types';

const WAIT_LIMIT_SECONDS = 180;

export default function DriverNavigateScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentRide, driverLocation, markArrived, startJourney, completeRide, cancelRide } = useRide();
  const [driverPos, setDriverPos] = useState(driverLocation ?? KIGALI_CENTER);
  const [waitSeconds, setWaitSeconds] = useState(WAIT_LIMIT_SECONDS);
  const [showReroute, setShowReroute] = useState(false);
  const moveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waitRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const phase = currentRide?.status === 'in_progress'
    ? 'inprogress'
    : currentRide?.status === 'arrived'
      ? 'waiting'
      : 'pickup';
  const target = phase === 'inprogress' ? currentRide?.destination : currentRide?.pickup;

  const { route, loading: routeLoading } = useRoute(
    currentRide ? driverPos : null,
    target ? { latitude: target.latitude, longitude: target.longitude } : null,
  );

  useEffect(() => {
    if (!currentRide) router.replace('/(driver)');
  }, [currentRide]);

  useEffect(() => {
    if (driverLocation) setDriverPos(driverLocation);
  }, [driverLocation]);

  useEffect(() => {
    if (moveRef.current) clearInterval(moveRef.current);
    if (!target || phase === 'waiting') return;

    moveRef.current = setInterval(() => {
      setDriverPos(prev => ({
        latitude: prev.latitude + (target.latitude - prev.latitude) * 0.15,
        longitude: prev.longitude + (target.longitude - prev.longitude) * 0.15,
      }));
    }, 3000);

    return () => {
      if (moveRef.current) clearInterval(moveRef.current);
    };
  }, [phase, target?.latitude, target?.longitude]);

  useEffect(() => {
    if (phase !== 'waiting') {
      if (waitRef.current) clearInterval(waitRef.current);
      return;
    }

    const elapsed = currentRide?.waitStartedAt
      ? Math.floor((Date.now() - new Date(currentRide.waitStartedAt).getTime()) / 1000)
      : 0;
    setWaitSeconds(Math.max(WAIT_LIMIT_SECONDS - elapsed, 0));
    waitRef.current = setInterval(() => {
      setWaitSeconds(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      if (waitRef.current) clearInterval(waitRef.current);
    };
  }, [phase, currentRide?.waitStartedAt]);

  useEffect(() => {
    if (phase !== 'inprogress') {
      setShowReroute(false);
      return;
    }
    const timer = setTimeout(() => setShowReroute(true), 5000);
    return () => clearTimeout(timer);
  }, [phase]);

  if (!currentRide) return null;

  const etaMin = target
    ? Math.round(
        Math.sqrt(
          Math.pow((target.latitude - driverPos.latitude) * 111, 2) +
          Math.pow((target.longitude - driverPos.longitude) * 111, 2)
        ) * 3 + 1
      )
    : 0;

  const phaseLabel =
    phase === 'pickup' ? 'Heading to pickup' :
    phase === 'waiting' ? 'Waiting for customer' :
    'Heading to destination';

  const formatWait = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleCall = () => {
    if (!currentRide.customerPhone) return;
    Linking.openURL(`tel:${currentRide.customerPhone}`).catch(() =>
      Alert.alert('Cannot call', 'Unable to open the phone dialler.')
    );
  };

  const handleCancelRide = () => {
    Alert.alert(
      'Cancel Ride',
      waitSeconds === 0
        ? 'Customer has not arrived. You may cancel this ride.'
        : 'Cancel this ride and return to the queue?',
      [
        { text: 'Back', style: 'cancel' },
        {
          text: 'Cancel Ride',
          style: 'destructive',
          onPress: () => {
            cancelRide();
            router.replace('/(driver)');
          },
        },
      ]
    );
  };

  const handleCompleteRide = () => {
    Alert.alert('Complete Ride', 'Mark this ride as completed?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Complete',
        onPress: () => {
          completeRide();
          router.replace('/(driver)');
        },
      },
    ]);
  };

  const handleEmergencyEnd = () => {
    Alert.alert('End Journey', 'End this journey early?', [
      { text: 'Back', style: 'cancel' },
      { text: 'End Journey', style: 'destructive', onPress: handleCompleteRide },
    ]);
  };

  const timerExpired = waitSeconds === 0;

  return (
    <View style={styles.container}>
      <MapView
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        region={{ ...driverPos, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
        customMapStyle={darkMapStyle}
      >
        <Marker coordinate={driverPos} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={[styles.youMarker, { borderColor: colors.primary }]}>
            <MaterialCommunityIcons name={VEHICLE_MCI[currentRide.vehicleType] as any} size={22} color={colors.primary} />
          </View>
        </Marker>
        <Marker coordinate={currentRide.pickup}>
          <View style={[styles.pinMarker, { backgroundColor: colors.primary }]}>
            <Feather name="user" size={14} color="#fff" />
          </View>
        </Marker>
        <Marker coordinate={currentRide.destination}>
          <View style={[styles.pinMarker, { backgroundColor: colors.destructive }]}>
            <Feather name="map-pin" size={14} color="#fff" />
          </View>
        </Marker>
        {route && <RoutePolyline coordinates={route.coordinates} color={colors.primary} width={4} />}
      </MapView>

      <View style={[styles.topBar, {
        backgroundColor: colors.background,
        paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) + 12,
        borderBottomColor: colors.border,
      }]}>
        <BackButton onPress={() => router.back()} />
        <View style={styles.topInfo}>
          <Text style={[styles.topPhase, { color: colors.primary }]}>{phaseLabel}</Text>
          {phase !== 'waiting' && (
            <Text style={[styles.topEta, { color: colors.foreground }]}>
              ETA: {route && !routeLoading ? formatDuration(route.durationSeconds) : `${etaMin} min`}
            </Text>
          )}
        </View>
        <TouchableOpacity style={[styles.callBtn, { backgroundColor: colors.muted }]} onPress={handleCall}>
          <Feather name="phone" size={20} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {phase === 'inprogress' && (
        <View style={[styles.turnCard, { backgroundColor: colors.card, borderColor: colors.border, top: insets.top + (Platform.OS === 'web' ? 67 : 0) + 82 }]}>
          <MaterialCommunityIcons name="navigation" size={24} color={colors.primary} style={{ transform: [{ rotate: '45deg' }] }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.turnText, { color: colors.foreground }]}>In 400m, continue on the fastest route</Text>
            <Text style={[styles.turnSubtext, { color: colors.mutedForeground }]}>Turn-by-turn navigation active</Text>
          </View>
        </View>
      )}

      {showReroute && (
        <View style={[styles.rerouteBanner, { backgroundColor: colors.primary, top: insets.top + (Platform.OS === 'web' ? 67 : 0) + 152 }]}>
          <Text style={[styles.rerouteText, { color: colors.primaryForeground }]}>Faster route available</Text>
          <TouchableOpacity style={styles.rerouteBtn} onPress={() => setShowReroute(false)}>
            <Text style={[styles.rerouteBtnText, { color: colors.primaryForeground }]}>Reroute</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.bottomCard, {
        backgroundColor: colors.background,
        borderTopColor: colors.border,
        paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 20),
      }]}>
        <View style={styles.routePreview}>
          <View style={styles.routeRow}>
            <View style={[styles.dot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.routeText, { color: colors.foreground }]}>{currentRide.pickup.address}</Text>
          </View>
          <View style={[styles.routeLine, { backgroundColor: colors.border }]} />
          <View style={styles.routeRow}>
            <View style={[styles.dot, { backgroundColor: colors.destructive, borderRadius: 3 }]} />
            <Text style={[styles.routeText, { color: colors.foreground }]}>{currentRide.destination.address}</Text>
          </View>
        </View>

        <View style={styles.customerRow}>
          <View style={[styles.customerAvatar, { backgroundColor: colors.muted }]}>
            <Feather name="user" size={20} color={colors.foreground} />
          </View>
          <View>
            <Text style={[styles.customerName, { color: colors.foreground }]}>{currentRide.customerName ?? 'Customer'}</Text>
            <Text style={[styles.fareText, { color: colors.primary }]}>
              Agreed: {currentRide.agreedFare?.toLocaleString() ?? '-'} RWF
            </Text>
          </View>
        </View>

        {phase === 'pickup' && (
          <KandaButton title="I Have Arrived" onPress={markArrived} fullWidth size="lg" />
        )}

        {phase === 'waiting' && (
          <View style={styles.waitingBlock}>
            <View style={[styles.timerBox, {
              backgroundColor: timerExpired ? colors.destructive + '15' : colors.primary + '15',
              borderColor: timerExpired ? colors.destructive + '40' : colors.primary + '30',
            }]}>
              <Feather name="clock" size={18} color={timerExpired ? colors.destructive : colors.primary} />
              <Text style={[styles.timerLabel, { color: colors.mutedForeground }]}>Time remaining</Text>
              <Text style={[styles.timerValue, { color: timerExpired ? colors.destructive : colors.primary }]}>{formatWait(waitSeconds)}</Text>
            </View>
            {timerExpired && (
              <Text style={[styles.cancelPrompt, { color: colors.destructive }]}>
                Customer has not arrived. You may cancel this ride.
              </Text>
            )}
            <View style={styles.waitingActions}>
              <KandaButton title="Start Journey" onPress={startJourney} style={{ flex: 1 }} size="lg" />
              <TouchableOpacity
                style={[
                  styles.cancelRideBtn,
                  {
                    backgroundColor: timerExpired ? colors.destructive + '20' : colors.muted,
                    borderColor: timerExpired ? colors.destructive : colors.border,
                  },
                ]}
                onPress={handleCancelRide}
              >
                <Feather name="x" size={16} color={timerExpired ? colors.destructive : colors.foreground} />
                <Text style={[styles.cancelRideBtnText, { color: timerExpired ? colors.destructive : colors.foreground }]}>Cancel Ride</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {phase === 'inprogress' && (
          <View style={styles.waitingActions}>
            <TouchableOpacity
              style={[styles.cancelRideBtn, { backgroundColor: colors.destructive + '15', borderColor: colors.destructive }]}
              onPress={handleEmergencyEnd}
            >
              <Feather name="alert-octagon" size={16} color={colors.destructive} />
              <Text style={[styles.cancelRideBtnText, { color: colors.destructive }]}>End Journey</Text>
            </TouchableOpacity>
            <KandaButton title="Complete Ride" onPress={handleCompleteRide} style={{ flex: 1 }} size="lg" />
          </View>
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
  turnCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  turnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  turnSubtext: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  rerouteBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rerouteText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  rerouteBtn: { borderWidth: 1, borderColor: 'rgba(0,0,0,0.25)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  rerouteBtnText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
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
  waitingBlock: { gap: 12 },
  waitingActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  cancelRideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 50,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  cancelRideBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  cancelPrompt: { fontSize: 12, fontFamily: 'Inter_500Medium', lineHeight: 18 },
  timerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  timerLabel: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium' },
  timerValue: { fontSize: 22, fontFamily: 'Inter_700Bold' },
});
