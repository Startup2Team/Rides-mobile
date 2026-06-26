import { typography } from '@/constants/typography';
import { AppText } from '@/components/AppText';
import React from 'react';
import { Modal, StyleSheet, TouchableOpacity, View, useColorScheme } from 'react-native';
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
          <AppText style={[styles.title, { color: colors.foreground }]}>Ride package required</AppText>
          <AppText style={[styles.lead, { color: colors.foreground }]}>
            You need an active ride package to receive ride requests.
          </AppText>
          <AppText style={[styles.text, { color: colors.mutedForeground }]}>
            1 completed trip uses 1 ride. Cancellations and declined requests do not change your rides.
          </AppText>
          <TouchableOpacity style={styles.secondary} onPress={onClose} activeOpacity={0.7}>
            <AppText style={[styles.secondaryText, { color: colors.primary }]}>Not Now</AppText>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.primary, { backgroundColor: colors.primary }]} onPress={onViewPackages} activeOpacity={0.85}>
            <AppText style={styles.primaryText}>View Packages</AppText>
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
  title: { ...typography.h2, marginTop: 14 },
  lead: { ...typography.body, lineHeight: 21, textAlign: 'center', marginTop: 10 },
  text: { ...typography.label, lineHeight: 19, textAlign: 'center', marginTop: 8, marginBottom: 20 },
  primary: { width: '100%', height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', ...typography.button },
  secondary: { height: 48, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { ...typography.button },
});
