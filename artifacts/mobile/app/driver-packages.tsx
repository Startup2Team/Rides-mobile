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
import { FORM_BOTTOM_PADDING, TAB_BAR_SCREEN_BOTTOM_PADDING } from '@/constants/tabBar';
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
import { useManualPaymentClaimsQuery } from '@/query/hooks/useManualPaymentClaimsQuery';
import { useDriverBackendEntitlementsQuery } from '@/query/hooks/useDriverBackendEntitlementsQuery';
import { toBackendTransportType } from '@/constants/vehicles';
import type { ManualPaymentClaimReadModel } from '@/domains/package-payments';
import { radius } from '@/constants/radius';
import { spacing, semanticSpacing } from '@/constants/spacing';
import { navigateToDriverHomeAfterCompletion } from '@/navigation/navigationPolicy';

function formatRwf(amount: number) {
  return `${amount.toLocaleString('en-RW')} RWF`;
}

// A claim in one of these statuses is still "in flight": the driver already
// submitted a payment for this package and is awaiting review, so the offer must
// not be re-offered as if it were unclaimed (prevents duplicate submissions).
const ACTIVE_CLAIM_STATUSES = new Set(['submitted', 'pending_review', 'needs_clarification']);



export function DriverPackagesScreen({ showBack = true }: { showBack?: boolean }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const isDark = useColorScheme() === 'dark';
  const { driverProfile, user } = useAuth();
  const {
    isLoading: isEntitlementLoading,
    activatePackage,
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
  const [activationError, setActivationError] = useState<string | null>(null);
  const [isActivating, setIsActivating] = useState(false);
  const generationRef = useRef(syncGeneration);
  const cardFill = isDark ? '#1C1C1E' : '#FFFFFF';
  const { claims } = useManualPaymentClaimsQuery({ driverId: user?.id });

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Index the freshest in-flight claim per package so an offer with a pending
  // payment renders as "under review" instead of a fresh, buyable offer. Keyed
  // on packageId (the meaningful join for a driver's single active vehicle);
  // custom top-ups carry an empty packageId and are ignored here.
  const activeClaimByPackageId = React.useMemo(() => {
    const map = new Map<string, ManualPaymentClaimReadModel>();
    for (const claim of (claims ?? []) as ManualPaymentClaimReadModel[]) {
      if (!claim?.packageId || !ACTIVE_CLAIM_STATUSES.has(claim.status)) continue;
      const existing = map.get(claim.packageId);
      if (!existing || claim.createdAt.localeCompare(existing.createdAt) > 0) {
        map.set(claim.packageId, claim);
      }
    }
    return map;
  }, [claims]);

  const activeVehicle = getEntitlementVehicleForProfile(driverProfile);
  const vehicleType = activeVehicle?.vehicleType ?? driverProfile?.vehicleType ?? null;

  // Backend-authoritative credits for this vehicle type. A free "launch" starter
  // is only for drivers who haven't onboarded yet, so once they hold any credits
  // (from the starter itself or any package) we stop offering the free one —
  // this survives reload, unlike the local activation list.
  const { data: backendEntitlements } = useDriverBackendEntitlementsQuery({ enabled: !!user?.id });
  const backendCode = vehicleType ? toBackendTransportType(vehicleType) : null;
  const vehicleEntitlement = backendCode
    ? (backendEntitlements ?? []).find(e => e.vehicleTypeCode === backendCode)
    : undefined;
  const hasCreditsForVehicle = !!vehicleEntitlement
    && (vehicleEntitlement.ridesRemaining + vehicleEntitlement.bonusRemaining) > 0;

  const packages = offerSourceReady ? getActivePackages(vehicleType, catalog) : [];
  const vehicleLabel = vehicleType ? VEHICLE_LABELS[vehicleType] : 'Vehicle';
  const activeCampaigns = getActiveDriverRideCampaigns(campaigns);
  const bottomPadding = showBack ? FORM_BOTTOM_PADDING : TAB_BAR_SCREEN_BOTTOM_PADDING;
  const packagesContentTop = Math.max(0, headerMetrics.contentTop - spacing[20]);

  useEffect(() => {
    if (generationRef.current === null) {
      generationRef.current = syncGeneration;
      return;
    }
    if (syncGeneration && generationRef.current !== syncGeneration) {
      generationRef.current = syncGeneration;
      if (selectedOffer) {
        setSelectedOffer(null);
        setActivationError(null);
      }
    }
  }, [selectedOffer, syncGeneration]);

  const handleSelectPackage = async (offer: DriverRidePackageOffer) => {
    if (selectedOffer?.packageId === offer.packageId) {
      setSelectedOffer(null);
      setActivationError(null);
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
        return;
      }
      setSelectedOffer(lockedOffer);
      setActivationError(null);
    } catch (lockError) {
      setSelectedOffer(null);
    }
  };

  const handleBuySelectedPackage = async () => {
    if (!selectedOffer) return;
    if (selectedOffer.priceRwf === 0) {
      setIsActivating(true);
      setActivationError(null);
      try {
        await activatePackage(selectedOffer);
        navigateToDriverHomeAfterCompletion(router);
      } catch (activationFailure) {
        setActivationError(activationFailure instanceof Error ? activationFailure.message : 'Unable to activate this package.');
      } finally {
        setIsActivating(false);
      }
      return;
    }
    router.push({
      pathname: '/driver-package-payment',
      params: { offerId: selectedOffer.offerId },
    });
  };

  return <View style={[styles.root, { backgroundColor: isDark ? '#000' : '#F2F2F7' }]}>
    <GlassHeader
      title="Ride Packages"
      showBack={showBack}
      onBackPress={() => router.back()}
    />

    <GlassScrollView
      style={styles.root}
      indicatorTop={headerMetrics.indicatorTop}
      contentContainerStyle={{
        paddingTop: Platform.OS === 'ios' ? 0 : packagesContentTop,
        paddingBottom: insets.bottom + bottomPadding,
      }}
      contentInset={Platform.OS === 'ios' ? { top: packagesContentTop } : undefined}
      contentOffset={Platform.OS === 'ios' ? { x: 0, y: -packagesContentTop } : undefined}
      showsVerticalScrollIndicator={false}
      onRefresh={refresh}
      refreshing={isRefreshing}
      refreshIndicatorTop={headerMetrics.headerInset + 44}
    >

    {(syncWarning && offerSourceReady) ? (
      <View style={styles.syncRow}>
        <View style={styles.syncCopy}>
          {syncWarning && offerSourceReady ? (
            <AppText style={[styles.syncWarning, { color: colors.warning }]}>Using cached package data</AppText>
          ) : null}
        </View>
      </View>
    ) : null}

    {claims && claims.length > 0 ? (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="View payment confirmations"
        style={[styles.historyLink, { backgroundColor: cardFill, borderColor: colors.border }]}
        onPress={() => router.push('/driver-package-payment-status')}
      >
        <Feather name="clock" size={16} color={colors.primary} />
        <AppText style={[styles.historyLinkText, { color: colors.foreground }]}>Payment confirmations</AppText>
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} style={{ marginLeft: 'auto' }} />
      </TouchableOpacity>
    ) : null}

    <View style={styles.introCopy}>
      <AppText style={[styles.introText, { color: colors.foreground }]}>
        Buy a package to go online and start receiving ride requests.
      </AppText>
      <AppText style={[styles.introText, { color: colors.foreground }]}>
        One completed trip uses one ride; declined requests do not count.
      </AppText>
    </View>

    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel="Buy rides with a custom amount"
      style={[styles.historyLink, { backgroundColor: cardFill, borderColor: colors.border }]}
      onPress={() => router.push('/driver-custom-topup')}
    >
      <Feather name="edit-3" size={16} color={colors.primary} />
      <AppText style={[styles.historyLinkText, { color: colors.foreground }]}>Custom top-up</AppText>
      <Feather name="chevron-right" size={16} color={colors.mutedForeground} style={{ marginLeft: 'auto' }} />
    </TouchableOpacity>

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
      // A free launch starter disappears once the driver has onboarded (holds
      // credits, or already claimed this offer locally) — don't re-offer it.
      const isFreeOffer = pkg.priceRwf === 0;
      if (isFreeOffer && (hasCreditsForVehicle || hasUsedPackageOffer(entitlement, pkg.packageId))) {
        return null;
      }
      const pendingClaim = activeClaimByPackageId.get(pkg.packageId);
      return (
        <PackageCard
          key={`${pkg.packageId}:${pkg.packageVersion}`}
          ridePackage={pkg}
          cardFill={cardFill}
          colors={colors}
          pending={Boolean(pendingClaim)}
          unavailable={isEntitlementLoading}
          selected={selectedOffer?.packageId === pkg.packageId}
          onPress={() => void handleSelectPackage(pkg)}
        />
      );
    })}
    {activationError ? (
      <View style={[styles.activationError, { borderColor: colors.destructiveHex + '30' }]}>
        <Feather name="alert-triangle" size={15} color={colors.destructive} />
        <AppText style={[styles.activationErrorText, { color: colors.destructive }]}>{activationError}</AppText>
      </View>
    ) : null}
    {packages.length > 0 ? <View style={styles.buyButtonContainer}>
      <AppButton
        title={selectedOffer?.priceRwf === 0 ? 'Activate Package' : 'Buy Selected Package'}
        onPress={() => void handleBuySelectedPackage()}
        disabled={!selectedOffer || isActivating}
        loading={isActivating}
        fullWidth
        size="lg"
      />
    </View> : null}
    <View style={styles.scrollTail} />
    </GlassScrollView>
  </View>;
}

function PackageCard({ cardFill, colors, disabled = false, pending = false, onPress, ridePackage, selected, unavailable = false }: {
  cardFill: string; colors: ReturnType<typeof useColors>; disabled?: boolean; pending?: boolean; onPress: () => void; ridePackage: DriverRidePackageOffer; selected?: boolean; unavailable?: boolean;
}) {
  // `pending` (a payment already under review for this package) is informational
  // only — the driver may buy the same or another package again while waiting,
  // and each purchase shows as "under review". It must NOT disable the card.
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
      {pending ? (
        <View style={[styles.pendingBadge, { backgroundColor: colors.warningHex + '18' }]}>
          <Feather name="clock" size={11} color={colors.warning} />
          <AppText style={[styles.pendingBadgeText, { color: colors.warning }]}>Payment under review</AppText>
        </View>
      ) : disabled ? (
        <AppText style={[styles.unavailableText, { color: colors.mutedForeground }]}>Already used</AppText>
      ) : null}
    </View>
    <View style={[
      styles.selectionControl,
      { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : 'transparent' },
    ]}>
      {selected ? <Feather name="check" size={17} color="#fff" /> : pending ? <Feather name="clock" size={15} color={colors.warning} /> : null}
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
  syncRow: { marginHorizontal: semanticSpacing.cardPadding, marginBottom: spacing[14], flexDirection: 'row', alignItems: 'center', gap: semanticSpacing.rowGap },
  syncCopy: { flex: 1, gap: 3 },
  syncWarning: { ...typography.tiny,  },
  introCopy: { marginHorizontal: semanticSpacing.cardPadding, marginBottom: spacing[14], gap: spacing[4] },
  introText: { ...typography.caption, lineHeight: 18 },

  stateCard: { marginHorizontal: semanticSpacing.cardPadding, borderRadius: 18, borderWidth: 1, padding: radius.sheetCompact, alignItems: 'center', gap: semanticSpacing.inlineGap },
  stateTitle: { ...typography.title, textAlign: 'center' },
  stateDetail: { ...typography.caption, lineHeight: 18, textAlign: 'center' },
  packageCard: { minHeight: 132, marginHorizontal: semanticSpacing.cardPadding, marginBottom: spacing[14], borderRadius: radius.sheetCompact, paddingHorizontal: semanticSpacing.screenPadding, paddingVertical: semanticSpacing.screenPadding, borderWidth: 1.5, flexDirection: 'row', alignItems: 'flex-start', gap: spacing[14] },
  packageContent: { flex: 1, gap: 9 },
  packageName: { ...typography.h2, lineHeight: 29 },
  creditRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 5 },
  creditTotal: { ...typography.bodySmall, lineHeight: 19 },
  bonusCredits: { ...typography.label, lineHeight: 18 },
  campaignBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing[4], alignSelf: 'flex-start', paddingHorizontal: semanticSpacing.inlineGap, paddingVertical: 5, borderRadius: radius.pill },
  campaignBadgeText: { ...typography.tiny,  },
  planLabel: { ...typography.caption, textTransform: 'uppercase', letterSpacing: 0.5 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: semanticSpacing.inlineGap },
  price: { ...typography.body,  },
  normalPrice: { ...typography.tiny, textDecorationLine: 'line-through' },
  unavailableText: { ...typography.tiny, marginTop: 2 },
  pendingBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing[4], alignSelf: 'flex-start', paddingHorizontal: semanticSpacing.inlineGap, paddingVertical: 4, borderRadius: radius.pill, marginTop: 2 },
  pendingBadgeText: { ...typography.tiny },
  selectionControl: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: spacing[2] },
  activationError: { marginHorizontal: semanticSpacing.cardPadding, marginBottom: spacing[10], borderWidth: 1, borderRadius: radius.lg, padding: spacing[10], flexDirection: 'row', alignItems: 'center', gap: spacing[8] },
  activationErrorText: { ...typography.caption, flex: 1, lineHeight: 18 },
  buyButtonContainer: { marginHorizontal: semanticSpacing.cardPadding, marginTop: spacing[4] },
  scrollTail: { height: spacing[32] },
  historyLink: {
    marginHorizontal: semanticSpacing.cardPadding,
    marginBottom: spacing[14],
    borderRadius: radius.sheetCompact,
    borderWidth: 1,
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[16],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[10],
  },
  historyLinkText: {
    ...typography.bodySmall,
  },
});

export default DriverPackagesScreen;
