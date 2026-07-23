import React, { useMemo, useState } from 'react';
import { StyleSheet, TouchableOpacity, View, useColorScheme } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { typography } from '@/constants/typography';
import { AppText } from '@/components/AppText';
import { AppButton } from '@/components/AppButton';
import { AppInput } from '@/components/AppInput';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { GlassScrollView } from '@/components/GlassScrollView';
import { FORM_BOTTOM_PADDING } from '@/constants/tabBar';
import { radius } from '@/constants/radius';
import { spacing, semanticSpacing } from '@/constants/spacing';
import { useAuth } from '@/context/AuthContext';
import { useDriverEntitlement } from '@/context/DriverEntitlementContext';
import { useColors } from '@/hooks/useColors';
import { getEntitlementVehicleForProfile, type DriverPackageOfferSnapshot } from '@/domain/driverRidePackages';
import { VEHICLE_LABELS } from '@/types';
import { toBackendTransportType } from '@/constants/vehicles';
import { normalizeRwandaPhoneNumber } from '@/utils/rwandaValidation';
import { usePackagePaymentConfigQuery } from '@/query/hooks/usePackagePaymentConfigQuery';
import {
  useCreateManualPaymentClaimMutation,
  useSubmitManualPaymentClaimMutation,
} from '@/query/hooks/useManualPaymentClaimMutations';
import {
  toManualPaymentClaimReadModel,
  type ManualPaymentClaimReadModel,
  type ManualPaymentProvider,
} from '@/domains/package-payments';
import { ManualPaymentClaimStatusCard } from '@/components/package-payments/ManualPaymentClaimStatusCard';
import { reportOperationalWarning } from '@/observability/monitoring';

function formatRwf(amount: number) {
  return `${amount.toLocaleString('en-RW')} RWF`;
}

function parseAmount(raw: string): number {
  const digits = raw.replace(/[^\d]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

export default function DriverCustomTopUpScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const isDark = useColorScheme() === 'dark';
  const { driverProfile, user } = useAuth();
  const { entitlement } = useDriverEntitlement();

  const { configuration } = usePackagePaymentConfigQuery();
  const mode = configuration?.mode ?? 'automatic';
  const providers = configuration?.manual?.providers ?? [];
  const pricePerRideMap = configuration?.pricePerRideRwf;

  const activeVehicle = getEntitlementVehicleForProfile(driverProfile);
  const vehicleType = activeVehicle?.vehicleType ?? driverProfile?.vehicleType ?? entitlement.vehicleType ?? null;
  const vehicleId = activeVehicle?.id ?? entitlement.vehicleId ?? 'driver-vehicle:custom';
  const vehicleLabel = vehicleType ? VEHICLE_LABELS[vehicleType] : 'your vehicle';
  const backendCode = vehicleType ? toBackendTransportType(vehicleType) : null;
  const pricePerRide = backendCode ? pricePerRideMap?.[backendCode] : undefined;

  const enabledProviders = providers.filter(p => p.enabled);
  const [selectedProvider, setSelectedProvider] = useState<ManualPaymentProvider>(
    (driverProfile?.momoProvider === 'airtel' ? 'airtel' : 'mtn') as ManualPaymentProvider,
  );
  const [amountText, setAmountText] = useState('');
  const [payerPhone, setPayerPhone] = useState(driverProfile?.momoCode ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedClaim, setSubmittedClaim] = useState<ManualPaymentClaimReadModel | null>(null);

  const createClaim = useCreateManualPaymentClaimMutation();
  const submitClaim = useSubmitManualPaymentClaimMutation();

  const amount = parseAmount(amountText);
  const rides = pricePerRide && pricePerRide > 0 ? Math.floor(amount / pricePerRide) : 0;
  const canPreview = Boolean(pricePerRide && pricePerRide > 0 && amount > 0);

  const provider: ManualPaymentProvider = useMemo(() => {
    if (enabledProviders.some(p => p.provider === selectedProvider)) return selectedProvider;
    return (enabledProviders[0]?.provider ?? 'mtn') as ManualPaymentProvider;
  }, [enabledProviders, selectedProvider]);

  const handleSubmit = async () => {
    setError(null);
    if (!pricePerRide || pricePerRide <= 0) {
      setError('Custom top-ups are not available for your vehicle right now.');
      return;
    }
    if (amount < pricePerRide) {
      setError(`Enter at least ${formatRwf(pricePerRide)} — the price of one ride.`);
      return;
    }
    const normalizedPhone = normalizeRwandaPhoneNumber(payerPhone);
    if (!normalizedPhone) {
      setError('Enter the number you paid from (+250 7xxxxxxxx).');
      return;
    }

    // Custom-amount claims carry an empty package_id; the backend derives the
    // ride count from the amount and the per-vehicle price-per-ride on approval.
    const customOffer: DriverPackageOfferSnapshot = {
      offerId: `custom-topup:${vehicleId}:${Date.now()}`,
      packageId: '',
      packageVersion: '',
      packageName: 'Custom top-up',
      vehicleId,
      vehicleType: vehicleType!,
      priceRwf: amount,
      ridesGranted: rides,
      bonusRidesGranted: 0,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      quoteAuthority: 'local',
      source: 'local_catalog',
    };

    setSubmitting(true);
    try {
      const created = await createClaim.mutateAsync({
        offer: customOffer,
        driverId: user?.id ?? '',
        provider,
        payerPhoneNumber: normalizedPhone,
      });
      if (created.failure || !created.data) {
        setError(created.failure?.message ?? 'Could not submit your top-up.');
        reportOperationalWarning('package-payment.custom.create', {
          operation: 'DriverCustomTopUpScreen',
          result: created.failure?.code ?? 'unknown',
        });
        return;
      }
      const submitted = await submitClaim.mutateAsync({ claim: created.data, actorId: user?.id });
      if (submitted.failure || !submitted.data) {
        setError(submitted.failure?.message ?? 'Could not submit your top-up.');
        reportOperationalWarning('package-payment.custom.submit', {
          operation: 'DriverCustomTopUpScreen',
          result: submitted.failure?.code ?? 'unknown',
        });
        return;
      }
      setSubmittedClaim(toManualPaymentClaimReadModel(submitted.data, { authority: 'remote_backed' }));
      reportOperationalWarning('package-payment.custom.review', {
        operation: 'DriverCustomTopUpScreen',
        status: submitted.data.status,
      });
    } catch {
      setError('Could not submit your top-up.');
    } finally {
      setSubmitting(false);
    }
  };

  const background = isDark ? '#000' : '#F2F2F7';

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      <GlassHeader title="Custom Top-up" onBackPress={() => router.back()} />
      <GlassScrollView
        style={styles.root}
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerMetrics.contentTop, paddingBottom: insets.bottom + FORM_BOTTOM_PADDING },
        ]}
        scrollIndicatorInsets={{ top: headerMetrics.indicatorTop }}
      >
        {submittedClaim ? (
          <ManualPaymentClaimStatusCard
            claim={submittedClaim}
            onRefetch={() => {}}
            onCancel={async () => ({ data: null, failure: null })}
            onResubmit={async () => ({ data: null, failure: null })}
          />
        ) : mode === 'disabled' ? (
          <InfoCard
            colors={colors}
            icon="clock"
            title="Payments unavailable"
            detail="Package payments are temporarily unavailable. Please try again later."
          />
        ) : !pricePerRide || pricePerRide <= 0 ? (
          <InfoCard
            colors={colors}
            icon="info"
            title="Not available yet"
            detail={`Custom top-ups aren't available for ${vehicleLabel} right now. Please buy a package instead.`}
          />
        ) : (
          <View style={styles.form}>
            <View style={styles.intro}>
              <AppText style={[styles.introTitle, { color: colors.foreground }]}>Buy rides with your own amount</AppText>
              <AppText style={[styles.introText, { color: colors.mutedForeground }]}>
                Enter how much you paid. Each {vehicleLabel} ride costs {formatRwf(pricePerRide)}.
              </AppText>
            </View>

            <AppInput
              label="Amount (RWF)"
              accessibilityLabel="Amount"
              placeholder="e.g. 6000"
              value={amountText}
              onChangeText={t => setAmountText(t.replace(/[^\d]/g, ''))}
              keyboardType="number-pad"
              leftIcon="dollar-sign"
            />

            <View style={[styles.previewCard, {
              backgroundColor: canPreview ? colors.primaryHex + '0D' : colors.surface,
              borderColor: canPreview ? colors.primary : colors.border,
            }]}>
              <Feather name="zap" size={18} color={canPreview ? colors.primary : colors.mutedForeground} />
              <AppText style={[styles.previewText, { color: canPreview ? colors.foreground : colors.mutedForeground }]}>
                {canPreview
                  ? `${formatRwf(amount)} → ${rides} ${vehicleLabel} ${rides === 1 ? 'ride' : 'rides'}`
                  : `Enter an amount to see how many ${vehicleLabel} rides you'll get.`}
              </AppText>
            </View>

            {enabledProviders.length > 1 ? (
              <View style={styles.providerRow}>
                {enabledProviders.map(p => {
                  const isSelected = provider === p.provider;
                  return (
                    <TouchableOpacity
                      key={p.provider}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: isSelected }}
                      onPress={() => setSelectedProvider(p.provider)}
                      style={[styles.providerChoice, {
                        borderColor: isSelected ? colors.primary : colors.border,
                        backgroundColor: isSelected ? colors.primaryHex + '0D' : colors.surface,
                      }]}
                      activeOpacity={0.8}
                    >
                      <AppText style={[styles.providerText, { color: colors.foreground }]}>
                        {p.provider === 'mtn' ? 'MTN MoMo' : 'Airtel Money'}
                      </AppText>
                      <View style={[styles.radio, { borderColor: isSelected ? colors.primary : colors.border }]}>
                        {isSelected ? <View style={[styles.radioInner, { backgroundColor: colors.primary }]} /> : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}

            <AppInput
              label="Number you paid from"
              accessibilityLabel="Number you paid from"
              placeholder="+250 7xxxxxxxx"
              value={payerPhone}
              onChangeText={setPayerPhone}
              keyboardType="phone-pad"
              leftIcon="smartphone"
            />
            <AppText style={[styles.helperText, { color: colors.mutedForeground }]}>
              Just share the number you sent the money from — we match it to the payment on our side. No transaction ID needed.
            </AppText>

            {error ? (
              <View style={[styles.inlineError, { borderColor: colors.destructiveHex + '30' }]}>
                <Feather name="alert-triangle" size={15} color={colors.destructive} />
                <AppText style={[styles.errorText, { color: colors.destructive }]}>{error}</AppText>
              </View>
            ) : null}

            <AppButton
              title="Submit for review"
              accessibilityLabel="Submit for review"
              onPress={() => void handleSubmit()}
              disabled={!canPreview || rides < 1}
              loading={submitting}
              fullWidth
              size="lg"
            />
            <View style={styles.secureNote}>
              <Feather name="lock" size={13} color={colors.mutedForeground} />
              <AppText style={[styles.secureNoteText, { color: colors.mutedForeground }]}>
                Your rides are added as soon as we verify your payment.
              </AppText>
            </View>
          </View>
        )}
      </GlassScrollView>
    </View>
  );
}

function InfoCard({ colors, icon, title, detail }: {
  colors: ReturnType<typeof useColors>;
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  detail: string;
}) {
  return (
    <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Feather name={icon} size={24} color={colors.mutedForeground} />
      <AppText style={[styles.infoTitle, { color: colors.foreground }]}>{title}</AppText>
      <AppText style={[styles.infoDetail, { color: colors.mutedForeground }]}>{detail}</AppText>
      <AppButton title="Return to Packages" onPress={() => router.back()} variant="secondary" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1 },
  form: { marginHorizontal: semanticSpacing.screenPadding, gap: spacing[14] },
  intro: { gap: spacing[4] },
  introTitle: { ...typography.h2, letterSpacing: -0.3 },
  introText: { ...typography.caption, lineHeight: 18 },
  helperText: { ...typography.caption, lineHeight: 17, marginTop: -spacing[6] },
  previewCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[10],
    borderRadius: radius.card, borderWidth: 1, paddingHorizontal: semanticSpacing.cardPadding, paddingVertical: spacing[14],
  },
  previewText: { flex: 1, ...typography.bodySmall, lineHeight: 20 },
  providerRow: { flexDirection: 'row', gap: spacing[10] },
  providerChoice: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing[12], paddingVertical: spacing[12],
  },
  providerText: { ...typography.bodySmall },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 8, height: 8, borderRadius: 4 },
  inlineError: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  errorText: { flex: 1, ...typography.caption, lineHeight: 18 },
  secureNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[6] },
  secureNoteText: { ...typography.tiny },
  infoCard: {
    marginHorizontal: semanticSpacing.screenPadding, borderRadius: 18, borderWidth: 1,
    padding: 28, alignItems: 'center', gap: spacing[10],
  },
  infoTitle: { ...typography.title, textAlign: 'center' },
  infoDetail: { ...typography.caption, lineHeight: 18, textAlign: 'center' },
});
