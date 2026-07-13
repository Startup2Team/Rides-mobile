import React from 'react';
import { Feather } from '@expo/vector-icons';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { AppInput } from '@/components/AppInput';
import { PAYMENT_PROVIDER_LOGOS } from '@/components/driver-onboarding/onboardingData';
import { useColors } from '@/hooks/useColors';
import type { DriverPackageOfferSnapshot } from '@/domain/driverRidePackages';
import type {
  ManualPaymentClaim,
  ManualPaymentProvider,
  ManualPaymentProviderConfiguration,
} from '@/domains/package-payments';
import { ManualPackagePaymentInstructions } from './ManualPackagePaymentInstructions';

export interface ManualPaymentClaimSubmissionProps {
  offer: DriverPackageOfferSnapshot;
  vehicleLabel?: string | null;
  providers: ManualPaymentProviderConfiguration[];
  selectedProvider: ManualPaymentProvider;
  onSelectProvider: (provider: ManualPaymentProvider) => void;
  payerPhoneNumber: string;
  onChangePayerPhoneNumber: (value: string) => void;
  transactionReference: string;
  onChangeTransactionReference: (value: string) => void;
  transactionReferenceRequired: boolean;
  submitDisabled?: boolean;
  submitting?: boolean;
  error?: string | null;
  submittedClaim?: ManualPaymentClaim | null;
  onCopyProvider: (provider: ManualPaymentProviderConfiguration, instruction: string) => void;
  onSubmit: () => void;
}

function formatRwf(amount: number) {
  return `${amount.toLocaleString('en-RW')} RWF`;
}

function maskPhoneNumber(value: string) {
  const trimmed = value.trim();
  if (trimmed.length <= 7) return trimmed;
  return `${trimmed.slice(0, 7)}***${trimmed.slice(-3)}`;
}

function providerLabel(provider: ManualPaymentProvider) {
  return provider === 'mtn' ? 'MTN MoMo' : 'Airtel Money';
}

export function ManualPaymentClaimSubmission({
  offer,
  vehicleLabel,
  providers,
  selectedProvider,
  onSelectProvider,
  payerPhoneNumber,
  onChangePayerPhoneNumber,
  transactionReference,
  onChangeTransactionReference,
  transactionReferenceRequired,
  submitDisabled = false,
  submitting = false,
  error = null,
  submittedClaim = null,
  onCopyProvider,
  onSubmit,
}: ManualPaymentClaimSubmissionProps) {
  const colors = useColors();
  const enabledProviders = providers.filter(provider => provider.enabled);
  const selectedProviderConfig = providers.find(provider => provider.provider === selectedProvider) ?? providers[0] ?? null;
  const canSubmit = !submitDisabled && !submitting && enabledProviders.length > 0;

  return (
    <View style={styles.shell}>
      <ManualPackagePaymentInstructions
        offer={offer}
        vehicleLabel={vehicleLabel}
        providers={providers}
        onCopyProvider={onCopyProvider}
      />

      {submittedClaim ? (
        <View style={[styles.pendingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.pendingHeader}>
            <View style={[styles.pendingIcon, { backgroundColor: colors.primaryHex + '12' }]}>
              <Feather name="clock" size={16} color={colors.primary} />
            </View>
            <View style={styles.pendingHeaderText}>
              <Text style={[styles.pendingEyebrow, { color: colors.primary }]}>CLAIM SUBMITTED</Text>
              <Text style={[styles.pendingTitle, { color: colors.foreground }]}>Pending review</Text>
            </View>
          </View>

          <View style={styles.pendingRows}>
            <Text style={[styles.pendingConfirmation, { color: colors.mutedForeground }]}>
              Payment claim submitted for review.
            </Text>
            <PendingRow label="Claim ID" value={submittedClaim.id} colors={colors} />
            <PendingRow label="Package" value={submittedClaim.packageName} colors={colors} />
            <PendingRow label="Amount" value={formatRwf(submittedClaim.expectedAmountRwf)} colors={colors} />
            <PendingRow label="Provider" value={providerLabel(submittedClaim.provider)} colors={colors} />
            <PendingRow label="Phone" value={maskPhoneNumber(submittedClaim.payerPhoneNumber)} colors={colors} />
            <PendingRow label="Submitted" value={new Date(submittedClaim.submittedAt ?? submittedClaim.createdAt).toLocaleString()} colors={colors} />
          </View>

          <View style={[styles.pendingNotice, { backgroundColor: colors.primaryHex + '10', borderColor: colors.primaryHex + '24' }]}>
            <Text style={[styles.pendingNoticeText, { color: colors.mutedForeground }]}>
              Support will verify your payment and activate your package after approval.
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.formSection}>
          <View style={styles.sectionHeading}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>I have paid</Text>
            <Text style={[styles.sectionDescription, { color: colors.mutedForeground }]}>
              Submit the payment details you used so support can review the claim.
            </Text>
          </View>

          <View style={styles.providerList}>
            {providers.map(provider => {
              const isSelected = provider.provider === selectedProvider;
              const isDisabled = !provider.enabled;
              return (
                <TouchableOpacity
                  key={provider.provider}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected, disabled: isDisabled }}
                  disabled={isDisabled}
                  onPress={() => onSelectProvider(provider.provider)}
                  style={[
                    styles.providerChoice,
                    {
                      backgroundColor: isSelected ? colors.primaryHex + '0D' : colors.surface,
                      borderColor: isSelected ? colors.primary : colors.border,
                      opacity: isDisabled ? 0.55 : 1,
                    },
                  ]}
                >
                  <View style={styles.providerChoiceMain}>
                    <View style={styles.providerLogoWrap}>
                      <Image source={PAYMENT_PROVIDER_LOGOS[provider.provider]} style={styles.providerLogo} resizeMode="contain" />
                    </View>
                    <View style={styles.providerChoiceText}>
                      <Text style={[styles.providerChoiceTitle, { color: colors.foreground }]}>
                        {providerLabel(provider.provider)}
                      </Text>
                      <Text style={[styles.providerChoiceSubtitle, { color: colors.mutedForeground }]}>
                        {provider.enabled ? 'Available for manual claim submission' : 'Unavailable right now'}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.radioOuter, { borderColor: isSelected ? colors.primary : colors.border }]}>
                    {isSelected ? <View style={[styles.radioInner, { backgroundColor: colors.primary }]} /> : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <AppInput
            label="Payer phone number"
            placeholder="+250 7xxxxxxxx"
            value={payerPhoneNumber}
            onChangeText={onChangePayerPhoneNumber}
            keyboardType="phone-pad"
            leftIcon="smartphone"
            accessibilityLabel="Payer phone number"
          />

          <AppInput
            label={`Transaction reference${transactionReferenceRequired ? ' *' : ''}`}
            placeholder={transactionReferenceRequired ? 'Enter the payment reference' : 'Optional payment reference'}
            value={transactionReference}
            onChangeText={onChangeTransactionReference}
            autoCapitalize="characters"
            leftIcon="hash"
            accessibilityLabel="Transaction reference"
          />

          <View style={[styles.helperCard, { backgroundColor: colors.muted }]}>
            <Feather name="shield" size={14} color={colors.primary} />
            <Text style={[styles.helperText, { color: colors.mutedForeground }]}>
              Amount stays locked at {formatRwf(offer.priceRwf)}.
            </Text>
          </View>

          {selectedProviderConfig && !selectedProviderConfig.enabled ? (
            <View style={[styles.inlineError, { borderColor: colors.destructiveHex + '30' }]}>
              <Feather name="alert-triangle" size={15} color={colors.destructive} />
              <Text style={[styles.errorText, { color: colors.destructive }]}>
                {providerLabel(selectedProviderConfig.provider)} is unavailable right now.
              </Text>
            </View>
          ) : null}

          {error ? (
            <View style={[styles.inlineError, { borderColor: colors.destructiveHex + '30' }]}>
              <Feather name="alert-triangle" size={15} color={colors.destructive} />
              <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
            </View>
          ) : null}

          <AppButton
            title="I have paid"
            onPress={onSubmit}
            variant="secondary"
            fullWidth
            loading={submitting}
            disabled={!canSubmit}
          />
        </View>
      )}
    </View>
  );
}

function PendingRow({
  colors,
  label,
  value,
}: {
  colors: ReturnType<typeof useColors>;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.pendingRow}>
      <Text style={[styles.pendingRowLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.pendingRowValue, { color: colors.foreground }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    gap: 16,
    marginHorizontal: 20,
  },
  formSection: {
    gap: 14,
  },
  sectionHeading: {
    gap: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  sectionDescription: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    lineHeight: 17,
  },
  providerList: {
    gap: 10,
  },
  providerChoice: {
    minHeight: 62,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  providerChoiceMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  providerLogoWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerLogo: {
    width: 27,
    height: 27,
  },
  providerChoiceText: {
    flex: 1,
    gap: 1,
  },
  providerChoiceTitle: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  providerChoiceSubtitle: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  helperCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  helperText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
  inlineError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    lineHeight: 18,
  },
  pendingCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  pendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pendingIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingHeaderText: {
    flex: 1,
    gap: 2,
  },
  pendingEyebrow: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.8,
  },
  pendingTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  pendingRows: {
    gap: 8,
  },
  pendingConfirmation: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
  pendingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  pendingRowLabel: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  pendingRowValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
  },
  pendingNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  pendingNoticeText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
});
