import React from 'react';
import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { useColors } from '@/hooks/useColors';
import type { DriverPackageOfferSnapshot } from '@/domain/driverRidePackages';

export interface PackagePaymentUnavailableProps {
  offer: DriverPackageOfferSnapshot;
  reasonText: string;
  onBack: () => void;
}

function formatRwf(amount: number) {
  return `${amount.toLocaleString('en-RW')} RWF`;
}

export function PackagePaymentUnavailable({ offer, reasonText, onBack }: PackagePaymentUnavailableProps) {
  const colors = useColors();

  return (
    <View style={styles.shell}>
      <View style={[styles.iconHalo, { backgroundColor: colors.warningHex + '18' }]}>
        <Feather name="clock" size={28} color={colors.warning} />
      </View>
      <Text style={[styles.title, { color: colors.foreground }]}>Payment unavailable</Text>
      <Text style={[styles.copy, { color: colors.mutedForeground }]}>{reasonText}</Text>

      <View style={[styles.detailsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>Package</Text>
          <Text style={[styles.detailValue, { color: colors.foreground }]}>{offer.packageName}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>Amount</Text>
          <Text style={[styles.detailValue, { color: colors.foreground }]}>{formatRwf(offer.priceRwf)}</Text>
        </View>
      </View>

      <AppButton title="Return to Packages" onPress={onBack} fullWidth />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 20,
  },
  iconHalo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
  },
  copy: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 320,
    fontFamily: 'Inter_400Regular',
  },
  detailsCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  detailLabel: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  detailValue: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    flexShrink: 1,
    textAlign: 'right',
  },
});
