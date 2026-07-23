import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import { AppInput } from '@/components/AppInput';
import { useColors } from '@/hooks/useColors';
import { getManualPaymentClaimPresentation, getPackagePaymentFailurePresentation, type ManualPaymentClaimReadModel } from '@/domains/package-payments';
import { formatRwandaPhoneInput, normalizeRwandaPhoneNumber } from '@/utils/rwandaValidation';

export interface ManualPaymentClaimStatusCardProps {
  claim: ManualPaymentClaimReadModel;
  onRefetch: () => void;
  isRefetching?: boolean;
  onCancel: (claimId: string, version: number) => Promise<any>;
  onResubmit: (claimId: string, version: number, updates: { provider: 'mtn' | 'airtel'; phone: string }) => Promise<any>;
  /** Called from the success CTA once the payment is approved (e.g. go to dashboard). */
  onDone?: () => void;
}

function formatRwf(amount: number) {
  return `${amount.toLocaleString('en-RW')} RWF`;
}

function providerLabel(provider: string) {
  return provider === 'mtn' ? 'MTN MoMo' : 'Airtel Money';
}

export function ManualPaymentClaimStatusCard({
  claim,
  onRefetch,
  isRefetching = false,
  onCancel,
  onResubmit,
  onDone,
}: ManualPaymentClaimStatusCardProps) {
  const colors = useColors();
  const isDark = useColorScheme() === 'dark';
  const presentation = getManualPaymentClaimPresentation(claim.status);

  const [isEditing, setIsEditing] = useState(false);
  const [provider, setProvider] = useState<'mtn' | 'airtel'>(claim.provider);
  const [phone, setPhone] = useState(claim.maskedPayerPhone ?? '');
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const tone = presentation.tone;
  let accent: any = colors.mutedForeground;
  let accentHex: any = colors.muted;
  if (tone === 'success') {
    accent = colors.success;
    accentHex = colors.successHex;
  } else if (tone === 'warning') {
    accent = colors.warning;
    accentHex = colors.warningHex;
  } else if (tone === 'danger') {
    accent = colors.destructive;
    accentHex = colors.destructiveHex;
  } else if (tone === 'info') {
    accent = colors.primary;
    accentHex = colors.primaryHex;
  }

  const handleCancelPress = () => {
    Alert.alert(
      'Cancel this payment confirmation?',
      'This will stop this confirmation from being reviewed. It does not reverse a Mobile Money payment you already made.',
      [
        { text: 'Keep confirmation', style: 'cancel' },
        {
          text: 'Cancel confirmation',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            setErrorMessage(null);
            try {
              const res = await onCancel(claim.id, claim.version);
              if (res.failure) {
                const failurePres = getPackagePaymentFailurePresentation(res.failure);
                setErrorMessage(failurePres?.message ?? res.failure.message);
              }
            } catch (err) {
              setErrorMessage('An unexpected error occurred while cancelling.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleResubmitPress = async () => {
    setErrorMessage(null);
    const normalizedPhone = normalizeRwandaPhoneNumber(phone);
    if (!normalizedPhone) {
      setErrorMessage('Please enter the number you paid from (+250 7xxxxxxxx).');
      return;
    }

    setActionLoading(true);
    try {
      const res = await onResubmit(claim.id, claim.version, {
        provider,
        phone: normalizedPhone,
      });
      if (res.failure) {
        const failurePres = getPackagePaymentFailurePresentation(res.failure);
        setErrorMessage(failurePres?.message ?? res.failure.message);
        if (res.failure.code === 'claim_version_conflict') {
          // Refresh state
          onRefetch();
        }
      } else {
        setIsEditing(false);
      }
    } catch (err) {
      setErrorMessage('An unexpected error occurred while resubmitting.');
    } finally {
      setActionLoading(false);
    }
  };

  const startEditing = () => {
    setPhone('');
    setProvider(claim.provider);
    setIsEditing(true);
  };

  const getStatusIconName = (): React.ComponentProps<typeof Feather>['name'] => {
    switch (claim.status) {
      case 'approved':
        return 'check-circle';
      case 'rejected':
        return 'x-circle';
      case 'needs_clarification':
        return 'help-circle';
      case 'expired':
        return 'alert-circle';
      case 'cancelled':
        return 'slash';
      default:
        return 'clock';
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={[styles.iconHalo, { backgroundColor: accentHex + '18' }]}>
          <Feather name={getStatusIconName()} size={24} color={accent} />
        </View>
        <View style={styles.titleBlock}>
          <Text style={[styles.eyebrow, { color: accent }]}>{presentation.title.toUpperCase()}</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>{claim.packageName}</Text>
        </View>
      </View>

      <Text style={[styles.message, { color: colors.mutedForeground }]}>{presentation.message}</Text>

      {claim.status === 'needs_clarification' && claim.clarificationMessage ? (
        <View style={[styles.clarificationBox, { backgroundColor: colors.warningHex + '0A', borderColor: colors.warning }]}>
          <Text style={[styles.clarificationLabel, { color: colors.warning }]}>REASON FOR CLARIFICATION</Text>
          <Text style={[styles.clarificationText, { color: colors.foreground }]}>{claim.clarificationMessage}</Text>
        </View>
      ) : null}

      {claim.status === 'rejected' && (claim.rejectionMessage || claim.rejectionReasonCode) ? (
        <View style={[styles.clarificationBox, { backgroundColor: colors.destructiveHex + '0A', borderColor: colors.destructive }]}>
          <Text style={[styles.clarificationLabel, { color: colors.destructive }]}>WHY IT WASN’T CONFIRMED</Text>
          <Text style={[styles.clarificationText, { color: colors.foreground }]}>
            {claim.rejectionMessage || claim.rejectionReasonCode}
          </Text>
        </View>
      ) : null}

      {isEditing ? (
        <View style={styles.form}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Update details</Text>

          <View style={styles.providerRow}>
            {(['mtn', 'airtel'] as const).map((prov) => {
              const isSelected = provider === prov;
              return (
                <TouchableOpacity
                  key={prov}
                  style={[
                    styles.providerChoice,
                    {
                      borderColor: isSelected ? colors.primary : colors.border,
                      backgroundColor: isSelected ? colors.primaryHex + '0D' : 'transparent',
                    },
                  ]}
                  onPress={() => setProvider(prov)}
                >
                  <Text style={[styles.providerChoiceText, { color: colors.foreground }]}>
                    {providerLabel(prov)}
                  </Text>
                  <View style={[styles.radio, { borderColor: isSelected ? colors.primary : colors.border }]}>
                    {isSelected && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <AppInput
            label="Number you paid from"
            placeholder="+250 7xxxxxxxx"
            value={phone}
            onChangeText={(val) => setPhone(formatRwandaPhoneInput(val))}
            keyboardType="phone-pad"
            leftIcon="smartphone"
          />
        </View>
      ) : (
        <View style={styles.details}>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>Claim ID</Text>
            <Text style={[styles.detailValue, { color: colors.foreground }]}>{claim.displayClaimId}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>Amount</Text>
            <Text style={[styles.detailValue, { color: colors.foreground }]}>{formatRwf(claim.expectedAmountRwf)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>Provider</Text>
            <Text style={[styles.detailValue, { color: colors.foreground }]}>{providerLabel(claim.provider)}</Text>
          </View>
          {claim.maskedPayerPhone ? (
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>Paid from</Text>
              <Text style={[styles.detailValue, { color: colors.foreground }]}>{claim.maskedPayerPhone}</Text>
            </View>
          ) : null}
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>Submitted</Text>
            <Text style={[styles.detailValue, { color: colors.foreground }]}>
              {new Date(claim.submittedAt ?? claim.createdAt).toLocaleString()}
            </Text>
          </View>
        </View>
      )}

      {errorMessage ? (
        <View style={[styles.errorBox, { borderColor: colors.destructiveHex + '30' }]}>
          <Feather name="alert-triangle" size={15} color={colors.destructive} />
          <Text style={[styles.errorText, { color: colors.destructive }]}>{errorMessage}</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        {isEditing ? (
          <>
            <AppButton
              title="Cancel"
              variant="secondary"
              onPress={() => setIsEditing(false)}
              disabled={actionLoading}
              style={styles.btn}
            />
            <AppButton
              title="Resubmit payment"
              onPress={handleResubmitPress}
              loading={actionLoading}
              disabled={!phone.trim()}
              style={styles.btn}
            />
          </>
        ) : (
          <>
            {claim.status === 'approved' && onDone && (
              <AppButton
                title="Go to Dashboard"
                onPress={onDone}
                style={styles.btn}
              />
            )}
            {presentation.canResubmit && (
              <AppButton
                title="Edit & Resubmit"
                onPress={startEditing}
                style={styles.btn}
              />
            )}
            {!presentation.terminal && (
              <AppButton
                title="Refresh status"
                variant="secondary"
                onPress={onRefetch}
                loading={isRefetching}
                style={styles.btn}
              />
            )}
            {presentation.canCancel && (
              <AppButton
                title="Cancel confirmation"
                variant="secondary"
                onPress={handleCancelPress}
                disabled={actionLoading}
                style={styles.btn}
              />
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1.5,
    padding: 20,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconHalo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  message: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
  clarificationBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  clarificationLabel: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },
  clarificationText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    lineHeight: 18,
  },
  details: {
    gap: 8,
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
  form: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    marginBottom: 4,
  },
  providerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  providerChoice: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  providerChoiceText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  errorBox: {
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
  actions: {
    flexDirection: 'column',
    gap: 10,
    marginTop: 4,
  },
  btn: {
    width: '100%',
  },
});
