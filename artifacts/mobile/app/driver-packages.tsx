import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { useAuth } from '@/context/AuthContext';
import { useDriverEntitlement } from '@/context/DriverEntitlementContext';
import { getEntitlementVehicleForProfile } from '@/domain/driverRidePackages';
import {
  createPackageOfferSnapshot,
  hasUsedPackageOffer,
  serializePackageOfferSnapshot,
  type DriverPackageOfferSnapshot,
} from '@/domain/driverRidePackages';
import {
  DRIVER_RIDE_PACKAGE_CATALOG,
  getActivePackages,
  type DriverRidePackageCatalogEntry,
} from '@/domain/driverRidePackageCatalog';
import { getActiveDriverRideCampaigns, resolvePackageOffer, type DriverRidePackageOffer } from '@/domain/driverRideCampaigns';
import { useColors } from '@/hooks/useColors';
import { VEHICLE_LABELS } from '@/types';

function formatRwf(amount: number) {
  return `${amount.toLocaleString('en-RW')} RWF`;
}

export default function DriverPackagesScreen({
  catalog = DRIVER_RIDE_PACKAGE_CATALOG,
}: {
  catalog?: DriverRidePackageCatalogEntry[];
} = {}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const isDark = useColorScheme() === 'dark';
  const { driverProfile } = useAuth();
  const {
    isLoading: isEntitlementLoading,
    entitlement,
    rideCredits,
  } = useDriverEntitlement();
  const [selectedOffer, setSelectedOffer] = useState<DriverPackageOfferSnapshot | null>(null);
  const cardFill = isDark ? '#1C1C1E' : '#FFFFFF';

  const activeVehicle = getEntitlementVehicleForProfile(driverProfile);
  const vehicleType = activeVehicle?.vehicleType ?? driverProfile?.vehicleType ?? null;
  const packages = getActivePackages(vehicleType, catalog);
  const vehicleLabel = vehicleType ? VEHICLE_LABELS[vehicleType] : 'Vehicle';
  const activeCampaigns = getActiveDriverRideCampaigns();

  const handleSelectPackage = (offer: DriverRidePackageOffer) => {
    if (selectedOffer?.packageId === offer.packageId) {
      setSelectedOffer(null);
      return;
    }
    const vehicle = activeVehicle
      ?? (entitlement.vehicleId && entitlement.vehicleType
        ? { vehicleId: entitlement.vehicleId, vehicleType: entitlement.vehicleType }
        : { vehicleId: 'driver-vehicle:legacy', vehicleType: offer.vehicleType });
    setSelectedOffer(createPackageOfferSnapshot(offer, vehicle));
  };

  const handleBuySelectedPackage = () => {
    if (!selectedOffer) return;
    router.push({
      pathname: '/driver-package-payment',
      params: { offer: serializePackageOfferSnapshot(selectedOffer) },
    });
  };

  return <View style={[styles.root, { backgroundColor: isDark ? '#000' : '#F2F2F7' }]}>
    <GlassHeader
      title="Ride Packages"
      subtitle={`Choose a package for your ${vehicleLabel}`}
      onBackPress={() => router.back()}
    />
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: headerMetrics.contentTop, paddingBottom: insets.bottom + 32 }}
      scrollIndicatorInsets={{ top: headerMetrics.indicatorTop }}
    >

    <View style={[styles.balanceCard, { backgroundColor: colors.primary }]}>
      <View>
        <Text style={styles.balanceLabel}>AVAILABLE RIDES</Text>
        <Text style={styles.balanceValue}>{isEntitlementLoading ? '...' : rideCredits}</Text>
      </View>
      <View style={styles.approvedBadge}><Feather name="shield" size={14} color="#fff" /><Text style={styles.approvedText}>{driverProfile?.isVerified ? 'Approved driver' : 'Driver'}</Text></View>
    </View>

    {packages.map(catalogEntry => {
      const pkg = resolvePackageOffer({
        package: catalogEntry,
        vehicleType,
        driver: driverProfile,
        entitlement,
        activeCampaigns,
      });
      const isOfferUsed = pkg.priceRwf === 0 && hasUsedPackageOffer(entitlement, pkg.packageId);
      return (
        <PackageCard
          key={`${pkg.packageId}:${pkg.packageVersion}`}
          ridePackage={pkg}
          cardFill={cardFill}
          colors={colors}
          disabled={isOfferUsed}
          unavailable={isEntitlementLoading}
          selected={selectedOffer?.packageId === pkg.packageId}
          onPress={() => handleSelectPackage(pkg)}
        />
      );
    })}
    <View style={styles.buyButtonContainer}>
      <AppButton
        title="Buy Selected Package"
        onPress={handleBuySelectedPackage}
        disabled={!selectedOffer}
        fullWidth
        size="lg"
      />
    </View>
   </ScrollView>
  </View>;
}

function PackageCard({ cardFill, colors, disabled = false, onPress, ridePackage, selected, unavailable = false }: {
  cardFill: string; colors: ReturnType<typeof useColors>; disabled?: boolean; onPress: () => void; ridePackage: DriverRidePackageOffer; selected?: boolean; unavailable?: boolean;
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
        borderColor: selected ? colors.primary : colors.border,
        opacity: isDisabled ? 0.55 : 1,
      },
    ]}
  >
    <View style={styles.packageContent}>
      <Text style={[styles.packageName, { color: colors.foreground }]}>{ridePackage.packageName}</Text>
      <View
        accessibilityLabel={`${ridePackage.ridesGranted} Rides + ${ridePackage.bonusRidesGranted} Bonus Rides`}
        style={styles.creditRow}
      >
        <Text style={[styles.creditTotal, { color: colors.foreground }]}>{ridePackage.ridesGranted} Rides</Text>
        <Text style={[styles.bonusCredits, { color: colors.primary }]}>+ {ridePackage.bonusRidesGranted} Bonus Rides</Text>
      </View>
      {ridePackage.campaignName ? (
        <View style={[styles.campaignBadge, { backgroundColor: colors.primaryHex + '12' }]}>
          <Feather name="tag" size={11} color={colors.primary} />
          <Text style={[styles.campaignBadgeText, { color: colors.primary }]}>{ridePackage.campaignName}</Text>
        </View>
      ) : null}
      <Text style={[styles.planLabel, { color: colors.mutedForeground }]}>
        {ridePackage.isPromotional
          ? 'Promotional Offer'
          : ridePackage.priceRwf === 0
            ? 'Launch Offer'
            : 'Ride Package'}
      </Text>
      <View style={styles.priceRow}>
        <Text style={[styles.price, { color: ridePackage.priceRwf === 0 ? colors.primary : colors.foreground }]}>
          {ridePackage.priceRwf === 0 ? 'FREE NOW' : formatRwf(ridePackage.priceRwf)}
        </Text>
        {ridePackage.basePriceRwf !== ridePackage.priceRwf ? (
          <Text style={[styles.normalPrice, { color: colors.mutedForeground }]}>{formatRwf(ridePackage.basePriceRwf)}</Text>
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
  packageCard: { minHeight: 132, marginHorizontal: 16, marginBottom: 14, borderRadius: 22, paddingHorizontal: 20, paddingVertical: 20, borderWidth: 1.5, flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  packageContent: { flex: 1, gap: 9 },
  packageName: { fontSize: 23, fontFamily: 'Inter_700Bold', lineHeight: 29 },
  creditRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 5 },
  creditTotal: { fontSize: 14, fontFamily: 'Inter_600SemiBold', lineHeight: 19 },
  bonusCredits: { fontSize: 13, fontFamily: 'Inter_700Bold', lineHeight: 18 },
  campaignBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999 },
  campaignBadgeText: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  planLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 0.5 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  price: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  normalPrice: { fontSize: 11, fontFamily: 'Inter_500Medium', textDecorationLine: 'line-through' },
  unavailableText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', marginTop: 2 },
  selectionControl: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  buyButtonContainer: { marginHorizontal: 16, marginTop: 4 },
});
