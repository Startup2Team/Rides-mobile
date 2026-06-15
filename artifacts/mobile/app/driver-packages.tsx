import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { useAuth } from '@/context/AuthContext';
import { useDriverEntitlement } from '@/context/DriverEntitlementContext';
import {
  DRIVER_RIDE_PACKAGES,
  type DriverRidePackage,
  type DriverRidePackageId,
} from '@/domain/driverRidePackages';
import { useColors } from '@/hooks/useColors';

function formatRwf(amount: number) {
  return `${amount.toLocaleString('en-RW')} RWF`;
}

export default function DriverPackagesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const isDark = useColorScheme() === 'dark';
  const { driverProfile } = useAuth();
  const {
    isLoading: isEntitlementLoading,
    launchOfferUsed,
    rideCredits,
  } = useDriverEntitlement();
  const [selectedPackageId, setSelectedPackageId] = useState<DriverRidePackageId | null>(null);
  const cardFill = isDark ? '#1C1C1E' : '#FFFFFF';

  const handleSelectPackage = (packageId: DriverRidePackageId) => {
    setSelectedPackageId(current => current === packageId ? null : packageId);
  };

  const handleBuySelectedPackage = () => {
    if (!selectedPackageId) return;
    router.push({
      pathname: '/driver-package-payment',
      params: { packageId: selectedPackageId },
    });
  };

  return <View style={[styles.root, { backgroundColor: isDark ? '#000' : '#F2F2F7' }]}>
    <GlassHeader
      title="Ride Packages"
      subtitle="Choose credits to receive ride requests"
      onBackPress={() => router.back()}
    />
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: headerMetrics.contentTop, paddingBottom: insets.bottom + 32 }}
      scrollIndicatorInsets={{ top: headerMetrics.indicatorTop }}
    >

    <View style={[styles.balanceCard, { backgroundColor: colors.primary }]}>
      <View>
        <Text style={styles.balanceLabel}>AVAILABLE RIDE CREDITS</Text>
        <Text style={styles.balanceValue}>{isEntitlementLoading ? '...' : rideCredits}</Text>
      </View>
      <View style={styles.approvedBadge}><Feather name="shield" size={14} color="#fff" /><Text style={styles.approvedText}>{driverProfile?.isVerified ? 'Approved driver' : 'Driver'}</Text></View>
    </View>

    <PackageCard
      ridePackage={DRIVER_RIDE_PACKAGES.launch_starter}
      cardFill={cardFill}
      colors={colors}
      disabled={launchOfferUsed}
      unavailable={isEntitlementLoading}
      selected={selectedPackageId === 'launch_starter'}
      onPress={() => handleSelectPackage('launch_starter')}
    />
    <PackageCard
      ridePackage={DRIVER_RIDE_PACKAGES.growth}
      cardFill={cardFill}
      colors={colors}
      unavailable={isEntitlementLoading}
      selected={selectedPackageId === 'growth'}
      onPress={() => handleSelectPackage('growth')}
    />
    <PackageCard
      ridePackage={DRIVER_RIDE_PACKAGES.pro}
      cardFill={cardFill}
      colors={colors}
      unavailable={isEntitlementLoading}
      selected={selectedPackageId === 'pro'}
      onPress={() => handleSelectPackage('pro')}
    />
    <View style={styles.buyButtonContainer}>
      <AppButton
        title="Buy Selected Package"
        onPress={handleBuySelectedPackage}
        disabled={!selectedPackageId}
        fullWidth
        size="lg"
      />
    </View>
   </ScrollView>
  </View>;
}

function PackageCard({ cardFill, colors, disabled = false, onPress, ridePackage, selected, unavailable = false }: {
  cardFill: string; colors: ReturnType<typeof useColors>; disabled?: boolean; onPress: () => void; ridePackage: DriverRidePackage; selected?: boolean; unavailable?: boolean;
}) {
  const isDisabled = disabled || unavailable;
  const fill = selected ? colors.primaryHex + '0A' : cardFill;

  return <TouchableOpacity
    accessibilityRole="radio"
    accessibilityState={{ checked: Boolean(selected), disabled: isDisabled }}
    activeOpacity={0.78}
    disabled={isDisabled}
    onPress={onPress}
    style={[
      styles.packageCard,
      {
        backgroundColor: fill,
        borderColor: colors.primary,
        borderWidth: selected ? 1.5 : 0,
        opacity: isDisabled ? 0.55 : 1,
      },
    ]}
  >
    <View style={styles.packageContent}>
      <Text style={[styles.packageName, { color: colors.foreground }]}>{ridePackage.name}</Text>
      <View
        accessibilityLabel={`${ridePackage.includedRides} Ride Credits + ${ridePackage.bonusRides} Bonus Credits`}
        style={styles.creditRow}
      >
        <Text style={[styles.creditTotal, { color: colors.foreground }]}>{ridePackage.includedRides} Ride Credits</Text>
        <Text style={[styles.bonusCredits, { color: colors.primary }]}>+ {ridePackage.bonusRides} Bonus Credits</Text>
      </View>
      <Text style={[styles.planLabel, { color: colors.mutedForeground }]}>
        {ridePackage.launchOffer ? 'Launch Offer' : ridePackage.id === 'growth' ? 'Most Popular Plan' : 'Best Value Plan'}
      </Text>
      <View style={styles.priceRow}>
        <Text style={[styles.price, { color: ridePackage.launchOffer ? colors.primary : colors.foreground }]}>
          {ridePackage.currentPriceRwf === 0 ? 'FREE NOW' : formatRwf(ridePackage.currentPriceRwf)}
        </Text>
        {ridePackage.currentPriceRwf === 0 ? (
          <Text style={[styles.normalPrice, { color: colors.mutedForeground }]}>{formatRwf(ridePackage.normalPriceRwf)}</Text>
        ) : null}
      </View>
      {disabled ? <Text style={[styles.unavailableText, { color: colors.mutedForeground }]}>Already used</Text> : null}
    </View>
    <View style={[
      styles.selectionControl,
      { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : 'transparent' },
    ]}>
      {selected ? <Feather name="check" size={17} color="#fff" /> : null}
    </View>
  </TouchableOpacity>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  balanceCard: { marginHorizontal: 16, marginBottom: 14, borderRadius: 18, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  balanceLabel: { color: 'rgba(255,255,255,0.78)', fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.8 },
  balanceValue: { color: '#fff', fontSize: 40, fontFamily: 'Inter_700Bold', marginTop: 3 },
  approvedBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 16 },
  approvedText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  packageCard: { minHeight: 132, marginHorizontal: 16, marginBottom: 14, borderRadius: 22, paddingHorizontal: 20, paddingVertical: 20, flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  packageContent: { flex: 1, gap: 9 },
  packageName: { fontSize: 23, fontFamily: 'Inter_700Bold', lineHeight: 29 },
  creditRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 5 },
  creditTotal: { fontSize: 14, fontFamily: 'Inter_600SemiBold', lineHeight: 19 },
  bonusCredits: { fontSize: 13, fontFamily: 'Inter_700Bold', lineHeight: 18 },
  planLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 0.5 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  price: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  normalPrice: { fontSize: 11, fontFamily: 'Inter_500Medium', textDecorationLine: 'line-through' },
  unavailableText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', marginTop: 2 },
  selectionControl: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  buyButtonContainer: { marginHorizontal: 16, marginTop: 4 },
});
