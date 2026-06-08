import React, { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import { BackButton } from '@/components/BackButton';
import { useAuth } from '@/context/AuthContext';
import { useDriverEntitlement } from '@/context/DriverEntitlementContext';
import {
  DRIVER_RIDE_PACKAGES,
  type DriverRidePackage,
  type DriverRidePackageId,
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
    entitlement,
    isLoading: isEntitlementLoading,
    launchOfferUsed,
    rideCredits,
  } = useDriverEntitlement();
  const [activating, setActivating] = useState<string | null>(null);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<DriverRidePackageId | null>(null);
  const [receipt, setReceipt] = useState<PackageActivation | null>(null);
  const cardFill = isDark ? '#1C1C1E' : '#FFFFFF';
  const selectedPackage = selectedPackageId ? DRIVER_RIDE_PACKAGES[selectedPackageId] : null;
  const packageHistory = useMemo(
    () => [...entitlement.activations].sort((a, b) => b.activatedAt.localeCompare(a.activatedAt)),
    [entitlement.activations],
  );

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
      onPress={() => {
        setReceipt(null);
        setActivationError(null);
        setSelectedPackageId('launch_starter');
      }}
    />
    <PackageCard
      ridePackage={DRIVER_RIDE_PACKAGES.growth}
      cardFill={cardFill}
      colors={colors}
      loading={activating === 'growth'}
      unavailable={isEntitlementLoading}
      buttonTitle="Review Plan"
      selected={selectedPackageId === 'growth'}
      onPress={() => {
        setReceipt(null);
        setActivationError(null);
        setSelectedPackageId('growth');
      }}
    />

    {selectedPackage ? (
      <ConfirmationCard
        error={activationError}
        cardFill={cardFill}
        colors={colors}
        loading={activating === selectedPackage.id}
        ridePackage={selectedPackage}
        onCancel={() => setSelectedPackageId(null)}
        onConfirm={() => void handleActivate(selectedPackage)}
      />
    ) : null}

    <PurchaseHistoryCard
      activations={packageHistory}
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

function ConfirmationCard({ cardFill, colors, error, loading, onCancel, onConfirm, ridePackage }: {
  cardFill: string; colors: ReturnType<typeof useColors>; error: string | null; loading: boolean; onCancel: () => void; onConfirm: () => void; ridePackage: DriverRidePackage;
}) {
  const isFree = ridePackage.currentPriceRwf === 0;

  return <View style={[styles.confirmationCard, { backgroundColor: cardFill, borderColor: colors.primary }]}>
    <View style={styles.sectionHeader}>
      <Feather name="clipboard" size={18} color={colors.primary} />
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Confirm package</Text>
    </View>
    <SummaryRow label="Package" value={ridePackage.name} colors={colors} />
    <SummaryRow label="Ride credits" value={`${ridePackage.totalCredits}`} colors={colors} />
    <SummaryRow label="Price today" value={isFree ? 'FREE' : `${ridePackage.currentPriceRwf.toLocaleString()} RWF`} colors={colors} strong />
    <View style={[styles.paymentNotice, { backgroundColor: colors.muted }]}>
      <Feather name={isFree ? 'gift' : 'smartphone'} size={17} color={colors.primary} />
      <Text style={[styles.paymentNoticeText, { color: colors.mutedForeground }]}>
        {isFree
          ? 'No payment is required for this launch package.'
          : 'Mobile Money payment will be connected here during backend integration. For now this records a local prototype purchase.'}
      </Text>
    </View>
    {error ? <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text> : null}
    <View style={styles.confirmActions}>
      <AppButton title="Cancel" onPress={onCancel} variant="secondary" size="md" style={styles.confirmButton} />
      <AppButton
        title={isFree ? 'Confirm Free Plan' : 'Record Purchase'}
        onPress={onConfirm}
        loading={loading}
        size="md"
        style={styles.confirmButton}
      />
    </View>
  </View>;
}

function ReceiptCard({ activation, cardFill, colors, onDashboard }: {
  activation: PackageActivation; cardFill: string; colors: ReturnType<typeof useColors>; onDashboard: () => void;
}) {
  const ridePackage = DRIVER_RIDE_PACKAGES[activation.packageId];

  return <View style={[styles.receiptCard, { backgroundColor: cardFill, borderColor: colors.primary }]}>
    <View style={styles.receiptIcon}><Feather name="check" size={20} color="#fff" /></View>
    <View style={{ flex: 1 }}>
      <Text style={[styles.receiptTitle, { color: colors.foreground }]}>Package confirmed</Text>
      <Text style={[styles.receiptText, { color: colors.mutedForeground }]}>
        {ridePackage.name} added {activation.creditsGranted} ride credits to your account.
      </Text>
      <Text style={[styles.receiptMeta, { color: colors.mutedForeground }]}>{formatActivationDate(activation.activatedAt)}</Text>
      <AppButton title="Go to Dashboard" onPress={onDashboard} size="sm" style={styles.receiptButton} />
    </View>
  </View>;
}

function PurchaseHistoryCard({ activations, cardFill, colors }: {
  activations: PackageActivation[]; cardFill: string; colors: ReturnType<typeof useColors>;
}) {
  return <View style={[styles.historyCard, { backgroundColor: cardFill }]}>
    <View style={styles.sectionHeader}>
      <Feather name="clock" size={18} color={colors.primary} />
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Package history</Text>
    </View>
    {activations.length === 0 ? (
      <Text style={[styles.emptyHistory, { color: colors.mutedForeground }]}>No package purchases yet.</Text>
    ) : activations.map(activation => {
      const ridePackage = DRIVER_RIDE_PACKAGES[activation.packageId];
      return <View key={activation.id} style={[styles.historyRow, { borderTopColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.historyName, { color: colors.foreground }]}>{ridePackage.name}</Text>
          <Text style={[styles.historyMeta, { color: colors.mutedForeground }]}>{formatActivationDate(activation.activatedAt)}</Text>
        </View>
        <View style={styles.historyTotals}>
          <Text style={[styles.historyCredits, { color: colors.foreground }]}>+{activation.creditsGranted}</Text>
          <Text style={[styles.historyPrice, { color: colors.mutedForeground }]}>
            {activation.pricePaidRwf === 0 ? 'FREE' : `${activation.pricePaidRwf.toLocaleString()} RWF`}
          </Text>
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
  errorText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', lineHeight: 18 },
  confirmActions: { flexDirection: 'row', gap: 10 },
  confirmButton: { flex: 1 },
  receiptCard: { marginHorizontal: 16, marginBottom: 14, borderRadius: 18, padding: 16, borderWidth: 1, flexDirection: 'row', gap: 12 },
  receiptIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#22C55E', alignItems: 'center', justifyContent: 'center' },
  receiptTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  receiptText: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19, marginTop: 3 },
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
  prototype: { marginHorizontal: 22, fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 17, textAlign: 'center' },
});
