import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import type { useColors } from '@/hooks/useColors';

export function RideCompleteModal({ colors, onClose, onConfirm, visible }: {
  colors: ReturnType<typeof useColors>;
  onClose: () => void;
  onConfirm: () => void;
  visible: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.background }]}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primaryHex + '18' }]}>
            <Feather name="check-circle" size={30} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Complete ride?</Text>
          <Text style={[styles.message, { color: colors.mutedForeground }]}>Confirm only when you have reached your destination.</Text>
          <View style={styles.actions}>
            <AppButton title="Not yet" variant="secondary" onPress={onClose} style={styles.action} />
            <AppButton title="Complete" variant="primary" onPress={onConfirm} style={styles.action} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 420, borderRadius: 20, padding: 20, alignItems: 'center' },
  iconWrap: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { fontSize: 20, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  message: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20, textAlign: 'center', marginTop: 8 },
  actions: { width: '100%', flexDirection: 'row', gap: 10, marginTop: 20 },
  action: { flex: 1 },
});
