import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { GlassHeader, useGlassHeaderMetrics } from "@/components/GlassHeader";
import { GlassScrollView } from "@/components/GlassScrollView";
import { ProfileAvatarCircle } from "@/components/ProfileAvatarCircle";
import {
  DriverStatisticsInsightsCard,
  DriverStatisticsMetricCard,
  DriverStatisticsSupportingCard,
  EarningsSummaryCard,
  type DriverStatisticsSupportingRow,
} from "@/components/driver-statistics";
import { AppText } from "@/components/AppText";
import { TAB_BAR_SCREEN_BOTTOM_PADDING } from "@/constants/tabBar";
import { spacing, semanticSpacing } from "@/constants/spacing";
import { typography } from "@/constants/typography";
import { useAuth } from "@/context/AuthContext";
import { useDriverEntitlement } from "@/context/DriverEntitlementContext";
import { formatRwf } from "@/domain/driverActivitySummary";
import {
  getDriverRatingSummary,
  type DriverRatingSummary,
} from "@/domain/driverWallet";
import { loadStoredDriverDailyGoals } from "@/persistence/driverDailyGoalPersistence";
import {
  createDriverStatisticsViewModel,
  getCompletedTripsSeries,
  getDriverStatisticsSparseLabels,
  getEarningsPerTripSeries,
  type DriverStatisticsPeriod,
  DEFAULT_DAILY_GOAL_RWF,
  resolveDailyGoalForDate,
  localDateStringToLocalDate,
} from "@/domains/driver-statistics";
import { useColors } from "@/hooks/useColors";
import { useCurrentLocalDate } from "@/hooks/useCurrentLocalDate";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { loadStoredDriverRatings } from "@/persistence/driverRatingPersistence";
import { useRideHistoryQuery } from "@/query/hooks/useRideHistoryQuery";

const EMPTY_RATING_SUMMARY: DriverRatingSummary = {
  averageRating: null,
  ratingCount: 0,
};

export default function DriverStats() {
  const colors = useColors();
  const reducedMotion = useReducedMotionPreference();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const statsContentTop = Math.max(0, headerMetrics.contentTop - spacing[20]);
  const { user, driverProfile } = useAuth();
  const { entitlement } = useDriverEntitlement();
  const {
    data: rideHistory = [],
    isLoading: isRideHistoryLoading,
    refetch: refetchRideHistory,
  } = useRideHistoryQuery(user?.id);
  const [ratingSummary, setRatingSummary] =
    React.useState<DriverRatingSummary>(EMPTY_RATING_SUMMARY);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [selectedPeriod, setSelectedPeriod] =
    React.useState<DriverStatisticsPeriod>("today");
  const { currentLocalDate, refreshCurrentLocalDate } = useCurrentLocalDate();
  const now = React.useMemo(
    () => localDateStringToLocalDate(currentLocalDate) ?? new Date(),
    [currentLocalDate],
  );

  const handleRefresh = React.useCallback(async () => {
    setIsRefreshing(true);
    const start = Date.now();
    try {
      await refetchRideHistory();
      const storedRatings = await loadStoredDriverRatings();
      const summary = user?.id
        ? getDriverRatingSummary(storedRatings.data ?? [], user.id)
        : EMPTY_RATING_SUMMARY;
      setRatingSummary(summary);
    } finally {
      const elapsed = Date.now() - start;
      const minDuration = process.env.NODE_ENV === "test" ? 0 : 800;
      const remaining = minDuration - elapsed;
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }
      setIsRefreshing(false);
    }
  }, [refetchRideHistory, user?.id]);

  React.useEffect(() => {
    let cancelled = false;
    async function loadRatingSummary() {
      const stored = await loadStoredDriverRatings();
      const summary = user?.id
        ? getDriverRatingSummary(stored.data ?? [], user.id)
        : EMPTY_RATING_SUMMARY;
      if (!cancelled) setRatingSummary(summary);
    }
    void loadRatingSummary();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const [dailyGoal, setDailyGoal] = React.useState(DEFAULT_DAILY_GOAL_RWF);

  useFocusEffect(
    React.useCallback(() => {
      let active = true;
      const todayLocalDate = refreshCurrentLocalDate();
      async function fetchGoal() {
        const stored = await loadStoredDriverDailyGoals();
        const goal = resolveDailyGoalForDate({
          records: stored.data ?? [],
          selectedLocalDate: todayLocalDate,
          fallbackGoal: DEFAULT_DAILY_GOAL_RWF,
        });
        if (active) {
          setDailyGoal(goal);
        }
      }
      fetchGoal();
      return () => {
        active = false;
      };
    }, [refreshCurrentLocalDate]),
  );

  const statistics = React.useMemo(
    () =>
      createDriverStatisticsViewModel({
        currentDriverId: user?.id,
        driverEntitlement: entitlement,
        driverProfile,
        driverRatingSummary: ratingSummary,
        now,
        rideHistory,
        selectedPeriod,
      }),
    [
      driverProfile,
      entitlement,
      now,
      ratingSummary,
      rideHistory,
      selectedPeriod,
      user?.id,
    ],
  );

  const isStatsLoading = isRideHistoryLoading && rideHistory.length === 0;
  const completedTrips = statistics.metrics.completedTrips.value;
  const periodEarnings = statistics.metrics.periodEarningsRwf.value;
  const earningsPerTrip = statistics.metrics.earningsPerTripRwf.value;
  const rating = statistics.metrics.driverRating.value;
  const acceptanceRate = statistics.metrics.acceptanceRate.value;
  const priorityRisk = statistics.metrics.priorityRisk.value;
  const tripSeries = getCompletedTripsSeries(statistics.buckets);
  const earningsPerTripSeries = getEarningsPerTripSeries(statistics.buckets);
  const sparseLabels = getDriverStatisticsSparseLabels(
    statistics.period,
    statistics.buckets,
  );
  const periodLabel = statistics.period.label;
  const localDateLabel = formatLocalSummaryDate(now);
  const earningsLabel = isStatsLoading ? "..." : formatRwf(periodEarnings);
  const completedTripsLabel = isStatsLoading ? "..." : String(completedTrips);
  const earningsPerTripLabel =
    earningsPerTrip === null ? "--" : formatRwf(earningsPerTrip);
  const ratingLabel =
    rating.ratingCount > 0
      ? (rating.averageRating?.toFixed(1) ?? "No rating yet")
      : "No rating yet";
  const acceptanceLabel =
    acceptanceRate === null ? "No data yet" : `${acceptanceRate}%`;
  const priorityLabel = priorityRisk.isReduced
    ? "Lower Priority"
    : "High Priority";
  const priorityNote = priorityRisk.isReduced
    ? `Reduced after ${priorityRisk.threshold} local declines.`
    : `${priorityRisk.declinesUntilReduced} declines before priority is reduced.`;
  const supportingRows = React.useMemo<DriverStatisticsSupportingRow[]>(
    () => [
      {
        label: "All-time Trips",
        value: String(statistics.metrics.allTimeCompletedTrips.value),
        note: "Local profile total",
      },
      {
        label: "All-time Ride Revenue",
        value: formatRwf(statistics.metrics.allTimeRideRevenueRwf.value),
        note: "Local profile total",
      },
      {
        label: "Daily Declines",
        value: String(statistics.metrics.dailyDeclines.value),
        note: "Local priority policy",
      },
      {
        label: "Priority Status",
        value: priorityLabel,
        note: priorityNote,
      },
    ],
    [
      priorityLabel,
      priorityNote,
      statistics.metrics.allTimeCompletedTrips.value,
      statistics.metrics.allTimeRideRevenueRwf.value,
      statistics.metrics.dailyDeclines.value,
    ],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GlassHeader title="Summary" subtitle={localDateLabel} showBack={false} />
      <GlassScrollView
        style={styles.container}
        indicatorTop={headerMetrics.indicatorTop}
        contentContainerStyle={{
          paddingTop: Platform.OS === "ios" ? 0 : statsContentTop,
          paddingBottom: insets.bottom + TAB_BAR_SCREEN_BOTTOM_PADDING,
          paddingHorizontal: semanticSpacing.cardPadding,
          gap: semanticSpacing.sectionGap,
        }}
        contentInset={
          Platform.OS === "ios" ? { top: statsContentTop } : undefined
        }
        contentOffset={
          Platform.OS === "ios" ? { x: 0, y: -statsContentTop } : undefined
        }
        showsVerticalScrollIndicator={false}
        onRefresh={handleRefresh}
        refreshing={isRefreshing}
        refreshIndicatorTop={headerMetrics.headerInset + 44}
      >
        <EarningsSummaryCard
          periodLabel={periodLabel}
          earningsLabel={earningsLabel}
          completedTrips={completedTrips}
          periodEarnings={periodEarnings}
          targetEarnings={dailyGoal}
          reducedMotion={reducedMotion}
          onPress={() => {
            router.push({
              pathname: "/driver-stats-detail",
              params: {
                metric: "earnings",
                period: selectedPeriod,
                dailyGoal: String(dailyGoal),
              },
            });
          }}
        />

        <View style={styles.cardRow}>
          <DriverStatisticsMetricCard
            title="Completed Trips"
            periodLabel={periodLabel}
            value={completedTripsLabel}
            icon="check-circle"
            values={tripSeries.map((point) => point.value)}
            labels={sparseLabels}
            color="#A38DF8"
            chartAccessibilityLabel={`Completed trips activity for ${periodLabel}. ${completedTrips} trips total.`}
            onPress={() => {
              router.push({
                pathname: "/driver-stats-detail",
                params: { metric: "completedTrips", period: selectedPeriod },
              });
            }}
          />
          <DriverStatisticsMetricCard
            title="Earnings Per Trip"
            periodLabel={periodLabel}
            value={earningsPerTripLabel}
            icon="trending-up"
            note={
              earningsPerTrip === null
                ? "Available after a completed trip"
                : undefined
            }
            values={earningsPerTripSeries.map((point) => point.value)}
            labels={sparseLabels}
            color="#2AC1E4"
            chartAccessibilityLabel={`Earnings per trip activity for ${periodLabel}.`}
            onPress={() => {
              router.push({
                pathname: "/driver-stats-detail",
                params: { metric: "earningsPerTrip", period: selectedPeriod },
              });
            }}
          />
        </View>

        <View style={styles.cardRow}>
          <DriverStatisticsMetricCard
            title="Driver Rating"
            value={ratingLabel}
            icon="star"
            note={
              rating.ratingCount > 0
                ? `${rating.ratingCount} ${rating.ratingCount === 1 ? "rating" : "ratings"}`
                : "Your rating will appear after customers rate completed trips."
            }
            color="#FFCC00"
            onPress={() => {
              router.push({
                pathname: "/driver-stats-detail",
                params: { metric: "rating", period: selectedPeriod },
              });
            }}
          />
          <DriverStatisticsMetricCard
            title="Acceptance"
            value={acceptanceLabel}
            icon="percent"
            note={
              acceptanceRate === null
                ? "No local profile activity yet"
                : "Local profile estimate"
            }
            color="#8CE62A"
            onPress={() => {
              router.push({
                pathname: "/driver-stats-detail",
                params: { metric: "acceptance", period: selectedPeriod },
              });
            }}
          />
        </View>

        <DriverStatisticsInsightsCard
          insights={statistics.insights}
          isNewDriverStatsState={statistics.isNewDriverStatsState}
          emptyStateTitle={
            statistics.isNewDriverStatsState
              ? "Keep driving to unlock your trends."
              : statistics.emptyStateTitle
          }
          emptyStateDescription={
            statistics.isNewDriverStatsState
              ? "Complete trips across more active periods and Rides will show when you perform best."
              : statistics.emptyStateDescription
          }
          onPress={() => {
            router.push({
              pathname: "/driver-stats-detail",
              params: { metric: "trends", period: selectedPeriod },
            });
          }}
        />

        <DriverStatisticsSupportingCard
          rows={supportingRows}
          onPress={() => {
            router.push({
              pathname: "/driver-stats-detail",
              params: { metric: "performance", period: selectedPeriod },
            });
          }}
        />
      </GlassScrollView>
    </View>
  );
}

function formatLocalSummaryDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    weekday: "long",
  }).format(value);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  titleBlock: {
    gap: spacing[2],
  },
  pageTitle: {
    ...typography.displayXL,
    lineHeight: 38,
    letterSpacing: -0.8,
  },
  pageDate: {
    ...typography.caption,
  },
  cardRow: {
    flexDirection: "row",
    gap: semanticSpacing.inlineGap,
  },
});
