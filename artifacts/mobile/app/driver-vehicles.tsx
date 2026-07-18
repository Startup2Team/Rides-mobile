import { typography } from '@/constants/typography';
import { AppText } from '@/components/AppText';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Alert, StyleSheet, TouchableOpacity, View, useColorScheme } from 'react-native';
import { GlassScrollView } from '@/components/GlassScrollView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { FORM_BOTTOM_PADDING } from '@/constants/tabBar';
import { useAuth } from '@/context/AuthContext';
import { useDriverEntitlement } from '@/context/DriverEntitlementContext';
import { getActiveBonusRides, getActivePackageActivation, getActiveRideCredits, getRideBalance, getVehicleEntitlement } from '@/domain/driverRidePackages';
import { useVehicles } from '@/domains/vehicle';
import { useColors } from '@/hooks/useColors';
import { VEHICLE_LABELS } from '@/types';
import { radius } from '@/constants/radius';
import { spacing, semanticSpacing } from '@/constants/spacing';

function formatRwf(amount: number) {
  return `${amount.toLocaleString('en-RW')} RWF`;
}

export default function DriverVehiclesScreen() {
  const colors = useColors();
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const { driverProfile } = useAuth();
  const { entitlement, isLoading } = useDriverEntitlement();
  const { vehicles, setPrimaryVehicle, refreshVehicles, isRefreshing } = useVehicles();
  const params = useLocalSearchParams<{ sourceVehicleId?: string }>();

  const statusCounts = React.useMemo(() => ({
    approved: vehicles.filter(vehicle => vehicle.status === 'approved').length,
    pendingReview: vehicles.filter(vehicle => vehicle.status === 'pending_review').length,
    rejected: vehicles.filter(vehicle => vehicle.status === 'rejected').length,
  }), [vehicles]);
  const cardFill = isDark ? '#1C1C1E' : '#FFFFFF';
  const online = driverProfile?.isOnline === true;
  const sourceVehicleId = typeof params.sourceVehicleId === 'string' ? params.sourceVehicleId : null;

  const handleRefresh = React.useCallback(async () => {
    // Real refetch of the driver's vehicles (GET /v1/driver/vehicles-backed
    // query), replacing the previous fixed-delay no-op.
    await refreshVehicles();
  }, [refreshVehicles]);

  const handleSelectVehicle = async (vehicleId: string) => {
    if (online) return;
    try {
      await setPrimaryVehicle(vehicleId);
    } catch {
      // Backend rejected the switch (409) — the driver has an active ride.
      Alert.alert(
        'Cannot switch vehicle',
        'You cannot change your active vehicle during an ongoing ride. Finish the ride first, then try again.',
      );
    }
  };

  const handleAddVehicle = () => {
    if (sourceVehicleId) {
      router.push({ pathname: '/driver-add-vehicle', params: { sourceVehicleId } });
      return;
    }
    router.push('/driver-add-vehicle');
  };

  return (
    <View style={[styles.root, { backgroundColor: isDark ? '#000' : '#F2F2F7' }]}>
      <GlassHeader
        title="My Vehicles"
        onBackPress={() => router.back()}
      />
      <GlassScrollView
        style={styles.root}
        contentContainerStyle={{
          paddingTop: headerMetrics.contentTop,
          paddingBottom: insets.bottom + FORM_BOTTOM_PADDING,
        }}
        scrollIndicatorInsets={{ top: headerMetrics.indicatorTop }}
        onRefresh={handleRefresh}
        refreshing={isRefreshing}
        refreshIndicatorTop={headerMetrics.headerInset + 44}
      >
        <View style={styles.headerBand}>
          <View style={styles.headerBandTop}>
            <AppText style={[styles.headerBandTitle, { color: colors.foreground }]}>
              {vehicles.length} linked vehicle{vehicles.length === 1 ? '' : 's'}
            </AppText>
            <AppButton title="Add Vehicle" onPress={handleAddVehicle} size="sm" icon="plus" />
          </View>
          <AppText style={[styles.headerBandDetail, { color: colors.mutedForeground }]} numberOfLines={1}>
            Approved {statusCounts.approved} • Pending {statusCounts.pendingReview} • Rejected {statusCounts.rejected}
          </AppText>
        </View>

        <View style={styles.list}>
          {vehicles.map(vehicle => {
            const vehicleEntitlement = getVehicleEntitlement(entitlement, vehicle);
            const ridesLeft = getRideBalance(vehicleEntitlement);
            const totalRides = getActiveRideCredits(vehicleEntitlement);
            const bonusRidesLeft = getActiveBonusRides(vehicleEntitlement);
            const activePackage = getActivePackageActivation(vehicleEntitlement);
            const isApproved = vehicle.status === 'approved';
            const isCurrent = driverProfile?.activeVehicle?.vehicleId === vehicle.id;

            return (
            <View key={vehicle.id} style={[styles.card, { backgroundColor: cardFill }]}>
              <View style={styles.cardTop}>
                  <TouchableOpacity
                    style={styles.cardCopy}
                    onPress={() => router.push({ pathname: '/driver-vehicle-details', params: { vehicleId: vehicle.id } })}
                    activeOpacity={0.76}
                  >
                    <View style={styles.titleRow}>
                      <AppText style={[styles.vehicleType, { color: colors.foreground }]}>{VEHICLE_LABELS[vehicle.vehicleType]}</AppText>
                      <StatusChip colors={colors} status={vehicle.status} />
                      {isCurrent ? <StatusChip colors={colors} status="approved" label="Selected" /> : null}
                    </View>
                    <AppText style={[styles.vehicleMeta, { color: colors.mutedForeground }]}>
                      {vehicle.brand ? `${vehicle.brand} - ` : ''}
                      {vehicle.model ? `${vehicle.model} - ` : ''}
                      {vehicle.manufactureYear ?? 'Year pending'}
                    </AppText>
                    <AppText style={[styles.vehicleMeta, { color: colors.mutedForeground }]}>
                      Plate {vehicle.plateNumber}
                    </AppText>
                    <AppText style={[styles.vehicleMeta, { color: colors.mutedForeground }]}>
                      {isLoading ? 'Loading rides...' : `${ridesLeft} rides left`}
                      {bonusRidesLeft > 0 ? ` - ${bonusRidesLeft} bonus rides` : ''}
                    </AppText>
                    <AppText style={[styles.vehicleMeta, { color: colors.mutedForeground }]}>
                      {activePackage ? `${activePackage.packageName ?? activePackage.packageId} - ${totalRides} total rides available` : 'No active package'}
                    </AppText>
                    {vehicle.status === 'rejected' && vehicle.rejectionReason ? (
                      <AppText style={[styles.rejectionReason, { color: colors.destructive }]}>Rejected: {vehicle.rejectionReason}</AppText>
                    ) : null}
                    {vehicle.status === 'pending_review' ? (
                      <AppText style={[styles.vehicleState, { color: colors.warningHex }]}>Under Review</AppText>
                    ) : null}
                    {vehicle.status === 'draft' ? (
                      <AppText style={[styles.vehicleState, { color: colors.mutedForeground }]}>Draft</AppText>
                    ) : null}
                    <AppText style={[styles.detailLink, { color: colors.primary }]}>View details</AppText>
                  </TouchableOpacity>
                  <View style={styles.actionStack}>
                    {isApproved ? (
                      <AppButton
                        title={isCurrent ? 'Selected' : 'Use for session'}
                        onPress={() => void handleSelectVehicle(vehicle.id)}
                        size="sm"
                        compact
                        disabled={online || isCurrent}
                        variant={isCurrent ? 'secondary' : 'primary'}
                      />
                    ) : (
                      <AppButton
                        title={vehicle.status === 'rejected' ? 'Update Application' : 'View'}
                        onPress={() => router.push({ pathname: '/driver-add-vehicle', params: { sourceVehicleId: vehicle.id } })}
                        size="sm"
                        compact
                        variant="secondary"
                      />
                    )}
                    {!isApproved && vehicle.status === 'pending_review' ? (
                      <AppText style={[styles.subtleNote, { color: colors.mutedForeground }]}>Not selectable</AppText>
                    ) : null}
                    {online && !isCurrent && isApproved ? (
                      <AppText style={[styles.subtleNote, { color: colors.mutedForeground }]}>Go offline to switch</AppText>
                    ) : null}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </GlassScrollView>
    </View>
  );
}

function StatusChip({ colors, label, status }: { colors: ReturnType<typeof useColors>; label?: string; status: 'draft' | 'pending_review' | 'approved' | 'rejected'; }) {
  const resolvedLabel = label ?? (
    status === 'approved'
      ? 'Approved'
      : status === 'pending_review'
        ? 'Under Review'
        : status === 'draft'
          ? 'Draft'
          : 'Rejected'
  );
  const color = status === 'approved'
    ? colors.successHex
    : status === 'pending_review'
      ? colors.warningHex
      : status === 'draft'
        ? colors.mutedForeground
        : colors.destructiveHex;
  return (
    <View style={[styles.statusChip, { backgroundColor: color + '14' }]}>
      <AppText style={[styles.statusChipText, { color }]}>{resolvedLabel}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerBand: {
    marginHorizontal: semanticSpacing.cardPadding,
    marginBottom: spacing[14],
    paddingVertical: spacing[14],
    borderRadius: 18,
    gap: semanticSpacing.inlineGap,
  },
  headerBandTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: semanticSpacing.rowGap },
  headerBandTitle: { ...typography.title,  },
  headerBandDetail: { ...typography.caption,  },
  list: { gap: semanticSpacing.rowGap, paddingHorizontal: semanticSpacing.cardPadding },
  card: { borderRadius: 18, padding: 15, gap: semanticSpacing.rowGap },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: semanticSpacing.rowGap },
  cardCopy: { flex: 1, minWidth: 0, gap: 5 },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: semanticSpacing.inlineGap },
  vehicleType: { ...typography.title,  },
  vehicleMeta: { ...typography.tiny, lineHeight: 16 },
  rejectionReason: { ...typography.tiny, lineHeight: 16 },
  vehicleState: { ...typography.tiny,  },
  detailLink: { ...typography.tiny, marginTop: 2 },
  statusChip: { paddingHorizontal: semanticSpacing.inlineGap, paddingVertical: spacing[4], borderRadius: radius.pill },
  statusChipText: { ...typography.tiny,  },
  actionStack: { alignItems: 'flex-end', gap: 6 },
  subtleNote: { ...typography.tiny,  },
});
