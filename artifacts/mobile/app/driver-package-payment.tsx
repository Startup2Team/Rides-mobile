import { typography } from '@/constants/typography';
import { AppText } from '@/components/AppText';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, TouchableOpacity, View, useColorScheme } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
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
import { closeTemporaryScreen, navigateToDriverHomeAfterCompletion } from '@/navigation/navigationPolicy';
import * as Clipboard from 'expo-clipboard';
import { useToast } from '@/context/ToastContext';
import { resolveManualPaymentInfo, type ResolvedManualPaymentInfo } from '@/services/manualPayment';
import { uploadPaymentProofImage } from '@/services/paymentProof';
import { createPackagePaymentRepository } from '@/data/repositories/packagePaymentRepositoryFactory';

function formatRwf(amount: number) {
  return `${amount.toLocaleString('en-RW')} RWF`;
}

export default function DriverPackagePaymentScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
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
  const paymentTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const { showToast } = useToast();

  // Manual (proof-based) payment. Proof = MoMo transaction reference (text) OR a
  // screenshot of the confirmation (photo). At least one is required; the driver
  // can supply both. The claim moves created → submitted; rides are ONLY granted
  // after an admin approves it (v2 manual-claims flow).
  const [paymentMethod, setPaymentMethod] = useState<'momo' | 'manual'>('momo');
  const [manualInfo, setManualInfo] = useState<ResolvedManualPaymentInfo | null>(null);
  const [proofRef, setProofRef] = useState('');
  const [proofImageUri, setProofImageUri] = useState<string | null>(null);
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualSubmitted, setManualSubmitted] = useState(false);
  const packagePaymentRepository = useMemo(() => createPackagePaymentRepository(), []);

  useEffect(() => {
    let active = true;
    void resolveManualPaymentInfo().then(info => {
      if (active) setManualInfo(info);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleCopy = async (value: string, label: string) => {
    await Clipboard.setStringAsync(value);
    showToast(`${label} copied`, 'info');
  };

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

  const handlePickProofImage = async () => {
    setError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError('Allow photo access to attach a payment screenshot, or use the transaction reference instead.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
      });
      if (!result.canceled && result.assets.length > 0) {
        setProofImageUri(result.assets[0].uri);
      }
    } catch {
      setError('Could not open your photos. Use the transaction reference instead.');
    }
  };

  const handleSubmitManualProof = async () => {
    if (!ridePackage) return;
    if (isPackageOfferExpired(ridePackage)) {
      setError('This package offer expired. Please refresh packages.');
      return;
    }
    const ref = proofRef.trim();
    // Proof = transaction reference (text) OR a screenshot (photo). Require one.
    if (!ref && !proofImageUri) {
      setError('Add your MoMo transaction reference or attach a payment screenshot.');
      return;
    }
    const payerPhone = (phoneNumber || manualInfo?.phoneNumber || '').trim();
    if (!payerPhone) {
      setError('Enter the phone number you paid from.');
      return;
    }
    setManualSubmitting(true);
    setError(null);
    try {
      // Optional photo proof → object storage → proof_image_id. Best-effort:
      // if storage is unavailable the text reference still submits the claim.
      let proofImageId: string | undefined;
      if (proofImageUri) {
        try {
          proofImageId = await uploadPaymentProofImage(proofImageUri);
        } catch {
          if (!ref) {
            setError('Screenshot upload is unavailable right now. Add your transaction reference to submit.');
            setManualSubmitting(false);
            return;
          }
          // Have a text reference — proceed without the image.
        }
      }

      // v2 manual-claims flow: create the claim, then submit it for admin
      // review. Rides are NOT granted here — only when an admin approves.
      const created = await packagePaymentRepository.createManualPaymentClaim({
        offer: ridePackage,
        driverId: user?.id ?? '',
        provider: selectedProvider,
        payerPhoneNumber: payerPhone,
        transactionReference: ref || undefined,
        proofImageId,
      });
      if (created.failure || !created.data) {
        throw new Error(created.failure?.message ?? 'Could not submit your payment proof.');
      }
      const submitted = await packagePaymentRepository.submitManualPaymentClaim({
        claim: created.data,
        actorId: user?.id,
      });
      if (submitted.failure) {
        throw new Error(submitted.failure.message);
      }

      setManualSubmitted(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not submit your payment proof.');
    } finally {
      setManualSubmitting(false);
    }
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
      ) : manualSubmitted ? (
        <ManualPendingCard amount={ridePackage.priceRwf} reference={proofRef} colors={colors} />
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
              <MethodTabs value={paymentMethod} onChange={setPaymentMethod} disabled={isWaiting} colors={colors} />

              {paymentMethod === 'momo' ? (
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
              ) : (
                <ManualPaymentSection
                  amount={ridePackage.priceRwf}
                  info={manualInfo}
                  proofRef={proofRef}
                  onChangeProofRef={setProofRef}
                  proofImageUri={proofImageUri}
                  onPickImage={() => void handlePickProofImage()}
                  onClearImage={() => setProofImageUri(null)}
                  onCopy={handleCopy}
                  colors={colors}
                />
              )}
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
          ) : paymentMethod === 'manual' ? (
            <AppButton
              title="I've Paid — Submit for Review"
              onPress={() => void handleSubmitManualProof()}
              disabled={!proofRef.trim() && !proofImageUri}
              loading={manualSubmitting}
              fullWidth
              size="lg"
            />
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
                {paymentMethod === 'manual'
                  ? 'Your ride credits are added as soon as we verify your payment.'
                  : 'You will confirm this payment securely on your phone.'}
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

function MethodTabs({ value, onChange, disabled, colors }: {
  value: 'momo' | 'manual'; onChange: (v: 'momo' | 'manual') => void; disabled?: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  const options: { key: 'momo' | 'manual'; label: string; icon: React.ComponentProps<typeof Feather>['name'] }[] = [
    { key: 'momo', label: 'Mobile Money', icon: 'smartphone' },
    { key: 'manual', label: 'Manual (Proof)', icon: 'edit-3' },
  ];
  return (
    <View style={[styles.methodTabs, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {options.map(option => {
        const active = value === option.key;
        return (
          <TouchableOpacity
            key={option.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            disabled={disabled}
            onPress={() => onChange(option.key)}
            style={[styles.methodTab, active ? { backgroundColor: colors.primary } : null]}
            activeOpacity={0.8}
          >
            <Feather name={option.icon} size={15} color={active ? '#fff' : colors.mutedForeground} />
            <AppText style={[styles.methodTabText, { color: active ? '#fff' : colors.mutedForeground }]}>{option.label}</AppText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function CopyRow({ label, value, onCopy, colors, emphasize }: {
  label: string; value: string; onCopy: () => void; colors: ReturnType<typeof useColors>; emphasize?: boolean;
}) {
  return (
    <View style={styles.copyRow}>
      <AppText style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{label}</AppText>
      <TouchableOpacity onPress={onCopy} style={styles.copyValue} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={`Copy ${label}`}>
        <AppText style={[emphasize ? styles.copyValueEmphasis : styles.copyValueText, { color: emphasize ? colors.primary : colors.foreground }]}>{value}</AppText>
        <Feather name="copy" size={14} color={colors.mutedForeground} />
      </TouchableOpacity>
    </View>
  );
}

function ManualPaymentSection({ amount, info, proofRef, onChangeProofRef, proofImageUri, onPickImage, onClearImage, onCopy, colors }: {
  amount: number; info: ResolvedManualPaymentInfo | null; proofRef: string;
  onChangeProofRef: (v: string) => void;
  proofImageUri: string | null; onPickImage: () => void; onClearImage: () => void;
  onCopy: (value: string, label: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const payCode = info?.payCode ?? '…';
  const phone = info?.phoneNumber ?? '…';
  return (
    <>
      <View style={styles.sectionHeading}>
        <AppText style={[styles.sectionTitle, { color: colors.foreground }]}>Pay manually</AppText>
        <AppText style={[styles.sectionDescription, { color: colors.mutedForeground }]}>
          Send {formatRwf(amount)} using the details below, then submit your proof — your MoMo transaction reference or a screenshot of the confirmation.
        </AppText>
      </View>

      <View style={[styles.payTargetCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <CopyRow label="Amount" value={formatRwf(amount)} onCopy={() => onCopy(String(amount), 'Amount')} colors={colors} />
        <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
        <CopyRow label="MoMo Pay Code" value={payCode} onCopy={() => onCopy(payCode, 'Pay code')} colors={colors} emphasize />
        <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
        <CopyRow label="Phone Number" value={phone} onCopy={() => onCopy(phone, 'Phone number')} colors={colors} />
      </View>

      <View style={[styles.instructionsBox, { backgroundColor: colors.primaryHex + '0A', borderColor: colors.primaryHex + '22' }]}>
        <Feather name="info" size={15} color={colors.primary} />
        <AppText style={[styles.instructionsText, { color: colors.mutedForeground }]}>
          {info?.instructions ?? 'Pay with MTN MoMo, then submit your transaction reference or a screenshot below.'}
        </AppText>
      </View>

      <AppInput
        label="Transaction ID / Reference"
        placeholder="e.g. 1234567890 (from your MoMo SMS)"
        value={proofRef}
        onChangeText={onChangeProofRef}
        leftIcon="hash"
        autoCapitalize="characters"
      />

      <View style={styles.proofPhotoBlock}>
        <AppText style={[styles.proofPhotoLabel, { color: colors.mutedForeground }]}>
          Payment screenshot (optional)
        </AppText>
        {proofImageUri ? (
          <View style={[styles.proofPreview, { borderColor: colors.border }]}>
            <Image source={{ uri: proofImageUri }} style={styles.proofPreviewImage} resizeMode="cover" />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Remove screenshot"
              onPress={onClearImage}
              style={[styles.proofRemove, { backgroundColor: colors.destructiveHex + '18' }]}
            >
              <Feather name="x" size={15} color={colors.destructive} />
              <AppText style={[styles.proofRemoveText, { color: colors.destructive }]}>Remove</AppText>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Attach payment screenshot"
            onPress={onPickImage}
            activeOpacity={0.75}
            style={[styles.proofPickButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
          >
            <Feather name="image" size={17} color={colors.primary} />
            <AppText style={[styles.proofPickText, { color: colors.foreground }]}>Attach a screenshot</AppText>
          </TouchableOpacity>
        )}
      </View>
    </>
  );
}

function ManualPendingCard({ amount, reference, colors }: {
  amount: number; reference: string; colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.paymentContent, styles.receiptCard]}>
      <View style={[styles.receiptIconHalo, { backgroundColor: colors.warningHex + '18' }]}>
        <View style={[styles.receiptIcon, { backgroundColor: colors.warning }]}>
          <Feather name="clock" size={30} color="#fff" />
        </View>
      </View>
      <AppText style={[styles.receiptTitle, { color: colors.foreground }]}>Payment Submitted</AppText>
      <AppText style={[styles.receiptText, { color: colors.mutedForeground }]}>
        We received your payment proof for {formatRwf(amount)}. Your ride credits will be added once our team verifies it — usually within a few minutes.
      </AppText>
      {reference ? (
        <AppText style={[styles.receiptCredits, { color: colors.foreground }]}>Reference: {reference}</AppText>
      ) : null}
      <View style={styles.receiptAction}>
        <AppButton title="Go to Dashboard" onPress={() => navigateToDriverHomeAfterCompletion(router)} fullWidth size="lg" />
      </View>
      <AppButton title="View Packages" onPress={() => closeTemporaryScreen(router, DRIVER_PACKAGES_ROUTE)} variant="plain" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  methodTabs: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: radius.card, borderWidth: 1 },
  methodTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: radius.md },
  methodTabText: { ...typography.bodySmall },
  payTargetCard: { borderRadius: radius.card, borderWidth: 1, paddingHorizontal: semanticSpacing.cardPadding, paddingVertical: spacing[4] },
  copyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing[10] },
  copyValue: { flexDirection: 'row', alignItems: 'center', gap: spacing[6] },
  copyValueText: { ...typography.bodySmall },
  copyValueEmphasis: { ...typography.title },
  instructionsBox: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[10], padding: 12, borderRadius: radius.card, borderWidth: 1 },
  instructionsText: { flex: 1, ...typography.caption, lineHeight: 18 },
  proofPhotoBlock: { gap: spacing[6] },
  proofPhotoLabel: { ...typography.label },
  proofPickButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[8], paddingVertical: spacing[14], borderRadius: radius.card, borderWidth: 1, borderStyle: 'dashed' },
  proofPickText: { ...typography.bodySmall },
  proofPreview: { borderRadius: radius.card, borderWidth: 1, overflow: 'hidden' },
  proofPreviewImage: { width: '100%', height: 160 },
  proofRemove: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[6], paddingVertical: spacing[10] },
  proofRemoveText: { ...typography.bodySmall },
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
