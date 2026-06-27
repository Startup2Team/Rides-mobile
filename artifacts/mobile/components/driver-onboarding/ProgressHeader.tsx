import { AppText } from '@/components/AppText';
import React from 'react';
import { Platform, View } from 'react-native';
import { router } from 'expo-router';
import { BackButton } from '@/components/BackButton';
import { spacing } from '@/constants/spacing';
import type { useColors } from '@/hooks/useColors';
import { ONBOARDING_STEPS } from './onboardingData';
import { styles } from './onboardingStyles';

export function ProgressHeader({ colors, onExit, safeAreaTop, setStep, step }: {
  colors: ReturnType<typeof useColors>;
  onExit?: () => void;
  safeAreaTop: number;
  setStep: React.Dispatch<React.SetStateAction<number>>;
  step: number;
}) {
  return <>
    <View style={[styles.header, { paddingTop: safeAreaTop + (Platform.OS === 'web' ? 67 : spacing[0]) + spacing[16] }]}>
      <BackButton exitOnPress={step === 0} onPress={() => (step > 0 ? setStep(current => current - 1) : onExit ? onExit() : router.back())} />
      <AppText style={[styles.headerTitle, { color: colors.foreground }]}>Become a Driver</AppText>
      <AppText style={[styles.stepIndicator, { color: colors.mutedForeground }]}>{step + 1}/{ONBOARDING_STEPS.length}</AppText>
    </View>
    <View style={styles.stepsRow}>
      {ONBOARDING_STEPS.map((label, index) => <View key={index} style={[styles.stepItem, { flex: 1 }]}>
        <View style={[styles.stepDot, { backgroundColor: index <= step ? colors.primary : colors.border }]} />
        <AppText style={[styles.stepLabel, { color: index <= step ? colors.primary : colors.mutedForeground }]}>{label}</AppText>
      </View>)}
    </View>
  </>;
}
