import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import {
  Alert,
  Animated,
  Image,
  Linking,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  type ImageSourcePropType,
  type LayoutChangeEvent,
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
import { updateDriverLocation, getDailyEarnings, getDriverStats, type DailyEarnings, type DriverStats } from '@/services/driverRides';
import { shouldSendLocation, IDLE_THROTTLE, type LocationSendState } from '@/utils/locationThrottle';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { useScreenTimerManager } from '@/hooks/useScreenTimerManager';
import { KIGALI_CENTER, VEHICLE_LABELS } from '@/types';
import { canDriverGoOnline } from '@/utils/driverVerification';
import { HOME_TAB_BAR_HEIGHT } from '@/components/home/homeUtils';
import { useDriverEntitlement } from '@/context/DriverEntitlementContext';
import { canDriverGoOnlineWithCredits } from '@/domain/driverRidePackages';
import { formatRwf, getDriverActivitySummary } from '@/domain/driverActivitySummary';
import { getDriverRatingSummary, type DriverRatingSummary } from '@/domain/driverWallet';
import { buttonCornerRadius, BUTTON_HEIGHT } from '@/constants/buttons';
import { DRIVER_CTA_PILL_WIDTH } from '@/constants/homeDriverCta';
import { loadStoredDriverRatings } from '@/persistence/driverRatingPersistence';
import { loadStoredProfileImage } from '@/persistence/profilePersistence';

const MAP_TYPES = ['standard', 'satellite', 'hybrid'] as const;
type AppMapType = typeof MAP_TYPES[number];
const CTA_AVATAR_SIZE = 34;
const CTA_AVATAR_INSET = 5;
const CTA_LEFT_WIDTH = CTA_AVATAR_INSET + CTA_AVATAR_SIZE + 6;
const CTA_PILL_PADDING_RIGHT = 6;
const CTA_LABEL_SLOT_WIDTH = DRIVER_CTA_PILL_WIDTH - CTA_LEFT_WIDTH - CTA_PILL_PADDING_RIGHT;
const CTA_SLIDE_THRESHOLD_RATIO = 0.7;
const EMPTY_RATING_SUMMARY: DriverRatingSummary = { averageRating: null, ratingCount: 0 };
const MAP_VISIBLE_DELTA = { latitudeDelta: 0.015, longitudeDelta: 0.015 };

function visibleDriverRegion(location: typeof KIGALI_CENTER) {
  return {
    ...location,
    ...MAP_VISIBLE_DELTA,
  };
}

const DASHBOARD_ADS: Array<{
  id: string;
  accessibilityLabel: string;
  image: ImageSourcePropType;
  url: string;
}> = [
  {
    id: 'airtel',
    accessibilityLabel: 'Open Airtel advertisement',
    image: require('../../assets/ads/dashboard/airtel.jpg'),
    url: 'https://www.airtel.co.rw/',
  },
  {
    id: 'bk',
    accessibilityLabel: 'Open Bank of Kigali advertisement',
    image: require('../../assets/ads/dashboard/bk.jpg'),
    url: 'https://www.bk.rw/',
  },
  {
    id: 'jibu',
    accessibilityLabel: 'Open Jibu advertisement',
    image: require('../../assets/ads/dashboard/jibu.jpg'),
    url: 'https://jibuco.com/',
  },
];
const DRIVER_DASHBOARD_IMAGE_SOURCES: ImageSourcePropType[] = [
  require('../../assets/images/dashboard/verified_badge.png'),
  ...DASHBOARD_ADS.map(ad => ad.image),
];

function prefetchImageSource(source: ImageSourcePropType) {
  if (typeof Image.resolveAssetSource !== 'function' || typeof Image.prefetch !== 'function') return;
  const uri = Image.resolveAssetSource(source)?.uri;
  if (uri) void Image.prefetch(uri).catch(() => {});
}

export default function DriverDashboard() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
  const { user, driverProfile, saveDriverProfile, setDriverOnline, switchMode } = useAuth();
  const { entitlement, isLoading: isEntitlementLoading, rideCredits } = useDriverEntitlement();
  const {
    pendingRequest,
    rideHistory,
    loadHistory,
    initDriverSession,
    acceptRideRequest,
    declineRideRequest,
  } = useRide();

  const [showRequest, setShowRequest] = useState(false);
  const [countdown, setCountdown] = useState(15);
  const [driverLocation, setDriverLocation] = useState(KIGALI_CENTER);
  const [mapType, setMapType] = useState<AppMapType>('standard');
  const [profileImage, setProfileImage] = useState<string | null>(driverProfile?.profileImage ?? null);
  const [ratingSummary, setRatingSummary] = useState<DriverRatingSummary>(EMPTY_RATING_SUMMARY);
  const [adCarouselWidth, setAdCarouselWidth] = useState(0);
  const [dashboardCardHeight, setDashboardCardHeight] = useState(0);

  const timers = useScreenTimerManager();
  const adCarouselRef = useRef<ScrollView>(null);
  const autoAdIndexRef = useRef(0);
  const adLoopResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSessionRef = useRef(timers.currentSession());
  const requestTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownValueRef = useRef(15);
  // True once we have a real device GPS fix (vs the KIGALI_CENTER placeholder).
  const hasGpsFixRef = useRef(false);
  const switchModeTrackWidthRef = useRef(DRIVER_CTA_PILL_WIDTH);
  const slideAnim = useRef(new Animated.Value(300)).current;
  const onlineScale = useRef(new Animated.Value(1)).current;
  const switchModeAvatarSlide = useRef(new Animated.Value(0)).current;
  const mapRef = useRef<MapView | null>(null);
  // Gate imperative map commands until the native view is committed (Fabric
  // dispatches to an uncommitted MapView segfault — see ride.tsx).
  const [mapReady, setMapReady] = useState(false);
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);

  const cardFill = isDark ? '#1C1C1E' : '#FFFFFF';
  const tabBarHeight = Platform.OS === 'web' ? HOME_TAB_BAR_HEIGHT : HOME_TAB_BAR_HEIGHT + insets.bottom;
  const isOnline = driverProfile?.isOnline === true;

  useEffect(() => {
    DRIVER_DASHBOARD_IMAGE_SOURCES.forEach(prefetchImageSource);
  }, []);

  useEffect(() => {
    if (driverProfile?.profileImage) setProfileImage(driverProfile.profileImage);
  }, [driverProfile?.profileImage]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadStoredProfileImage().then(stored => {
        if (active) setProfileImage(stored.data ?? driverProfile?.profileImage ?? null);
      });
      void loadStoredDriverRatings().then(stored => {
        if (active) {
          setRatingSummary(user?.id ? getDriverRatingSummary(stored.data ?? [], user.id) : EMPTY_RATING_SUMMARY);
        }
      });
      return () => {
        active = false;
      };
    }, [driverProfile?.profileImage, user?.id]),
  );

  // Location
  useEffect(() => {
    let mounted = true;
    const setCoords = (coords: { latitude: number; longitude: number }) => {
      if (!mounted) return;
      hasGpsFixRef.current = true; // we now have a real fix — safe to post it
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

  // Authoritative driver figures from the backend — the local activity summary
  // is computed from the customer ride history, which is the wrong dataset for
  // a driver, so it always read 0.
  const [daily, setDaily] = useState<DailyEarnings | null>(null);
  const [serverStats, setServerStats] = useState<DriverStats | null>(null);
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        try {
          const [d, s] = await Promise.all([getDailyEarnings(), getDriverStats()]);
          if (!cancelled) { setDaily(d); setServerStats(s); }
        } catch {
          // keep nulls — UI falls back to local values
        }
      })();
      return () => { cancelled = true; };
    }, []),
  );

  // Ad carousel auto-scroll (develop dashboard UI).
  useEffect(() => {
    if (adCarouselWidth <= 0 || DASHBOARD_ADS.length <= 1) return;

    const interval = setInterval(() => {
      const nextIndex = autoAdIndexRef.current + 1;
      autoAdIndexRef.current = nextIndex;
      adCarouselRef.current?.scrollTo({ x: nextIndex * adCarouselWidth, animated: true });

      if (nextIndex === DASHBOARD_ADS.length) {
        adLoopResetRef.current = setTimeout(() => {
          autoAdIndexRef.current = 0;
          adCarouselRef.current?.scrollTo({ x: 0, animated: false });
        }, 450);
      }
    }, 5000);

    return () => {
      clearInterval(interval);
      if (adLoopResetRef.current) {
        clearTimeout(adLoopResetRef.current);
        adLoopResetRef.current = null;
      }
    };
  }, [adCarouselWidth]);

  // Recenter on location (mapReady-gated to avoid the Fabric command crash).
  useEffect(() => {
    if (!mapReady) return;
    mapRef.current?.animateToRegion({ ...driverLocation, latitudeDelta: 0.015, longitudeDelta: 0.015 }, 350);
  }, [driverLocation, mapReady]);

  // Connect the driver session (WS) and post location periodically while online
  // so the backend matching engine can find this driver and deliver requests.
  const lastLocationSentRef = useRef<LocationSendState | null>(null);
  useEffect(() => {
    if (!isOnline) {
      lastLocationSentRef.current = null;
      return;
    }
    initDriverSession();
    const coords = { latitude: driverLocation.latitude, longitude: driverLocation.longitude };
    // Idle drivers are usually parked, so only post when they've moved ~100m or
    // as a 60s heartbeat — instead of re-sending the same point every 12s.
    const maybeSend = () => {
      // Never post the KIGALI_CENTER placeholder — it's ~5km off and trips the
      // server's GPS-plausibility guard. Wait for a real GPS fix.
      if (!hasGpsFixRef.current) return;
      const now = Date.now();
      if (shouldSendLocation(lastLocationSentRef.current, coords, now, IDLE_THROTTLE)) {
        lastLocationSentRef.current = { lat: coords.latitude, lng: coords.longitude, sentAt: now };
        void updateDriverLocation(coords.latitude, coords.longitude).catch(() => {});
      }
    };
    maybeSend();
    const interval = setInterval(maybeSend, 15000);
    return () => clearInterval(interval);
  }, [isOnline, initDriverSession, driverLocation.latitude, driverLocation.longitude]);

  const handleDecline = useCallback(() => {
    Animated.timing(slideAnim, { toValue: 300, duration: 300, useNativeDriver: true }).start(() => {
      setShowRequest(false);
      setCountdown(15);
    });
    if (driverProfile) saveDriverProfile({ ...driverProfile, dailyDeclines: (driverProfile.dailyDeclines ?? 0) + 1 });
    declineRideRequest();
  }, [slideAnim, driverProfile, saveDriverProfile, declineRideRequest]);

  const handleAccept = useCallback(() => {
    acceptRideRequest();
    router.push('/driver-negotiation');
  }, [acceptRideRequest]);

  // Show the incoming-request card when a real request arrives over the WS,
  // with a 15-second auto-decline countdown.
  useEffect(() => {
    if (!pendingRequest) {
      setShowRequest(false);
      setCountdown(15);
      return;
    }
    setShowRequest(true);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }).start();
    countdownValueRef.current = 15;
    setCountdown(15);
    const interval = setInterval(() => {
      const next = Math.max(0, countdownValueRef.current - 1);
      countdownValueRef.current = next;
      setCountdown(next);
      if (next <= 0) {
        clearInterval(interval);
        handleDecline();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [pendingRequest, slideAnim, handleDecline]);

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
    setDriverOnline(next).catch((err: Error) => {
      Alert.alert('Connection Error', err.message);
    });
  };

  const recenterMap = () => {
    if (!mapReady) return;
    mapRef.current?.animateToRegion({ ...driverLocation, latitudeDelta: 0.015, longitudeDelta: 0.015 }, 350);
  };

  const cycleMapType = () => {
    setMapType(prev => MAP_TYPES[(MAP_TYPES.indexOf(prev) + 1) % MAP_TYPES.length]);
  };

  const openAdWebsite = (url: string) => {
    void Linking.openURL(url);
  };

  const onAdCarouselLayout = (event: LayoutChangeEvent) => {
    setAdCarouselWidth(event.nativeEvent.layout.width);
  };

  const onStatusCardLayout = (event: LayoutChangeEvent) => {
    setDashboardCardHeight(event.nativeEvent.layout.height);
  };

  const driverName = user?.name?.split(' ')[0] ?? 'Driver';
  const driverInitial = user?.name?.trim().charAt(0).toUpperCase() || 'D';
  const activeVehicleType = driverProfile?.vehicleType ?? 'moto';
  const remainingCreditsText = isEntitlementLoading ? '-' : String(rideCredits);
  const statusLabel = isOnline ? 'Online' : 'Offline';
  const isVerified = driverProfile?.isVerified === true;
  const ratingLabel = ratingSummary.ratingCount > 0 && ratingSummary.averageRating !== null
    ? ratingSummary.averageRating.toFixed(1)
    : '0.0';
  const showNoCreditsWarning = !isEntitlementLoading && rideCredits === 0;
  const request = pendingRequest;
  const requestDestinationLabel = request?.destination.locationType === 'generic'
    ? 'Unknown - to be negotiated'
    : request?.destination.address;

  const getSwitchModeSlideEnd = useCallback(() => (
    Math.max(
      0,
      switchModeTrackWidthRef.current - CTA_AVATAR_SIZE - (CTA_AVATAR_INSET * 2) - CTA_PILL_PADDING_RIGHT,
    )
  ), []);

  const isSwitchModeAvatarStart = useCallback((locationX: number | undefined) => (
    typeof locationX === 'number' && locationX >= 0 && locationX <= CTA_AVATAR_INSET + CTA_AVATAR_SIZE
  ), []);

  const setSwitchModeSlideValue = useCallback((nextX: number) => {
    switchModeAvatarSlide.setValue(nextX);
  }, [switchModeAvatarSlide]);

  const animateSwitchAvatarToStart = useCallback(() => {
    Animated.spring(switchModeAvatarSlide, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 8,
      speed: 18,
    }).start();
  }, [switchModeAvatarSlide]);

  const handleSwitchToCustomer = useCallback(async () => {
    if (isSwitchingMode) return;
    setIsSwitchingMode(true);
    Animated.timing(switchModeAvatarSlide, {
      toValue: getSwitchModeSlideEnd(),
      duration: 240,
      useNativeDriver: true,
    }).start(() => {
      void (async () => {
        await switchMode('customer');
        router.replace('/(tabs)');
        switchModeAvatarSlide.setValue(0);
        setIsSwitchingMode(false);
      })();
    });
  }, [getSwitchModeSlideEnd, isSwitchingMode, switchMode, switchModeAvatarSlide]);

  const handleSwitchModeCtaLayout = useCallback((event: LayoutChangeEvent) => {
    switchModeTrackWidthRef.current = event.nativeEvent.layout.width;
  }, []);

  const switchModePanResponder = React.useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: event =>
        !isSwitchingMode && isSwitchModeAvatarStart(event.nativeEvent.locationX),
      onMoveShouldSetPanResponder: (_, gestureState) =>
        !isSwitchingMode && Math.abs(gestureState.dx) > 2 && Math.abs(gestureState.dx) >= Math.abs(gestureState.dy),
      onPanResponderGrant: () => {
        if (isSwitchingMode) return;
        switchModeAvatarSlide.stopAnimation();
      },
      onPanResponderMove: (_, gestureState) => {
        if (isSwitchingMode) return;
        const slideEnd = getSwitchModeSlideEnd();
        const nextX = Math.min(slideEnd, Math.max(0, gestureState.dx));
        setSwitchModeSlideValue(nextX);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (isSwitchingMode) return;
        const slideEnd = getSwitchModeSlideEnd();
        const threshold = slideEnd * CTA_SLIDE_THRESHOLD_RATIO;
        if (gestureState.dx >= threshold) {
          void handleSwitchToCustomer();
          return;
        }
        animateSwitchAvatarToStart();
      },
      onPanResponderTerminate: () => {
        if (!isSwitchingMode) animateSwitchAvatarToStart();
      },
      onPanResponderTerminationRequest: () => false,
    }),
    [
      animateSwitchAvatarToStart,
      getSwitchModeSlideEnd,
      handleSwitchToCustomer,
      isSwitchingMode,
      isSwitchModeAvatarStart,
      setSwitchModeSlideValue,
      switchModeAvatarSlide,
    ],
  );

  const switchModeLabelMaskScale = typeof switchModeAvatarSlide.interpolate === 'function'
    ? switchModeAvatarSlide.interpolate({
      inputRange: [0, CTA_LABEL_SLOT_WIDTH],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    })
    : 0;
  const switchModeLabelMaskTranslateX = typeof switchModeAvatarSlide.interpolate === 'function'
    ? switchModeAvatarSlide.interpolate({
      inputRange: [0, CTA_LABEL_SLOT_WIDTH],
      outputRange: [-CTA_LABEL_SLOT_WIDTH / 2, 0],
      extrapolate: 'clamp',
    })
    : -CTA_LABEL_SLOT_WIDTH / 2;

  return (
    <View style={styles.root}>

      {/* ── Full-screen map ── */}
      <MapView
        ref={mapRef}
        style={[StyleSheet.absoluteFill, { top: dashboardCardHeight }]}
        provider={PROVIDER_DEFAULT}
        onMapReady={() => setMapReady(true)}
        mapType={mapType}
        initialRegion={visibleDriverRegion(driverLocation)}
        customMapStyle={mapType === 'standard' ? darkMapStyle : undefined}
        showsUserLocation={false}
        showsMyLocationButton={false}
      >
        <Marker coordinate={driverLocation} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={styles.driverMarker}>
            <VehicleMapMarker type={activeVehicleType} style={styles.driverVehicleMarker} />
          </View>
        </Marker>
        {request ? (
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
        ) : null}
      </MapView>

      {/* Top dashboard overlay */}
      <View style={[styles.topBar, { paddingTop: Platform.OS === 'web' ? 67 : 0 }]}>
        <View
          style={[styles.statusCard, { backgroundColor: cardFill, paddingTop: insets.top + 14 }]}
          onLayout={onStatusCardLayout}
          testID="driver-status-card"
        >
          <View style={styles.statusHeader}>
            <View style={styles.statusIdentity} testID="driver-identity-block">
              <View style={styles.greetingRow}>
                <Text style={[styles.statusGreeting, { color: colors.foreground }]} numberOfLines={1}>
                  Hi, {driverName}
                </Text>
                {isVerified && (
                  <VerifiedBadge
                    testID="driver-verified-badge"
                  />
                )}
                <TouchableOpacity
                  style={styles.notificationButton}
                  onPress={() => router.push('/notifications')}
                  activeOpacity={0.65}
                  accessibilityRole="button"
                  accessibilityLabel="Notifications"
                >
                  <Feather name="bell" size={17} color={colors.foreground} />
                </TouchableOpacity>
              </View>
              <View style={styles.identityChipRow}>
                <View style={styles.identityItem}>
                  <VehicleMapMarker compact type={activeVehicleType} />
                </View>
                <View style={[styles.metadataSeparator, { backgroundColor: colors.border }]} />
                <View style={styles.identityItem}>
                  <MaterialCommunityIcons name="star" size={14} color={colors.star} />
                  <Text style={[styles.identityChipText, { color: colors.foreground }]}>{ratingLabel}</Text>
                </View>
                <View style={[styles.metadataSeparator, { backgroundColor: colors.border }]} />
                <View style={styles.identityItem} testID="driver-header-status">
                  <View style={[styles.onlineDot, { backgroundColor: isOnline ? colors.successHex : colors.primaryHex }]} />
                  <Text style={[styles.identityChipText, { color: isOnline ? colors.successHex : colors.mutedForeground }]}>
                    {statusLabel}
                  </Text>
                </View>
              </View>
            </View>
            <View
              style={[
                styles.switchModeQuickAction,
                {
                  width: DRIVER_CTA_PILL_WIDTH,
                  backgroundColor: colors.primary,
                  shadowOpacity: isDark ? 0.4 : 0.22,
                },
              ]}
              onLayout={handleSwitchModeCtaLayout}
              accessibilityRole="button"
              accessibilityLabel="Slide to switch to customer mode"
              accessibilityActions={[{ name: 'activate', label: 'Switch to customer mode' }]}
              onAccessibilityAction={event => {
                if (event.nativeEvent.actionName === 'activate') void handleSwitchToCustomer();
              }}
              onAccessibilityTap={() => void handleSwitchToCustomer()}
              {...switchModePanResponder.panHandlers}
            >
              <View
                style={styles.switchModeAvatarInset}
                testID="switch-mode-avatar-drag-handle"
              >
                <Animated.View
                  style={[
                    styles.switchModeAvatarFrame,
                    { transform: [{ translateX: switchModeAvatarSlide }] },
                  ]}
                >
                  {profileImage ? (
                    <Image
                      key={profileImage}
                      source={{ uri: profileImage }}
                      style={styles.switchModeAvatarImage}
                    />
                  ) : (
                    <Text style={styles.switchModeAvatarText}>{driverInitial}</Text>
                  )}
                </Animated.View>
              </View>
              <Animated.View
                style={[
                  styles.switchModeLabelSlot,
                  { width: CTA_LABEL_SLOT_WIDTH },
                ]}
                pointerEvents="none"
              >
                <Text style={[styles.switchModeQuickActionText, { color: colors.primaryForeground }]} numberOfLines={1}>
                  Slide to Customer
                </Text>
                <Animated.View
                  style={[
                    styles.switchModeLabelMask,
                    {
                      backgroundColor: colors.primary,
                      transform: [
                        { translateX: switchModeLabelMaskTranslateX },
                        { scaleX: switchModeLabelMaskScale },
                      ],
                    },
                  ]}
                />
              </Animated.View>
            </View>
          </View>

          <Text style={[styles.activityTitle, { color: colors.foreground }]}>Today's Activity</Text>
          <View style={styles.activityGrid}>
            <View style={styles.activityStat}>
              <Text style={[styles.activityValue, { color: colors.foreground }]}>
                {daily ? formatRwf(daily.total_rwf) : '—'}
              </Text>
              <Text style={[styles.activityLabel, { color: colors.mutedForeground }]}>Earnings</Text>
            </View>
            <View style={[styles.activityDivider, { backgroundColor: colors.border }]} />
            <View style={styles.activityStat}>
              <Text style={[styles.activityValue, { color: colors.foreground }]}>
                {serverStats ? serverStats.total_rides : '—'}
              </Text>
              <Text style={[styles.activityLabel, { color: colors.mutedForeground }]}>Trips</Text>
            </View>
            <View style={[styles.activityDivider, { backgroundColor: colors.border }]} />
            <View style={styles.activityStat}>
              <Text style={[styles.activityValue, { color: colors.foreground }]}>{remainingCreditsText}</Text>
              <Text style={[styles.activityLabel, { color: colors.mutedForeground }]}>Credits Left</Text>
            </View>
          </View>

          {showNoCreditsWarning && (
            <View style={[styles.noCreditsPanel, { backgroundColor: colors.successHex + '12', borderColor: colors.successHex + '35' }]}>
              <View style={styles.noCreditsCopy}>
                <View style={styles.noCreditsTitleRow}>
                  <Feather name="layers" size={14} color={colors.success} />
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

        <View style={[styles.adCard, { backgroundColor: cardFill }]} onLayout={onAdCarouselLayout}>
          <ScrollView
            ref={adCarouselRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.adCarousel}
          >
            {[...DASHBOARD_ADS, DASHBOARD_ADS[0]].map((ad, index) => (
              <TouchableOpacity
                key={`${ad.id}-${index}`}
                style={[styles.adSlide, { width: Math.max(adCarouselWidth, 1) }]}
                onPress={() => openAdWebsite(ad.url)}
                activeOpacity={0.9}
                accessibilityRole="link"
                accessibilityLabel={ad.accessibilityLabel}
                testID={index < DASHBOARD_ADS.length ? `dashboard-ad-${ad.id}` : 'dashboard-ad-loop-first'}
              >
                <Image source={ad.image} style={styles.adImage} resizeMode="cover" />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* ── Map controls ── */}
      <View style={[styles.mapControls, { bottom: tabBarHeight - 8 }]}>
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
  statusHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  statusIdentity: { flex: 1, minWidth: 0, height: BUTTON_HEIGHT.sm, justifyContent: 'space-between' },
  statusGreeting: { fontSize: 17, lineHeight: 20, fontFamily: 'Inter_700Bold', flexShrink: 1 },
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: 2, minWidth: 0 },
  notificationButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  identityChipRow: { height: 22, flexDirection: 'row', alignItems: 'center', gap: 6, overflow: 'hidden' },
  identityItem: {
    height: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  identityChipText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  metadataSeparator: { width: 3, height: 3, borderRadius: 2, flexShrink: 0 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },
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
    zIndex: 3,
    elevation: 8,
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
    zIndex: 3,
    elevation: 8,
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
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
  },
  switchModeLabelMask: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: CTA_LABEL_SLOT_WIDTH,
    zIndex: 2,
  },
  switchModeQuickActionText: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold', lineHeight: 16, zIndex: 1 },
  statusDivider: { height: 1, marginVertical: 12 },
  activityTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', marginTop: 18, marginBottom: 10 },
  activityGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activityStat: { flex: 1, alignItems: 'center', minWidth: 0 },
  activityValue: { fontSize: 19, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  activityLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold', textAlign: 'center', marginTop: 3 },
  activityDivider: { width: 1, height: 30 },
  noCreditsPanel: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noCreditsCopy: { flex: 1, minWidth: 0 },
  noCreditsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  noCreditsTitle: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  noCreditsText: { fontSize: 11, fontFamily: 'Inter_500Medium', lineHeight: 15, marginTop: 1 },
  viewPackagesButton: {
    minHeight: 30,
    borderRadius: 15,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewPackagesButtonText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  adCard: {
    marginTop: 4,
    marginHorizontal: 6,
    borderRadius: 0,
    height: 128,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 8,
    ...Platform.select({ ios: { borderCurve: 'continuous' } }),
  },
  adCarousel: { flex: 1 },
  adSlide: { height: 128 },
  adImage: { width: '100%', height: '100%' },

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
  driverVehicleMarker: {},
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
