import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import {
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
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import { ProfileAvatarCircle } from '@/components/ProfileAvatarCircle';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { useRide } from '@/context/RideContext';
import { VehicleMapMarker } from '@/components/VehicleMapMarker';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { useScreenTimerManager } from '@/hooks/useScreenTimerManager';
import { KIGALI_CENTER } from '@/types';
import { canDriverGoOnline } from '@/utils/driverVerification';
import { showDeclineRideAlert } from '@/utils/declineRideAlert';
import { HOME_TAB_BAR_HEIGHT } from '@/components/home/homeUtils';
import { useDriverEntitlement } from '@/context/DriverEntitlementContext';
import { canDriverGoOnlineWithCredits } from '@/domain/driverRidePackages';
import { formatRwf, getDriverActivitySummary } from '@/domain/driverActivitySummary';
import { getDriverRatingSummary, type DriverRatingSummary } from '@/domain/driverWallet';
import { buttonCornerRadius, BUTTON_HEIGHT } from '@/constants/buttons';
import { DRIVER_CTA_PILL_WIDTH } from '@/constants/homeDriverCta';
import { loadStoredDriverRatings } from '@/persistence/driverRatingPersistence';
import { loadStoredProfileImage } from '@/persistence/profilePersistence';
import { loadNotificationReadState } from '@/persistence/notificationPersistence';
import {
  formatDistanceToPickup,
  formatRequestLocation,
  formatTripDistance,
  formatTripDuration,
} from '../driverRequestCard';

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
    id: 'jibu',
    accessibilityLabel: 'Open Jibu advertisement',
    image: require('../../assets/ads/dashboard/jibu.jpg'),
    url: 'https://jibuco.com/',
  },
  {
    id: 'bralirwa',
    accessibilityLabel: 'Open Bralirwa advertisement',
    image: require('../../assets/ads/bralirwa.png'),
    url: 'http://www.bralirwa.com/',
  },
];
const LOOPED_DASHBOARD_ADS = [
  DASHBOARD_ADS[DASHBOARD_ADS.length - 1],
  ...DASHBOARD_ADS,
  DASHBOARD_ADS[0],
];
const DRIVER_DASHBOARD_IMAGE_SOURCES: ImageSourcePropType[] = [
  require('../../assets/images/verified badge.png'),
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
  const { bonusRides, entitlement, isLoading: isEntitlementLoading, totalAvailableRides } = useDriverEntitlement();
  const {
    pendingRequest,
    rideHistory,
    loadHistory,
    simulateIncomingRideRequest,
    acceptRideRequest,
    declineRideRequest,
  } = useRide();

  const [countdown, setCountdown] = useState(15);
  const [driverLocation, setDriverLocation] = useState(KIGALI_CENTER);
  const [mapType, setMapType] = useState<AppMapType>('standard');
  const [profileImage, setProfileImage] = useState<string | null>(driverProfile?.profileImage ?? null);
  const [ratingSummary, setRatingSummary] = useState<DriverRatingSummary>(EMPTY_RATING_SUMMARY);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [adCarouselWidth, setAdCarouselWidth] = useState(0);
  const [dashboardCardHeight, setDashboardCardHeight] = useState(0);

  const timers = useScreenTimerManager();
  const adCarouselRef = useRef<ScrollView>(null);
  const autoAdIndexRef = useRef(1);
  const adLoopResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const adCarouselPositionedRef = useRef(false);
  const requestSessionRef = useRef(timers.currentSession());
  const requestTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownValueRef = useRef(15);
  const switchModeTrackWidthRef = useRef(DRIVER_CTA_PILL_WIDTH);
  const slideAnim = useRef(new Animated.Value(300)).current;
  const onlineScale = useRef(new Animated.Value(1)).current;
  const switchModeAvatarSlide = useRef(new Animated.Value(0)).current;
  const mapRef = useRef<MapView | null>(null);
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);

  const clearAdLoopReset = useCallback(() => {
    if (adLoopResetRef.current) {
      clearTimeout(adLoopResetRef.current);
      adLoopResetRef.current = null;
    }
  }, []);

  const resetAdCarouselToStart = useCallback(() => {
    autoAdIndexRef.current = 1;
    adCarouselRef.current?.scrollTo({ x: adCarouselWidth, animated: false });
  }, [adCarouselWidth]);

  const resetAdCarouselToEnd = useCallback(() => {
    autoAdIndexRef.current = DASHBOARD_ADS.length;
    adCarouselRef.current?.scrollTo({ x: DASHBOARD_ADS.length * adCarouselWidth, animated: false });
  }, [adCarouselWidth]);

  const positionAdCarouselAtStart = useCallback(() => {
    if (adCarouselWidth <= 0 || adCarouselPositionedRef.current) return;

    adCarouselPositionedRef.current = true;
    resetAdCarouselToStart();
  }, [adCarouselWidth, resetAdCarouselToStart]);

  const scheduleAdLoopReset = useCallback(() => {
    clearAdLoopReset();
    adLoopResetRef.current = setTimeout(() => {
      resetAdCarouselToStart();
      adLoopResetRef.current = null;
    }, 450);
  }, [clearAdLoopReset, resetAdCarouselToStart]);

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
      void loadNotificationReadState().then(state => {
        if (!active) return;
        const credits = totalAvailableRides;
        const hasUnread = Boolean(pendingRequest) || (!isEntitlementLoading && credits <= 5 && !state.read.has(`driver_low_credits_${credits}`)) || state.unread.size > 0;
        setHasUnreadNotifications(hasUnread);
      });
      return () => {
        active = false;
      };


    }, [driverProfile?.profileImage, isEntitlementLoading, pendingRequest, totalAvailableRides, user?.id]),
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

  useEffect(() => {
    positionAdCarouselAtStart();
  }, [positionAdCarouselAtStart]);

  useEffect(() => {
    if (adCarouselWidth <= 0 || DASHBOARD_ADS.length <= 1) return;

    const interval = setInterval(() => {
      const nextIndex = autoAdIndexRef.current + 1;
      autoAdIndexRef.current = nextIndex;
      adCarouselRef.current?.scrollTo({ x: nextIndex * adCarouselWidth, animated: true });

      if (nextIndex === DASHBOARD_ADS.length + 1) {
        scheduleAdLoopReset();
      }
    }, 5000);

    return () => {
      clearInterval(interval);
      clearAdLoopReset();
    };
  }, [adCarouselWidth, clearAdLoopReset, scheduleAdLoopReset]);

  // Recenter on location
  useEffect(() => {
    mapRef.current?.animateToRegion(visibleDriverRegion(driverLocation), 350);
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
    if (!isOnline) {
      slideAnim.setValue(300);
      setCountdown(15);
      declineRideRequest();
      return;
    }
    const session = requestSessionRef.current;
    requestTimeoutRef.current = timers.scheduleTimeout(() => {
      requestTimeoutRef.current = null;
      simulateIncomingRideRequest();
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
          confirmDecline();
        }
      }, 1000, session);
    }, 5000, session);
    return clearRequestTimers;
  }, [declineRideRequest, isOnline, simulateIncomingRideRequest, slideAnim, timers]);

  const confirmDecline = () => {
    timers.clearInterval(countdownRef.current);
    countdownRef.current = null;
    Animated.timing(slideAnim, { toValue: 300, duration: 300, useNativeDriver: true }).start(() => {
      setCountdown(15);
      declineRideRequest();
    });
    if (driverProfile) saveDriverProfile({ ...driverProfile, dailyDeclines: (driverProfile.dailyDeclines ?? 0) + 1 });
  };

  const handleDecline = () => {
    if (!pendingRequest) return;
    showDeclineRideAlert(confirmDecline);
  };

  const handleAccept = () => {
    if (!pendingRequest) return;
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
    mapRef.current?.animateToRegion(visibleDriverRegion(driverLocation), 350);
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

  const handleAdCarouselMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (adCarouselWidth <= 0) return;

    clearAdLoopReset();
    const pageIndex = Math.round(event.nativeEvent.contentOffset.x / adCarouselWidth);

    if (pageIndex <= 0) {
      resetAdCarouselToEnd();
      return;
    }

    if (pageIndex >= DASHBOARD_ADS.length + 1) {
      resetAdCarouselToStart();
      return;
    }

    autoAdIndexRef.current = pageIndex;
  };

  const onStatusCardLayout = (event: LayoutChangeEvent) => {
    setDashboardCardHeight(event.nativeEvent.layout.height);
  };

  const driverName = user?.name?.split(' ')[0] ?? 'Driver';
  const driverInitial = user?.name?.trim().charAt(0).toUpperCase() || 'D';
  const activeVehicleType = driverProfile?.vehicleType ?? 'moto';
  const activitySummary = getDriverActivitySummary({ driverId: user?.id, driverProfile, entitlement, rideHistory });
  const remainingCreditsText = isEntitlementLoading ? '-' : String(activitySummary.remainingRideCredits);
  const bonusRidesText = isEntitlementLoading ? '-' : String(bonusRides);
  const statusLabel = isOnline ? 'Online' : 'Offline';
  const isVerified = driverProfile?.isVerified === true;
  const ratingLabel = ratingSummary.ratingCount > 0 && ratingSummary.averageRating !== null
    ? ratingSummary.averageRating.toFixed(1)
    : '0.0';
  const showNoCreditsWarning = !isEntitlementLoading && totalAvailableRides === 0;
  const request = pendingRequest;
  const requestPickupLabel = formatRequestLocation(request?.pickup, 'Pickup unavailable');
  const requestDestinationLabel = formatRequestLocation(request?.destination, 'Destination unavailable');
  const requestDistanceToPickup = request ? formatDistanceToPickup(driverLocation, request.pickup) : 'Distance unavailable';
  const requestTripDistance = formatTripDistance(request?.distance);
  const requestTripDuration = formatTripDuration(request?.duration);

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
        {request && (
          <Marker coordinate={request.pickup}>
            <View style={[styles.pickupPin, { backgroundColor: colors.primary }]}>
              <Feather name="user" size={12} color={colors.primaryForeground} />
            </View>
          </Marker>
        )}
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
              </View>
              <View style={styles.identityChipRow}>
                <View style={styles.identityItem}>
                  <MaterialCommunityIcons name="star" size={14} color={colors.foreground} />
                  <Text style={[styles.identityChipText, { color: colors.foreground }]}>{ratingLabel}</Text>
                </View>
                <View style={[styles.metadataSeparator, { backgroundColor: colors.border }]} />
                <View style={styles.identityItem} testID="driver-header-status">
                  <View style={[styles.onlineDot, { backgroundColor: isOnline ? colors.successHex : colors.foreground }]} />
                  <Text style={[styles.identityChipText, { color: isOnline ? colors.successHex : colors.mutedForeground }]}>
                    {statusLabel}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.ctaRow}>
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
              <TouchableOpacity
                style={[
                  styles.notificationButton,
                  { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' },
                ]}
                onPress={() => router.push('/notifications')}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Notifications"
              >
                <Feather name="bell" size={18} color={colors.foreground} />
                {hasUnreadNotifications && (
                  <View
                    style={[
                      styles.notifDot,
                      {
                        backgroundColor: colors.destructive,
                        borderColor: isDark ? '#2C2C2E' : '#F2F2F7',
                      },
                    ]}
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>

          <Text style={[styles.activityTitle, { color: colors.foreground }]}>Today's Activity</Text>
          <View style={styles.activityGrid}>
            <View style={styles.activityStat}>
              <Text style={[styles.activityValue, { color: colors.foreground }]} numberOfLines={1} adjustsFontSizeToFit>
                {formatRwf(activitySummary.todayEarningsRwf)}
              </Text>
              <Text style={[styles.activityLabel, { color: colors.mutedForeground }]}>Earnings</Text>
            </View>
            <View style={[styles.activityDivider, { backgroundColor: colors.border }]} />
            <View style={styles.activityStat}>
              <Text style={[styles.activityValue, { color: colors.foreground }]} numberOfLines={1} adjustsFontSizeToFit>
                {activitySummary.completedRidesToday}
              </Text>
              <Text style={[styles.activityLabel, { color: colors.mutedForeground }]}>Trips</Text>
            </View>
            <View style={[styles.activityDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity
              style={styles.activityStat}
              onPress={() => router.push('/driver-packages')}
              activeOpacity={0.72}
              accessibilityRole="button"
              accessibilityLabel="View ride package rides"
            >
              <Text style={[styles.activityValue, { color: colors.foreground }]} numberOfLines={1} adjustsFontSizeToFit>{remainingCreditsText}</Text>
              <Text style={[styles.activityLabel, { color: colors.mutedForeground }]}>Rides</Text>
            </TouchableOpacity>
            <View style={[styles.activityDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity
              style={styles.activityStat}
              onPress={() => router.push('/driver-packages')}
              activeOpacity={0.72}
              accessibilityRole="button"
              accessibilityLabel="View ride package Bonus Rides"
            >
              <Text style={[styles.activityValue, { color: colors.foreground }]} numberOfLines={1} adjustsFontSizeToFit>{bonusRidesText}</Text>
              <Text style={[styles.activityLabel, { color: colors.mutedForeground }]}>Bonus Rides</Text>
            </TouchableOpacity>
          </View>

          {showNoCreditsWarning && (
            <View style={[styles.noCreditsPanel, { backgroundColor: colors.successHex + '12', borderColor: colors.successHex + '35' }]}>
              <View style={styles.noCreditsCopy}>
                <View style={styles.noCreditsTitleRow}>
                  <Feather name="layers" size={14} color={colors.success} />
                  <Text style={[styles.noCreditsTitle, { color: colors.foreground }]}>No Rides</Text>
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

        <View style={styles.adCard} onLayout={onAdCarouselLayout}>
          <View style={[styles.adCardClip, { backgroundColor: cardFill }]}>
            <ScrollView
              ref={adCarouselRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={styles.adCarousel}
              onMomentumScrollEnd={handleAdCarouselMomentumEnd}
            >
              {LOOPED_DASHBOARD_ADS.map((ad, index) => (
                <TouchableOpacity
                  key={`${ad.id}-${index}`}
                  style={[styles.adSlide, { width: Math.max(adCarouselWidth, 1) }]}
                  onPress={() => openAdWebsite(ad.url)}
                  activeOpacity={0.9}
                  accessibilityRole="link"
                  accessibilityLabel={ad.accessibilityLabel}
                  testID={
                    index === 0
                      ? 'dashboard-ad-loop-last'
                      : index === DASHBOARD_ADS.length + 1
                        ? 'dashboard-ad-loop-first'
                        : `dashboard-ad-${ad.id}`
                  }
                >
                  <Image source={ad.image} style={styles.adImage} resizeMode="cover" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
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
      {!request && (
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
      {request && (
        <Animated.View
          style={[styles.requestSheet, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', transform: [{ translateY: slideAnim }], paddingBottom: tabBarHeight + 10 }]}
        >
          <View style={styles.requestHeader}>
            <ProfileAvatarCircle
              size={40}
              initial={(request.customerName ?? 'C').charAt(0).toUpperCase()}
              imageUri={request.customerImage ?? null}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.requestEyebrow, { color: colors.mutedForeground }]}>Incoming Ride Request</Text>
              <Text style={[styles.requestTitle, { color: colors.foreground }]} numberOfLines={1}>{request.customerName ?? 'Customer'}</Text>
              {request.customerRating != null ? (
                <View style={styles.requestRatingRow}>
                  <MaterialCommunityIcons name="star" size={12} color={colors.star} />
                  <Text style={[styles.requestRatingText, { color: colors.star }]}>
                    {request.customerRating.toFixed(1)}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={[styles.countdown, { backgroundColor: countdown <= 5 ? colors.destructive : colors.primary }]}>
              <Text style={styles.countdownText}>{countdown}</Text>
              <Text style={styles.countdownSub}>sec</Text>
            </View>
          </View>
          <View style={[styles.routeCard, { backgroundColor: isDark ? '#2C2C2E' : colors.muted }]}>
            <View style={styles.routeRow}>
              <View style={[styles.routeDot, { backgroundColor: colors.primary }]} />
              <View style={styles.routeTextBlock}>
                <Text style={[styles.routeInlineLabel, { color: colors.mutedForeground }]}>Pickup</Text>
                <Text style={[styles.routeValue, { color: colors.foreground }]} numberOfLines={1}>{requestPickupLabel}</Text>
              </View>
            </View>
            <View style={[styles.routeConnector, { backgroundColor: colors.border }]} />
            <View style={styles.routeRow}>
              <View style={[styles.routeSquare, { backgroundColor: colors.destructive }]} />
              <View style={styles.routeTextBlock}>
                <Text style={[styles.routeInlineLabel, { color: colors.mutedForeground }]}>Destination</Text>
                <Text style={[styles.routeValue, { color: colors.foreground }]} numberOfLines={1}>{requestDestinationLabel}</Text>
              </View>
            </View>
          </View>
          <View style={styles.metaRow}>
            <View style={[styles.metaInfoCard, { backgroundColor: isDark ? '#2C2C2E' : colors.muted }]}>
              <MaterialCommunityIcons name="map-marker-radius" size={16} color={colors.primary} />
              <View style={styles.metaInfoText}>
                <Text style={[styles.metaInfoLabel, { color: colors.mutedForeground }]}>Pickup</Text>
                <Text style={[styles.metaInfoValue, { color: colors.foreground }]}>{requestDistanceToPickup}</Text>
              </View>
            </View>
            <View style={[styles.metaInfoCard, { backgroundColor: isDark ? '#2C2C2E' : colors.muted }]}>
              <MaterialCommunityIcons name="map-marker-distance" size={16} color={colors.primary} />
              <View style={styles.metaInfoText}>
                <Text style={[styles.metaInfoLabel, { color: colors.mutedForeground }]}>Trip Distance</Text>
                <Text style={[styles.metaInfoValue, { color: colors.foreground }]}>{requestTripDistance}</Text>
              </View>
            </View>
            <View style={[styles.metaInfoCard, { backgroundColor: isDark ? '#2C2C2E' : colors.muted }]}>
              <MaterialCommunityIcons name="clock-outline" size={16} color={colors.primary} />
              <View style={styles.metaInfoText}>
                <Text style={[styles.metaInfoLabel, { color: colors.mutedForeground }]}>Time</Text>
                <Text style={[styles.metaInfoValue, { color: colors.foreground }]}>{requestTripDuration}</Text>
              </View>
            </View>
          </View>
          <View style={styles.requestActions}>
            <AppButton variant="decline" size="md" title="Decline" icon="x" onPress={handleDecline} />
            <AppButton variant="primary" size="md" title="Accept" icon="check" onPress={handleAccept} style={{ flex: 1 }} />
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
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  notificationButton: {
    width: BUTTON_HEIGHT.sm,
    height: BUTTON_HEIGHT.sm,
    borderRadius: buttonCornerRadius(BUTTON_HEIGHT.sm),
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
  },
  notifDot: { position: 'absolute', top: 10, right: 11, width: 8, height: 8, borderRadius: 4, borderWidth: 1.5 },
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
  activityTitle: { fontSize: 12, fontFamily: 'Inter_700Bold', marginTop: 14, marginBottom: 7 },
  activityGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activityStat: { flex: 1, alignItems: 'center', minWidth: 0 },
  activityValue: { fontSize: 18, lineHeight: 22, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  activityLabel: { fontSize: 9, fontFamily: 'Inter_600SemiBold', textAlign: 'center', marginTop: 2 },
  activityDivider: { width: 1, height: 24 },
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
    borderRadius: 10,
    height: 128,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    ...Platform.select({ ios: { borderCurve: 'continuous' } }),
  },
  adCardClip: { flex: 1, borderRadius: 10, overflow: 'hidden' },
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
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 10, paddingHorizontal: 16, gap: 9,
    shadowColor: '#000', shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.18, shadowRadius: 20, elevation: 20,
    ...Platform.select({ ios: { borderCurve: 'continuous' } }),
  },
  requestHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  requestEyebrow: { fontSize: 10, fontFamily: 'Inter_500Medium', marginBottom: 1 },
  requestTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  requestRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  requestRatingText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  countdown: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  countdownText: { fontSize: 17, fontFamily: 'Inter_700Bold', color: '#fff', lineHeight: 19 },
  countdownSub: { fontSize: 9, fontFamily: 'Inter_600SemiBold', color: 'rgba(255,255,255,0.75)', lineHeight: 11 },
  fareRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  fareLabel: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular' },
  fareValue: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  routeCard: { borderRadius: 13, paddingHorizontal: 12, paddingVertical: 7, gap: 0 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  routeDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  routeSquare: { width: 10, height: 10, borderRadius: 3, flexShrink: 0 },
  routeConnector: { height: 1, marginLeft: 20 },
  routeTextBlock: { flex: 1, gap: 1 },
  routeInlineLabel: { fontSize: 9, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase' },
  routeValue: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  routeText: { fontSize: 13, fontFamily: 'Inter_500Medium', flex: 1 },
  metaRow: { flexDirection: 'row', gap: 5 },
  metaInfoCard: { flex: 1, minHeight: 36, flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 7, borderRadius: 12, gap: 4 },
  metaInfoText: { flex: 1, gap: 1 },
  metaInfoValue: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  metaInfoLabel: { fontSize: 8, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase' },
  requestActions: { flexDirection: 'row', gap: 10 },
});
