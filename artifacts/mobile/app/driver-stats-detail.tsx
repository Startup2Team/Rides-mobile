import React, { useState, useMemo, useCallback, useRef } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  Image,
  PanResponder,
  Animated,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "@/components/AppText";
import { GlassHeader } from "@/components/GlassHeader";
import { ProgressRing } from "@/components/driver-statistics/ProgressRing";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useDriverEntitlement } from "@/context/DriverEntitlementContext";
import { useRideHistoryQuery } from "@/query/hooks/useRideHistoryQuery";
import { loadStoredDriverRatings } from "@/persistence/driverRatingPersistence";
import {
  getDriverRatingSummary,
  type DriverRatingSummary,
} from "@/domain/driverWallet";
import {
  DEFAULT_DAILY_GOAL_RWF,
  addLocalDays,
  buildDriverDailyStatisticsIndex,
  createEmptyDriverDailyStatistics,
  isFutureLocalDateString,
  localDateStringToLocalDate,
  resolveDailyGoalForDate,
  toLocalDateString,
  type DriverDailyGoalRecord,
} from "@/domains/driver-statistics";
import { formatRwf } from "@/domain/driverActivitySummary";
import { loadStoredDriverDailyGoals } from "@/persistence/driverDailyGoalPersistence";
import { getDriverDailyGoalUpdateVersion } from "@/persistence/driverDailyGoalUpdateSignal";
import { useCurrentLocalDate } from "@/hooks/useCurrentLocalDate";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { spacing } from "@/constants/spacing";
import { typography } from "@/constants/typography";
import { radius } from "@/constants/radius";

type MetricType =
  | "earnings"
  | "completedTrips"
  | "earningsPerTrip"
  | "rating"
  | "acceptance"
  | "trends"
  | "performance";

interface MetricConfig {
  title: string;
  color: string;
  target: number;
  unit: string;
  targetLabel: string;
}

const METRIC_CONFIGS: Record<MetricType, MetricConfig> = {
  earnings: {
    title: "Earnings",
    color: "#FF2D55",
    target: 30000,
    unit: "RWF",
    targetLabel: "Daily Target: 30K RWF",
  },
  completedTrips: {
    title: "Trips",
    color: "#A38DF8",
    target: 8,
    unit: "trips",
    targetLabel: "Daily Target: 8 Trips",
  },
  earningsPerTrip: {
    title: "Earnings Per Trip",
    color: "#2AC1E4",
    target: 5000,
    unit: "RWF",
    targetLabel: "Daily Target: 5K / Trip",
  },
  rating: {
    title: "Driver Rating",
    color: "#FFCC00",
    target: 5.0,
    unit: "★",
    targetLabel: "Rating Goal: 5.0",
  },
  acceptance: {
    title: "Acceptance",
    color: "#8CE62A",
    target: 90,
    unit: "%",
    targetLabel: "Acceptance Target: 90%",
  },
  trends: {
    title: "Trends",
    color: "#FF2D55",
    target: 1,
    unit: "insight",
    targetLabel: "Explore insights",
  },
  performance: {
    title: "Performance",
    color: "#2AC1E4",
    target: 1,
    unit: "score",
    targetLabel: "Performance Stats",
  },
};

export default function DriverStatsDetail() {
  const colors = useColors();
  const reducedMotion = useReducedMotionPreference();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    metric: string;
    period: string;
    dailyGoal?: string;
  }>();
  const activeMetric: MetricType = (params.metric as MetricType) || "earnings";
  const config = useMemo(() => {
    const baseConfig = METRIC_CONFIGS[activeMetric];
    if (activeMetric === "earnings") {
      return {
        ...baseConfig,
        color: colors.primaryHex,
      };
    }
    return baseConfig;
  }, [activeMetric, colors.primary]);

  const { user, driverProfile } = useAuth();
  const { entitlement } = useDriverEntitlement();
  const { data: rideHistory = [] } = useRideHistoryQuery(user?.id);

  const [ratingSummary, setRatingSummary] = useState<DriverRatingSummary>({
    averageRating: null,
    ratingCount: 0,
  });
  const [dailyGoalRecords, setDailyGoalRecords] = useState<
    DriverDailyGoalRecord[]
  >(() => {
    if (params.dailyGoal) {
      const parsed = parseInt(params.dailyGoal, 10);
      if (!isNaN(parsed) && parsed > 0) {
        return [
          {
            amountRwf: parsed,
            effectiveFromLocalDate: toLocalDateString(new Date()),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];
      }
    }
    return [];
  });
  const { currentLocalDate, refreshCurrentLocalDate } = useCurrentLocalDate();
  const [selectedLocalDate, setSelectedLocalDate] = useState(() =>
    toLocalDateString(new Date()),
  );
  const selectedDate = localDateStringToLocalDate(selectedLocalDate) ?? new Date();
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [weekPagerWidth, setWeekPagerWidth] = useState(320);
  const weekPagerWidthRef = useRef(320);
  const weekTranslateX = useRef(new Animated.Value(-320)).current;
  const isWeekAnimating = useRef(false);
  const lastObservedGoalUpdateVersionRef = useRef(
    getDriverDailyGoalUpdateVersion(),
  );
  const previousCurrentLocalDateRef = useRef(currentLocalDate);
  const hasMountedInitialWeekRef = useRef(false);

  React.useEffect(() => {
    hasMountedInitialWeekRef.current = true;
  }, []);

  const centerWeekPager = useCallback(() => {
    isWeekAnimating.current = false;
    weekTranslateX.stopAnimation?.();
    weekTranslateX.setValue(-weekPagerWidthRef.current);
  }, [weekTranslateX]);

  const shiftVisibleWeek = useCallback((weekOffset: number) => {
    setSelectedLocalDate((currentDate) => {
      const nextDate = addLocalDays(currentDate, weekOffset * 7);
      return isFutureLocalDateString(nextDate, currentLocalDate)
        ? currentLocalDate
        : nextDate;
    });
  }, [currentLocalDate]);

  const canShiftVisibleWeek = useCallback(
    (weekOffset: number) => {
      const nextDate = addLocalDays(selectedLocalDate, weekOffset * 7);
      return !isFutureLocalDateString(nextDate, currentLocalDate);
    },
    [currentLocalDate, selectedLocalDate],
  );

  const settleWeekSwipe = useCallback(
    (weekOffset: number) => {
      if (isWeekAnimating.current) return;

      if (!canShiftVisibleWeek(weekOffset)) {
        Animated.timing(weekTranslateX, {
          toValue: -weekPagerWidth,
          duration: 180,
          useNativeDriver: true,
        }).start();
        return;
      }

      isWeekAnimating.current = true;
      Animated.timing(weekTranslateX, {
        toValue: weekOffset > 0 ? -weekPagerWidth * 2 : 0,
        duration: 220,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) {
          isWeekAnimating.current = false;
          return;
        }

        shiftVisibleWeek(weekOffset);
        weekTranslateX.setValue(-weekPagerWidth);
        isWeekAnimating.current = false;
      });
    },
    [canShiftVisibleWeek, shiftVisibleWeek, weekPagerWidth, weekTranslateX],
  );

  const weekSwipeResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 8 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderMove: (_, gestureState) => {
          const movingTowardFuture =
            gestureState.dx < 0 && !canShiftVisibleWeek(1);
          weekTranslateX.setValue(
            -weekPagerWidth +
              (movingTowardFuture ? gestureState.dx * 0.22 : gestureState.dx),
          );
        },
        onPanResponderRelease: (_, gestureState) => {
          const pageChangeThreshold = weekPagerWidth * 0.35;
          if (gestureState.dx <= -pageChangeThreshold) {
            settleWeekSwipe(1);
          } else if (gestureState.dx >= pageChangeThreshold) {
            settleWeekSwipe(-1);
          } else {
            Animated.timing(weekTranslateX, {
              toValue: -weekPagerWidth,
              duration: 180,
              useNativeDriver: true,
            }).start();
          }
        },
        onPanResponderTerminate: () => {
          Animated.timing(weekTranslateX, {
            toValue: -weekPagerWidth,
            duration: 180,
            useNativeDriver: true,
          }).start();
        },
      }),
    [canShiftVisibleWeek, settleWeekSwipe, weekPagerWidth, weekTranslateX],
  );

  // Load rating summary
  React.useEffect(() => {
    async function loadRatings() {
      const stored = await loadStoredDriverRatings();
      const summary = user?.id
        ? getDriverRatingSummary(stored.data ?? [], user.id)
        : { averageRating: null, ratingCount: 0 };
      setRatingSummary(summary);
    }
    void loadRatings();
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const todayLocalDate = refreshCurrentLocalDate();
      const goalUpdateVersion = getDriverDailyGoalUpdateVersion();
      const returningFromGoal =
        goalUpdateVersion !== lastObservedGoalUpdateVersionRef.current;
      lastObservedGoalUpdateVersionRef.current = goalUpdateVersion;

      if (returningFromGoal) {
        setSelectedLocalDate(todayLocalDate);
        centerWeekPager();
      }

      void loadStoredDriverDailyGoals().then(stored => {
        if (active) setDailyGoalRecords(stored.data ?? []);
      });

      return () => {
        active = false;
        isWeekAnimating.current = false;
        weekTranslateX.stopAnimation?.();
      };
    }, [centerWeekPager, refreshCurrentLocalDate, weekTranslateX]),
  );

  React.useEffect(() => {
    const previousToday = previousCurrentLocalDateRef.current;
    if (currentLocalDate !== previousToday) {
      if (selectedLocalDate === previousToday) {
        setSelectedLocalDate(currentLocalDate);
        centerWeekPager();
      }
      previousCurrentLocalDateRef.current = currentLocalDate;
    }
  }, [centerWeekPager, currentLocalDate, selectedLocalDate]);

  // Build the visible week in Monday-to-Sunday order.
  const weekDays = useMemo(() => {
    const startOfWeek = new Date(selectedDate);
    const dayIndex = startOfWeek.getDay();
    const mondayOffset = dayIndex === 0 ? -6 : 1 - dayIndex;
    startOfWeek.setDate(startOfWeek.getDate() + mondayOffset);

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + index);
      return date;
    });
  }, [selectedLocalDate]);
  const carouselWeeks = useMemo(
    () =>
      [-1, 0, 1].map((weekOffset) => {
        const weekDate = new Date(selectedDate);
        weekDate.setDate(selectedDate.getDate() + weekOffset * 7);
        const dayIndex = weekDate.getDay();
        const mondayOffset = dayIndex === 0 ? -6 : 1 - dayIndex;
        weekDate.setDate(weekDate.getDate() + mondayOffset);
        return Array.from({ length: 7 }, (_, index) => {
          const date = new Date(weekDate);
          date.setDate(weekDate.getDate() + index);
          return date;
        });
      }),
    [selectedLocalDate],
  );
  const dailyStatisticsIndex = useMemo(
    () => buildDriverDailyStatisticsIndex({ rides: rideHistory, driverId: user?.id }),
    [rideHistory, user?.id],
  );
  const getDailyStatsForDate = useCallback(
    (date: Date) => {
      const localDate = toLocalDateString(date);
      return dailyStatisticsIndex.get(localDate)
        ?? createEmptyDriverDailyStatistics(localDate);
    },
    [dailyStatisticsIndex],
  );

  const activeStats = useMemo(
    () => getDailyStatsForDate(selectedDate),
    [selectedDate, getDailyStatsForDate],
  );

  // Extract values based on active metric
  const currentValue = useMemo(() => {
    switch (activeMetric) {
      case "earnings":
        return activeStats.earningsRwf;
      case "completedTrips":
        return activeStats.completedTrips;
      case "earningsPerTrip":
        return activeStats.earningsPerTripRwf ?? 0;
      case "rating":
        return ratingSummary.averageRating ?? 0;
      case "acceptance":
        return driverProfile?.acceptanceRate ?? 0;
      default:
        return 0;
    }
  }, [activeMetric, activeStats, ratingSummary, driverProfile]);

  const isSelectedToday = selectedLocalDate === currentLocalDate;
  const selectedDateGoal = useMemo(() => {
    if (activeMetric !== "earnings") return config.target;
    return resolveDailyGoalForDate({
      records: dailyGoalRecords,
      selectedLocalDate,
      fallbackGoal: DEFAULT_DAILY_GOAL_RWF,
    });
  }, [activeMetric, config.target, dailyGoalRecords, selectedLocalDate]);

  const progressRatio = useMemo(() => {
    if (selectedDateGoal <= 0) return 0;
    return currentValue / selectedDateGoal;
  }, [currentValue, selectedDateGoal]);
  const mainRingStrokeWidth = activeMetric === "earnings" ? 50 : 36;

  // Build calendar month days (July 2026 or Current Month)
  const calendarDays = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay(); // Sunday is 0
    const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1; // Align to Monday as 0
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];
    // Pad initial slots
    for (let i = 0; i < startOffset; i++) {
      days.push(null);
    }
    // Populate month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  }, [selectedLocalDate]);

  const handleShare = () => {
    // Shared mock action
    alert("Sharing statistics report!");
  };

  const hourlyData = useMemo(() => {
    return Array.from({ length: 24 }, (_, hour) => {
      if (activeMetric === "earnings") {
        return { hour, value: activeStats.hourlyEarningsRwf[hour] };
      }
      if (activeMetric === "completedTrips") {
        return { hour, value: activeStats.hourlyCompletedTrips[hour] };
      }
      if (activeMetric === "earningsPerTrip") {
        const trips = activeStats.hourlyCompletedTrips[hour];
        return {
          hour,
          value: trips > 0 ? activeStats.hourlyEarningsRwf[hour] / trips : 0,
        };
      }
      return { hour, value: 0 };
    });
  }, [activeMetric, activeStats]);

  const maxHourlyValue = useMemo(() => {
    const max = Math.max(...hourlyData.map((h) => h.value));
    return max > 0 ? max : 1;
  }, [hourlyData]);

  const formattedDateTitle = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    weekday: "long",
  }).format(selectedDate);

  const displayValueStr = useMemo(() => {
    if (activeMetric === "earnings" || activeMetric === "earningsPerTrip") {
      return formatRwf(currentValue);
    }
    if (activeMetric === "rating") {
      return currentValue > 0 ? currentValue.toFixed(1) : "No Rating";
    }
    if (activeMetric === "acceptance") {
      return `${currentValue}%`;
    }
    return String(currentValue);
  }, [currentValue, activeMetric]);
  const targetProgressLabel = useMemo(() => {
    if (activeMetric === "earnings" || activeMetric === "earningsPerTrip") {
      const displayAmount = displayValueStr.replace(/\s*RWF/gi, "");
      return `${displayAmount}/${formatRwf(selectedDateGoal)}`;
    }

    return `${displayValueStr}/${selectedDateGoal} ${config.unit}`;
  }, [activeMetric, config.unit, displayValueStr, selectedDateGoal]);
  const headerBottom =
    insets.top + (Platform.OS === "web" ? 67 : 0) + 44;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Detail Screen Header */}
      <GlassHeader
        title={config.title}
        subtitle={formattedDateTitle}
        showBack={true}
        onBackPress={() => router.back()}
        right={
          activeMetric === "earnings" ? (
            <Pressable
              onPress={() => setCalendarVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Open earnings calendar"
              style={styles.headerBtn}
            >
              <Feather name="calendar" size={20} color={colors.foreground} />
            </Pressable>
          ) : undefined
        }
        bottom={
          <View style={styles.weekdayPager}>
            <View style={styles.weekdayLabelsRow}>
              {weekDays.map((date) => {
                const isSelected =
                  date.getDate() === selectedDate.getDate() &&
                  date.getMonth() === selectedDate.getMonth() &&
                  date.getFullYear() === selectedDate.getFullYear();
                const dateLocalDate = toLocalDateString(date);
                const isToday = dateLocalDate === currentLocalDate;
                const isFuture = isFutureLocalDateString(dateLocalDate, currentLocalDate);
                return (
                <Pressable
                  key={toLocalDateString(date)}
                  onPress={() => setSelectedLocalDate(dateLocalDate)}
                  disabled={isFuture}
                  accessibilityState={{ disabled: isFuture }}
                  accessibilityLabel={`Select ${new Intl.DateTimeFormat("en-GB", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  }).format(date)} from weekday label`}
                  style={styles.weekdayLabelItem}
                >
                  <AppText
                    style={[
                      styles.weekdayLabel,
                      {
                        color: isSelected
                          ? "#FFFFFF"
                          : isToday
                            ? config.color
                            : colors.mutedForeground,
                      },
                      isSelected && {
                        backgroundColor: isToday
                          ? config.color
                          : colors.mutedForeground,
                      },
                    ]}
                  >
                    {date.toLocaleDateString("en-US", { weekday: "narrow" })}
                  </AppText>
                </Pressable>
                );
              })}
            </View>
            <View
              onLayout={(event) => {
                const width = event.nativeEvent.layout.width;
                if (width > 0 && width !== weekPagerWidth) {
                  weekPagerWidthRef.current = width;
                  setWeekPagerWidth(width);
                  weekTranslateX.setValue(-width);
                }
              }}
              style={styles.weekdayRingsViewport}
            >
            <Animated.View
              accessibilityLabel="Weekly date selector. Swipe left for next week or right for previous week."
              testID="weekly-date-selector"
              style={[
                styles.weekdayRingsTrack,
                { transform: [{ translateX: weekTranslateX }] },
              ]}
              {...weekSwipeResponder.panHandlers}
            >
              {carouselWeeks.map((carouselWeek, weekIndex) => (
                <View
                  key={weekIndex}
                  style={[styles.weekdayRingsRow, { width: weekPagerWidth }]}
                >
              {carouselWeek.map((date) => {
                const dateLocalDate = toLocalDateString(date);
                const isFuture = isFutureLocalDateString(dateLocalDate, currentLocalDate);
                const dayStats = getDailyStatsForDate(date);
                let dayProgress = 0;
                if (activeMetric === "earnings" && dayStats.earningsRwf > 0) {
                  const dayGoal = resolveDailyGoalForDate({
                    records: dailyGoalRecords,
                    selectedLocalDate: toLocalDateString(date),
                    fallbackGoal: DEFAULT_DAILY_GOAL_RWF,
                  });
                  dayProgress = dayGoal > 0 ? dayStats.earningsRwf / dayGoal : 0;
                } else if (
                  activeMetric === "completedTrips" &&
                  dayStats.completedTrips > 0
                ) {
                  dayProgress =
                    selectedDateGoal > 0
                      ? dayStats.completedTrips / selectedDateGoal
                      : 0;
                }

                return (
                  <Pressable
                    key={toLocalDateString(date)}
                    onPress={() => setSelectedLocalDate(dateLocalDate)}
                    disabled={isFuture}
                    accessibilityState={{ disabled: isFuture }}
                    accessibilityLabel={`Select ${new Intl.DateTimeFormat("en-GB", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    }).format(date)}`}
                    style={styles.weekdayItem}
                  >
                    <ProgressRing
                      size={40}
                      strokeWidth={9}
                      progress={isFuture ? 0 : dayProgress}
                      color={config.color}
                      trackColor={config.color}
                      trackOpacity={0.24}
                      allowSmallOverflowShadow={!isFuture}
                      showStartCapAtZero={!isFuture}
                      animationMode={
                        weekIndex === 1
                          ? hasMountedInitialWeekRef.current
                            ? "updates-only"
                            : "entry-and-updates"
                          : "none"
                      }
                      animateArrow={false}
                      detailLevel="compact"
                      reducedMotion={reducedMotion}
                      testID={`weekly-progress-ring-${weekIndex}-${dateLocalDate}`}
                    />
                  </Pressable>
                );
              })}
                </View>
              ))}
            </Animated.View>
            </View>
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContainer,
          {
            paddingTop: headerBottom + 92 + spacing[20],
            paddingBottom: insets.bottom + spacing[20],
          },
        ]}
        showsVerticalScrollIndicator={false}
      >

        {/* Center: Large Progress Ring */}
        <View style={styles.ringContainer}>
          <ProgressRing
            size={250}
            strokeWidth={mainRingStrokeWidth}
            progress={progressRatio}
            color={config.color}
            trackColor={config.color}
            trackOpacity={0.24}
            showArrow={activeMetric === "earnings"}
            animationMode="entry-and-updates"
            animateArrow={activeMetric === "earnings"}
            detailLevel="full"
            reducedMotion={reducedMotion}
            testID="earnings-big-progress-ring"
          >
            {activeMetric !== "earnings" && (
              <View style={styles.ringCenterText}>
                <AppText
                  style={[
                    styles.ringMetricTitle,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {config.title}
                </AppText>
                <AppText style={[styles.ringValue, { color: config.color }]}>
                  {displayValueStr}
                </AppText>
                <AppText
                  style={[styles.ringSub, { color: colors.mutedForeground }]}
                >
                  {activeMetric === "completedTrips"
                    ? `Goal: ${selectedDateGoal}`
                    : config.targetLabel}
                </AppText>
              </View>
            )}
          </ProgressRing>
        </View>

        <View style={styles.goalSummary}>
          <AppText
            style={[styles.goalSummaryLabel, { color: colors.mutedForeground }]}
          >
            Goal
          </AppText>
          <View style={styles.goalSummaryRow}>
            <AppText
              style={[styles.goalSummaryValue, { color: config.color }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {targetProgressLabel}
            </AppText>
            {activeMetric === "earnings" ? (
              isSelectedToday ? (
                <Pressable
                accessibilityRole="button"
                accessibilityLabel="Change daily earnings goal"
                hitSlop={8}
                onPress={() => router.push("/driver-daily-goal")}
                style={({ pressed }) => [
                  styles.goalEditButton,
                  {
                    opacity: pressed ? 0.6 : 1,
                    backgroundColor: colors.foreground,
                  },
                ]}
              >
                <AppText
                  style={[
                    styles.goalEditButtonText,
                    { color: colors.background },
                  ]}
                >
                  Change goal
                </AppText>
                </Pressable>
              ) : (
                <View
                  pointerEvents="none"
                  style={[styles.goalEditButton, styles.goalEditButtonPlaceholder]}
                />
              )
            ) : null}
          </View>
        </View>

        {/* Metric Chart */}
        <View
          style={[
            styles.chartCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.chartHeader}>
            <AppText style={[styles.chartTitle, { color: colors.foreground }]}>
              Activity breakdown
            </AppText>
            <AppText
              style={[styles.chartSubtitle, { color: colors.mutedForeground }]}
            >
              Hourly view
            </AppText>
          </View>

          {/* Svg / Custom View Bar Chart */}
          <View style={styles.chartArea}>
            {/* Dashed Target Line */}
            <View
              style={[
                styles.chartTargetLine,
                { borderBottomColor: config.color + "44", top: "40%" },
              ]}
            />

            <View style={styles.barsContainer}>
              {hourlyData.map((h, i) => {
                const heightRatio = h.value / maxHourlyValue;
                const barHeight =
                  heightRatio > 0
                    ? Math.max(4, Math.round(heightRatio * 110))
                    : 0;

                // Show X labels at specific hours
                const showLabel = h.hour % 6 === 0;

                return (
                  <View key={i} style={styles.chartBarSlot}>
                    <View
                      style={[
                        styles.chartBarTrack,
                        { backgroundColor: colors.border },
                      ]}
                    >
                      {barHeight > 0 && (
                        <View
                          testID={`hourly-activity-bar-${h.hour}`}
                          accessibilityLabel={`${String(h.hour).padStart(2, "0")}:00 activity`}
                          accessibilityValue={{
                            min: 0,
                            max: Math.round(maxHourlyValue),
                            now: Math.round(h.value),
                          }}
                          style={[
                            styles.chartBarFill,
                            {
                              backgroundColor: config.color,
                              height: barHeight,
                            },
                          ]}
                        />
                      )}
                    </View>
                    {showLabel ? (
                      <AppText
                        style={[
                          styles.chartAxisLabel,
                          { color: colors.mutedForeground },
                        ]}
                      >
                        {String(h.hour).padStart(2, "0")}
                      </AppText>
                    ) : (
                      <View style={styles.chartAxisSpacer} />
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* Sub-Metrics Details */}
        <View
          style={[
            styles.subCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <AppText style={[styles.subCardTitle, { color: colors.foreground }]}>
            Daily Metrics Summary
          </AppText>

          <View style={styles.subGrid}>
            <View
              style={[
                styles.subGridItem,
                {
                  borderBottomColor: colors.border,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                },
              ]}
            >
              <AppText
                style={[styles.subLabel, { color: colors.mutedForeground }]}
              >
                Completed Rides
              </AppText>
              <AppText style={[styles.subValue, { color: colors.foreground }]}>
                {activeStats.completedTrips}
              </AppText>
            </View>
            <View
              style={[
                styles.subGridItem,
                {
                  borderBottomColor: colors.border,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                },
              ]}
            >
              <AppText
                style={[styles.subLabel, { color: colors.mutedForeground }]}
              >
                Total Earnings
              </AppText>
              <AppText style={[styles.subValue, { color: colors.foreground }]}>
                {formatRwf(activeStats.earningsRwf)}
              </AppText>
            </View>
            <View style={styles.subGridItem}>
              <AppText
                style={[styles.subLabel, { color: colors.mutedForeground }]}
              >
                Earnings per Trip
              </AppText>
              <AppText style={[styles.subValue, { color: colors.foreground }]}>
                {formatRwf(activeStats.earningsPerTripRwf ?? 0)}
              </AppText>
            </View>
            <View style={styles.subGridItem}>
              <AppText
                style={[styles.subLabel, { color: colors.mutedForeground }]}
              >
                Rating Index
              </AppText>
              <AppText style={[styles.subValue, { color: colors.foreground }]}>
                {ratingSummary.averageRating?.toFixed(1) ?? "--"} ★
              </AppText>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Calendar Overlay Modal */}
      <Modal
        visible={calendarVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setCalendarVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.calendarModal,
              { backgroundColor: "#121214", borderColor: colors.border },
            ]}
          >
            {/* Header */}
            <View style={styles.calendarHeader}>
              <AppText
                style={[
                  styles.calendarMonthTitle,
                  { color: colors.foreground },
                ]}
              >
                {selectedDate.toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </AppText>
              <Pressable
                onPress={() => setCalendarVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close earnings calendar"
                style={styles.calendarCloseBtn}
              >
                <Feather name="x" size={18} color="#FFFFFF" />
              </Pressable>
            </View>

            {/* Weekdays Row */}
            <View style={styles.calendarWeekHeader}>
              {["M", "T", "W", "T", "F", "S", "S"].map((day, idx) => (
                <AppText
                  key={idx}
                  style={[
                    styles.calendarWeekText,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {day}
                </AppText>
              ))}
            </View>

            {/* Month Grid */}
            <View style={styles.calendarGrid}>
              {calendarDays.map((date, idx) => {
                if (!date) {
                  return <View key={idx} style={styles.calendarGridSlot} />;
                }

                const isCurrentSelected =
                  date.getDate() === selectedDate.getDate() &&
                  date.getMonth() === selectedDate.getMonth();
                const dayStats = getDailyStatsForDate(date);
                const dateLocalDate = toLocalDateString(date);
                const isFuture = isFutureLocalDateString(dateLocalDate, currentLocalDate);

                let dayProgress = 0;
                if (activeMetric === "earnings" && dayStats.earningsRwf > 0) {
                  const dayGoal = resolveDailyGoalForDate({
                    records: dailyGoalRecords,
                    selectedLocalDate: toLocalDateString(date),
                    fallbackGoal: DEFAULT_DAILY_GOAL_RWF,
                  });
                  dayProgress = dayGoal > 0 ? dayStats.earningsRwf / dayGoal : 0;
                } else if (
                  activeMetric === "completedTrips" &&
                  dayStats.completedTrips > 0
                ) {
                  dayProgress =
                    selectedDateGoal > 0
                      ? dayStats.completedTrips / selectedDateGoal
                      : 0;
                }

                return (
                  <Pressable
                    key={idx}
                    onPress={() => {
                      setSelectedLocalDate(dateLocalDate);
                      setCalendarVisible(false);
                    }}
                    disabled={isFuture}
                    accessibilityState={{ disabled: isFuture }}
                    style={styles.calendarGridSlot}
                  >
                    {isFuture ? (
                      <AppText
                        style={[
                          styles.calendarDayText,
                          { color: colors.mutedForeground, opacity: 0.45 },
                        ]}
                      >
                        {date.getDate()}
                      </AppText>
                    ) : (
                    <ProgressRing
                      size={32}
                      strokeWidth={3}
                      progress={dayProgress}
                      color={config.color}
                      trackColor="rgba(255, 255, 255, 0.05)"
                      animationMode="none"
                      animateArrow={false}
                      detailLevel="compact"
                      reducedMotion={reducedMotion}
                      testID={`calendar-progress-ring-${dateLocalDate}`}
                    >
                      <View
                        style={[
                          styles.calendarDayBubble,
                          isCurrentSelected && {
                            backgroundColor: config.color,
                          },
                        ]}
                      >
                        <AppText
                          style={[
                            styles.calendarDayText,
                            {
                              color: isCurrentSelected
                                ? "#FFFFFF"
                                : colors.foreground,
                            },
                          ]}
                        >
                          {date.getDate()}
                        </AppText>
                      </View>
                    </ProgressRing>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    paddingHorizontal: 16,
    gap: 20,
  },
  headerRightActions: {
    flexDirection: "row",
    gap: 16,
  },
  headerBtn: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  weekdayPager: {
    gap: 6,
    paddingVertical: 12,
  },
  weekdayLabelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  weekdayLabelItem: {
    width: 40,
    alignItems: "center",
  },
  weekdayRingsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  weekdayRingsViewport: {
    overflow: "hidden",
  },
  weekdayRingsTrack: {
    flexDirection: "row",
  },
  weekdayItem: {
    alignItems: "center",
  },
  weekdayLabel: {
    width: 22,
    height: 22,
    lineHeight: 22,
    borderRadius: 11,
    textAlign: "center",
    overflow: "hidden",
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  ringContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  ringCenterText: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  ringMetricTitle: {
    fontSize: 14,
    textTransform: "uppercase",
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  ringValue: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: "800",
  },
  ringSub: {
    fontSize: 13,
  },
  chartCard: {
    borderRadius: radius["3xl"],
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 16,
  },
  chartHeader: {
    gap: 2,
  },
  goalSummary: {
    paddingHorizontal: 4,
    gap: 2,
  },
  goalSummaryLabel: {
    ...typography.tiny,
    textTransform: "uppercase",
  },
  goalSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  goalSummaryValue: {
    ...typography.h2,
    flex: 1,
    minWidth: 0,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
  },
  goalEditButton: {
    minHeight: 36,
    minWidth: 92,
    paddingHorizontal: 12,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: "auto",
  },
  goalEditButtonPlaceholder: {
    opacity: 0,
  },
  goalEditButtonText: {
    ...typography.label,
    fontSize: 12,
    fontWeight: "700",
  },
  chartTitle: {
    ...typography.title,
    fontSize: 16,
  },
  chartSubtitle: {
    ...typography.tiny,
  },
  chartArea: {
    height: 140,
    position: "relative",
    justifyContent: "flex-end",
  },
  chartTargetLine: {
    position: "absolute",
    left: 0,
    right: 0,
    borderBottomWidth: 1,
    borderStyle: "dashed",
    zIndex: 1,
  },
  barsContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 120,
    justifyContent: "space-between",
  },
  chartBarSlot: {
    flex: 1,
    alignItems: "center",
    height: "100%",
    justifyContent: "flex-end",
  },
  chartBarTrack: {
    width: 4,
    height: 110,
    borderRadius: 2,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  chartBarFill: {
    width: "100%",
    borderRadius: 2,
  },
  chartAxisLabel: {
    fontSize: 8,
    marginTop: 6,
    height: 10,
    fontWeight: "600",
  },
  chartAxisSpacer: {
    height: 10,
    marginTop: 6,
  },
  subCard: {
    borderRadius: radius["3xl"],
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 16,
  },
  subCardTitle: {
    ...typography.title,
    fontSize: 16,
  },
  subGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  subGridItem: {
    width: "50%",
    paddingVertical: 12,
    gap: 4,
  },
  subLabel: {
    fontSize: 12,
  },
  subValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  calendarModal: {
    width: "100%",
    borderRadius: radius["3xl"],
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 16,
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  calendarMonthTitle: {
    ...typography.h2,
    fontSize: 18,
    fontWeight: "700",
  },
  calendarCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FF3B30",
    alignItems: "center",
    justifyContent: "center",
  },
  calendarWeekHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  calendarWeekText: {
    width: 36,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 12,
  },
  calendarGridSlot: {
    width: "14.28%",
    alignItems: "center",
    justifyContent: "center",
    height: 36,
  },
  calendarDayBubble: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  calendarDayText: {
    fontSize: 11,
    fontWeight: "700",
  },
});
