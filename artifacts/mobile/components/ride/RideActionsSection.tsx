import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import type { useColors } from '@/hooks/useColors';

export function RideActionsSection({
  colors, isArrived, isArriving, isInProgress, onCall, onCancelArrived, onCancelArriving,
  onComplete, onEmergency, onSOS, onStartJourney,
}: {
  colors: ReturnType<typeof useColors>;
  isArrived: boolean;
  isArriving: boolean;
  isInProgress: boolean;
  onCall: () => void;
  onCancelArrived: () => void;
  onCancelArriving: () => void;
  onComplete: () => void;
  onEmergency: () => void;
  onSOS: () => void;
  onStartJourney: () => void;
}) {
  return (
    <View style={styles.actions}>
      {(isArriving || isArrived) && <AppButton title={isArriving ? 'Call driver' : 'Call'} icon="phone" variant="call" size="sm" onPress={onCall} iconOnly={!isArriving} style={isArriving ? styles.wide : undefined} />}
      {isArriving && <AppButton title="Cancel" icon="x" variant="dangerPlain" size="sm" iconOnly onPress={onCancelArriving} accessibilityLabel="Cancel ride" />}
      {isArrived && <>
        <AppButton title="Cancel Ride" icon="x" variant="dangerPlain" size="sm" labelFontSize={14} onPress={onCancelArrived} style={styles.wide} />
        <AppButton title="Start Journey" size="sm" labelFontSize={14} onPress={onStartJourney} style={styles.wide} />
      </>}
      {isInProgress && <>
        <TouchableOpacity style={[styles.sos, { backgroundColor: colors.destructive }]} onPress={onSOS} accessibilityLabel="Emergency SOS" accessibilityRole="button"><Text style={styles.sosText}>SOS</Text></TouchableOpacity>
        <AppButton title="Emergency" icon="alert-octagon" variant="dangerPlain" size="sm" iconOnly onPress={onEmergency} accessibilityLabel="Report emergency" />
        <AppButton title="Complete Ride" onPress={onComplete} style={styles.wide} />
      </>}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  wide: { flex: 1 },
  sos: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', shadowColor: '#FF3B30', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 6 },
  sosText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#FFFFFF', letterSpacing: 0.5 },
});
