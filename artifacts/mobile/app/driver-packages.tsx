import { typography } from '@/constants/typography';
import { AppText } from '@/components/AppText';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, TouchableOpacity, View, useColorScheme } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { GlassScrollView } from '@/components/GlassScrollView';
import { FORM_BOTTOM_PADDING } from '@/constants/tabBar';
import { useAuth } from '@/context/AuthContext';
import { useDriverEntitlement } from '@/context/DriverEntitlementContext';
import { usePackageSync } from '@/context/PackageSyncContext';
import { getEntitlementVehicleForProfile } from '@/domain/driverRidePackages';
import {
  createPackageOfferSnapshot,
  hasUsedPackageOffer,
  type DriverPackageOfferSnapshot,
} from '@/domain/driverRidePackages';
import { getActivePackages } from '@/domain/driverRidePackageCatalog';
import { getActiveDriverRideCampaigns, resolvePackageOffer, type DriverRidePackageOffer } from '@/domain/driverRideCampaigns';
import { useColors } from '@/hooks/useColors';
import { saveLockedPackageOffer } from '@/persistence/lockedPackageOfferPersistence';
import { VEHICLE_LABELS } from '@/types';

function formatRwf(amount: number) {
  return `${amount.toLocaleString('en-RW')} RWF`;
}



export default function DriverPackagesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const isDark = useColorScheme() === 'dark';
  const { driverProfile, user } = useAuth();
  const {
    isLoading: isEntitlementLoading,
    entitlement,
  } = useDriverEntitlement();
  const {
    campaigns,
    catalog,
    hasCatalogSnapshot,
    offerSourceReady,
    isLoading: isCatalogLoading,
    isRefreshing,
    lastSyncedAt,
    refresh,
    syncWarning,
    syncGeneration,
  } = usePackageSync();
  const [selectedOffer, setSelectedOffer] = useState<DriverPackageOfferSnapshot | null>(null);
  const [selectionNotice, setSelectionNotice] = useState<string | null>(null);
  const generationRef = useRef(syncGeneration);
  const cardFill = isDark ? '#1C1C1E' : '#FFFFFF';

  const activeVehicle = getEntitlementVehicleForProfile(driverProfile);
  const vehicleType = activeVehicle?.vehicleType ?? driverProfile?.vehicleType ?? null;
  const packages = offerSourceReady ? getActivePackages(vehicleType, catalog) : [];
  const vehicleLabel = vehicleType ? VEHICLE_LABELS[vehicleType] : 'Vehicle';
  const activeCampaigns = getActiveDriverRideCampaigns(campaigns);

  useEffect(() => {
    if (generationRef.current === null) {
      generationRef.current = syncGeneration;
      return;
    }
    if (syncGeneration && generationRef.current !== syncGeneration) {
      generationRef.current = syncGeneration;
      if (selectedOffer) {
        setSelectedOffer(null);
        setSelectionNotice('Package offers were refreshed. Please select again.');
      }
    }
  }, [selectedOffer, syncGeneration]);

  const handleSelectPackage = async (offer: DriverRidePackageOffer) => {
    if (selectedOffer?.packageId === offer.packageId) {
      setSelectedOffer(null);
      return;
    }
    const vehicle = activeVehicle
      ?? (entitlement.vehicleId && entitlement.vehicleType
        ? { vehicleId: entitlement.vehicleId, vehicleType: entitlement.vehicleType }
        : { vehicleId: 'driver-vehicle:legacy', vehicleType: offer.vehicleType });
    const selectionGeneration = syncGeneration;
    const lockedOffer = createPackageOfferSnapshot(offer, vehicle, new Date(), undefined, {
      ownerUserId: user?.id,
      quoteAuthority: 'local',
    });
    try {
      await saveLockedPackageOffer(lockedOffer, catalog, offer);
      if (generationRef.current !== selectionGeneration) {
        setSelectionNotice('Package offers were refreshed. Please select again.');
        return;
      }
      setSelectionNotice(null);
      setSelectedOffer(lockedOffer);
    } catch (lockError) {
      setSelectedOffer(null);
      setSelectionNotice(lockError instanceof Error ? lockError.message : 'Unable to lock this package offer.');
    }
  };

  const handleBuySelectedPackage = () => {
    if (!selectedOffer) return;
    router.push({
      pathname: '/driver-package-payment',
      params: { offerId: selectedOffer.offerId },
    });
  };

  return <View style={[styles.root, { backgroundColor: isDark ? '#000' : '#F2F2F7' }]}>
    <GlassHeader
      title="Ride Packages"
      subtitle={`Choose a package for your ${vehicleLabel}`}
      onBackPress={() => router.back()}
    />

    <GlassScrollView
      style={styles.root}
      contentContainerStyle={{
        paddingTop: Platform.OS === 'ios' ? 0 : headerMetrics.contentTop,
        paddingBottom: insets.bottom + FORM_BOTTOM_PADDING,
      }}
      contentInset={Platform.OS === 'ios' ? { top: headerMetrics.contentTop } : undefined}
      contentOffset={Platform.OS === 'ios' ? { x: 0, y: -headerMetrics.contentTop } : undefined}
      scrollIndicatorInsets={{ top: headerMetrics.indicatorTop }}
      onRefresh={refresh}
      refreshing={isRefreshing}
      refreshIndicatorTop={headerMetrics.headerInset + 44}
    >

    {((syncWarning && offerSourceReady) || selectionNotice) ? (
      <View style={styles.syncRow}>
        <View style={styles.syncCopy}>
          {syncWarning && offerSourceReady ? (
            <AppText style={[styles.syncWarning, { color: colors.warning }]}>Using cached package data</AppText>
          ) : null}
          {selectionNotice ? (
            <AppText style={[styles.syncWarning, { color: colors.warning }]}>{selectionNotice}</AppText>
          ) : null}
        </View>
      </View>
    ) : null}

    {isCatalogLoading && !hasCatalogSnapshot ? (
      <PackageState
        colors={colors}
        icon="loader"
        title="Loading packages..."
        detail="Checking for the latest package offers."
      />
    ) : !offerSourceReady && syncWarning ? (
      <PackageState
        colors={colors}
        icon="wifi-off"
        title="Packages unavailable."
        detail="Please connect to the internet and try again."
      />
    ) : packages.length === 0 ? (
      <PackageState
        colors={colors}
        icon="package"
        title="No packages available"
        detail={`There are no active packages for your ${vehicleLabel} right now.`}
      />
    ) : packages.map(catalogEntry => {
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
          onPress={() => void handleSelectPackage(pkg)}
        />
      );
    })}
    {packages.length > 0 ? <View style={styles.buyButtonContainer}>
      <AppButton
        title="Buy Selected Package"
        onPress={handleBuySelectedPackage}
        disabled={!selectedOffer}
        fullWidth
        size="lg"
      />
    </View> : null}
    </GlassScrollView>
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
      <AppText style={[styles.packageName, { color: colors.foreground }]}>{ridePackage.packageName}</AppText>
      <View
        accessibilityLabel={`${ridePackage.ridesGranted} Rides + ${ridePackage.bonusRidesGranted} Bonus Rides`}
        style={styles.creditRow}
      >
        <AppText style={[styles.creditTotal, { color: colors.foreground }]}>{ridePackage.ridesGranted} Rides</AppText>
        <AppText style={[styles.bonusCredits, { color: colors.primary }]}>+ {ridePackage.bonusRidesGranted} Bonus Rides</AppText>
      </View>
      {ridePackage.campaignName ? (
        <View style={[styles.campaignBadge, { backgroundColor: colors.primaryHex + '12' }]}>
          <Feather name="tag" size={11} color={colors.primary} />
          <AppText style={[styles.campaignBadgeText, { color: colors.primary }]}>{ridePackage.campaignName}</AppText>
        </View>
      ) : null}
      <AppText style={[styles.planLabel, { color: colors.mutedForeground }]}>
        {ridePackage.isPromotional
          ? 'Promotional Offer'
          : ridePackage.priceRwf === 0
            ? 'Launch Offer'
            : 'Ride Package'}
      </AppText>
      <View style={styles.priceRow}>
        <AppText style={[styles.price, { color: ridePackage.priceRwf === 0 ? colors.primary : colors.foreground }]}>
          {ridePackage.priceRwf === 0 ? 'FREE NOW' : formatRwf(ridePackage.priceRwf)}
        </AppText>
        {ridePackage.basePriceRwf !== ridePackage.priceRwf ? (
          <AppText style={[styles.normalPrice, { color: colors.mutedForeground }]}>{formatRwf(ridePackage.basePriceRwf)}</AppText>
        ) : null}
      </View>
      {disabled ? <AppText style={[styles.unavailableText, { color: colors.mutedForeground }]}>Already used</AppText> : null}
    </View>
    <View style={[
      styles.selectionControl,
      { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : 'transparent' },
    ]}>
      {selected ? <Feather name="check" size={17} color="#fff" /> : null}
    </View>
  </TouchableOpacity>;
}

function PackageState({ colors, detail, icon, title }: {
  colors: ReturnType<typeof useColors>;
  detail: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
}) {
  return <View style={[styles.stateCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
    <Feather name={icon} size={22} color={colors.mutedForeground} />
    <AppText style={[styles.stateTitle, { color: colors.foreground }]}>{title}</AppText>
    <AppText style={[styles.stateDetail, { color: colors.mutedForeground }]}>{detail}</AppText>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  syncRow: { marginHorizontal: 16, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  syncCopy: { flex: 1, gap: 3 },
  syncWarning: { ...typography.tiny,  },

  stateCard: { marginHorizontal: 16, borderRadius: 18, borderWidth: 1, padding: 22, alignItems: 'center', gap: 8 },
  stateTitle: { ...typography.title, textAlign: 'center' },
  stateDetail: { ...typography.caption, lineHeight: 18, textAlign: 'center' },
  packageCard: { minHeight: 132, marginHorizontal: 16, marginBottom: 14, borderRadius: 22, paddingHorizontal: 20, paddingVertical: 20, borderWidth: 1.5, flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  packageContent: { flex: 1, gap: 9 },
  packageName: { ...typography.h2, lineHeight: 29 },
  creditRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 5 },
  creditTotal: { ...typography.bodySmall, lineHeight: 19 },
  bonusCredits: { ...typography.label, lineHeight: 18 },
  campaignBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999 },
  campaignBadgeText: { ...typography.tiny,  },
  planLabel: { ...typography.caption, textTransform: 'uppercase', letterSpacing: 0.5 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  price: { ...typography.body,  },
  normalPrice: { ...typography.tiny, textDecorationLine: 'line-through' },
  unavailableText: { ...typography.tiny, marginTop: 2 },
  selectionControl: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  buyButtonContainer: { marginHorizontal: 16, marginTop: 4 },
});
