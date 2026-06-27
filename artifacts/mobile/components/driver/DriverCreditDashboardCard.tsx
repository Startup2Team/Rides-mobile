import { typography } from '@/constants/typography';
import { AppText } from '@/components/AppText';
import React from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View, useColorScheme } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { icons } from '@/constants/icons';
import { radius } from '@/constants/radius';
import { sizes } from '@/constants/sizes';
import { spacing } from '@/constants/spacing';
import { getActivePackageActivation, getRideCreditBalanceMessage, getRideCreditProgress, type DriverEntitlement } from '@/domain/driverRidePackages';
import { useColors } from '@/hooks/useColors';

interface DriverCreditDashboardCardProps {
  entitlement: DriverEntitlement;
  isLoading: boolean;
  onViewPackages: () => void;
}

export function DriverCreditDashboardCard({ entitlement, isLoading, onViewPackages }: DriverCreditDashboardCardProps) {
  const colors = useColors();
  const isDark = useColorScheme() === 'dark';
  const cardFill = isDark ? '#1C1C1E' : '#FFFFFF';
  const progress = getRideCreditProgress(entitlement);
  const message = getRideCreditBalanceMessage(entitlement);
  const activePackage = getActivePackageActivation(entitlement);

  if (isLoading) {
    return (
      <View style={[styles.loadingCard, { backgroundColor: cardFill }]}>
        <ActivityIndicator size="small" color={colors.primary} />
        <AppText style={[styles.loadingText, { color: colors.mutedForeground }]}>Checking rides...</AppText>
      </View>
    );
  }

  if (progress.remaining === 0) {
    return (
      <View style={[styles.zeroCard, { backgroundColor: cardFill, borderColor: colors.successHex + '45' }]}>
        <View style={[styles.zeroIcon, { backgroundColor: colors.successHex + '14' }]}>
          <Feather name="layers" size={17} color={colors.success} />
        </View>
        <View style={styles.content}>
          <AppText style={[styles.title, { color: colors.foreground }]}>No rides</AppText>
          <AppText style={[styles.description, { color: colors.mutedForeground }]}>{message}</AppText>
        </View>
        <TouchableOpacity style={[styles.action, { backgroundColor: colors.primary }]} onPress={onViewPackages} activeOpacity={0.8}>
          <AppText style={[styles.actionText, { color: colors.primaryForeground }]}>View Packages</AppText>
        </TouchableOpacity>
      </View>
    );
  }

  const balanceLabel = progress.activationCount > 1
    ? `${progress.remaining} rides remaining across ${progress.activationCount} packages`
    : `${progress.remaining} of ${progress.totalGranted} rides remaining`;

  return (
    <TouchableOpacity style={[styles.progressCard, { backgroundColor: cardFill }]} onPress={onViewPackages} activeOpacity={0.85}>
      <View style={styles.progressHeader}>
        <View style={styles.content}>
          <AppText style={[styles.eyebrow, { color: colors.mutedForeground }]}>ACTIVE RIDE PACKAGE</AppText>
          <AppText style={[styles.title, { color: colors.foreground }]}>{activePackage?.packageName ?? 'Combined package rides'}</AppText>
          <AppText style={[styles.description, { color: colors.mutedForeground }]}>{balanceLabel}</AppText>
        </View>
        <Feather name="chevron-right" size={icons.semantic.row} color={colors.mutedForeground} />
      </View>
      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
        <View style={[styles.progressFill, { backgroundColor: message ? colors.destructive : colors.primary, width: `${progress.ratio * 100}%` }]} />
      </View>
      {message ? <AppText style={[styles.warningText, { color: colors.destructive }]}>{message}</AppText> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  loadingCard: {
    marginTop: spacing[8],
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    paddingHorizontal: spacing[12],
    height: sizes.avatar.md,
    borderRadius: radius['3xl'],
  },
  loadingText: { ...typography.caption,  },
  zeroCard: {
    marginTop: spacing[8],
    borderRadius: radius['2xl'],
    borderWidth: 1,
    paddingHorizontal: spacing[10],
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[10],
  },
  zeroIcon: { width: sizes.avatar.sm, height: sizes.avatar.sm, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1 },
  title: { ...typography.bodySmall,  },
  description: { ...typography.tiny, lineHeight: 16, marginTop: 2 },
  action: { paddingHorizontal: spacing[10], height: 30, borderRadius: 15, justifyContent: 'center' },
  actionText: { ...typography.button },
  progressCard: { marginTop: spacing[8], borderRadius: radius['2xl'], padding: spacing[12], gap: 9 },
  progressHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[8] },
  eyebrow: { ...typography.tiny, letterSpacing: 0.6 },
  progressTrack: { height: 5, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  warningText: { ...typography.tiny, lineHeight: 16 },
});
