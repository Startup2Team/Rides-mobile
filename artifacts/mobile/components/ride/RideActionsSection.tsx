import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import type { useColors } from '@/hooks/useColors';

export function RideActionsSection({
  colors, isArrived, isArriving, isInProgress, onCall, onCancelArrived, onCancelArriving,
  onEmergency, onSOS,
}: {
  colors: ReturnType<typeof useColors>;
  isArrived: boolean;
  isArriving: boolean;
  isInProgress: boolean;
  onCall: () => void;
  onCancelArrived: () => void;
  onCancelArriving: () => void;
  onEmergency: () => void;
  onSOS: () => void;
}) {
  // The driver drives the state machine (start/complete on their screen); the
  // customer's screen only watches and is moved forward by WebSocket events.
  // So the customer has no Start Journey / Complete Ride buttons — only Cancel,
  // Call, and the in-ride safety controls.
  return (
    <View style={styles.actions}>
      {isArriving && <>
        <AppButton title="Cancel" icon="x" variant="dangerPlain" size="sm" iconOnly onPress={onCancelArriving} accessibilityLabel="Cancel ride" />
        <AppButton title="Call driver" icon="phone" variant="call" size="sm" onPress={onCall} style={styles.wide} />
      </>}
      {isArrived && <>
        <AppButton title="Cancel Ride" icon="x" variant="dangerPlain" size="sm" labelFontSize={14} onPress={onCancelArrived} style={styles.wide} />
        <AppButton title="Call" icon="phone" variant="call" size="sm" labelFontSize={14} onPress={onCall} style={styles.wide} />
      </>}
      {isInProgress && <>
        <TouchableOpacity style={[styles.sos, { backgroundColor: colors.destructive }]} onPress={onSOS} accessibilityLabel="Emergency SOS" accessibilityRole="button"><Text style={styles.sosText}>SOS</Text></TouchableOpacity>
        <AppButton title="Emergency" icon="alert-octagon" variant="dangerPlain" size="sm" onPress={onEmergency} accessibilityLabel="Report emergency" style={styles.wide} />
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
