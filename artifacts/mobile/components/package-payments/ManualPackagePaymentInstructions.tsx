import React from 'react';
import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { useColors } from '@/hooks/useColors';
import type { DriverPackageOfferSnapshot } from '@/domain/driverRidePackages';
import type { ManualPaymentProviderConfiguration } from '@/domains/package-payments';
import { buildManualPaymentUssdInstruction } from '@/domains/package-payments';
import { ManualPaymentProviderCard } from './ManualPaymentProviderCard';

export interface ManualPackagePaymentInstructionsProps {
  offer: DriverPackageOfferSnapshot;
  vehicleLabel?: string | null;
  providers: ManualPaymentProviderConfiguration[];
  onCopyProvider: (provider: ManualPaymentProviderConfiguration, instruction: string) => void;
}

function formatRwf(amount: number) {
  return `${amount.toLocaleString('en-RW')} RWF`;
}

function vehicleText(vehicleLabel?: string | null) {
  return vehicleLabel ?? 'Selected vehicle';
}

export function ManualPackagePaymentInstructions({
  offer,
  vehicleLabel,
  providers,
  onCopyProvider,
}: ManualPackagePaymentInstructionsProps) {
  const colors = useColors();

  return (
    <View style={styles.shell}>
      <View style={styles.summary}>
        <View style={[styles.badge, { backgroundColor: colors.primaryHex + '12' }]}>
          <Feather name="credit-card" size={13} color={colors.primary} />
          <Text style={[styles.badgeText, { color: colors.primary }]}>Manual payment</Text>
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>{offer.packageName}</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Pay using the code below, then return to Rides.
        </Text>
      </View>

      <View style={[styles.detailsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>Vehicle</Text>
          <Text style={[styles.detailValue, { color: colors.foreground }]}>{vehicleText(vehicleLabel)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>Locked amount</Text>
          <Text style={[styles.detailValue, { color: colors.foreground }]}>{formatRwf(offer.priceRwf)}</Text>
        </View>
      </View>

      <View style={styles.providerList}>
        {providers.map(provider => {
          const instructionResult = buildManualPaymentUssdInstruction(provider, offer.priceRwf);
          if (!instructionResult.data) {
            return (
              <View key={provider.provider} style={[styles.disabledProvider, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Text style={[styles.disabledProviderText, { color: colors.mutedForeground }]}>
                  {provider.provider === 'mtn' ? 'MTN MoMo' : 'Airtel Money'} is not available right now.
                </Text>
              </View>
            );
          }

          return (
            <ManualPaymentProviderCard
              key={provider.provider}
              provider={provider}
              instruction={instructionResult.data}
              amountLabel={formatRwf(offer.priceRwf)}
              onCopy={() => onCopyProvider(provider, instructionResult.data as string)}
            />
          );
        })}
      </View>

      <View style={[styles.note, { backgroundColor: colors.muted }]}>
        <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
          Manual payment confirmation is coming next.
        </Text>
      </View>

      <AppButton
        title="I have paid"
        onPress={() => undefined}
        variant="secondary"
        disabled
        fullWidth
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    gap: 14,
    marginHorizontal: 20,
  },
  summary: {
    gap: 4,
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
  },
  title: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 19,
  },
  detailsCard: {
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
  providerList: {
    gap: 10,
  },
  disabledProvider: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  disabledProviderText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 19,
  },
  note: {
    borderRadius: 14,
    padding: 12,
  },
  noteText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
});
