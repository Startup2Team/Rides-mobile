import { typography } from '@/constants/typography';
import { AppText } from '@/components/AppText';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, TouchableOpacity, View, useColorScheme } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { AppButton } from '@/components/AppButton';
import { AppInput } from '@/components/AppInput';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { GlassScrollView } from '@/components/GlassScrollView';
import { FORM_BOTTOM_PADDING } from '@/constants/tabBar';
import { PAYMENT_PROVIDER_LOGOS } from '@/components/driver-onboarding/onboardingData';
import { useAuth } from '@/context/AuthContext';
import { useDriverEntitlement } from '@/context/DriverEntitlementContext';
import { useToast } from '@/context/ToastContext';
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
import { PackagePaymentUnavailable } from '@/components/package-payments/PackagePaymentUnavailable';
import { usePackagePaymentConfigQuery } from '@/query/hooks/usePackagePaymentConfigQuery';
import { useColors } from '@/hooks/useColors';
import { reportOperationalWarning } from '@/observability/monitoring';
import { loadLockedPackageOffer, type LockedOfferLoadFailure } from '@/persistence/lockedPackageOfferPersistence';
import { createPackagePaymentRepository } from '@/data/repositories/packagePaymentRepositoryFactory';
import {
  normalizeManualPaymentTransactionReference,
  validateManualPaymentClaim,
  type ManualPaymentClaim,
  type ManualPaymentProvider,
} from '@/domains/package-payments';
import { formatRwandaPhoneInput, normalizeRwandaPhoneNumber } from '@/utils/rwandaValidation';
import {
  useCreateManualPaymentClaimMutation,
  useSubmitManualPaymentClaimMutation,
  useResubmitManualPaymentClaimMutation,
  useCancelManualPaymentClaimMutation,
} from '@/query/hooks/useManualPaymentClaimMutations';
import { useManualPaymentClaimsQuery } from '@/query/hooks/useManualPaymentClaimsQuery';
import { useManualPaymentClaimQuery } from '@/query/hooks/useManualPaymentClaimQuery';
import { selectRelevantManualPaymentClaim } from '@/domains/package-payments/manualPaymentClaimHelpers';
import { ManualPaymentClaimStatusCard } from '@/components/package-payments/ManualPaymentClaimStatusCard';
import { ManualPackagePaymentInstructions } from '@/components/package-payments/ManualPackagePaymentInstructions';
import { icons } from '@/constants/icons';
import { radius } from '@/constants/radius';
import { sizes } from '@/constants/sizes';
import { spacing, semanticSpacing } from '@/constants/spacing';
import { DRIVER_PACKAGES_ROUTE } from '@/navigation/driverPackagesNavigation';
import { closeTemporaryScreen, navigateToDriverHomeAfterCompletion } from '@/navigation/navigationPolicy';

function formatRwf(amount: number) {
  return `${amount.toLocaleString('en-RW')} RWF`;
}

function getVehicleLabel(vehicleType: DriverEntitlementVehicleRef['vehicleType'] | null | undefined) {
  if (vehicleType === 'moto') return 'Motorcycle';
  if (vehicleType === 'cab') return 'Car';
  if (vehicleType === 'rifani') return 'Rifani';
  if (vehicleType === 'fuso') return 'Fuso';
  if (vehicleType === 'hilux') return 'Hilux';
  return null;
}

export default function DriverPackagePaymentScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const { showToast } = useToast();
  const isDark = useColorScheme() === 'dark';
  const { offerId } = useLocalSearchParams<{ offerId?: string }>();
  const { driverProfile, user } = useAuth();
  const { activatePackage, createPackagePurchase, entitlement, updatePackagePurchaseStatus } = useDriverEntitlement();
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
  const [manualClaimProvider, setManualClaimProvider] = useState<ManualPaymentProvider>(
    driverProfile?.momoProvider === 'airtel' ? 'airtel' : 'mtn',
  );
  const [manualPayerPhoneNumber, setManualPayerPhoneNumber] = useState(driverProfile?.momoCode ?? '');
  const [manualTransactionReference, setManualTransactionReference] = useState('');
  const [manualClaimSubmitting, setManualClaimSubmitting] = useState(false);
  const [manualClaimError, setManualClaimError] = useState<string | null>(null);
  const [submittedManualClaim, setSubmittedManualClaim] = useState<ManualPaymentClaim | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const { claimId } = useLocalSearchParams<{ claimId?: string }>();
  const claimsQuery = useManualPaymentClaimsQuery({ driverId: user?.id });
  const singleClaimQuery = useManualPaymentClaimQuery(claimId, { enabled: Boolean(claimId) });

  const createMutation = useCreateManualPaymentClaimMutation();
  const submitMutation = useSubmitManualPaymentClaimMutation();
  const resubmitMutation = useResubmitManualPaymentClaimMutation();
  const cancelMutation = useCancelManualPaymentClaimMutation();

  const paymentTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const paymentConfigQuery = usePackagePaymentConfigQuery();
  const paymentMode = paymentConfigQuery.configuration.mode;
  const packagePaymentRepository = useMemo(
    () => createPackagePaymentRepository({ configuration: paymentConfigQuery.configuration }),
    [paymentConfigQuery.configuration],
  );
  const manualPaymentConfiguration = paymentConfigQuery.configuration.manual;
  const manualPaymentProviders = manualPaymentConfiguration?.providers ?? [];
  const manualTransactionReferenceRequired = manualPaymentConfiguration?.transactionReferenceRequired ?? false;

  const activeClaim = claimId
    ? singleClaimQuery.claim
    : (ridePackage && checkoutVehicleId
        ? selectRelevantManualPaymentClaim(claimsQuery.claims, ridePackage.packageId, checkoutVehicleId)
        : null);

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

  useEffect(() => {
    if (paymentMode !== 'manual') return;
    const preferredProvider = manualPaymentProviders.find(provider => provider.provider === manualClaimProvider && provider.enabled)
      ?? manualPaymentProviders.find(provider => provider.enabled)
      ?? manualPaymentProviders[0];
    if (preferredProvider && preferredProvider.provider !== manualClaimProvider) {
      setManualClaimProvider(preferredProvider.provider);
    }
  }, [manualClaimProvider, manualPaymentProviders, paymentMode]);

  const handleCopyManualInstruction = async (
    provider: 'mtn' | 'airtel',
    instruction: string,
  ) => {
    try {
      if (Clipboard?.setStringAsync) {
        await Clipboard.setStringAsync(instruction);
      } else {
        throw new Error('Clipboard unavailable');
      }
      showToast('USSD copied', 'success');
      reportOperationalWarning('package-payment.manual.ussd.copied', {
        operation: 'driver-package-payment',
        provider,
      });
    } catch {
      showToast('Unable to copy USSD', 'error');
    }
  };

  const handleManualClaimSubmit = async () => {
    if (!ridePackage || !user?.id) return;
    setManualClaimSubmitting(true);
    setManualClaimError(null);
    setError(null);
    try {
      const normalizedPhone = normalizeRwandaPhoneNumber(manualPayerPhoneNumber);
      const normalizedTransactionReference = normalizeManualPaymentTransactionReference(manualTransactionReference);

      const validation = validateManualPaymentClaim({
        claimId: `manual-payment-claim:${ridePackage.offerId}:${user.id}`,
        driverId: user.id,
        offer: ridePackage,
        provider: manualClaimProvider,
        payerPhoneNumber: normalizedPhone ?? manualPayerPhoneNumber,
        transactionReference: normalizedTransactionReference ?? undefined,
      }, paymentConfigQuery.configuration);

      if (validation.failure || !validation.data) {
        setManualClaimError(validation.failure?.message ?? 'Manual payment claim is invalid.');
        return;
      }

      const createdRes = await createMutation.mutateAsync({
        claimId: validation.data.id,
        idempotencyKey: validation.data.idempotencyKey,
        offer: ridePackage,
        driverId: user.id,
        provider: manualClaimProvider,
        payerPhoneNumber: normalizedPhone ?? manualPayerPhoneNumber,
        transactionReference: normalizedTransactionReference ?? undefined,
      });

      if (createdRes.failure || !createdRes.data) {
        setManualClaimError(createdRes.failure?.message ?? 'Unable to create manual payment claim.');
        return;
      }

      const submittedRes = await submitMutation.mutateAsync({
        claim: createdRes.data,
        submittedAt: new Date().toISOString(),
        actorId: user.id,
      });

      if (submittedRes.failure || !submittedRes.data) {
        setManualClaimError(submittedRes.failure?.message ?? 'Unable to submit manual payment claim.');
        return;
      }

      showToast('Payment claim submitted for review.', 'success');
      reportOperationalWarning('package-payment.manual.claim.submitted', {
        status: 'submitted',
      });
      setManualTransactionReference('');
      setFormVisible(false);
    } catch (claimError) {
      setManualClaimError(claimError instanceof Error ? claimError.message : 'Unable to submit manual payment claim.');
    } finally {
      setManualClaimSubmitting(false);
    }
  };

  const handleCancelClaim = async (claimId: string, version: number) => {
    if (!user?.id) return { failure: { code: 'unauthorized', message: 'Unauthorized' } };
    
    const claimRes = await packagePaymentRepository.getManualPaymentClaim(claimId);
    if (claimRes.failure || !claimRes.data) {
      return claimRes;
    }

    const cancelRes = await cancelMutation.mutateAsync({
      claim: claimRes.data,
      cancelledAt: new Date().toISOString(),
      actorId: user.id,
    });
    
    if (!cancelRes.failure) {
      showToast('Payment claim cancelled.', 'success');
    }
    return cancelRes;
  };

  const handleResubmitClaim = async (
    claimId: string,
    version: number,
    updates: { provider: 'mtn' | 'airtel'; phone: string; reference?: string }
  ) => {
    if (!user?.id) return { failure: { code: 'unauthorized', message: 'Unauthorized' } };
    
    const claimRes = await packagePaymentRepository.getManualPaymentClaim(claimId);
    if (claimRes.failure || !claimRes.data) {
      return claimRes;
    }

    const updatedClaim = {
      ...claimRes.data,
      provider: updates.provider,
      payerPhoneNumber: updates.phone,
      transactionReference: updates.reference,
    };

    const resubmitRes = await resubmitMutation.mutateAsync({
      claim: updatedClaim,
      submittedAt: new Date().toISOString(),
      actorId: user.id,
    });

    if (!resubmitRes.failure) {
      showToast('Payment claim resubmitted for review.', 'success');
    }
    return resubmitRes;
  };

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

  if (paymentMode === 'manual') {
    const isFetchingStatus = singleClaimQuery.isFetching || claimsQuery.isFetching;
    const isLoadingStatus = singleClaimQuery.isLoading || claimsQuery.isLoading;

    return <View style={[styles.root, { backgroundColor: isDark ? '#000' : '#F2F2F7' }]}>
      <GlassHeader title="Package Payment" onBackPress={() => router.back()} />
      <ScrollView
        style={styles.root}
        contentContainerStyle={[
          styles.paymentScrollContent,
          { paddingTop: headerMetrics.contentTop, paddingBottom: insets.bottom + FORM_BOTTOM_PADDING },
        ]}
        scrollIndicatorInsets={{ top: headerMetrics.indicatorTop }}
      >
        {isLoadingStatus ? (
          <View style={styles.centered}>
            <AppText style={[styles.invalidText, { color: colors.mutedForeground }]}>Loading payment status...</AppText>
          </View>
        ) : activeClaim ? (
          <View style={{ marginHorizontal: 20 }}>
            <ManualPaymentClaimStatusCard
              claim={activeClaim}
              onRefetch={() => {
                if (claimId) singleClaimQuery.refetch();
                else claimsQuery.refetch();
              }}
              isRefetching={isFetchingStatus}
              onCancel={handleCancelClaim}
              onResubmit={handleResubmitClaim}
            />
          </View>
        ) : !formVisible ? (
          <View style={{ gap: 20 }}>
            <ManualPackagePaymentInstructions
              offer={ridePackage}
              vehicleLabel={getVehicleLabel(ridePackage.vehicleType)}
              providers={manualPaymentProviders}
              onCopyProvider={(provider, instruction) => {
                void handleCopyManualInstruction(provider.provider, instruction);
              }}
            />
            <View style={{ marginHorizontal: 20 }}>
              <AppButton
                title="I have paid"
                onPress={() => setFormVisible(true)}
                fullWidth
                size="lg"
              />
            </View>
          </View>
        ) : (
          <View style={styles.paymentContent}>
            <View style={styles.sectionHeading}>
              <AppText style={[styles.sectionTitle, { color: colors.foreground }]}>I have paid</AppText>
              <AppText style={[styles.sectionDescription, { color: colors.mutedForeground }]}>
                Submit the payment details you used so support can review the claim.
              </AppText>
            </View>

            <View style={styles.providerChoiceRow}>
              {manualPaymentProviders.map(provider => {
                const isSelected = provider.provider === manualClaimProvider;
                const isDisabled = !provider.enabled;
                return (
                  <TouchableOpacity
                    key={provider.provider}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected, disabled: isDisabled }}
                    disabled={isDisabled}
                    onPress={() => setManualClaimProvider(provider.provider)}
                    style={[
                      styles.providerOption,
                      {
                        backgroundColor: isSelected ? colors.primaryHex + '0D' : colors.surface,
                        borderColor: isSelected ? colors.primary : colors.border,
                        opacity: isDisabled ? 0.55 : 1,
                      },
                    ]}
                  >
                    <View style={styles.providerIcon}>
                      <Image source={PAYMENT_PROVIDER_LOGOS[provider.provider]} style={styles.providerLogo} resizeMode="contain" />
                    </View>
                    <View style={styles.providerTextBlock}>
                      <AppText style={[styles.providerOptionText, { color: colors.foreground }]}>
                        {provider.provider === 'mtn' ? 'MTN MoMo' : 'Airtel Money'}
                      </AppText>
                      <AppText style={[styles.providerOptionSubtext, { color: colors.mutedForeground }]}>
                        {provider.enabled ? 'Available for manual claim' : 'Unavailable'}
                      </AppText>
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
              value={manualPayerPhoneNumber}
              onChangeText={val => setManualPayerPhoneNumber(formatRwandaPhoneInput(val))}
              keyboardType="phone-pad"
              leftIcon="smartphone"
              accessibilityLabel="Payer phone number"
            />

            <AppInput
              label={`Transaction reference${manualTransactionReferenceRequired ? ' *' : ''}`}
              placeholder="Enter the payment reference"
              value={manualTransactionReference}
              onChangeText={val => setManualTransactionReference(val.trimStart())}
              autoCapitalize="characters"
              leftIcon="hash"
              accessibilityLabel="Transaction reference"
            />

            <View style={[styles.notice, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Feather name="shield" size={14} color={colors.primary} />
              <AppText style={[styles.noticeText, { color: colors.mutedForeground }]}>
                Amount stays locked at {formatRwf(ridePackage.priceRwf)}.
              </AppText>
            </View>

            {manualClaimError ? (
              <View style={[styles.inlineError, { borderColor: colors.destructiveHex + '30' }]}>
                <Feather name="alert-triangle" size={15} color={colors.destructive} />
                <AppText style={[styles.errorText, { color: colors.destructive }]}>{manualClaimError}</AppText>
              </View>
            ) : null}

            <View style={styles.actions}>
              <AppButton
                title="Back to instructions"
                variant="secondary"
                onPress={() => setFormVisible(false)}
                disabled={manualClaimSubmitting}
                style={styles.actionButton}
              />
              <AppButton
                title="Submit payment"
                onPress={() => void handleManualClaimSubmit()}
                loading={manualClaimSubmitting}
                disabled={manualClaimSubmitting || manualPaymentProviders.length === 0}
                style={styles.actionButton}
              />
            </View>
          </View>
        )}
      </ScrollView>
    </View>;
  }

  if (paymentMode === 'disabled') {
    return <View style={[styles.root, { backgroundColor: isDark ? '#000' : '#F2F2F7' }]}>
      <GlassHeader title="Package Payment" onBackPress={() => router.back()} />
      <ScrollView
        style={styles.root}
        contentContainerStyle={[
          styles.paymentScrollContent,
          { paddingTop: headerMetrics.contentTop, paddingBottom: insets.bottom + FORM_BOTTOM_PADDING },
        ]}
        scrollIndicatorInsets={{ top: headerMetrics.indicatorTop }}
      >
        <PackagePaymentUnavailable
          offer={ridePackage}
          reasonText="Package payments are temporarily unavailable. Please try again later."
          onBack={() => closeTemporaryScreen(router, '/driver-packages')}
        />
      </ScrollView>
    </View>;
  }

  const isFree = ridePackage.priceRwf === 0;
  const isWaiting = paymentStatus === 'pending' || paymentStatus === 'processing';
  const isIncomplete = paymentStatus === 'failed' || paymentStatus === 'cancelled' || paymentStatus === 'expired';

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
          ) : (
            <AppButton
              title={isFree ? 'Activate Package' : 'Send Payment Prompt'}
              onPress={() => void handleSendPaymentPrompt()}
              disabled={!isFree && !phoneNumber.trim()}
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
  packageName: { ...typography.h2,  },
  campaignBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing[4], alignSelf: 'flex-start', paddingHorizontal: semanticSpacing.inlineGap, paddingVertical: 5, borderRadius: radius.pill },
  campaignBadgeText: { ...typography.tiny,  },
  summaryDivider: { height: StyleSheet.hairlineWidth },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: semanticSpacing.cardPadding },
  summaryLabel: { ...typography.label,  },
  summaryValue: { ...typography.bodySmall,  },
  totalLabel: { ...typography.bodySmall,  },
  credits: { ...typography.title,  },
  price: { ...typography.h2,  },
  sectionHeading: { gap: spacing[4] },
  sectionTitle: { ...typography.title,  },
  sectionDescription: { ...typography.caption, lineHeight: 17 },
  providerChoiceRow: { gap: 9 },
  providerOption: { minHeight: 62, borderRadius: 15, borderWidth: 1, paddingHorizontal: semanticSpacing.rowGap, paddingVertical: spacing[10], flexDirection: 'row', alignItems: 'center', gap: spacing[10] },
  providerIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  providerLogo: { width: 27, height: 27 },
  providerTextBlock: { flex: 1, gap: 1 },
  providerOptionText: { ...typography.bodySmall,  },
  providerOptionSubtext: { ...typography.tiny,  },
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
  secureNoteText: { ...typography.tiny,  },
  receiptCard: { alignItems: 'center', gap: semanticSpacing.rowGap },
  receiptIconHalo: { width: 86, height: 86, borderRadius: 43, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  receiptIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  receiptTitle: { ...typography.h1, letterSpacing: -0.4 },
  receiptText: { maxWidth: 290, textAlign: 'center', ...typography.bodySmall, lineHeight: 21 },
  receiptCredits: { ...typography.title, marginTop: spacing[4] },
  receiptAction: { width: '100%', marginTop: semanticSpacing.rowGap },
});
