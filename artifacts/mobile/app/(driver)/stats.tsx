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
import { loadStoredDriverDailyGoals } from "@/persistence/driverDailyGoalPersistence";
import {
  createDriverStatisticsViewModel,
  getCompletedTripsSeries,
  getDriverStatisticsSparseLabels,
  getEarningsPerTripSeries,
  type DriverStatisticsPeriod,
  DEFAULT_DAILY_GOAL_RWF,
  resolveDailyGoalForDate,
  toLocalDateString,
} from "@/domains/driver-statistics";
import { useColors } from "@/hooks/useColors";
import { useDriverRideHistoryQuery } from "@/query/hooks/useRideHistoryQuery";
import { useDriverStatsQuery } from "@/query/hooks/useDriverStatsQuery";
import {
  useDriverDailyEarningsQuery,
  useDriverWeeklyEarningsQuery,
} from "@/query/hooks/useDriverEarningsQuery";
import { useDriverRatingsQuery } from "@/query/hooks/useDriverRatingsQuery";
import type { DriverStatisticsBackendInput } from "@/domains/driver-statistics";

export default function DriverStats() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const statsContentTop = Math.max(0, headerMetrics.contentTop - spacing[20]);
  const { user, driverProfile } = useAuth();
  const { entitlement } = useDriverEntitlement();
  // Driver ride history has no backend list endpoint yet, so this is empty;
  // headline metrics come from the real /driver/stats + /driver/earnings/*.
  const { data: rideHistory = [], refetch: refetchRideHistory } =
    useDriverRideHistoryQuery(user?.id);
  const { data: driverStats, refetch: refetchStats } = useDriverStatsQuery();
  const { data: dailyEarnings, refetch: refetchDaily } =
    useDriverDailyEarningsQuery();
  const { data: weeklyEarnings, refetch: refetchWeekly } =
    useDriverWeeklyEarningsQuery();
  const { data: ratingSummary = { averageRating: null, ratingCount: 0 }, refetch: refetchRatings } =
    useDriverRatingsQuery();
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [selectedPeriod, setSelectedPeriod] =
    React.useState<DriverStatisticsPeriod>("today");
  const [now] = React.useState(() => new Date());

  const handleRefresh = React.useCallback(async () => {
    setIsRefreshing(true);
    const start = Date.now();
    try {
      await Promise.all([
        refetchRideHistory(),
        refetchStats(),
        refetchDaily(),
        refetchWeekly(),
        refetchRatings(),
      ]);
    } finally {
      const elapsed = Date.now() - start;
      const minDuration = process.env.NODE_ENV === "test" ? 0 : 800;
      const remaining = minDuration - elapsed;
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }
      setIsRefreshing(false);
    }
  }, [refetchDaily, refetchRatings, refetchRideHistory, refetchStats, refetchWeekly]);

  // Backend-authoritative values passed into the statistics view model. Period
  // earnings/trips are only available for today (daily) and week (weekly); the
  // month window has no aggregate endpoint yet.
  const backendInput = React.useMemo<DriverStatisticsBackendInput>(() => {
    const base: DriverStatisticsBackendInput = {
      allTimeCompletedTrips: driverStats?.totalRides ?? null,
      acceptanceRate: driverStats?.acceptanceRate ?? null,
      completionRate: driverStats?.completionRate ?? null,
      priorityTier: driverStats?.priorityTier ?? null,
    };
    if (selectedPeriod === "today") {
      base.periodEarningsRwf = dailyEarnings?.totalRwf ?? null;
      base.periodCompletedTrips = dailyEarnings?.rides ?? null;
    } else if (selectedPeriod === "week") {
      base.periodEarningsRwf = weeklyEarnings?.totalRwf ?? null;
    }
    return base;
  }, [driverStats, dailyEarnings, weeklyEarnings, selectedPeriod]);

  const [dailyGoal, setDailyGoal] = React.useState(DEFAULT_DAILY_GOAL_RWF);

  useFocusEffect(
    React.useCallback(() => {
      let active = true;
      async function fetchGoal() {
        const stored = await loadStoredDriverDailyGoals();
        const goal = resolveDailyGoalForDate({
          records: stored.data ?? [],
          selectedLocalDate: toLocalDateString(new Date()),
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
    }, []),
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
        backend: backendInput,
      }),
    [
      backendInput,
      driverProfile,
      entitlement,
      now,
      ratingSummary,
      rideHistory,
      selectedPeriod,
      user?.id,
    ],
  );

  const isStatsLoading = !driverStats && !dailyEarnings;
  const completedTrips = statistics.metrics.completedTrips.value;
  const periodEarnings = statistics.metrics.periodEarningsRwf.value;
  const earningsPerTrip = statistics.metrics.earningsPerTripRwf.value;
  const rating = statistics.metrics.driverRating.value;
  const acceptanceRate = statistics.metrics.acceptanceRate.value;
  const completionRate = statistics.metrics.completionRate.value;
  const priorityTier = statistics.metrics.priorityTier.value;
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
    acceptanceRate === null ? "No data yet" : `${Math.round(acceptanceRate)}%`;
  const supportingRows = React.useMemo<DriverStatisticsSupportingRow[]>(
    () => [
      {
        label: "All-time Trips",
        value: String(statistics.metrics.allTimeCompletedTrips.value),
        note: "All completed rides",
      },
      {
        label: "Completion Rate",
        value:
          completionRate === null ? "No data yet" : `${Math.round(completionRate)}%`,
        note: "Rides completed vs. accepted",
      },
      {
        label: "Priority Tier",
        value: priorityTier === null ? "No data yet" : `Tier ${priorityTier}`,
        note: "Higher tiers receive requests first",
      },
    ],
    [
      completionRate,
      priorityTier,
      statistics.metrics.allTimeCompletedTrips.value,
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
                ? "No requests yet"
                : "Requests accepted"
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
