import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import type { useColors } from '@/hooks/useColors';
import { typography } from '@/constants/typography';

export function RideActionsSection({
  colors, isConfirmed = false, isArrived, isArriving, isInProgress, onCall, onCancelArrived, onCancelArriving,
  onEmergency, onSOS,
}: {
  colors: ReturnType<typeof useColors>;
  isConfirmed?: boolean;
  isArrived: boolean;
  isArriving: boolean;
  isInProgress: boolean;
  onCall: () => void;
  onCancelArrived: () => void;
  onCancelArriving: () => void;
  onEmergency: () => void;
  onSOS: () => void;
}) {
  return (
    <View style={styles.actions}>
      {/* From the moment the ride is confirmed (driver assigned & on the way)
          the rider can already call the driver — e.g. if the driver is slow to
          reach the pickup — not only once the driver marks "en route". */}
      {(isConfirmed || isArriving) && <>
        <AppButton title="Cancel" icon="x" variant="dangerPlain" size="sm" iconOnly onPress={onCancelArriving} accessibilityLabel="Cancel ride" />
        <AppButton title="Call driver" icon="phone" variant="call" size="sm" onPress={onCall} style={styles.wide} />
      </>}
      {isArrived && <>
        <AppButton title="Cancel Ride" icon="x" variant="dangerPlain" size="sm" labelFontSize={14} onPress={onCancelArrived} style={styles.wide} />
        <AppButton title="Call" icon="phone" variant="call" size="sm" labelFontSize={14} onPress={onCall} style={styles.wide} />
      </>}
      {isInProgress && <>
        <TouchableOpacity style={[styles.sos, { backgroundColor: colors.destructive }]} onPress={onSOS} accessibilityLabel="Emergency SOS" accessibilityRole="button"><Text style={styles.sosText}>SOS</Text></TouchableOpacity>
        <AppButton title="Emergency" icon="alert-octagon" variant="dangerPlain" size="sm" iconOnly onPress={onEmergency} accessibilityLabel="Report emergency" />
      </>}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  wide: { flex: 1 },
  sos: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', shadowColor: '#FF3B30', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 6 },
  sosText: { ...typography.label, fontFamily: typography.badge.fontFamily, color: '#FFFFFF', letterSpacing: 0.5 },
});
