import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

interface DriverPackageRequiredModalProps {
  bottomInset: number;
  onClose: () => void;
  onViewPackages: () => void;
  visible: boolean;
}

export function DriverPackageRequiredModal({
  bottomInset,
  onClose,
  onViewPackages,
  visible,
}: DriverPackageRequiredModalProps) {
  const colors = useColors();
  const isDark = useColorScheme() === 'dark';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', paddingBottom: bottomInset + 20 }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={[styles.icon, { backgroundColor: colors.primaryHex + '18' }]}>
            <Feather name="layers" size={24} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Ride package required</Text>
          <Text style={[styles.lead, { color: colors.foreground }]}>
            You need an active ride package to receive ride requests.
          </Text>
          <Text style={[styles.text, { color: colors.mutedForeground }]}>
            1 completed trip uses 1 trip from your balance. Cancellations and declined requests do not change your balance.
          </Text>
          <TouchableOpacity style={styles.secondary} onPress={onClose} activeOpacity={0.7}>
            <Text style={[styles.secondaryText, { color: colors.primary }]}>Not Now</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.primary, { backgroundColor: colors.primary }]} onPress={onViewPackages} activeOpacity={0.85}>
            <Text style={styles.primaryText}>View Packages</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.48)' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    alignItems: 'center',
  },
  handle: { width: 36, height: 4, borderRadius: 2 },
  icon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  title: { fontSize: 21, fontFamily: 'Inter_700Bold', marginTop: 14 },
  lead: { fontSize: 15, fontFamily: 'Inter_600SemiBold', lineHeight: 21, textAlign: 'center', marginTop: 10 },
  text: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19, textAlign: 'center', marginTop: 8, marginBottom: 20 },
  primary: { width: '100%', height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  secondary: { height: 48, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
