import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { getDriverVerificationStatus } from '@/utils/driverVerification';

const STATUS_COPY = {
  pending_review: {
    icon: 'clock' as const,
    title: 'Application under review',
    message: 'Your driver application is under review. This usually takes 5–10 minutes.',
  },
  rejected: {
    icon: 'alert-circle' as const,
    title: 'Application needs an update',
    message: 'Review your application details and resubmit them for verification.',
  },
  approved: {
    icon: 'check-circle' as const,
    title: 'Application approved',
    message: 'Your driver application is approved. You can now access driver mode.',
  },
  draft: {
    icon: 'edit-3' as const,
    title: 'Application not submitted',
    message: 'Continue your driver application when you are ready.',
  },
  not_started: {
    icon: 'file-plus' as const,
    title: 'Become a driver',
    message: 'Submit your driver application to begin verification.',
  },
};

export default function DriverApplicationStatusScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { driverProfile, switchMode } = useAuth();
  const status = getDriverVerificationStatus(driverProfile);
  const copy = STATUS_COPY[status];

  const handlePrimaryAction = async () => {
    if (status === 'approved') {
      await switchMode('driver');
      router.replace('/(driver)');
      return;
    }
    router.push('/driver-onboarding');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]}>
      <View style={[styles.iconCircle, { backgroundColor: colors.primaryHex + '18' }]}>
        <Feather name={copy.icon} size={34} color={colors.primary} />
      </View>
      <Text style={[styles.title, { color: colors.foreground }]}>{copy.title}</Text>
      <Text style={[styles.message, { color: colors.mutedForeground }]}>{copy.message}</Text>

      <View style={styles.actions}>
        {status === 'pending_review' && (
          <TouchableOpacity style={[styles.secondaryAction, { borderColor: colors.border }]} onPress={() => router.replace('/driver-application-status')}>
            <Feather name="refresh-cw" size={18} color={colors.foreground} />
            <Text style={[styles.secondaryText, { color: colors.foreground }]}>View Application Status</Text>
          </TouchableOpacity>
        )}
        {(status === 'approved' || status === 'rejected' || status === 'draft' || status === 'not_started') && (
          <AppButton
            title={status === 'approved' ? 'Open Driver Mode' : status === 'rejected' ? 'Update Application' : 'Continue Application'}
            onPress={handlePrimaryAction}
            fullWidth
            size="lg"
          />
        )}
        <TouchableOpacity style={[styles.secondaryAction, { borderColor: colors.border }]} onPress={() => router.replace('/(tabs)')}>
          <Feather name="home" size={18} color={colors.foreground} />
          <Text style={[styles.secondaryText, { color: colors.foreground }]}>Return to Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.helpAction} onPress={() => router.push('/help-support')}>
          <Feather name="help-circle" size={17} color={colors.primary} />
          <Text style={[styles.helpText, { color: colors.primary }]}>Contact Support</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  iconCircle: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  message: { fontSize: 15, fontFamily: 'Inter_400Regular', lineHeight: 23, textAlign: 'center', marginTop: 10, maxWidth: 340 },
  actions: { width: '100%', gap: 12, marginTop: 32 },
  secondaryAction: { height: 52, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  secondaryText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  helpAction: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  helpText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
