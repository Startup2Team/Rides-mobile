import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { KandaButton } from '@/components/KandaButton';
import { KIGALI_CENTER } from '@/types';

type Phase = 'pickup' | 'waiting' | 'inprogress';

const PICKUP = { latitude: -1.9365, longitude: 30.1011, address: 'Kimironko Market' };
const DESTINATION = { latitude: -1.9438, longitude: 30.0616, address: 'Kigali City Tower' };
const CUSTOMER_NAME = 'Amina K.';
const CUSTOMER_PHONE = '+250788000000';
const WAIT_LIMIT = 10;

export default function DriverNavigateScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('pickup');
  const [driverPos, setDriverPos] = useState(KIGALI_CENTER);
  const [waitSeconds, setWaitSeconds] = useState(WAIT_LIMIT);
  const moveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waitRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mapRef = useRef<MapView>(null);

  // Move driver toward target
  useEffect(() => {
    if (moveRef.current) clearInterval(moveRef.current);
    if (phase === 'waiting') return;
    moveRef.current = setInterval(() => {
      const target = phase === 'inprogress' ? DESTINATION : PICKUP;
      setDriverPos(prev => ({
        latitude: prev.latitude + (target.latitude - prev.latitude) * 0.15,
        longitude: prev.longitude + (target.longitude - prev.longitude) * 0.15,
      }));
    }, 1500);
    return () => { if (moveRef.current) clearInterval(moveRef.current); };
  }, [phase]);

  // Wait countdown timer
  useEffect(() => {
    if (phase === 'waiting') {
      setWaitSeconds(WAIT_LIMIT);
      waitRef.current = setInterval(() => {
        setWaitSeconds(s => {
          if (s <= 1) { if (waitRef.current) clearInterval(waitRef.current); return 0; }
          return s - 1;
        });
      }, 1000);
    } else {
      if (waitRef.current) clearInterval(waitRef.current);
    }
    return () => { if (waitRef.current) clearInterval(waitRef.current); };
  }, [phase]);

  const handleArrivedAtPickup = () => { setPhase('waiting'); };

  const handleStartJourney = () => {
    setPhase('inprogress');
  };

  const handleCompleteRide = () => {
    Alert.alert('Complete Ride', 'Mark this ride as completed?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Complete',
        onPress: () => {
          if (moveRef.current) clearInterval(moveRef.current);
          if (waitRef.current) clearInterval(waitRef.current);
          router.replace('/(driver)/');
        },
      },
    ]);
  };

  const handleCall = () => {
    Linking.openURL(`tel:${CUSTOMER_PHONE}`).catch(() =>
      Alert.alert('Cannot call', 'Unable to open the phone dialler.')
    );
  };

  const formatWait = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const isTimerRed = waitSeconds <= 60;

  const etaTarget = phase === 'inprogress' ? DESTINATION : PICKUP;
  const etaMin = Math.round(
    Math.sqrt(
      Math.pow((etaTarget.latitude - driverPos.latitude) * 111, 2) +
      Math.pow((etaTarget.longitude - driverPos.longitude) * 111, 2)
    ) * 3 + 1
  );

  const phaseLabel =
    phase === 'pickup' ? 'Heading to pickup' :
    phase === 'waiting' ? 'Waiting for customer' :
    'Heading to destination';

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
        {phase !== 'inprogress' && (
          <Polyline
            coordinates={[driverPos, PICKUP]}
            strokeColor={colors.primary}
            strokeWidth={3}
            lineDashPattern={[8, 4]}
          />
        )}
        {phase === 'inprogress' && (
          <Polyline
            coordinates={[PICKUP, DESTINATION]}
            strokeColor={colors.primary}
            strokeWidth={3}
          />
        )}
      </MapView>

      {/* Top bar */}
      <View style={[styles.topBar, {
        backgroundColor: colors.background,
        paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) + 12,
        borderBottomColor: colors.border,
      }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.topInfo}>
          <Text style={[styles.topPhase, { color: colors.primary }]}>{phaseLabel}</Text>
          {phase !== 'waiting' && (
            <Text style={[styles.topEta, { color: colors.foreground }]}>ETA: {etaMin} min</Text>
          )}
        </View>
        <TouchableOpacity style={[styles.callBtn, { backgroundColor: colors.muted }]} onPress={handleCall}>
          <Feather name="phone" size={20} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* Bottom card */}
      <View style={[styles.bottomCard, {
        backgroundColor: colors.background,
        borderTopColor: colors.border,
        paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 20),
      }]}>
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

        {phase === 'pickup' && (
          <KandaButton
            title="Arrived at Pickup"
            onPress={handleArrivedAtPickup}
            fullWidth
            size="lg"
          />
        )}

        {phase === 'waiting' && (
          <View style={styles.waitingBlock}>
            <View style={[styles.timerBox, {
              backgroundColor: isTimerRed ? colors.destructive + '15' : colors.primary + '15',
              borderColor: isTimerRed ? colors.destructive + '40' : colors.primary + '30',
            }]}>
              <Feather name="clock" size={18} color={isTimerRed ? colors.destructive : colors.primary} />
              <Text style={[styles.timerLabel, { color: colors.mutedForeground }]}>Time remaining</Text>
              <Text style={[styles.timerValue, { color: isTimerRed ? colors.destructive : colors.primary }]}>{formatWait(waitSeconds)}</Text>
            </View>
            <View style={styles.waitingActions}>
              <KandaButton
                title="Start Journey"
                onPress={handleStartJourney}
                style={{ flex: 1 }}
                size="lg"
              />
              {waitSeconds === 0 && (
                <TouchableOpacity
                  style={[styles.cancelRideBtn, { backgroundColor: colors.destructive + '15', borderColor: colors.destructive }]}
                  onPress={() => {
                    Alert.alert(
                      'Cancel Ride',
                      'Cancel this ride and return to the queue?',
                      [
                        { text: 'Back', style: 'cancel' },
                        {
                          text: 'Cancel Ride',
                          style: 'destructive',
                          onPress: () => {
                            if (waitRef.current) clearInterval(waitRef.current);
                            if (moveRef.current) clearInterval(moveRef.current);
                            router.replace('/(driver)/');
                          },
                        },
                      ]
                    );
                  }}
                >
                  <Feather name="x" size={16} color={colors.destructive} />
                  <Text style={[styles.cancelRideBtnText, { color: colors.destructive }]}>Cancel Ride</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {phase === 'inprogress' && (
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
  callIconBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
