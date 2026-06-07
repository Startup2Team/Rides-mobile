import React, { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import { BackButton } from '@/components/BackButton';
import { useAuth } from '@/context/AuthContext';
import { useDriverEntitlement } from '@/context/DriverEntitlementContext';
import { DRIVER_RIDE_PACKAGES, type DriverRidePackage } from '@/domain/driverRidePackages';
import { useColors } from '@/hooks/useColors';

export default function DriverPackagesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
  const { driverProfile } = useAuth();
  const { activatePackage, launchOfferUsed, rideCredits } = useDriverEntitlement();
  const [activating, setActivating] = useState<string | null>(null);
  const cardFill = isDark ? '#1C1C1E' : '#FFFFFF';

  const handleActivate = async (ridePackage: DriverRidePackage) => {
    setActivating(ridePackage.id);
    try {
      await activatePackage(ridePackage.id);
      Alert.alert(
        'Package activated',
        `${ridePackage.totalCredits} ride credits are now available.`,
        [{ text: 'Go to Dashboard', onPress: () => router.replace('/(driver)') }],
      );
    } catch (error) {
      Alert.alert('Package unavailable', error instanceof Error ? error.message : 'Unable to activate this package.');
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
        <Text style={styles.balanceValue}>{rideCredits}</Text>
      </View>
      <View style={styles.approvedBadge}><Feather name="shield" size={14} color="#fff" /><Text style={styles.approvedText}>{driverProfile?.isVerified ? 'Approved driver' : 'Driver'}</Text></View>
    </View>

    <View style={[styles.explanation, { backgroundColor: cardFill }]}>
      <Feather name="info" size={18} color={colors.primary} />
      <Text style={[styles.explanationText, { color: colors.mutedForeground }]}>Rides connects customers with independent drivers. One completed ride uses exactly 1 ride credit. Cancelled or declined rides use no credits.</Text>
    </View>

    <PackageCard
      ridePackage={DRIVER_RIDE_PACKAGES.launch_starter}
      cardFill={cardFill}
      colors={colors}
      disabled={launchOfferUsed}
      loading={activating === 'launch_starter'}
      buttonTitle={launchOfferUsed ? 'Launch Offer Already Used' : 'Activate Free Plan'}
      onPress={() => void handleActivate(DRIVER_RIDE_PACKAGES.launch_starter)}
    />
    <PackageCard
      ridePackage={DRIVER_RIDE_PACKAGES.growth}
      cardFill={cardFill}
      colors={colors}
      loading={activating === 'growth'}
      buttonTitle="Buy Plan"
      onPress={() => void handleActivate(DRIVER_RIDE_PACKAGES.growth)}
    />
    <Text style={[styles.prototype, { color: colors.mutedForeground }]}>Prototype payment: Buy Plan simulates a successful local purchase. Package authority will move to the backend later.</Text>
  </ScrollView>;
}

function PackageCard({ buttonTitle, cardFill, colors, disabled = false, loading, onPress, ridePackage }: {
  buttonTitle: string; cardFill: string; colors: ReturnType<typeof useColors>; disabled?: boolean; loading: boolean; onPress: () => void; ridePackage: DriverRidePackage;
}) {
  return <View style={[styles.packageCard, { backgroundColor: cardFill, borderColor: ridePackage.launchOffer ? colors.primary : colors.border }]}>
    {ridePackage.launchOffer ? <Text style={[styles.offerTag, { backgroundColor: colors.primary }]}>LAUNCH OFFER</Text> : null}
    <Text style={[styles.packageName, { color: colors.foreground }]}>{ridePackage.name}</Text>
    <View style={styles.priceRow}>
      {ridePackage.currentPriceRwf === 0 ? <><Text style={[styles.oldPrice, { color: colors.mutedForeground }]}>{ridePackage.normalPriceRwf.toLocaleString()} RWF</Text><Text style={[styles.freePrice, { color: colors.primary }]}>FREE</Text></>
        : <Text style={[styles.freePrice, { color: colors.foreground }]}>{ridePackage.currentPriceRwf.toLocaleString()} RWF</Text>}
    </View>
    <Text style={[styles.creditTotal, { color: colors.foreground }]}>{ridePackage.totalCredits} completed rides</Text>
    <Text style={[styles.creditBreakdown, { color: colors.mutedForeground }]}>{ridePackage.includedRides} included + {ridePackage.bonusRides} bonus rides</Text>
    <AppButton title={buttonTitle} onPress={onPress} disabled={disabled} loading={loading} fullWidth size="lg" />
  </View>;
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
  packageName: { fontSize: 19, fontFamily: 'Inter_700Bold', marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  oldPrice: { fontSize: 14, fontFamily: 'Inter_500Medium', textDecorationLine: 'line-through' },
  freePrice: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  creditTotal: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginTop: 4 },
  creditBreakdown: { fontSize: 13, fontFamily: 'Inter_400Regular', marginBottom: 10 },
  prototype: { marginHorizontal: 22, fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 17, textAlign: 'center' },
});
