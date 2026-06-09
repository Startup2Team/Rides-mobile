import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import {
  Animated,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { useRide } from '@/context/RideContext';
import { VehicleMapMarker } from '@/components/VehicleMapMarker';
import { useScreenTimerManager } from '@/hooks/useScreenTimerManager';
import { KIGALI_CENTER, VEHICLE_LABELS } from '@/types';
import { canDriverGoOnline } from '@/utils/driverVerification';
import { HOME_TAB_BAR_HEIGHT } from '@/components/home/homeUtils';
import { useDriverEntitlement } from '@/context/DriverEntitlementContext';
import { canDriverGoOnlineWithCredits } from '@/domain/driverRidePackages';
import { formatRwf, getDriverActivitySummary } from '@/domain/driverActivitySummary';
import { buttonCornerRadius, BUTTON_HEIGHT } from '@/constants/buttons';
import { DRIVER_CTA_PILL_WIDTH } from '@/constants/homeDriverCta';
import { loadStoredProfileImage } from '@/persistence/profilePersistence';

const MAP_TYPES = ['standard', 'satellite', 'hybrid'] as const;
type AppMapType = typeof MAP_TYPES[number];
const CTA_AVATAR_SIZE = 34;
const CTA_AVATAR_INSET = 5;
const CTA_LEFT_WIDTH = CTA_AVATAR_INSET + CTA_AVATAR_SIZE + 6;
const CTA_PILL_PADDING_RIGHT = 6;
const CTA_LABEL_SLOT_WIDTH = DRIVER_CTA_PILL_WIDTH - CTA_LEFT_WIDTH - CTA_PILL_PADDING_RIGHT;

const DASHBOARD_CAMPAIGNS = [
  {
    id: 'growth-package',
    eyebrow: 'Growth Package',
    title: '75 Ride Credits',
    description: 'Most Popular Plan',
    icon: 'trending-up' as const,
  },
];

export default function DriverDashboard() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
  const { user, driverProfile, saveDriverProfile, setDriverOnline, switchMode } = useAuth();
  const { entitlement, isLoading: isEntitlementLoading } = useDriverEntitlement();
  const {
    pendingRequest,
    rideHistory,
    loadHistory,
    simulateIncomingRideRequest,
    acceptRideRequest,
    declineRideRequest,
  } = useRide();

  const [showRequest, setShowRequest] = useState(false);
  const [countdown, setCountdown] = useState(15);
  const [driverLocation, setDriverLocation] = useState(KIGALI_CENTER);
  const [mapType, setMapType] = useState<AppMapType>('standard');
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const timers = useScreenTimerManager();
  const requestSessionRef = useRef(timers.currentSession());
  const requestTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownValueRef = useRef(15);
  const slideAnim = useRef(new Animated.Value(300)).current;
  const onlineScale = useRef(new Animated.Value(1)).current;
  const mapRef = useRef<MapView | null>(null);

  const cardFill = isDark ? '#1C1C1E' : '#FFFFFF';
  const tabBarHeight = Platform.OS === 'web' ? HOME_TAB_BAR_HEIGHT : HOME_TAB_BAR_HEIGHT + insets.bottom;
  const isOnline = driverProfile?.isOnline === true;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadStoredProfileImage().then(stored => {
        if (active) setProfileImage(stored.data);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  // Location
  useEffect(() => {
    let mounted = true;
    const setCoords = (coords: { latitude: number; longitude: number }) => {
      if (!mounted) return;
      setDriverLocation(coords);
    };
    const resolveNativeLocation = async () => {
      const permission = await Location.getForegroundPermissionsAsync();
      const finalPermission = permission.granted ? permission : await Location.requestForegroundPermissionsAsync();
      if (!finalPermission.granted) return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    };
    if (Platform.OS === 'web') {
      navigator.geolocation?.getCurrentPosition(
        p => setCoords({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
        () => {},
        { enableHighAccuracy: true },
      );
    } else {
      resolveNativeLocation().catch(() => {});
    }
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  // Recenter on location
  useEffect(() => {
    mapRef.current?.animateToRegion({ ...driverLocation, latitudeDelta: 0.015, longitudeDelta: 0.015 }, 350);
  }, [driverLocation]);

  // Ride request simulation
  useEffect(() => {
    const clearRequestTimers = () => {
      timers.clearTimeout(requestTimeoutRef.current);
      timers.clearInterval(countdownRef.current);
      requestTimeoutRef.current = null;
      countdownRef.current = null;
    };
    clearRequestTimers();
    requestSessionRef.current = timers.startSession();
    if (!isOnline) { setShowRequest(false); setCountdown(15); return; }
    const session = requestSessionRef.current;
    requestTimeoutRef.current = timers.scheduleTimeout(() => {
      requestTimeoutRef.current = null;
      simulateIncomingRideRequest();
      setShowRequest(true);
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }).start();
      countdownValueRef.current = 15;
      setCountdown(15);
      countdownRef.current = timers.scheduleInterval(() => {
        const nextCountdown = Math.max(0, countdownValueRef.current - 1);
        countdownValueRef.current = nextCountdown;
        setCountdown(nextCountdown);
        if (nextCountdown <= 0) {
          timers.clearInterval(countdownRef.current);
          countdownRef.current = null;
          handleDecline();
        }
      }, 1000, session);
    }, 5000, session);
    return clearRequestTimers;
  }, [isOnline, simulateIncomingRideRequest, timers]);

  const handleDecline = () => {
    timers.clearInterval(countdownRef.current);
    countdownRef.current = null;
    Animated.timing(slideAnim, { toValue: 300, duration: 300, useNativeDriver: true }).start(() => {
      setShowRequest(false);
      setCountdown(15);
    });
    if (driverProfile) saveDriverProfile({ ...driverProfile, dailyDeclines: (driverProfile.dailyDeclines ?? 0) + 1 });
    declineRideRequest();
  };

  const handleAccept = () => {
    timers.clearInterval(countdownRef.current);
    countdownRef.current = null;
    acceptRideRequest();
    router.push('/driver-negotiation');
  };

  const toggleOnline = () => {
    const next = !isOnline;
    if (next && isEntitlementLoading) return;
    if (next && canDriverGoOnline(driverProfile) && !canDriverGoOnlineWithCredits(driverProfile, entitlement)) {
      router.push('/driver-packages');
      return;
    }
    if (next && !canDriverGoOnline(driverProfile)) {
      return;
    }
    // Pulse animation on toggle
    Animated.sequence([
      Animated.timing(onlineScale, { toValue: 0.93, duration: 80, useNativeDriver: true }),
      Animated.spring(onlineScale, { toValue: 1, useNativeDriver: true, bounciness: 12 }),
    ]).start();
    void setDriverOnline(next);
  };

  const recenterMap = () => {
    mapRef.current?.animateToRegion({ ...driverLocation, latitudeDelta: 0.015, longitudeDelta: 0.015 }, 350);
  };

  const cycleMapType = () => {
    setMapType(prev => MAP_TYPES[(MAP_TYPES.indexOf(prev) + 1) % MAP_TYPES.length]);
  };

  const driverName = user?.name?.split(' ')[0] ?? 'Driver';
  const driverInitial = user?.name?.trim().charAt(0).toUpperCase() || 'D';
  const activeVehicleType = driverProfile?.vehicleType ?? 'moto';
  const activitySummary = getDriverActivitySummary({ driverId: user?.id, driverProfile, entitlement, rideHistory });
  const remainingCreditsText = isEntitlementLoading ? '-' : String(activitySummary.remainingRideCredits);
  const statusLabel = isOnline ? 'Online' : 'Offline';
  const statusDescription = isOnline ? 'Accepting rides' : 'Not accepting rides';
  const showNoCreditsWarning = !isEntitlementLoading && activitySummary.remainingRideCredits === 0;
  const activeCampaign = DASHBOARD_CAMPAIGNS[0];
  const request = pendingRequest;
  const requestDestinationLabel = request?.destination.locationType === 'generic'
    ? 'Unknown - to be negotiated'
    : request?.destination.address;

  const handleSwitchToCustomer = async () => {
    await switchMode('customer');
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.root}>

      {/* ── Full-screen map ── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        mapType={mapType}
        initialRegion={{ ...driverLocation, latitudeDelta: 0.015, longitudeDelta: 0.015 }}
        customMapStyle={mapType === 'standard' ? darkMapStyle : undefined}
        showsUserLocation={false}
        showsMyLocationButton={false}
      >
        <Marker coordinate={driverLocation} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={styles.driverMarker}>
            <View style={[styles.youAreHereBubble, { backgroundColor: colors.primary }]}>
              <Text style={styles.youAreHereText}>You're Here</Text>
            </View>
            <View style={[styles.youAreHereTail, { borderTopColor: colors.primary }]} />
            <VehicleMapMarker type={activeVehicleType} style={styles.driverVehicleMarker} />
          </View>
        </Marker>
        {request && (
          <>
            <Marker coordinate={request.pickup}>
              <View style={[styles.pickupPin, { backgroundColor: colors.primary }]}>
                <Feather name="user" size={12} color={colors.primaryForeground} />
              </View>
            </Marker>
            <Polyline
              coordinates={[driverLocation, request.pickup]}
              strokeColor={colors.destructiveHex}
              strokeWidth={3}
              lineDashPattern={[8, 4]}
            />
          </>
        )}
      </MapView>

      {/* Top dashboard overlay */}
      <View style={[styles.topBar, { paddingTop: Platform.OS === 'web' ? 67 : 0 }]}>
        <View style={[styles.statusCard, { backgroundColor: cardFill, paddingTop: insets.top + 14 }]} testID="driver-status-card">
          <View style={styles.statusHeader}>
            <View style={styles.statusIdentity}>
              <Text style={[styles.statusGreeting, { color: colors.foreground }]}>Hi, {driverName}</Text>
              <Text style={[styles.statusVehicle, { color: colors.mutedForeground }]}>
                {driverProfile ? VEHICLE_LABELS[driverProfile.vehicleType] : 'Driver'} Driver
              </Text>
              <View style={styles.statusPillRow}>
                <View style={[styles.onlineDot, { backgroundColor: isOnline ? colors.successHex : colors.primary }]} />
                <Text style={[styles.statusText, { color: colors.foreground }]}>{statusLabel}</Text>
                <Text style={[styles.statusMutedText, { color: colors.mutedForeground }]}>{statusDescription}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[
                styles.switchModeQuickAction,
                {
                  width: DRIVER_CTA_PILL_WIDTH,
                  backgroundColor: colors.primary,
                  shadowOpacity: isDark ? 0.4 : 0.22,
                },
              ]}
              onPress={handleSwitchToCustomer}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Switch to Customer"
            >
              <View style={styles.switchModeAvatarInset}>
                <View style={styles.switchModeAvatarFrame}>
                  {profileImage ? (
                    <Image
                      key={profileImage}
                      source={{ uri: profileImage }}
                      style={styles.switchModeAvatarImage}
                    />
                  ) : (
                    <Text style={styles.switchModeAvatarText}>{driverInitial}</Text>
                  )}
                </View>
              </View>
              <View style={[styles.switchModeLabelSlot, { width: CTA_LABEL_SLOT_WIDTH }]}>
                <Text style={[styles.switchModeQuickActionText, { color: colors.primaryForeground }]} numberOfLines={1}>
                  Customer Mode
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={[styles.statusDivider, { backgroundColor: colors.border }]} />

          <Text style={[styles.activityTitle, { color: colors.foreground }]}>Today's Activity</Text>
          <View style={styles.activityGrid}>
            <View style={styles.activityStat}>
              <Text style={[styles.activityValue, { color: colors.foreground }]}>
                {formatRwf(activitySummary.todayEarningsRwf)}
              </Text>
              <Text style={[styles.activityLabel, { color: colors.mutedForeground }]}>Activity Earnings</Text>
            </View>
            <View style={[styles.activityDivider, { backgroundColor: colors.border }]} />
            <View style={styles.activityStat}>
              <Text style={[styles.activityValue, { color: colors.foreground }]}>
                {activitySummary.completedRidesToday}
              </Text>
              <Text style={[styles.activityLabel, { color: colors.mutedForeground }]}>Completed Today</Text>
            </View>
            <View style={[styles.activityDivider, { backgroundColor: colors.border }]} />
            <View style={styles.activityStat}>
              <Text style={[styles.activityValue, { color: colors.foreground }]}>{remainingCreditsText}</Text>
              <Text style={[styles.activityLabel, { color: colors.mutedForeground }]}>Ride Credits</Text>
            </View>
          </View>

          {showNoCreditsWarning && (
            <View style={[styles.noCreditsPanel, { backgroundColor: colors.destructiveHex + '10', borderColor: colors.destructiveHex + '30' }]}>
              <View style={styles.noCreditsCopy}>
                <View style={styles.noCreditsTitleRow}>
                  <Feather name="alert-triangle" size={16} color={colors.destructive} />
                  <Text style={[styles.noCreditsTitle, { color: colors.foreground }]}>No Ride Credits</Text>
                </View>
                <Text style={[styles.noCreditsText, { color: colors.mutedForeground }]}>
                  Choose a package to start receiving ride requests.
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.viewPackagesButton, { backgroundColor: colors.primary }]}
                onPress={() => router.push('/driver-packages')}
                activeOpacity={0.8}
              >
                <Text style={[styles.viewPackagesButtonText, { color: colors.primaryForeground }]}>View Packages</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.campaignCard, { backgroundColor: cardFill }]}
          onPress={() => router.push('/driver-packages')}
          activeOpacity={0.85}
        >
          <View style={[styles.campaignIcon, { backgroundColor: colors.primaryHex + '16' }]}>
            <Feather name={activeCampaign.icon} size={20} color={colors.primary} />
          </View>
          <View style={styles.campaignCopy}>
            <Text style={[styles.campaignEyebrow, { color: colors.primary }]}>{activeCampaign.eyebrow}</Text>
            <Text style={[styles.campaignTitle, { color: colors.foreground }]}>{activeCampaign.title}</Text>
            <Text style={[styles.campaignDescription, { color: colors.mutedForeground }]}>{activeCampaign.description}</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {/* ── Map controls ── */}
      <View style={[styles.mapControls, { bottom: tabBarHeight + 16 }]}>
        <TouchableOpacity style={[styles.mapBtn, { backgroundColor: cardFill }]} onPress={cycleMapType} activeOpacity={0.8}>
          <MaterialCommunityIcons
            name={mapType === 'standard' ? 'layers-outline' : mapType === 'satellite' ? 'satellite-variant' : 'map'}
            size={22} color={colors.primary}
          />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.mapBtn, { backgroundColor: cardFill }]} onPress={recenterMap} activeOpacity={0.8}>
          <MaterialCommunityIcons name="crosshairs-gps" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* ── Go Online / Offline button above tab bar ── */}
      {!showRequest && (
        <View style={[styles.onlineBtnWrap, { bottom: tabBarHeight - 8 }]}>
          <Animated.View style={{ transform: [{ scale: onlineScale }] }}>
            <TouchableOpacity
              style={[
                styles.onlineBtn,
                {
                  backgroundColor: isOnline ? colors.destructive : colors.primary,
                  borderColor: isOnline ? colors.destructive : colors.primary,
                },
              ]}
              onPress={toggleOnline}
              disabled={isEntitlementLoading}
              activeOpacity={0.85}
            >
              <View style={[styles.onlineBtnDot, { backgroundColor: '#fff' }]} />
              <Text style={[styles.onlineBtnText, { color: '#fff' }]}>
                {isOnline ? 'Go Offline' : 'Go Online'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}

      {/* ── Incoming ride request sheet ── */}
      {showRequest && request && (
        <Animated.View
          style={[
            styles.requestSheet,
            {
              backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
              transform: [{ translateY: slideAnim }],
              paddingBottom: tabBarHeight + 16,
            },
          ]}
        >
          {/* Handle */}
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

          <View style={styles.requestHeader}>
            <View>
              <Text style={[styles.requestEyebrow, { color: colors.primary }]}>Incoming Ride</Text>
              <Text style={[styles.requestTitle, { color: colors.foreground }]}>{request.customerName ?? 'Customer'}</Text>
            </View>
            <View style={[styles.countdown, { backgroundColor: countdown <= 5 ? colors.destructive : colors.primary }]}>
              <Text style={styles.countdownText}>{countdown}s</Text>
            </View>
          </View>

          <View style={styles.requestRoute}>
            <View style={styles.routeRow}>
              <View style={[styles.routeDot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.routeText, { color: colors.foreground }]} numberOfLines={1}>{request.pickup.address}</Text>
            </View>
            <View style={[styles.routeConnector, { borderColor: colors.border }]} />
            <View style={styles.routeRow}>
              <View style={[styles.routeSquare, { backgroundColor: colors.destructive }]} />
              <Text style={[styles.routeText, { color: colors.foreground }]} numberOfLines={1}>{requestDestinationLabel}</Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={[styles.metaChip, { backgroundColor: isDark ? '#2C2C2E' : colors.muted }]}>
              <Feather name="map-pin" size={13} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{request.distance} km</Text>
            </View>
            <View style={[styles.metaChip, { backgroundColor: isDark ? '#2C2C2E' : colors.muted }]}>
              <Feather name="clock" size={13} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>~{request.duration ?? '-'} min</Text>
            </View>
          </View>

          <View style={styles.requestActions}>
            <TouchableOpacity
              style={[styles.reqBtn, { backgroundColor: colors.destructiveHex + '12', borderColor: colors.destructive }]}
              onPress={handleDecline}
              activeOpacity={0.8}
            >
              <Feather name="x" size={20} color={colors.destructive} />
              <Text style={[styles.reqBtnText, { color: colors.destructive }]}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.reqBtn, { backgroundColor: colors.primary, borderColor: colors.primary, flex: 1 }]}
              onPress={handleAccept}
              activeOpacity={0.8}
            >
              <Feather name="check" size={20} color={colors.primaryForeground} />
              <Text style={[styles.reqBtnText, { color: colors.primaryForeground }]}>Accept</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

    </View>
  );
}

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
];

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Top dashboard
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  statusCard: {
    borderRadius: 0,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    ...Platform.select({ ios: { borderCurve: 'continuous' } }),
  },
  statusHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  statusIdentity: { flex: 1, minWidth: 0 },
  statusGreeting: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  statusVehicle: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginTop: 2 },
  statusPillRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  onlineDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  statusText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  statusMutedText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  switchModeQuickAction: {
    height: BUTTON_HEIGHT.sm,
    borderRadius: buttonCornerRadius(BUTTON_HEIGHT.sm),
    paddingRight: CTA_PILL_PADDING_RIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 14,
    elevation: 6,
    ...Platform.select({
      ios: { borderCurve: 'continuous' },
      default: {},
    }),
  },
  switchModeAvatarInset: {
    marginLeft: CTA_AVATAR_INSET,
    marginVertical: CTA_AVATAR_INSET,
    flexShrink: 0,
  },
  switchModeAvatarFrame: {
    width: CTA_AVATAR_SIZE,
    height: CTA_AVATAR_SIZE,
    borderRadius: CTA_AVATAR_SIZE / 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.28,
    shadowRadius: 3,
    elevation: 4,
    ...Platform.select({
      ios: { borderCurve: 'continuous' },
      default: {},
    }),
  },
  switchModeAvatarImage: {
    width: CTA_AVATAR_SIZE,
    height: CTA_AVATAR_SIZE,
  },
  switchModeAvatarText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
  switchModeLabelSlot: {
    justifyContent: 'center',
    minWidth: 0,
    paddingLeft: 3,
  },
  switchModeQuickActionText: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold', lineHeight: 16 },
  statusDivider: { height: 1, marginVertical: 12 },
  activityTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', marginBottom: 10 },
  activityGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activityStat: { flex: 1, alignItems: 'center', minWidth: 0 },
  activityValue: { fontSize: 15, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  activityLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold', textAlign: 'center', marginTop: 3 },
  activityDivider: { width: 1, height: 30 },
  noCreditsPanel: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  noCreditsCopy: { flex: 1, minWidth: 0 },
  noCreditsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  noCreditsTitle: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  noCreditsText: { fontSize: 12, fontFamily: 'Inter_500Medium', lineHeight: 17, marginTop: 3 },
  viewPackagesButton: {
    minHeight: 36,
    borderRadius: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewPackagesButtonText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  campaignCard: {
    marginTop: 8,
    marginHorizontal: 8,
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 6,
    ...Platform.select({ ios: { borderCurve: 'continuous' } }),
  },
  campaignIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  campaignCopy: { flex: 1, minWidth: 0 },
  campaignEyebrow: { fontSize: 11, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  campaignTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', marginTop: 1 },
  campaignDescription: { fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 1 },

  // Map controls
  mapControls: { position: 'absolute', right: 16, gap: 10 },
  mapBtn: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 6, elevation: 6,
  },

  // Go Online button
  onlineBtnWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  onlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 36,
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  onlineBtnDot: { width: 9, height: 9, borderRadius: 5 },
  onlineBtnText: { fontSize: 17, fontFamily: 'Inter_700Bold' },

  // Driver marker
  driverMarker: { alignItems: 'center' },
  driverVehicleMarker: { marginTop: -14 },
  youAreHereBubble: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 4,
  },
  youAreHereText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  youAreHereTail: {
    width: 0, height: 0,
    borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 7,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    marginBottom: -2,
  },
  pickupPin: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  // Request sheet
  requestSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, paddingHorizontal: 20, gap: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.18, shadowRadius: 20, elevation: 20,
    ...Platform.select({ ios: { borderCurve: 'continuous' } }),
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  requestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  requestEyebrow: { fontSize: 11, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 0.6 },
  requestTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', marginTop: 2 },
  countdown: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  countdownText: { fontSize: 17, fontFamily: 'Inter_700Bold', color: '#fff' },
  requestRoute: { gap: 6 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  routeDot: { width: 11, height: 11, borderRadius: 6, flexShrink: 0 },
  routeSquare: { width: 11, height: 11, borderRadius: 3, flexShrink: 0 },
  routeConnector: { height: 18, borderLeftWidth: 2, borderStyle: 'dashed', marginLeft: 5 },
  routeText: { fontSize: 14, fontFamily: 'Inter_500Medium', flex: 1 },
  metaRow: { flexDirection: 'row', gap: 10 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 32, borderRadius: 16 },
  metaText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  requestActions: { flexDirection: 'row', gap: 12 },
  reqBtn: {
    flex: 0.45, flexDirection: 'row', height: 56,
    borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    gap: 8, borderWidth: 1.5,
  },
  reqBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
});
