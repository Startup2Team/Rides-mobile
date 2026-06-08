import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import { AppInput } from '@/components/AppInput';
import { BackButton } from '@/components/BackButton';
import { useAuth } from '@/context/AuthContext';
import { useDriverEntitlement } from '@/context/DriverEntitlementContext';
import {
  DRIVER_RIDE_PACKAGES,
  type DriverPackagePurchase,
  type DriverPackagePurchaseStatus,
  type DriverRidePackage,
  type DriverRidePackageId,
  type MobileMoneyPackageProvider,
  type PackageActivation,
} from '@/domain/driverRidePackages';
import { useColors } from '@/hooks/useColors';

export default function DriverPackagesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
  const { driverProfile } = useAuth();
  const {
    activatePackage,
    createPackagePurchase,
    entitlement,
    isLoading: isEntitlementLoading,
    launchOfferUsed,
    rideCredits,
    updatePackagePurchaseStatus,
  } = useDriverEntitlement();
  const [activating, setActivating] = useState<string | null>(null);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<DriverRidePackageId | null>(null);
  const [receipt, setReceipt] = useState<PackageActivation | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<MobileMoneyPackageProvider>(
    driverProfile?.momoProvider === 'airtel' ? 'airtel' : 'mtn',
  );
  const [phoneNumber, setPhoneNumber] = useState(driverProfile?.momoCode ?? '');
  const [paymentStatus, setPaymentStatus] = useState<DriverPackagePurchaseStatus>('idle');
  const [activePurchase, setActivePurchase] = useState<DriverPackagePurchase | null>(null);
  const paymentTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const cardFill = isDark ? '#1C1C1E' : '#FFFFFF';
  const selectedPackage = selectedPackageId ? DRIVER_RIDE_PACKAGES[selectedPackageId] : null;
  const purchaseHistory = useMemo(
    () => [...(entitlement.purchaseHistory ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [entitlement.purchaseHistory],
  );

  const clearPaymentTimers = () => {
    paymentTimers.current.forEach(timer => clearTimeout(timer));
    paymentTimers.current = [];
  };

  useEffect(() => () => clearPaymentTimers(), []);

  const handleActivate = async (ridePackage: DriverRidePackage) => {
    setActivating(ridePackage.id);
    setActivationError(null);
    try {
      const activation = await activatePackage(ridePackage.id);
      setReceipt(activation);
      setSelectedPackageId(null);
    } catch (error) {
      setReceipt(null);
      setActivationError(error instanceof Error ? error.message : 'Unable to activate this package.');
    } finally {
      setActivating(null);
    }
  };

  const handleSelectPackage = (packageId: DriverRidePackageId) => {
    clearPaymentTimers();
    setReceipt(null);
    setActivationError(null);
    setPaymentStatus('idle');
    setActivePurchase(null);
    setSelectedPackageId(packageId);
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
        if (result.activation) {
          setReceipt(result.activation);
          setSelectedPackageId(null);
        }
      } catch (error) {
        setPaymentStatus('failed');
        setActivationError(error instanceof Error ? error.message : 'Payment was not completed');
      }
    }, 1800);
    paymentTimers.current = [processingTimer, successTimer];
  };

  const handleSendPaymentPrompt = async (ridePackage: DriverRidePackage) => {
    if (ridePackage.currentPriceRwf <= 0) {
      await handleActivate(ridePackage);
      return;
    }
    clearPaymentTimers();
    setActivating(ridePackage.id);
    setActivationError(null);
    try {
      const purchase = await createPackagePurchase({
        packageId: ridePackage.id,
        provider: selectedProvider,
        phoneNumber,
      });
      setActivePurchase(purchase);
      setPaymentStatus('pending');
      schedulePaymentSuccess(purchase);
    } catch (error) {
      setPaymentStatus('failed');
      setActivationError(error instanceof Error ? error.message : 'Payment was not completed');
    } finally {
      setActivating(null);
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
    setActivationError(null);
  };

  return <ScrollView
    style={[styles.root, { backgroundColor: isDark ? '#000' : '#F2F2F7' }]}
    contentContainerStyle={{ paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) + 16, paddingBottom: insets.bottom + 32 }}
  >
    <View style={styles.header}>
      <BackButton onPress={() => router.back()} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: colors.foreground }]}>Ride Packages</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Choose credits to receive ride requests</Text>
      </View>
    </View>

    <View style={[styles.balanceCard, { backgroundColor: colors.primary }]}>
      <View>
        <Text style={styles.balanceLabel}>AVAILABLE RIDE CREDITS</Text>
        <Text style={styles.balanceValue}>{isEntitlementLoading ? '...' : rideCredits}</Text>
      </View>
      <View style={styles.approvedBadge}><Feather name="shield" size={14} color="#fff" /><Text style={styles.approvedText}>{driverProfile?.isVerified ? 'Approved driver' : 'Driver'}</Text></View>
    </View>

    <View style={[styles.explanation, { backgroundColor: cardFill }]}>
      <Feather name="info" size={18} color={colors.primary} />
      <Text style={[styles.explanationText, { color: colors.mutedForeground }]}>Rides connects customers with independent drivers. One completed ride uses exactly 1 ride credit. Cancelled or declined rides use no credits.</Text>
    </View>

    {receipt ? (
      <ReceiptCard
        activation={receipt}
        cardFill={cardFill}
        colors={colors}
        onDashboard={() => router.replace('/(driver)')}
      />
    ) : null}

    <PackageCard
      ridePackage={DRIVER_RIDE_PACKAGES.launch_starter}
      cardFill={cardFill}
      colors={colors}
      disabled={launchOfferUsed}
      unavailable={isEntitlementLoading}
      loading={activating === 'launch_starter'}
      buttonTitle={launchOfferUsed ? 'Launch Offer Already Used' : 'Review Free Plan'}
      selected={selectedPackageId === 'launch_starter'}
      onPress={() => handleSelectPackage('launch_starter')}
    />
    <PackageCard
      ridePackage={DRIVER_RIDE_PACKAGES.growth}
      cardFill={cardFill}
      colors={colors}
      loading={activating === 'growth'}
      unavailable={isEntitlementLoading}
      buttonTitle="Review Plan"
      selected={selectedPackageId === 'growth'}
      onPress={() => handleSelectPackage('growth')}
    />

    {selectedPackage ? (
      <ConfirmationCard
        error={activationError}
        cardFill={cardFill}
        colors={colors}
        loading={activating === selectedPackage.id}
        onCancel={() => setSelectedPackageId(null)}
        onChooseAnotherMethod={handleChooseAnotherMethod}
        onConfirm={() => void handleActivate(selectedPackage)}
        onPhoneNumberChange={setPhoneNumber}
        onProviderChange={setSelectedProvider}
        onSendPaymentPrompt={() => void handleSendPaymentPrompt(selectedPackage)}
        paymentStatus={paymentStatus}
        phoneNumber={phoneNumber}
        provider={selectedProvider}
        ridePackage={selectedPackage}
      />
    ) : null}

    <PurchaseHistoryCard
      purchases={purchaseHistory}
      cardFill={cardFill}
      colors={colors}
    />
   </ScrollView>;
}

function PackageCard({ buttonTitle, cardFill, colors, disabled = false, loading, onPress, ridePackage, selected, unavailable = false }: {
  buttonTitle: string; cardFill: string; colors: ReturnType<typeof useColors>; disabled?: boolean; loading: boolean; onPress: () => void; ridePackage: DriverRidePackage; selected?: boolean; unavailable?: boolean;
}) {
  return <View style={[styles.packageCard, { backgroundColor: cardFill, borderColor: selected || ridePackage.launchOffer ? colors.primary : colors.border }]}>
    {ridePackage.launchOffer ? <Text style={[styles.offerTag, { backgroundColor: colors.primary }]}>LAUNCH OFFER</Text> : null}
    <View style={styles.packageTitleRow}>
      <Text style={[styles.packageName, { color: colors.foreground }]}>{ridePackage.name}</Text>
      {selected ? <Feather name="check-circle" size={20} color={colors.primary} /> : null}
    </View>
    <View style={styles.priceRow}>
      {ridePackage.currentPriceRwf === 0 ? <><Text style={[styles.oldPrice, { color: colors.mutedForeground }]}>{ridePackage.normalPriceRwf.toLocaleString()} RWF</Text><Text style={[styles.freePrice, { color: colors.primary }]}>FREE</Text></>
        : <Text style={[styles.freePrice, { color: colors.foreground }]}>{ridePackage.currentPriceRwf.toLocaleString()} RWF</Text>}
    </View>
    <Text style={[styles.creditTotal, { color: colors.foreground }]}>{ridePackage.totalCredits} completed rides</Text>
    <Text style={[styles.creditBreakdown, { color: colors.mutedForeground }]}>{ridePackage.includedRides} included + {ridePackage.bonusRides} bonus rides</Text>
    <AppButton title={buttonTitle} onPress={onPress} disabled={disabled || unavailable} loading={loading} fullWidth size="lg" />
  </View>;
}

function ConfirmationCard({
  cardFill,
  colors,
  error,
  loading,
  onCancel,
  onChooseAnotherMethod,
  onConfirm,
  onPhoneNumberChange,
  onProviderChange,
  onSendPaymentPrompt,
  paymentStatus,
  phoneNumber,
  provider,
  ridePackage,
}: {
  cardFill: string;
  colors: ReturnType<typeof useColors>;
  error: string | null;
  loading: boolean;
  onCancel: () => void;
  onChooseAnotherMethod: () => void;
  onConfirm: () => void;
  onPhoneNumberChange: (value: string) => void;
  onProviderChange: (value: MobileMoneyPackageProvider) => void;
  onSendPaymentPrompt: () => void;
  paymentStatus: DriverPackagePurchaseStatus;
  phoneNumber: string;
  provider: MobileMoneyPackageProvider;
  ridePackage: DriverRidePackage;
}) {
  const isFree = ridePackage.currentPriceRwf === 0;
  const isWaiting = paymentStatus === 'pending' || paymentStatus === 'processing';
  const isIncomplete = paymentStatus === 'failed' || paymentStatus === 'cancelled' || paymentStatus === 'expired';

  return <View style={[styles.confirmationCard, { backgroundColor: cardFill, borderColor: colors.primary }]}>
    <View style={styles.sectionHeader}>
      <Feather name="clipboard" size={18} color={colors.primary} />
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Confirm package</Text>
    </View>
    <SummaryRow label="Package" value={ridePackage.name} colors={colors} />
    <SummaryRow label="Ride credits" value={`${ridePackage.totalCredits}`} colors={colors} />
    <SummaryRow label="Price today" value={isFree ? 'FREE' : `${ridePackage.currentPriceRwf.toLocaleString()} RWF`} colors={colors} strong />
    {isFree ? (
      <View style={[styles.paymentNotice, { backgroundColor: colors.muted }]}>
        <Feather name="gift" size={17} color={colors.primary} />
        <Text style={[styles.paymentNoticeText, { color: colors.mutedForeground }]}>No payment is required for this launch package.</Text>
      </View>
    ) : (
      <>
        <View style={styles.providerChoiceRow}>
          {(['mtn', 'airtel'] as MobileMoneyPackageProvider[]).map(option => (
            <ProviderOption
              key={option}
              colors={colors}
              isSelected={provider === option}
              label={option === 'mtn' ? 'MTN Mobile Money' : 'Airtel Money'}
              onPress={() => onProviderChange(option)}
            />
          ))}
        </View>
        <AppInput
          label="Mobile Money Phone Number"
          placeholder="+250 7x xxx xxxx"
          value={phoneNumber}
          onChangeText={onPhoneNumberChange}
          keyboardType="phone-pad"
          leftIcon="smartphone"
        />
        {isWaiting ? (
          <View style={[styles.paymentNotice, { backgroundColor: colors.muted }]}>
            <Feather name="smartphone" size={17} color={colors.primary} />
            <Text style={[styles.paymentNoticeText, { color: colors.mutedForeground }]}>
              Waiting for Mobile Money confirmation. Confirm the payment on your phone.
            </Text>
          </View>
        ) : null}
        {isIncomplete ? (
          <View style={[styles.paymentNotice, { backgroundColor: colors.muted }]}>
            <Feather name="alert-circle" size={17} color={colors.destructive} />
            <Text style={[styles.paymentNoticeText, { color: colors.mutedForeground }]}>Payment was not completed</Text>
          </View>
        ) : null}
      </>
    )}
    {error ? <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text> : null}
    <View style={styles.confirmActions}>
      {isIncomplete ? (
        <>
          <AppButton title="Choose Another Method" onPress={onChooseAnotherMethod} variant="secondary" size="md" style={styles.confirmButton} />
          <AppButton title="Try Again" onPress={onSendPaymentPrompt} loading={loading} size="md" style={styles.confirmButton} />
        </>
      ) : (
        <>
          <AppButton title={isWaiting ? 'Choose Another Method' : 'Cancel'} onPress={isWaiting ? onChooseAnotherMethod : onCancel} variant="secondary" size="md" style={styles.confirmButton} />
          <AppButton
            title={isFree ? 'Confirm Free Plan' : 'Send Payment Prompt'}
            onPress={isFree ? onConfirm : onSendPaymentPrompt}
            loading={loading || isWaiting}
            disabled={!isFree && !phoneNumber.trim()}
            size="md"
            style={styles.confirmButton}
          />
        </>
      )}
    </View>
  </View>;
}

function ProviderOption({ colors, isSelected, label, onPress }: {
  colors: ReturnType<typeof useColors>;
  isSelected: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.providerOption,
        {
          backgroundColor: isSelected ? colors.primaryHex + '14' : colors.muted,
          borderColor: isSelected ? colors.primary : colors.border,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.providerOptionText, { color: colors.foreground }]}>{label}</Text>
      {isSelected ? <Feather name="check-circle" size={16} color={colors.primary} /> : null}
    </TouchableOpacity>
  );
}

function ReceiptCard({ activation, cardFill, colors, onDashboard }: {
  activation: PackageActivation; cardFill: string; colors: ReturnType<typeof useColors>; onDashboard: () => void;
}) {
  return <View style={[styles.receiptCard, { backgroundColor: cardFill, borderColor: colors.primary }]}>
    <View style={styles.receiptIcon}><Feather name="check" size={20} color="#fff" /></View>
    <View style={{ flex: 1 }}>
      <Text style={[styles.receiptTitle, { color: colors.foreground }]}>Package Activated</Text>
      <Text style={[styles.receiptText, { color: colors.mutedForeground }]}>
        You can now go online and start receiving ride requests.
      </Text>
      <Text style={[styles.receiptCredits, { color: colors.foreground }]}>
        Credits Added: {activation.creditsGranted}
      </Text>
      <Text style={[styles.receiptMeta, { color: colors.mutedForeground }]}>{formatActivationDate(activation.activatedAt)}</Text>
      <AppButton title="Go to Dashboard" onPress={onDashboard} size="sm" style={styles.receiptButton} />
    </View>
  </View>;
}

function PurchaseHistoryCard({ purchases, cardFill, colors }: {
  purchases: DriverPackagePurchase[]; cardFill: string; colors: ReturnType<typeof useColors>;
}) {
  return <View style={[styles.historyCard, { backgroundColor: cardFill }]}>
    <View style={styles.sectionHeader}>
      <Feather name="clock" size={18} color={colors.primary} />
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Purchase history</Text>
    </View>
    {purchases.length === 0 ? (
      <Text style={[styles.emptyHistory, { color: colors.mutedForeground }]}>No purchase history yet.</Text>
    ) : purchases.map(purchase => {
      const ridePackage = DRIVER_RIDE_PACKAGES[purchase.packageId];
      return <View key={purchase.transactionId} style={[styles.historyRow, { borderTopColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.historyName, { color: colors.foreground }]}>{ridePackage.name}</Text>
          <Text style={[styles.historyMeta, { color: colors.mutedForeground }]}>{formatActivationDate(purchase.createdAt)} - {purchase.provider === 'mtn' ? 'MTN Mobile Money' : 'Airtel Money'}</Text>
        </View>
        <View style={styles.historyTotals}>
          <Text style={[styles.historyCredits, { color: colors.foreground }]}>{formatPurchaseStatus(purchase.status)}</Text>
          <Text style={[styles.historyPrice, { color: colors.mutedForeground }]}>{purchase.amount.toLocaleString()} RWF</Text>
        </View>
      </View>;
    })}
  </View>;
}

function SummaryRow({ colors, label, strong = false, value }: {
  colors: ReturnType<typeof useColors>; label: string; strong?: boolean; value: string;
}) {
  return <View style={styles.summaryRow}>
    <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{label}</Text>
    <Text style={[strong ? styles.summaryValueStrong : styles.summaryValue, { color: colors.foreground }]}>{value}</Text>
  </View>;
}

function formatPurchaseStatus(status: DriverPackagePurchaseStatus) {
  if (status === 'successful') return 'Successful';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'expired') return 'Expired';
  if (status === 'processing') return 'Processing';
  if (status === 'pending') return 'Pending';
  if (status === 'failed') return 'Failed';
  return 'Idle';
}

function formatActivationDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, marginBottom: 18 },
  title: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  balanceCard: { marginHorizontal: 16, borderRadius: 18, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  balanceLabel: { color: 'rgba(255,255,255,0.78)', fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.8 },
  balanceValue: { color: '#fff', fontSize: 40, fontFamily: 'Inter_700Bold', marginTop: 3 },
  approvedBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 16 },
  approvedText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  explanation: { margin: 16, padding: 14, borderRadius: 14, flexDirection: 'row', gap: 10 },
  explanationText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19 },
  packageCard: { marginHorizontal: 16, marginBottom: 14, borderRadius: 18, padding: 18, borderWidth: 1, gap: 8, overflow: 'hidden' },
  offerTag: { alignSelf: 'flex-start', color: '#fff', fontSize: 10, fontFamily: 'Inter_700Bold', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10 },
  packageTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  packageName: { flex: 1, fontSize: 19, fontFamily: 'Inter_700Bold', marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  oldPrice: { fontSize: 14, fontFamily: 'Inter_500Medium', textDecorationLine: 'line-through' },
  freePrice: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  creditTotal: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginTop: 4 },
  creditBreakdown: { fontSize: 13, fontFamily: 'Inter_400Regular', marginBottom: 10 },
  confirmationCard: { marginHorizontal: 16, marginBottom: 14, borderRadius: 18, padding: 18, borderWidth: 1, gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  summaryLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  summaryValue: { flex: 1, textAlign: 'right', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  summaryValueStrong: { flex: 1, textAlign: 'right', fontSize: 17, fontFamily: 'Inter_700Bold' },
  paymentNotice: { flexDirection: 'row', gap: 9, padding: 12, borderRadius: 12 },
  paymentNoticeText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  providerChoiceRow: { flexDirection: 'row', gap: 10 },
  providerOption: { flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  providerOptionText: { flex: 1, fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  errorText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', lineHeight: 18 },
  confirmActions: { flexDirection: 'row', gap: 10 },
  confirmButton: { flex: 1 },
  receiptCard: { marginHorizontal: 16, marginBottom: 14, borderRadius: 18, padding: 16, borderWidth: 1, flexDirection: 'row', gap: 12 },
  receiptIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#22C55E', alignItems: 'center', justifyContent: 'center' },
  receiptTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  receiptText: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19, marginTop: 3 },
  receiptCredits: { fontSize: 14, fontFamily: 'Inter_700Bold', marginTop: 8 },
  receiptMeta: { fontSize: 11, fontFamily: 'Inter_500Medium', marginTop: 6 },
  receiptButton: { alignSelf: 'flex-start', marginTop: 12 },
  historyCard: { marginHorizontal: 16, marginTop: 2, borderRadius: 18, padding: 18, gap: 12 },
  emptyHistory: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 12, borderTopWidth: 1 },
  historyName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  historyMeta: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  historyTotals: { alignItems: 'flex-end' },
  historyCredits: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  historyPrice: { fontSize: 11, fontFamily: 'Inter_500Medium', marginTop: 2 },
});
