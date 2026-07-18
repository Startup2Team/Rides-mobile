import { typography } from '@/constants/typography';
import { AppText } from '@/components/AppText';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, TouchableOpacity, View, useColorScheme } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import { AppInput } from '@/components/AppInput';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { GlassScrollView } from '@/components/GlassScrollView';
import { FORM_BOTTOM_PADDING } from '@/constants/tabBar';
import { PAYMENT_PROVIDER_LOGOS } from '@/components/driver-onboarding/onboardingData';
import { useAuth } from '@/context/AuthContext';
import { useDriverEntitlement } from '@/context/DriverEntitlementContext';
import {
  isPackageOfferExpired,
  type DriverEntitlementVehicleRef,
  type DriverPackageOfferSnapshot,
  type DriverPackagePurchase,
  type DriverPackagePurchaseStatus,
  type MobileMoneyPackageProvider,
  type PackageActivation,
} from '@/domain/driverRidePackages';
import { getEntitlementVehicleForProfile } from '@/domain/driverRidePackages';
import { useColors } from '@/hooks/useColors';
import { loadLockedPackageOffer, type LockedOfferLoadFailure } from '@/persistence/lockedPackageOfferPersistence';
import { icons } from '@/constants/icons';
import { radius } from '@/constants/radius';
import { sizes } from '@/constants/sizes';
import { spacing, semanticSpacing } from '@/constants/spacing';
import { DRIVER_PACKAGES_ROUTE } from '@/navigation/driverPackagesNavigation';
import { closeTemporaryScreen, navigateToDriverHomeAfterCompletion, replaceFlowScreen } from '@/navigation/navigationPolicy';
import * as Clipboard from 'expo-clipboard';
import { useToast } from '@/context/ToastContext';
import { VEHICLE_LABELS } from '@/types';
import { usePackagePaymentConfigQuery } from '@/query/hooks/usePackagePaymentConfigQuery';
import { useManualPaymentClaimsQuery } from '@/query/hooks/useManualPaymentClaimsQuery';
import {
  useCancelManualPaymentClaimMutation,
  useCreateManualPaymentClaimMutation,
  useResubmitManualPaymentClaimMutation,
  useSubmitManualPaymentClaimMutation,
} from '@/query/hooks/useManualPaymentClaimMutations';
import {
  toManualPaymentClaimReadModel,
  type ManualPaymentClaim,
  type ManualPaymentClaimReadModel,
  type ManualPaymentProvider,
  type ManualPaymentProviderConfiguration,
} from '@/domains/package-payments';
import { ManualPackagePaymentInstructions } from '@/components/package-payments/ManualPackagePaymentInstructions';
import { ManualPaymentClaimStatusCard } from '@/components/package-payments/ManualPaymentClaimStatusCard';
import { PackagePaymentUnavailable } from '@/components/package-payments/PackagePaymentUnavailable';
import { normalizeRwandaPhoneNumber } from '@/utils/rwandaValidation';
import { reportOperationalWarning } from '@/observability/monitoring';

function formatRwf(amount: number) {
  return `${amount.toLocaleString('en-RW')} RWF`;
}

// A manual claim is still "live" (needs the driver's attention / blocks starting
// a fresh payment) while it is awaiting or in review, or needs clarification.
const ACTIVE_CLAIM_STATUSES = new Set(['submitted', 'pending_review', 'needs_clarification']);

export default function DriverPackagePaymentScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const isDark = useColorScheme() === 'dark';
  const { offerId } = useLocalSearchParams<{ offerId?: string; claimId?: string }>();
  const { driverProfile, user } = useAuth();
  const { createPackagePurchase, entitlement, updatePackagePurchaseStatus, activatePackage } = useDriverEntitlement();
  const activeVehicle = getEntitlementVehicleForProfile(driverProfile);
  const checkoutVehicle: DriverEntitlementVehicleRef | null = activeVehicle
    ?? (entitlement.vehicleId && entitlement.vehicleType
      ? { vehicleId: entitlement.vehicleId, vehicleType: entitlement.vehicleType }
      : null);
  const checkoutVehicleId = activeVehicle?.id ?? entitlement.vehicleId ?? null;

  const [ridePackage, setRidePackage] = useState<DriverPackageOfferSnapshot | null>(null);
  const [offerFailure, setOfferFailure] = useState<LockedOfferLoadFailure | null>(null);
  const [offerLoading, setOfferLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<MobileMoneyPackageProvider>(
    driverProfile?.momoProvider === 'airtel' ? 'airtel' : 'mtn',
  );
  const [phoneNumber, setPhoneNumber] = useState(driverProfile?.momoCode ?? '');
  const [paymentStatus, setPaymentStatus] = useState<DriverPackagePurchaseStatus>('idle');
  const [activePurchase, setActivePurchase] = useState<DriverPackagePurchase | null>(null);
  const [receipt, setReceipt] = useState<PackageActivation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paymentTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const { showToast } = useToast();

  // Manual (proof-based) claim flow. Configuration decides which mode is live:
  //   automatic → Mobile Money prompt (below); manual → submit a payment claim
  //   for admin review; disabled → an unavailable shell.
  const { configuration } = usePackagePaymentConfigQuery();
  const mode = configuration?.mode ?? 'automatic';
  const manualConfig = configuration?.manual;
  const providers: ManualPaymentProviderConfiguration[] = manualConfig?.providers ?? [];
  const transactionReferenceRequired = manualConfig?.transactionReferenceRequired ?? true;

  const { claims, refetch: refetchClaims } = useManualPaymentClaimsQuery({ driverId: user?.id });
  const createClaim = useCreateManualPaymentClaimMutation();
  const submitClaim = useSubmitManualPaymentClaimMutation();
  const resubmitClaim = useResubmitManualPaymentClaimMutation();
  const cancelClaim = useCancelManualPaymentClaimMutation();

  const [formVisible, setFormVisible] = useState(false);
  const [payerPhone, setPayerPhone] = useState(driverProfile?.momoCode ?? '');
  const [transactionReference, setTransactionReference] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [submittedClaim, setSubmittedClaim] = useState<ManualPaymentClaimReadModel | null>(null);

  const manualProvider: ManualPaymentProvider = useMemo(() => {
    const enabled = providers.filter(p => p.enabled);
    if (enabled.some(p => p.provider === selectedProvider)) return selectedProvider as ManualPaymentProvider;
    return (enabled[0]?.provider ?? 'mtn') as ManualPaymentProvider;
  }, [providers, selectedProvider]);

  // A claim already in flight (from the server, or one we just submitted) takes
  // priority over starting a new payment.
  const activeClaim: ManualPaymentClaimReadModel | null = useMemo(() => {
    if (submittedClaim) return submittedClaim;
    const list = (claims ?? []) as ManualPaymentClaimReadModel[];
    return list.find(c => c && ACTIVE_CLAIM_STATUSES.has(c.status)) ?? null;
  }, [submittedClaim, claims]);

  const clearPaymentTimers = () => {
    paymentTimers.current.forEach(timer => clearTimeout(timer));
    paymentTimers.current = [];
  };

  useEffect(() => () => clearPaymentTimers(), []);

  useEffect(() => {
    let active = true;
    setOfferLoading(true);
    void loadLockedPackageOffer(offerId, {
      ownerUserId: user?.id,
      vehicle: checkoutVehicle,
    }).then(result => {
      if (!active) return;
      setRidePackage(result.offer);
      setOfferFailure(result.failure);
      setOfferLoading(false);
    });
    return () => {
      active = false;
    };
  }, [checkoutVehicleId, checkoutVehicle?.vehicleType, offerId, user?.id]);

  const schedulePaymentSuccess = (purchase: DriverPackagePurchase) => {
    const processingTimer = setTimeout(() => {
      setPaymentStatus('processing');
      void updatePackagePurchaseStatus(purchase.transactionId, 'processing');
    }, 700);
    const successTimer = setTimeout(async () => {
      try {
        const result = await updatePackagePurchaseStatus(purchase.transactionId, 'successful');
        setPaymentStatus('successful');
        if (result.activation) setReceipt(result.activation);
      } catch (paymentError) {
        setPaymentStatus('failed');
        setError(paymentError instanceof Error ? paymentError.message : 'Payment was not completed');
      }
    }, 1800);
    paymentTimers.current = [processingTimer, successTimer];
  };

  const handleActivateFreePackage = async () => {
    if (!ridePackage) return;
    if (isPackageOfferExpired(ridePackage)) {
      setError('This package offer expired. Please refresh packages.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setReceipt(await activatePackage(ridePackage));
    } catch (activationError) {
      setError(activationError instanceof Error ? activationError.message : 'Unable to activate this package.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendPaymentPrompt = async () => {
    if (!ridePackage) return;
    if (isPackageOfferExpired(ridePackage)) {
      setError('This package offer expired. Please refresh packages.');
      return;
    }
    if (ridePackage.priceRwf <= 0) {
      await handleActivateFreePackage();
      return;
    }
    clearPaymentTimers();
    setLoading(true);
    setError(null);
    try {
      const purchase = await createPackagePurchase({
        offer: ridePackage,
        provider: selectedProvider,
        phoneNumber,
      });
      setActivePurchase(purchase);
      setPaymentStatus('pending');
      schedulePaymentSuccess(purchase);
    } catch (paymentError) {
      setPaymentStatus('failed');
      setError(paymentError instanceof Error ? paymentError.message : 'Payment was not completed');
    } finally {
      setLoading(false);
    }
  };

  const handleChooseAnotherMethod = async () => {
    clearPaymentTimers();
    if (activePurchase && (paymentStatus === 'pending' || paymentStatus === 'processing')) {
      await updatePackagePurchaseStatus(activePurchase.transactionId, 'cancelled');
      setPaymentStatus('cancelled');
      return;
    }
    setPaymentStatus('idle');
    setActivePurchase(null);
    setError(null);
  };

  const handleCopyProvider = async (_provider: ManualPaymentProviderConfiguration, instruction: string) => {
    await Clipboard.setStringAsync(instruction);
    showToast('USSD copied', 'success');
  };

  const handleSubmitManualClaim = async () => {
    if (!ridePackage) return;
    if (isPackageOfferExpired(ridePackage)) {
      setManualError('This package offer expired. Please refresh packages.');
      return;
    }
    setManualError(null);
    const normalizedPhone = normalizeRwandaPhoneNumber(payerPhone);
    if (!normalizedPhone) {
      setManualError('Manual payment claim is invalid.');
      return;
    }
    const ref = transactionReference.trim();
    if (transactionReferenceRequired && !ref) {
      setManualError('A transaction reference is required.');
      return;
    }

    setManualSubmitting(true);
    try {
      const created = await createClaim.mutateAsync({
        offer: ridePackage,
        driverId: user?.id ?? '',
        provider: manualProvider,
        payerPhoneNumber: normalizedPhone,
        transactionReference: ref || undefined,
      });
      if (created.failure || !created.data) {
        setManualError(created.failure?.message ?? 'Could not submit your payment claim.');
        reportOperationalWarning('package-payment.manual.create', {
          operation: 'DriverPackagePaymentScreen',
          result: created.failure?.code ?? 'unknown',
          mode,
        });
        return;
      }
      const submitted = await submitClaim.mutateAsync({ claim: created.data, actorId: user?.id });
      if (submitted.failure || !submitted.data) {
        setManualError(submitted.failure?.message ?? 'Could not submit your payment claim.');
        reportOperationalWarning('package-payment.manual.submit', {
          operation: 'DriverPackagePaymentScreen',
          result: submitted.failure?.code ?? 'unknown',
          mode,
        });
        return;
      }
      setSubmittedClaim(toManualPaymentClaimReadModel(submitted.data, { authority: 'remote_backed' }));
      setFormVisible(false);
      reportOperationalWarning('package-payment.manual.review', {
        operation: 'DriverPackagePaymentScreen',
        status: submitted.data.status,
        mode,
      });
    } catch {
      setManualError('Could not submit your payment claim.');
      reportOperationalWarning('package-payment.manual.error', {
        operation: 'DriverPackagePaymentScreen',
        result: 'exception',
        mode,
      });
    } finally {
      setManualSubmitting(false);
    }
  };

  const handleCancelClaim = async (claimId: string, version: number) =>
    cancelClaim.mutateAsync({ claim: { id: claimId, version } as ManualPaymentClaim });

  const handleResubmitClaim = async (
    claimId: string,
    version: number,
    updates: { provider: ManualPaymentProvider; phone: string; reference?: string },
  ) => {
    const result = await resubmitClaim.mutateAsync({
      claim: {
        id: claimId,
        version,
        provider: updates.provider,
        payerPhoneNumber: updates.phone,
        transactionReference: updates.reference,
      } as ManualPaymentClaim,
    });
    if (result.data) setSubmittedClaim(toManualPaymentClaimReadModel(result.data, { authority: 'remote_backed' }));
    return result;
  };

  if (offerLoading) {
    return <View style={[styles.root, styles.centered, { backgroundColor: isDark ? '#000' : '#F2F2F7' }]}>
      <AppText style={[styles.invalidText, { color: colors.mutedForeground }]}>Loading package offer...</AppText>
    </View>;
  }

  if (!ridePackage) {
    const expired = offerFailure === 'expired';
    return <View style={[styles.root, styles.centered, { backgroundColor: isDark ? '#000' : '#F2F2F7' }]}>
      <View style={[styles.invalidIconHalo, { backgroundColor: colors.destructiveHex + '14' }]}>
        <Feather name="package" size={sizes.avatar.xs} color={colors.destructive} />
      </View>
      <AppText style={[styles.invalidTitle, { color: colors.foreground }]}>
        {expired ? 'Package offer expired' : 'Package offer unavailable'}
      </AppText>
      <AppText style={[styles.invalidText, { color: colors.mutedForeground }]}>
        {expired
          ? 'This package offer expired. Please refresh packages.'
          : 'This package offer is missing or invalid. Please choose the package again.'}
      </AppText>
      <AppButton title="Return to Packages" onPress={() => closeTemporaryScreen(router, DRIVER_PACKAGES_ROUTE)} />
    </View>;
  }

  const isFree = ridePackage.priceRwf === 0;
  const isWaiting = paymentStatus === 'pending' || paymentStatus === 'processing';
  const isIncomplete = paymentStatus === 'failed' || paymentStatus === 'cancelled' || paymentStatus === 'expired';
  const vehicleLabel = ridePackage.vehicleType ? VEHICLE_LABELS[ridePackage.vehicleType] : null;

  return <View style={[styles.root, { backgroundColor: isDark ? '#000' : '#F2F2F7' }]}>
    <GlassHeader title="Package Payment" onBackPress={() => router.back()} />
    <GlassScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.paymentScrollContent,
        { paddingTop: headerMetrics.contentTop, paddingBottom: insets.bottom + FORM_BOTTOM_PADDING },
      ]}
      scrollIndicatorInsets={{ top: headerMetrics.indicatorTop }}
    >
      {receipt ? (
        <ReceiptCard activation={receipt} colors={colors} />
      ) : mode === 'disabled' ? (
        <PackagePaymentUnavailable
          offer={ridePackage}
          reasonText="Package payments are temporarily unavailable. Please try again later."
          onBack={() => replaceFlowScreen(router, '/driver-packages')}
        />
      ) : activeClaim ? (
        <View style={styles.claimShell}>
          <ManualPaymentClaimStatusCard
            claim={activeClaim}
            onRefetch={() => { void refetchClaims?.(); }}
            onCancel={handleCancelClaim}
            onResubmit={handleResubmitClaim}
          />
        </View>
      ) : mode === 'manual' && !isFree ? (
        <View style={styles.manualShell}>
          <ManualPackagePaymentInstructions
            offer={ridePackage}
            vehicleLabel={vehicleLabel}
            providers={providers}
            onCopyProvider={(provider, instruction) => void handleCopyProvider(provider, instruction)}
          />
          <View style={styles.manualForm}>
            {formVisible ? (
              <>
                <AppInput
                  label="Payer phone number"
                  accessibilityLabel="Payer phone number"
                  placeholder="+250 7xxxxxxxx"
                  value={payerPhone}
                  onChangeText={setPayerPhone}
                  keyboardType="phone-pad"
                  leftIcon="smartphone"
                />
                <AppInput
                  label={`Transaction reference${transactionReferenceRequired ? ' *' : ''}`}
                  accessibilityLabel="Transaction reference"
                  placeholder={transactionReferenceRequired ? 'Enter the payment reference' : 'Optional payment reference'}
                  value={transactionReference}
                  onChangeText={setTransactionReference}
                  autoCapitalize="characters"
                  leftIcon="hash"
                />
                {manualError ? (
                  <View style={[styles.inlineError, { borderColor: colors.destructiveHex + '30' }]}>
                    <Feather name="alert-triangle" size={15} color={colors.destructive} />
                    <AppText style={[styles.errorText, { color: colors.destructive }]}>{manualError}</AppText>
                  </View>
                ) : null}
                <AppButton
                  title="Submit payment"
                  accessibilityLabel="Submit payment"
                  onPress={() => void handleSubmitManualClaim()}
                  loading={manualSubmitting}
                  fullWidth
                  size="lg"
                />
              </>
            ) : (
              <AppButton
                title="I have paid"
                accessibilityLabel="I have paid"
                onPress={() => { setManualError(null); setFormVisible(true); }}
                variant="secondary"
                fullWidth
                size="lg"
              />
            )}
          </View>
        </View>
      ) : (
        <View style={styles.paymentContent}>
          <View style={styles.summaryPanel}>
            <View style={styles.summaryHeader}>
              <View style={[styles.summaryIcon, { backgroundColor: colors.primary }]}>
                <Feather name="navigation" size={icons.semantic.row} color="#fff" />
              </View>
              <View style={styles.summaryTitleBlock}>
                <AppText style={[styles.summaryEyebrow, { color: colors.primary }]}>SELECTED PACKAGE</AppText>
                <AppText style={[styles.packageName, { color: colors.foreground }]}>{ridePackage.packageName}</AppText>
                {ridePackage.campaignName ? (
                  <View style={[styles.campaignBadge, { backgroundColor: colors.primaryHex + '12' }]}>
                    <Feather name="tag" size={11} color={colors.primary} />
                    <AppText style={[styles.campaignBadgeText, { color: colors.primary }]}>{ridePackage.campaignName}</AppText>
                  </View>
                ) : null}
              </View>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
            <View style={styles.summaryRow}>
              <AppText style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Rides</AppText>
              <AppText style={[styles.summaryValue, { color: colors.foreground }]}>{ridePackage.ridesGranted}</AppText>
            </View>
            <View style={styles.summaryRow}>
              <AppText style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Bonus Rides</AppText>
              <AppText style={[styles.summaryValue, { color: colors.primary }]}>+{ridePackage.bonusRidesGranted}</AppText>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
            <View style={styles.summaryRow}>
              <AppText style={[styles.totalLabel, { color: colors.foreground }]}>Total due</AppText>
              <AppText style={[styles.price, { color: colors.primary }]}>{isFree ? 'FREE NOW' : formatRwf(ridePackage.priceRwf)}</AppText>
            </View>
          </View>

          {isFree ? (
            <Notice icon="gift" text="No payment is required for this launch package now." colors={colors} tone="success" />
          ) : (
            <>
              <View style={styles.sectionHeading}>
                <AppText style={[styles.sectionTitle, { color: colors.foreground }]}>Pay with Mobile Money</AppText>
                <AppText style={[styles.sectionDescription, { color: colors.mutedForeground }]}>
                  Choose a provider and confirm the phone number that will receive the prompt.
                </AppText>
              </View>
              <View style={styles.providerChoiceRow}>
                {(['mtn', 'airtel'] as MobileMoneyPackageProvider[]).map(option => (
                  <ProviderOption
                    key={option}
                    colors={colors}
                    isSelected={selectedProvider === option}
                    label={option === 'mtn' ? 'MTN Mobile Money' : 'Airtel Money'}
                    provider={option}
                    shortLabel={option === 'mtn' ? 'MTN' : 'Airtel'}
                    onPress={() => setSelectedProvider(option)}
                  />
                ))}
              </View>
              <AppInput
                label="Mobile Money Phone Number"
                placeholder="+250 7xxxxxxxx"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                leftIcon="smartphone"
              />
              {isWaiting ? <Notice icon="smartphone" text="Waiting for Mobile Money confirmation. Confirm the payment on your phone." colors={colors} tone="waiting" /> : null}
              {isIncomplete ? <Notice icon="alert-circle" text="Payment was not completed" colors={colors} tone="error" /> : null}
            </>
          )}

          {error ? (
            <View style={[styles.inlineError, { borderColor: colors.destructiveHex + '30' }]}>
              <Feather name="alert-triangle" size={15} color={colors.destructive} />
              <AppText style={[styles.errorText, { color: colors.destructive }]}>{error}</AppText>
            </View>
          ) : null}
          {isIncomplete ? (
            <View style={styles.actions}>
              <AppButton title="Choose Another Method" onPress={handleChooseAnotherMethod} variant="secondary" style={styles.actionButton} />
              <AppButton title="Try Again" onPress={() => void handleSendPaymentPrompt()} loading={loading} style={styles.actionButton} />
            </View>
          ) : isFree ? (
            <AppButton title="Activate Package" onPress={() => void handleSendPaymentPrompt()} loading={loading} fullWidth size="lg" />
          ) : (
            <AppButton
              title="Send Payment Prompt"
              onPress={() => void handleSendPaymentPrompt()}
              disabled={!phoneNumber.trim()}
              loading={loading || isWaiting}
              fullWidth
              size="lg"
            />
          )}
          {!isFree && !isWaiting ? (
            <View style={styles.secureNote}>
              <Feather name="lock" size={13} color={colors.mutedForeground} />
              <AppText style={[styles.secureNoteText, { color: colors.mutedForeground }]}>
                You will confirm this payment securely on your phone.
              </AppText>
            </View>
          ) : null}
        </View>
      )}
    </GlassScrollView>
  </View>;
}

function ProviderOption({ colors, isSelected, label, onPress, provider, shortLabel }: {
  colors: ReturnType<typeof useColors>; isSelected: boolean; label: string; onPress: () => void;
  provider: MobileMoneyPackageProvider; shortLabel: string;
}) {
  return <TouchableOpacity
    accessibilityRole="radio"
    accessibilityState={{ checked: isSelected }}
    style={[styles.providerOption, {
      backgroundColor: isSelected ? colors.primaryHex + '0D' : colors.surface,
      borderColor: isSelected ? colors.primary : colors.border,
    }]}
    onPress={onPress}
    activeOpacity={0.75}
  >
    <View style={styles.providerIcon}>
      <Image source={PAYMENT_PROVIDER_LOGOS[provider]} style={styles.providerLogo} resizeMode="contain" />
    </View>
    <View style={styles.providerTextBlock}>
      <AppText style={[styles.providerOptionText, { color: colors.foreground }]}>{shortLabel}</AppText>
      <AppText style={[styles.providerOptionSubtext, { color: colors.mutedForeground }]}>{label}</AppText>
    </View>
    <View style={[styles.radioOuter, { borderColor: isSelected ? colors.primary : colors.border }]}>
      {isSelected ? <View style={[styles.radioInner, { backgroundColor: colors.primary }]} /> : null}
    </View>
  </TouchableOpacity>;
}

function Notice({ colors, icon, text, tone }: {
  colors: ReturnType<typeof useColors>; icon: React.ComponentProps<typeof Feather>['name']; text: string;
  tone: 'success' | 'waiting' | 'error';
}) {
  const accent = tone === 'success' ? colors.success : tone === 'waiting' ? colors.warning : colors.destructive;
  const accentHex = tone === 'success' ? colors.successHex : tone === 'waiting' ? colors.warningHex : colors.destructiveHex;

  return <View style={[styles.notice, { backgroundColor: accentHex + '0D', borderColor: accentHex + '28' }]}>
    <View style={[styles.noticeIcon, { backgroundColor: accentHex + '18' }]}>
      <Feather name={icon} size={17} color={accent} />
    </View>
    <AppText style={[styles.noticeText, { color: colors.mutedForeground }]}>{text}</AppText>
  </View>;
}

function ReceiptCard({ activation, colors }: {
  activation: PackageActivation; colors: ReturnType<typeof useColors>;
}) {
  return <View style={[styles.paymentContent, styles.receiptCard]}>
    <View style={[styles.receiptIconHalo, { backgroundColor: colors.successHex + '18' }]}>
      <View style={[styles.receiptIcon, { backgroundColor: colors.success }]}>
        <Feather name="check" size={30} color="#fff" />
      </View>
    </View>
    <AppText style={[styles.receiptTitle, { color: colors.foreground }]}>Package Activated</AppText>
    {activation.campaignName ? (
      <View style={[styles.campaignBadge, { backgroundColor: colors.primaryHex + '12' }]}>
        <Feather name="tag" size={11} color={colors.primary} />
        <AppText style={[styles.campaignBadgeText, { color: colors.primary }]}>{activation.campaignName}</AppText>
      </View>
    ) : null}
    <AppText style={[styles.receiptText, { color: colors.mutedForeground }]}>You can now go online and start receiving ride requests.</AppText>
    <AppText style={[styles.receiptCredits, { color: colors.foreground }]}>Rides Added: {activation.ridesGranted ?? 0}</AppText>
    <AppText style={[styles.receiptCredits, { color: colors.foreground }]}>Bonus Rides Added: {activation.bonusRidesGranted ?? 0}</AppText>
    <View style={styles.receiptAction}>
      <AppButton title="Go to Dashboard" onPress={() => navigateToDriverHomeAfterCompletion(router)} fullWidth size="lg" />
    </View>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  manualShell: { gap: semanticSpacing.screenPadding },
  manualForm: { marginHorizontal: semanticSpacing.screenPadding, gap: spacing[14] },
  claimShell: { marginHorizontal: semanticSpacing.screenPadding },
  centered: { alignItems: 'center', justifyContent: 'center', gap: icons.semantic.row, padding: semanticSpacing.sectionGap },
  invalidIconHalo: { width: sizes.thumbnail.md, height: sizes.thumbnail.md, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: spacing[2] },
  invalidTitle: { ...typography.h2, letterSpacing: -0.3 },
  invalidText: { maxWidth: 300, textAlign: 'center', ...typography.label, lineHeight: 19 },
  paymentScrollContent: { flexGrow: 1, justifyContent: 'center' },
  paymentContent: { marginHorizontal: semanticSpacing.screenPadding, gap: semanticSpacing.screenPadding },
  summaryPanel: { gap: spacing[10] },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: semanticSpacing.rowGap },
  summaryIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  summaryTitleBlock: { flex: 1, gap: 2 },
  summaryEyebrow: { ...typography.tiny, letterSpacing: 0.8 },
  packageName: { ...typography.h2 },
  campaignBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing[4], alignSelf: 'flex-start', paddingHorizontal: semanticSpacing.inlineGap, paddingVertical: 5, borderRadius: radius.pill },
  campaignBadgeText: { ...typography.tiny },
  summaryDivider: { height: StyleSheet.hairlineWidth },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: semanticSpacing.cardPadding },
  summaryLabel: { ...typography.label },
  summaryValue: { ...typography.bodySmall },
  totalLabel: { ...typography.bodySmall },
  price: { ...typography.h2 },
  sectionHeading: { gap: spacing[4] },
  sectionTitle: { ...typography.title },
  sectionDescription: { ...typography.caption, lineHeight: 17 },
  providerChoiceRow: { gap: 9 },
  providerOption: { minHeight: 62, borderRadius: 15, borderWidth: 1, paddingHorizontal: semanticSpacing.rowGap, paddingVertical: spacing[10], flexDirection: 'row', alignItems: 'center', gap: spacing[10] },
  providerIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  providerLogo: { width: 27, height: 27 },
  providerTextBlock: { flex: 1, gap: 1 },
  providerOptionText: { ...typography.bodySmall },
  providerOptionSubtext: { ...typography.tiny },
  radioOuter: { width: spacing[20], height: spacing[20], borderRadius: radius.md, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: spacing[10], height: spacing[10], borderRadius: 5 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: spacing[10], padding: 11, borderRadius: radius.card, borderWidth: 1 },
  noticeIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  noticeText: { flex: 1, ...typography.caption, lineHeight: 18 },
  inlineError: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  errorText: { flex: 1, ...typography.caption, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: spacing[10] },
  actionButton: { flex: 1 },
  secureNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[6] },
  secureNoteText: { ...typography.tiny },
  receiptCard: { alignItems: 'center', gap: semanticSpacing.rowGap },
  receiptIconHalo: { width: 86, height: 86, borderRadius: 43, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  receiptIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  receiptTitle: { ...typography.h1, letterSpacing: -0.4 },
  receiptText: { maxWidth: 290, textAlign: 'center', ...typography.bodySmall, lineHeight: 21 },
  receiptCredits: { ...typography.title, marginTop: spacing[4] },
  receiptAction: { width: '100%', marginTop: semanticSpacing.rowGap },
});
