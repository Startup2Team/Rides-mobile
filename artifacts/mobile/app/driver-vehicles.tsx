import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { GlassScrollView } from '@/components/GlassScrollView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { FORM_BOTTOM_PADDING } from '@/constants/tabBar';
import { useAuth } from '@/context/AuthContext';
import { useDriverEntitlement } from '@/context/DriverEntitlementContext';
import { getActiveBonusRides, getActivePackageActivation, getActiveRideCredits, getRideBalance, getVehicleEntitlement } from '@/domain/driverRidePackages';
import { getDriverVehicleStatusCounts, getDriverVehicles } from '@/domain/driverVehicles';
import { useColors } from '@/hooks/useColors';
import { VEHICLE_LABELS } from '@/types';

function formatRwf(amount: number) {
  return `${amount.toLocaleString('en-RW')} RWF`;
}

export default function DriverVehiclesScreen() {
  const colors = useColors();
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const { driverProfile, setActiveVehicle } = useAuth();
  const { entitlement, isLoading } = useDriverEntitlement();
  const params = useLocalSearchParams<{ sourceVehicleId?: string }>();

  const vehicles = getDriverVehicles(driverProfile);
  const statusCounts = getDriverVehicleStatusCounts(driverProfile);
  const cardFill = isDark ? '#1C1C1E' : '#FFFFFF';
  const online = driverProfile?.isOnline === true;
  const sourceVehicleId = typeof params.sourceVehicleId === 'string' ? params.sourceVehicleId : null;
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = React.useCallback(async () => {
    setIsRefreshing(true);
    const start = Date.now();
    try {
      // Simulate status check/reload delay
    } finally {
      const elapsed = Date.now() - start;
      const minDuration = process.env.NODE_ENV === 'test' ? 0 : 800;
      const remaining = minDuration - elapsed;
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }
      setIsRefreshing(false);
    }
  }, []);

  const handleSelectVehicle = async (vehicleId: string) => {
    if (online) return;
    await setActiveVehicle(vehicleId);
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
        subtitle="Manage your linked vehicles"
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
            <Text style={[styles.headerBandTitle, { color: colors.foreground }]}>
              {vehicles.length} linked vehicle{vehicles.length === 1 ? '' : 's'}
            </Text>
            <AppButton title="Add Vehicle" onPress={handleAddVehicle} size="sm" icon="plus" />
          </View>
          <Text style={[styles.headerBandDetail, { color: colors.mutedForeground }]} numberOfLines={1}>
            Approved {statusCounts.approved} • Pending {statusCounts.pendingReview} • Rejected {statusCounts.rejected}
          </Text>
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
                      <Text style={[styles.vehicleType, { color: colors.foreground }]}>{VEHICLE_LABELS[vehicle.vehicleType]}</Text>
                      <StatusChip colors={colors} status={vehicle.status} />
                      {isCurrent ? <StatusChip colors={colors} status="approved" label="Selected" /> : null}
                    </View>
                    <Text style={[styles.vehicleMeta, { color: colors.mutedForeground }]}>
                      {vehicle.brand ? `${vehicle.brand} - ` : ''}
                      {vehicle.model ? `${vehicle.model} - ` : ''}
                      {vehicle.manufactureYear ?? 'Year pending'}
                    </Text>
                    <Text style={[styles.vehicleMeta, { color: colors.mutedForeground }]}>
                      Plate {vehicle.plateNumber}
                    </Text>
                    <Text style={[styles.vehicleMeta, { color: colors.mutedForeground }]}>
                      {isLoading ? 'Loading rides...' : `${ridesLeft} rides left`}
                      {bonusRidesLeft > 0 ? ` - ${bonusRidesLeft} bonus rides` : ''}
                    </Text>
                    <Text style={[styles.vehicleMeta, { color: colors.mutedForeground }]}>
                      {activePackage ? `${activePackage.packageName ?? activePackage.packageId} - ${totalRides} total rides available` : 'No active package'}
                    </Text>
                    {vehicle.status === 'rejected' && vehicle.rejectionReason ? (
                      <Text style={[styles.rejectionReason, { color: colors.destructive }]}>Rejected: {vehicle.rejectionReason}</Text>
                    ) : null}
                    {vehicle.status === 'pending_review' ? (
                      <Text style={[styles.vehicleState, { color: colors.warningHex }]}>Under Review</Text>
                    ) : null}
                    {vehicle.status === 'draft' ? (
                      <Text style={[styles.vehicleState, { color: colors.mutedForeground }]}>Draft</Text>
                    ) : null}
                    <Text style={[styles.detailLink, { color: colors.primary }]}>View details</Text>
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
                      <Text style={[styles.subtleNote, { color: colors.mutedForeground }]}>Not selectable</Text>
                    ) : null}
                    {online && !isCurrent && isApproved ? (
                      <Text style={[styles.subtleNote, { color: colors.mutedForeground }]}>Go offline to switch</Text>
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
      <Text style={[styles.statusChipText, { color }]}>{resolvedLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerBand: {
    marginHorizontal: 16,
    marginBottom: 14,
    paddingVertical: 14,
    borderRadius: 18,
    gap: 8,
  },
  headerBandTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headerBandTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  headerBandDetail: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  list: { gap: 12, paddingHorizontal: 16 },
  card: { borderRadius: 18, padding: 15, gap: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardCopy: { flex: 1, minWidth: 0, gap: 5 },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  vehicleType: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  vehicleMeta: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 16 },
  rejectionReason: { fontSize: 11, fontFamily: 'Inter_600SemiBold', lineHeight: 16 },
  vehicleState: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  detailLink: { fontSize: 11, fontFamily: 'Inter_600SemiBold', marginTop: 2 },
  statusChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100 },
  statusChipText: { fontSize: 9, fontFamily: 'Inter_700Bold' },
  actionStack: { alignItems: 'flex-end', gap: 6 },
  subtleNote: { fontSize: 10, fontFamily: 'Inter_400Regular' },
});
