import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DRIVER_RIDE_PACKAGES, getRideCreditBalanceMessage, getRideCreditProgress, type DriverEntitlement } from '@/domain/driverRidePackages';
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
  const activePackage = entitlement.activePackageId ? DRIVER_RIDE_PACKAGES[entitlement.activePackageId] : null;

  if (isLoading) {
    return (
      <View style={[styles.loadingCard, { backgroundColor: cardFill }]}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Checking ride balance...</Text>
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
          <Text style={[styles.title, { color: colors.foreground }]}>No ride credits</Text>
          <Text style={[styles.description, { color: colors.mutedForeground }]}>{message}</Text>
        </View>
        <TouchableOpacity style={[styles.action, { backgroundColor: colors.primary }]} onPress={onViewPackages} activeOpacity={0.8}>
          <Text style={[styles.actionText, { color: colors.primaryForeground }]}>View Packages</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const balanceLabel = progress.activationCount > 1
    ? `${progress.remaining} ride credits remaining across ${progress.activationCount} packages`
    : `${progress.remaining} of ${progress.totalGranted} ride credits remaining`;

  return (
    <TouchableOpacity style={[styles.progressCard, { backgroundColor: cardFill }]} onPress={onViewPackages} activeOpacity={0.85}>
      <View style={styles.progressHeader}>
        <View style={styles.content}>
          <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>ACTIVE RIDE PACKAGE</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>{activePackage?.name ?? 'Combined ride-credit balance'}</Text>
          <Text style={[styles.description, { color: colors.mutedForeground }]}>{balanceLabel}</Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </View>
      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
        <View style={[styles.progressFill, { backgroundColor: message ? colors.destructive : colors.primary, width: `${progress.ratio * 100}%` }]} />
      </View>
      {message ? <Text style={[styles.warningText, { color: colors.destructive }]}>{message}</Text> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  loadingCard: {
    marginTop: 8,
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 20,
  },
  loadingText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  zeroCard: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  zeroIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1 },
  title: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  description: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 16, marginTop: 2 },
  action: { paddingHorizontal: 10, height: 30, borderRadius: 15, justifyContent: 'center' },
  actionText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  progressCard: { marginTop: 8, borderRadius: 16, padding: 12, gap: 9 },
  progressHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyebrow: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 0.6 },
  progressTrack: { height: 5, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  warningText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', lineHeight: 16 },
});
