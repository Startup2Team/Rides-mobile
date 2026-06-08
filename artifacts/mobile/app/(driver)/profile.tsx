import { router } from 'expo-router';
import React from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { VEHICLE_LABELS } from '@/types';
import { useDriverEntitlement } from '@/context/DriverEntitlementContext';
import { DRIVER_RIDE_PACKAGES } from '@/domain/driverRidePackages';

export default function DriverProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, driverProfile, logout, switchMode } = useAuth();
  const { entitlement, isLoading: isEntitlementLoading, rideCredits } = useDriverEntitlement();
  const activePackage = entitlement.activePackageId ? DRIVER_RIDE_PACKAGES[entitlement.activePackageId] : null;

  const handleSwitchToCustomer = () => {
    Alert.alert('Switch Mode', 'Switch to customer mode?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Switch',
        onPress: async () => {
          await switchMode('customer');
          router.replace('/(tabs)');
        },
      },
    ]);
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', onPress: logout },
    ]);
  };

  const initials = user?.name?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() ?? 'DR';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) + 16,
        paddingBottom: insets.bottom + (Platform.OS === 'web' ? 84 : 80) + 20,
      }}
    >
      {/* Avatar */}
      <View style={styles.avatarSection}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={[styles.name, { color: colors.foreground }]}>{user?.name}</Text>
        <Text style={[styles.phone, { color: colors.mutedForeground }]}>{user?.phone}</Text>
        <View style={[styles.driverBadge, { backgroundColor: colors.primaryHex + '20' }]}>
          <Feather name="zap" size={12} color={colors.primary} />
          <Text style={[styles.driverBadgeText, { color: colors.primary }]}>Verified Driver</Text>
        </View>
      </View>

      {/* Vehicle info */}
      {driverProfile && (
        <View style={[styles.vehicleCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.mutedForeground }]}>VEHICLE INFO</Text>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Vehicle Type</Text>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>{VEHICLE_LABELS[driverProfile.vehicleType]}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Plate Number</Text>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>{driverProfile.plateNumber}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>License</Text>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>{driverProfile.licenseNumber}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>City</Text>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>{driverProfile.city}</Text>
          </View>
          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>MoMo Code</Text>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>{driverProfile.momoCode}</Text>
          </View>
        </View>
      )}

      <TouchableOpacity
        style={[styles.switchModeButton, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={handleSwitchToCustomer}
        activeOpacity={0.75}
      >
        <View style={[styles.switchModeIcon, { backgroundColor: colors.primaryHex + '15' }]}>
          <Feather name="user" size={16} color={colors.primary} />
        </View>
        <Text style={[styles.switchModeText, { color: colors.foreground }]}>Switch to Customer Mode</Text>
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.switchModeButton, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => router.push('/driver-packages')}
        activeOpacity={0.75}
      >
        <View style={[styles.switchModeIcon, { backgroundColor: colors.primaryHex + '15' }]}>
          <Feather name="layers" size={16} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.switchModeText, { color: colors.foreground }]}>{isEntitlementLoading ? 'Checking ride package...' : activePackage?.name ?? 'Choose Ride Package'}</Text>
          <Text style={[styles.packageSubtext, { color: colors.mutedForeground }]}>{isEntitlementLoading ? 'Checking ride balance...' : `${rideCredits} ride credits remaining`}</Text>
        </View>
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      </TouchableOpacity>

      <View style={[styles.menuSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]}>
          <Feather name="file-text" size={18} color={colors.foreground} />
          <Text style={[styles.menuText, { color: colors.foreground }]}>View Policy Documents</Text>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border, borderBottomWidth: 0 }]}>
          <Feather name="help-circle" size={18} color={colors.foreground} />
          <Text style={[styles.menuText, { color: colors.foreground }]}>Help & Support</Text>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <View style={[styles.menuSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.menuItem, { borderBottomColor: colors.border, borderBottomWidth: 0 }]}
          onPress={handleLogout}
        >
          <Feather name="log-out" size={18} color={colors.destructive} />
          <Text style={[styles.menuText, { color: colors.destructive }]}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  avatarSection: { alignItems: 'center', paddingHorizontal: 20, paddingBottom: 24, gap: 6 },
  avatar: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  avatarText: { fontSize: 32, fontFamily: 'Inter_700Bold', color: '#000' },
  name: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  phone: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  driverBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  driverBadgeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  vehicleCard: { marginHorizontal: 20, marginBottom: 16, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  cardTitle: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.8, padding: 14, paddingBottom: 8 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  infoLabel: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  infoValue: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  switchModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 14,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  switchModeIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchModeText: { flex: 1, fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  packageSubtext: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },
  menuSection: { marginHorizontal: 20, marginBottom: 16, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1 },
  menuText: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
});
