import React, { useState, useMemo, useCallback } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useColorScheme,
  Image,
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
import { useDriverRideHistoryQuery } from "@/query/hooks/useRideHistoryQuery";
import { useDriverRatingsQuery } from "@/query/hooks/useDriverRatingsQuery";
import { useDriverStatsQuery } from "@/query/hooks/useDriverStatsQuery";
import { useDriverDailyEarningsQuery } from "@/query/hooks/useDriverEarningsQuery";
import {
  DEFAULT_DAILY_GOAL_RWF,
  isCurrentLocalDate,
  resolveDailyGoalForDate,
  toLocalDateString,
  type DriverDailyGoalRecord,
} from "@/domains/driver-statistics";
import { createDriverStatisticsViewModel } from "@/domains/driver-statistics";
import { formatRwf } from "@/domain/driverActivitySummary";
import { loadStoredDriverDailyGoals } from "@/persistence/driverDailyGoalPersistence";
import { spacing } from "@/constants/spacing";
import { typography } from "@/constants/typography";
import { radius } from "@/constants/radius";

import { DailyGoalIcon } from "@/components/DailyGoalIcon";

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
  // Driver ride history has no backend list endpoint yet (empty). Per-date
  // earnings/trips are only backend-authoritative for TODAY (daily endpoint).
  const { data: rideHistory = [] } = useDriverRideHistoryQuery(user?.id);
  const { data: ratingSummary = { averageRating: null, ratingCount: 0 } } =
    useDriverRatingsQuery();
  const { data: driverStats } = useDriverStatsQuery();
  const { data: dailyEarnings } = useDriverDailyEarningsQuery();

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
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [calendarVisible, setCalendarVisible] = useState(false);

  const refreshDailyGoals = useCallback(async () => {
    const stored = await loadStoredDriverDailyGoals();
    setDailyGoalRecords(stored.data ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshDailyGoals();
    }, [refreshDailyGoals]),
  );

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
  }, [selectedDate]);

  // Compute daily metrics specifically for a given date
  const getDailyStatsForDate = useCallback(
    (date: Date) => {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const dayRides = rideHistory.filter((ride) => {
        const rideDate = new Date(ride.createdAt);
        return rideDate >= startOfDay && rideDate <= endOfDay;
      });

      const tripsCount = dayRides.filter(
        (r) => r.status === "completed",
      ).length;
      const earnings = dayRides.reduce(
        (sum, r) => sum + (r.agreedFare ?? 0),
        0,
      );
      const earningsPerTrip = tripsCount > 0 ? earnings / tripsCount : 0;

      return { tripsCount, earnings, earningsPerTrip };
    },
    [rideHistory],
  );

  const activeStats = useMemo(() => {
    // TODAY is the only date with a backend earnings/trips endpoint. Other
    // dates have no per-date driver endpoint yet, so they read empty rather
    // than showing fabricated numbers. NEEDS-BACKEND: per-date driver rides.
    if (isCurrentLocalDate(selectedDate) && dailyEarnings) {
      const tripsCount = dailyEarnings.rides;
      const earnings = dailyEarnings.totalRwf;
      return {
        tripsCount,
        earnings,
        earningsPerTrip: tripsCount > 0 ? earnings / tripsCount : 0,
      };
    }
    return getDailyStatsForDate(selectedDate);
  }, [selectedDate, getDailyStatsForDate, dailyEarnings]);

  // Extract values based on active metric
  const currentValue = useMemo(() => {
    switch (activeMetric) {
      case "earnings":
        return activeStats.earnings;
      case "completedTrips":
        return activeStats.tripsCount;
      case "earningsPerTrip":
        return activeStats.earningsPerTrip;
      case "rating":
        return ratingSummary.averageRating ?? 0;
      case "acceptance":
        // Backend-authoritative acceptance rate (GET /v1/driver/stats).
        return driverStats?.acceptanceRate ?? driverProfile?.acceptanceRate ?? 0;
      default:
        return 0;
    }
  }, [activeMetric, activeStats, ratingSummary, driverStats, driverProfile]);

  const selectedLocalDate = useMemo(
    () => toLocalDateString(selectedDate),
    [selectedDate],
  );
  const isSelectedToday = useMemo(
    () => isCurrentLocalDate(selectedDate),
    [selectedDate],
  );
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
  }, [selectedDate]);

  const handleShare = () => {
    // Shared mock action
    alert("Sharing statistics report!");
  };

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
              style={styles.headerBtn}
            >
              <Feather name="calendar" size={20} color={colors.foreground} />
            </Pressable>
          ) : undefined
        }
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContainer,
          {
            paddingTop: Platform.OS === "ios" ? 100 : 120,
            paddingBottom: insets.bottom + spacing[20],
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Horizontal Weekly Day Selector */}
        <View style={styles.weekdayRow}>
          {weekDays.map((date, idx) => {
            const isSelected =
              date.getDate() === selectedDate.getDate() &&
              date.getMonth() === selectedDate.getMonth();
            const dayName = date.toLocaleDateString("en-US", {
              weekday: "narrow",
            });
            const dayStats = getDailyStatsForDate(date);

            // Calculate progress ring percentage for this day
            let dayProgress = 0;
            if (activeMetric === "earnings" && dayStats.earnings > 0) {
              const dayGoal = resolveDailyGoalForDate({
                records: dailyGoalRecords,
                selectedLocalDate: toLocalDateString(date),
                fallbackGoal: DEFAULT_DAILY_GOAL_RWF,
              });
              dayProgress = dayGoal > 0 ? dayStats.earnings / dayGoal : 0;
            } else if (
              activeMetric === "completedTrips" &&
              dayStats.tripsCount > 0
            ) {
              dayProgress =
                selectedDateGoal > 0
                  ? dayStats.tripsCount / selectedDateGoal
                  : 0;
            }

            return (
              <Pressable
                key={idx}
                onPress={() => setSelectedDate(date)}
                style={styles.weekdayItem}
              >
                <AppText
                  style={[
                    styles.weekdayLabel,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {dayName}
                </AppText>
                <ProgressRing
                  size={32}
                  strokeWidth={3}
                  progress={dayProgress}
                  color={config.color}
                >
                  <View
                    style={[
                      styles.dayTextBubble,
                      isSelected && { backgroundColor: config.color },
                    ]}
                  >
                    <AppText
                      style={[
                        styles.dayText,
                        { color: isSelected ? "#FFFFFF" : colors.foreground },
                      ]}
                    >
                      {date.getDate()}
                    </AppText>
                  </View>
                </ProgressRing>
              </Pressable>
            );
          })}
        </View>

        {/* Center: Large Progress Ring */}
        <View style={styles.ringContainer}>
          <ProgressRing
            size={250}
            strokeWidth={mainRingStrokeWidth}
            progress={progressRatio}
            color={config.color}
            showArrow={activeMetric === "earnings"}
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
            {activeMetric === "earnings" && isSelectedToday ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Change daily earnings goal"
                hitSlop={8}
                onPress={() => router.push("/driver-daily-goal")}
                style={({ pressed }) => [
                  styles.goalEditButton,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <DailyGoalIcon color={colors.foreground} />
              </Pressable>
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

          {/* An hourly breakdown needs a per-hour driver endpoint that does not
              exist yet. Rather than fabricate a distribution, show a clear empty
              state. NEEDS-BACKEND: hourly earnings/trips breakdown. */}
          <View style={styles.chartEmptyState}>
            <Feather
              name="bar-chart-2"
              size={28}
              color={colors.mutedForeground}
            />
            <AppText
              style={[styles.chartEmptyText, { color: colors.mutedForeground }]}
            >
              Hourly breakdown isn't available yet
            </AppText>
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
                {activeStats.tripsCount}
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
                {formatRwf(activeStats.earnings)}
              </AppText>
            </View>
            <View style={styles.subGridItem}>
              <AppText
                style={[styles.subLabel, { color: colors.mutedForeground }]}
              >
                Earnings per Trip
              </AppText>
              <AppText style={[styles.subValue, { color: colors.foreground }]}>
                {formatRwf(activeStats.earningsPerTrip)}
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

                let dayProgress = 0;
                if (activeMetric === "earnings" && dayStats.earnings > 0) {
                  const dayGoal = resolveDailyGoalForDate({
                    records: dailyGoalRecords,
                    selectedLocalDate: toLocalDateString(date),
                    fallbackGoal: DEFAULT_DAILY_GOAL_RWF,
                  });
                  dayProgress = dayGoal > 0 ? dayStats.earnings / dayGoal : 0;
                } else if (
                  activeMetric === "completedTrips" &&
                  dayStats.tripsCount > 0
                ) {
                  dayProgress =
                    selectedDateGoal > 0
                      ? dayStats.tripsCount / selectedDateGoal
                      : 0;
                }

                return (
                  <Pressable
                    key={idx}
                    onPress={() => {
                      setSelectedDate(date);
                      setCalendarVisible(false);
                    }}
                    style={styles.calendarGridSlot}
                  >
                    <ProgressRing
                      size={32}
                      strokeWidth={3}
                      progress={dayProgress}
                      color={config.color}
                      trackColor="rgba(255, 255, 255, 0.05)"
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
  weekdayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  weekdayItem: {
    alignItems: "center",
    gap: 6,
  },
  weekdayLabel: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  dayTextBubble: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  dayText: {
    fontSize: 12,
    fontWeight: "700",
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
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: "auto",
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
  chartEmptyState: {
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  chartEmptyText: {
    ...typography.caption,
    textAlign: "center",
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
