import { router, useFocusEffect } from 'expo-router';
import React, { useCallback } from 'react';
import { Alert, Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { VEHICLE_LABELS } from '@/types';
import { useDriverEntitlement } from '@/context/DriverEntitlementContext';
import { formatDriverRatingSummary, getDriverRatingSummary, type DriverRatingSummary } from '@/domain/driverWallet';
import { DRIVER_RIDE_PACKAGES } from '@/domain/driverRidePackages';
import { loadStoredDriverRatings } from '@/persistence/driverRatingPersistence';
import { loadStoredProfileImage } from '@/persistence/profilePersistence';

const EMPTY_RATING_SUMMARY: DriverRatingSummary = { averageRating: null, ratingCount: 0 };

export default function DriverProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, driverProfile, logout, switchMode } = useAuth();
  const { entitlement, isLoading: isEntitlementLoading, rideCredits } = useDriverEntitlement();
  const activePackage = entitlement.activePackageId ? DRIVER_RIDE_PACKAGES[entitlement.activePackageId] : null;
  const [ratingSummary, setRatingSummary] = React.useState<DriverRatingSummary>(EMPTY_RATING_SUMMARY);
  const [profileImage, setProfileImage] = React.useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadStoredProfileImage().then(stored => {
        if (active) setProfileImage(stored.data ?? driverProfile?.profileImage ?? null);
      });
      return () => {
        active = false;
      };
    }, [driverProfile?.profileImage]),
  );

  React.useEffect(() => {
    let cancelled = false;
    async function loadRatingSummary() {
      const stored = await loadStoredDriverRatings();
      const summary = user?.id ? getDriverRatingSummary(stored.data ?? [], user.id) : EMPTY_RATING_SUMMARY;
      if (!cancelled) setRatingSummary(summary);
    }
    void loadRatingSummary();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleSwitchToCustomer = () => {
    Alert.alert('Switch Mode', 'Switch to customer mode?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Switch',
        onPress: async () => {
          try {
            await switchMode('customer');
            router.replace('/(tabs)');
          } catch {
            // switchMode('customer') is local-only and should never throw,
            // but guard anyway to prevent unhandled rejections.
          }
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

  const profileInitial = user?.name?.trim()?.[0]?.toUpperCase() ?? '?';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) + 16,
        paddingBottom: insets.bottom + (Platform.OS === 'web' ? 84 : 80) + 20,
      }}
    >
      <TouchableOpacity
        style={styles.avatarSection}
        onPress={() => router.push('/edit-profile')}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Edit profile"
      >
        {profileImage ? (
          <View style={styles.avatarImageShadow}>
            <Image source={{ uri: profileImage }} style={styles.avatarImage} />
          </View>
        ) : (
          <LinearGradient colors={['#9DBBE0', '#7984C3']} style={styles.avatar}>
            <Text style={styles.avatarInitial}>{profileInitial}</Text>
          </LinearGradient>
        )}
        <Text style={[styles.name, { color: colors.foreground }]}>{user?.name}</Text>
        <Text style={[styles.phone, { color: colors.mutedForeground }]}>{user?.phone}</Text>
        <View style={[styles.driverBadge, { backgroundColor: colors.primaryHex + '20' }]}>
          <Feather name="zap" size={12} color={colors.primary} />
          <Text style={[styles.driverBadgeText, { color: colors.primary }]}>Verified Driver</Text>
        </View>
        <Text style={[styles.ratingSummary, { color: colors.mutedForeground }]}>
          {formatDriverRatingSummary(ratingSummary)}
        </Text>
      </TouchableOpacity>

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
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Mobile Money Details</Text>
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
        onPress={() => router.push('/edit-profile')}
        activeOpacity={0.75}
      >
        <View style={[styles.switchModeIcon, { backgroundColor: colors.primaryHex + '15' }]}>
          <Feather name="edit-3" size={16} color={colors.primary} />
        </View>
        <Text style={[styles.switchModeText, { color: colors.foreground }]}>Edit Profile</Text>
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
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    backgroundColor: '#8FA8D4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
    ...Platform.select({
      web: { boxShadow: '0 6px 16px rgba(0,0,0,0.12)' },
    }),
  },
  avatarInitial: { fontSize: 42, fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', lineHeight: 48 },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  avatarImageShadow: {
    marginBottom: 8,
    borderRadius: 44,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 4,
    ...Platform.select({
      web: { boxShadow: '0 6px 16px rgba(0,0,0,0.16)' },
    }),
  },
  name: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  phone: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  driverBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  driverBadgeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  ratingSummary: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginTop: 2 },
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
