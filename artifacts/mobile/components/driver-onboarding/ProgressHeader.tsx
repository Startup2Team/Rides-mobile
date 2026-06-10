import React from 'react';
import { Platform, Text, View } from 'react-native';
import { router } from 'expo-router';
import { BackButton } from '@/components/BackButton';
import type { useColors } from '@/hooks/useColors';
import { ONBOARDING_STEPS } from './onboardingData';
import { styles } from './onboardingStyles';

export function ProgressHeader({ colors, safeAreaTop, setStep, step }: {
  colors: ReturnType<typeof useColors>;
  safeAreaTop: number;
  setStep: React.Dispatch<React.SetStateAction<number>>;
  step: number;
}) {
  return <>
    <View style={[styles.header, { paddingTop: safeAreaTop + (Platform.OS === 'web' ? 67 : 0) + 16, borderBottomColor: colors.border }]}>
      <BackButton exitOnPress={step === 0} onPress={() => (step > 0 ? setStep(current => current - 1) : router.back())} />
      <Text style={[styles.headerTitle, { color: colors.foreground }]}>Become a Driver</Text>
      <Text style={[styles.stepIndicator, { color: colors.mutedForeground }]}>{step + 1}/{ONBOARDING_STEPS.length}</Text>
    </View>
    <View style={styles.stepsRow}>
      {ONBOARDING_STEPS.map((label, index) => <View key={index} style={[styles.stepItem, { flex: 1 }]}>
        <View style={[styles.stepDot, { backgroundColor: index <= step ? colors.primary : colors.border }]} />
        <Text style={[styles.stepLabel, { color: index <= step ? colors.primary : colors.mutedForeground }]}>{label}</Text>
      </View>)}
    </View>
  </>;
}
