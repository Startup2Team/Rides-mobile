import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "@/components/AppText";
import { BackButton } from "@/components/BackButton";
import { EarningsHistoryCalendar } from "@/components/driver-statistics/EarningsHistoryCalendar";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useCurrentLocalDate } from "@/hooks/useCurrentLocalDate";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { useRideHistoryQuery } from "@/query/hooks/useRideHistoryQuery";
import {
  DRIVER_STATISTICS_CALENDAR_WEEKDAY_LABELS,
  buildDriverDailyStatisticsIndex,
  driverStatisticsHaptics,
  formatCalendarMonthLabel,
  isFutureLocalDateString,
  isValidLocalDateString,
  localDateStringToLocalDate,
  type DriverDailyGoalRecord,
} from "@/domains/driver-statistics";
import { loadStoredDriverDailyGoals } from "@/persistence/driverDailyGoalPersistence";
import { publishDriverEarningsDateSelection } from "@/persistence/driverEarningsDateSelectionSignal";
import { radius } from "@/constants/radius";
import { spacing } from "@/constants/spacing";
import { typography } from "@/constants/typography";

function resolveRouteSelectedLocalDate(
  param: string | string[] | undefined,
  todayLocalDate: string,
) {
  const value = Array.isArray(param) ? param[0] : param;
  if (
    typeof value === "string"
    && isValidLocalDateString(value)
    && !isFutureLocalDateString(value, todayLocalDate)
  ) {
    return value;
  }
  return todayLocalDate;
}

export default function DriverEarningsHistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotionPreference();
  const { user } = useAuth();
  const { currentLocalDate } = useCurrentLocalDate();
  const params = useLocalSearchParams<{ selectedLocalDate?: string }>();
  const selectedLocalDate = resolveRouteSelectedLocalDate(
    params.selectedLocalDate,
    currentLocalDate,
  );

  const rideHistoryQuery = useRideHistoryQuery(user?.id);
  const rideHistory = rideHistoryQuery.data ?? [];

  const [goalRecords, setGoalRecords] = useState<DriverDailyGoalRecord[]>([]);
  const [goalLoadStatus, setGoalLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [headerMonthLabel, setHeaderMonthLabel] = useState(() => {
    const date = localDateStringToLocalDate(selectedLocalDate);
    if (!date) return "Earnings History";
    return formatCalendarMonthLabel(date.getFullYear(), date.getMonth());
  });

  useEffect(() => {
    const date = localDateStringToLocalDate(selectedLocalDate);
    if (!date) return;
    setHeaderMonthLabel(formatCalendarMonthLabel(date.getFullYear(), date.getMonth()));
  }, [selectedLocalDate]);

  const loadGoals = useCallback(async () => {
    setGoalLoadStatus("loading");
    try {
      const stored = await loadStoredDriverDailyGoals();
      if (stored.source === "invalid" && stored.data == null) {
        setGoalLoadStatus("error");
        return;
      }
      setGoalRecords(stored.data ?? []);
      setGoalLoadStatus("ready");
    } catch {
      setGoalLoadStatus("error");
    }
  }, []);

  useEffect(() => {
    void loadGoals();
  }, [loadGoals]);

  useEffect(() => {
    const date = localDateStringToLocalDate(selectedLocalDate);
    const label = date
      ? formatCalendarMonthLabel(date.getFullYear(), date.getMonth())
      : "Earnings History";
    void AccessibilityInfo.announceForAccessibility(label);
  }, [selectedLocalDate]);

  const dailyStatisticsIndex = useMemo(
    () => buildDriverDailyStatisticsIndex({ rides: rideHistory, driverId: user?.id }),
    [rideHistory, user?.id],
  );

  const ridesPending =
    (rideHistoryQuery.isLoading || rideHistoryQuery.isFetching)
    && rideHistoryQuery.data == null;
  const isLoading = ridesPending || goalLoadStatus === "loading";
  const hasRideError = Boolean(rideHistoryQuery.isError && rideHistoryQuery.data == null);
  const hasBlockingError = hasRideError || goalLoadStatus === "error";

  const returnWithDate = useCallback(
    (localDate: string) => {
      if (isFutureLocalDateString(localDate, currentLocalDate)) return;
      if (localDate !== selectedLocalDate) {
        void driverStatisticsHaptics.selection();
      }
      void AccessibilityInfo.announceForAccessibility(`Selected ${localDate}`);
      publishDriverEarningsDateSelection(localDate);
      router.back();
    },
    [currentLocalDate, selectedLocalDate],
  );

  const handleRetry = useCallback(() => {
    void rideHistoryQuery.refetch();
    void loadGoals();
  }, [loadGoals, rideHistoryQuery]);

  return (
    <View
      style={[styles.screen, { backgroundColor: colors.background }]}
      testID="driver-earnings-history-screen"
      accessibilityLabel={headerMonthLabel}
    >
      <View
        style={{
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0),
          backgroundColor: colors.background,
        }}
      >
        <View style={styles.headerRow}>
          <BackButton
            exitOnPress={false}
            onPress={() => router.back()}
            accessibilityLabel="Back to Earnings"
          />
          <AppText
            accessibilityRole="header"
            style={[styles.headerTitle, { color: colors.foreground }]}
            testID="earnings-history-month-title"
          >
            {headerMonthLabel}
          </AppText>
          <View style={styles.headerSideSlot} />
        </View>
        <View
          style={styles.weekdayRow}
          accessibilityRole="summary"
          accessibilityLabel="Weekdays Monday through Sunday"
          testID="earnings-history-weekday-header"
        >
          {DRIVER_STATISTICS_CALENDAR_WEEKDAY_LABELS.map((label, index) => (
            <AppText
              key={`weekday-${index}`}
              style={[styles.weekdayLabel, { color: colors.mutedForeground }]}
            >
              {label}
            </AppText>
          ))}
        </View>
      </View>

      <View style={styles.content}>
        {isLoading ? (
          <View style={styles.centered} testID="earnings-history-loading">
            <ActivityIndicator color={colors.primaryHex} />
          </View>
        ) : hasBlockingError ? (
          <View style={styles.centered} testID="earnings-history-error">
            <AppText style={[styles.errorTitle, { color: colors.foreground }]}>
              Couldn’t load earnings history
            </AppText>
            <AppText style={[styles.errorBody, { color: colors.mutedForeground }]}>
              Check your connection and try again.
            </AppText>
            <Pressable
              onPress={handleRetry}
              accessibilityRole="button"
              accessibilityLabel="Retry loading earnings history"
              style={[styles.retryBtn, { backgroundColor: colors.foreground }]}
              testID="earnings-history-retry"
            >
              <AppText style={[styles.retryText, { color: colors.background }]}>
                Retry
              </AppText>
            </Pressable>
          </View>
        ) : (
          <EarningsHistoryCalendar
            todayLocalDate={currentLocalDate}
            selectedLocalDate={selectedLocalDate}
            dailyStatisticsIndex={dailyStatisticsIndex}
            goalRecords={goalRecords}
            accentColor={colors.primaryHex}
            reducedMotion={reducedMotion}
            onSelectDate={returnWithDate}
            onVisibleMonthChange={setHeaderMonthLabel}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
    paddingHorizontal: spacing[16],
  },
  headerTitle: {
    ...typography.h3,
    flex: 1,
    textAlign: "center",
    fontWeight: "700",
  },
  headerSideSlot: {
    width: 44,
    height: 44,
  },
  weekdayRow: {
    flexDirection: "row",
    paddingHorizontal: spacing[16],
    paddingTop: spacing[4],
    paddingBottom: spacing[10],
  },
  weekdayLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[24],
    gap: spacing[12],
  },
  errorTitle: {
    ...typography.h2,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  errorBody: {
    fontSize: 14,
    textAlign: "center",
  },
  retryBtn: {
    marginTop: spacing[8],
    minHeight: 44,
    paddingHorizontal: spacing[20],
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  retryText: {
    fontSize: 15,
    fontWeight: "700",
  },
});
