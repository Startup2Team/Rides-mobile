import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import { AppInput } from '@/components/AppInput';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { useAuth } from '@/context/AuthContext';
import { useDriverEntitlement } from '@/context/DriverEntitlementContext';
import {
  DRIVER_RIDE_PACKAGES,
  type DriverPackagePurchase,
  type DriverPackagePurchaseStatus,
  type DriverRidePackageId,
  type MobileMoneyPackageProvider,
  type PackageActivation,
} from '@/domain/driverRidePackages';
import { useColors } from '@/hooks/useColors';

function formatRwf(amount: number) {
  return `${amount.toLocaleString('en-RW')} RWF`;
}

export default function DriverPackagePaymentScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const isDark = useColorScheme() === 'dark';
  const { packageId } = useLocalSearchParams<{ packageId?: string }>();
  const { driverProfile } = useAuth();
  const { activatePackage, createPackagePurchase, updatePackagePurchaseStatus } = useDriverEntitlement();
  const validPackageId: DriverRidePackageId | null =
    packageId === 'launch_starter' || packageId === 'growth' || packageId === 'pro' ? packageId : null;
  const ridePackage = validPackageId ? DRIVER_RIDE_PACKAGES[validPackageId] : null;
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
  const cardFill = isDark ? '#1C1C1E' : '#FFFFFF';

  const clearPaymentTimers = () => {
    paymentTimers.current.forEach(timer => clearTimeout(timer));
    paymentTimers.current = [];
  };

  useEffect(() => () => clearPaymentTimers(), []);

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
    setLoading(true);
    setError(null);
    try {
      setReceipt(await activatePackage(ridePackage.id));
    } catch (activationError) {
      setError(activationError instanceof Error ? activationError.message : 'Unable to activate this package.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendPaymentPrompt = async () => {
    if (!ridePackage) return;
    if (ridePackage.currentPriceRwf <= 0) {
      await handleActivateFreePackage();
      return;
    }
    clearPaymentTimers();
    setLoading(true);
    setError(null);
    try {
      const purchase = await createPackagePurchase({
        packageId: ridePackage.id,
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

  if (!ridePackage) {
    return <View style={[styles.root, styles.centered, { backgroundColor: isDark ? '#000' : '#F2F2F7' }]}>
      <Text style={[styles.invalidTitle, { color: colors.foreground }]}>Package not found</Text>
      <AppButton title="Choose a Package" onPress={() => router.replace('/driver-packages')} />
    </View>;
  }

  const isFree = ridePackage.currentPriceRwf === 0;
  const isWaiting = paymentStatus === 'pending' || paymentStatus === 'processing';
  const isIncomplete = paymentStatus === 'failed' || paymentStatus === 'cancelled' || paymentStatus === 'expired';

  return <View style={[styles.root, { backgroundColor: isDark ? '#000' : '#F2F2F7' }]}>
    <GlassHeader title="Package Payment" subtitle="Review and complete your purchase" onBackPress={() => router.back()} />
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: headerMetrics.contentTop, paddingBottom: insets.bottom + 32 }}
      scrollIndicatorInsets={{ top: headerMetrics.indicatorTop }}
    >
      {receipt ? (
        <ReceiptCard activation={receipt} cardFill={cardFill} colors={colors} />
      ) : (
        <View style={[styles.paymentCard, { backgroundColor: cardFill }]}>
          <Text style={[styles.packageName, { color: colors.foreground }]}>{ridePackage.name}</Text>
          <Text style={[styles.credits, { color: colors.foreground }]}>{ridePackage.totalCredits} Ride Credits</Text>
          <Text style={[styles.price, { color: colors.primary }]}>{isFree ? 'FREE NOW' : formatRwf(ridePackage.currentPriceRwf)}</Text>

          {isFree ? (
            <Notice icon="gift" text="No payment is required for this launch package now." colors={colors} />
          ) : (
            <>
              <Text style={[styles.inputLabel, { color: colors.foreground }]}>Choose payment method</Text>
              <View style={styles.providerChoiceRow}>
                {(['mtn', 'airtel'] as MobileMoneyPackageProvider[]).map(option => (
                  <ProviderOption
                    key={option}
                    colors={colors}
                    isSelected={selectedProvider === option}
                    label={option === 'mtn' ? 'MTN Mobile Money' : 'Airtel Money'}
                    onPress={() => setSelectedProvider(option)}
                  />
                ))}
              </View>
              <AppInput
                label="Mobile Money Phone Number"
                placeholder="+250 7x xxx xxxx"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                leftIcon="smartphone"
              />
              {isWaiting ? <Notice icon="smartphone" text="Waiting for Mobile Money confirmation. Confirm the payment on your phone." colors={colors} /> : null}
              {isIncomplete ? <Notice icon="alert-circle" text="Payment was not completed" colors={colors} destructive /> : null}
            </>
          )}

          {error ? <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text> : null}
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
        </View>
      )}
    </ScrollView>
  </View>;
}

function ProviderOption({ colors, isSelected, label, onPress }: {
  colors: ReturnType<typeof useColors>; isSelected: boolean; label: string; onPress: () => void;
}) {
  return <TouchableOpacity
    style={[styles.providerOption, {
      backgroundColor: isSelected ? colors.primaryHex + '14' : colors.muted,
      borderColor: isSelected ? colors.primary : colors.border,
    }]}
    onPress={onPress}
    activeOpacity={0.75}
  >
    <Text style={[styles.providerOptionText, { color: colors.foreground }]}>{label}</Text>
    {isSelected ? <Feather name="check-circle" size={16} color={colors.primary} /> : null}
  </TouchableOpacity>;
}

function Notice({ colors, destructive = false, icon, text }: {
  colors: ReturnType<typeof useColors>; destructive?: boolean; icon: React.ComponentProps<typeof Feather>['name']; text: string;
}) {
  return <View style={[styles.notice, { backgroundColor: colors.muted }]}>
    <Feather name={icon} size={17} color={destructive ? colors.destructive : colors.primary} />
    <Text style={[styles.noticeText, { color: colors.mutedForeground }]}>{text}</Text>
  </View>;
}

function ReceiptCard({ activation, cardFill, colors }: {
  activation: PackageActivation; cardFill: string; colors: ReturnType<typeof useColors>;
}) {
  return <View style={[styles.paymentCard, { backgroundColor: cardFill }]}>
    <View style={styles.receiptIcon}><Feather name="check" size={24} color="#fff" /></View>
    <Text style={[styles.receiptTitle, { color: colors.foreground }]}>Package Activated</Text>
    <Text style={[styles.receiptText, { color: colors.mutedForeground }]}>You can now go online and start receiving ride requests.</Text>
    <Text style={[styles.credits, { color: colors.foreground }]}>Credits Added: {activation.creditsGranted}</Text>
    <AppButton title="Go to Dashboard" onPress={() => router.replace('/(driver)')} fullWidth size="lg" />
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24 },
  invalidTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  paymentCard: { marginHorizontal: 16, borderRadius: 22, padding: 20, gap: 16 },
  packageName: { fontSize: 21, fontFamily: 'Inter_700Bold' },
  credits: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  price: { fontSize: 26, fontFamily: 'Inter_700Bold' },
  inputLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  providerChoiceRow: { flexDirection: 'row', gap: 10 },
  providerOption: { flex: 1, minHeight: 52, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  providerOptionText: { flex: 1, fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  notice: { flexDirection: 'row', gap: 9, padding: 12, borderRadius: 12 },
  noticeText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  errorText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 10 },
  actionButton: { flex: 1 },
  receiptIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#22C55E', alignItems: 'center', justifyContent: 'center' },
  receiptTitle: { fontSize: 21, fontFamily: 'Inter_700Bold' },
  receiptText: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20 },
});
