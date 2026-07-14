import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
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
  clampDateSelectorPrefillDay,
  createLocalCalendarDate,
  driverStatisticsHaptics,
  formatCalendarMonthLabel,
  getLocalCalendarDateParts,
  getYearMonthFromRelativeOffset,
  validateDateSelectorDraft,
  isFutureLocalDateString,
  isValidLocalDateString,
  localDateStringToLocalDate,
  toLocalDateString,
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
  const [highlightedLocalDate, setHighlightedLocalDate] = useState(selectedLocalDate);
  const [navigationRequest, setNavigationRequest] = useState<{
    localDate: string;
    requestId: number;
  } | null>(null);
  const navigationRequestIdRef = React.useRef(0);
  const [selectorVisible, setSelectorVisible] = useState(false);
  const [selectorDay, setSelectorDay] = useState("");
  const [selectorMonth, setSelectorMonth] = useState("");
  const [selectorYear, setSelectorYear] = useState("");
  const [selectorTouched, setSelectorTouched] = useState(false);

  const rideHistoryQuery = useRideHistoryQuery(user?.id);
  const rideHistory = rideHistoryQuery.data ?? [];

  const [goalRecords, setGoalRecords] = useState<DriverDailyGoalRecord[]>([]);
  const [goalLoadStatus, setGoalLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [visibleMonthOffset, setVisibleMonthOffset] = useState(0);
  const [headerMonthLabel, setHeaderMonthLabel] = useState(() => {
    const date = localDateStringToLocalDate(selectedLocalDate);
    return date
      ? formatCalendarMonthLabel(date.getFullYear(), date.getMonth())
      : "Earnings History";
  });

  const selectorValidation = useMemo(
    () => validateDateSelectorDraft({
      dayInput: selectorDay,
      monthInput: selectorMonth,
      yearInput: selectorYear,
      todayLocalDate: currentLocalDate,
    }),
    [currentLocalDate, selectorDay, selectorMonth, selectorYear],
  );

  const fillSelector = useCallback((localDate: string) => {
    const parts = getLocalCalendarDateParts(localDate);
    if (!parts) return;
    setSelectorDay(String(parts.day));
    setSelectorMonth(String(parts.month));
    setSelectorYear(String(parts.year));
    setSelectorTouched(false);
  }, []);

  const closeSelector = useCallback(() => {
    Keyboard.dismiss();
    setSelectorVisible(false);
    setSelectorTouched(false);
  }, []);

  const openSelector = useCallback(() => {
    let prefill = getLocalCalendarDateParts(highlightedLocalDate)
      ? highlightedLocalDate
      : null;
    if (!prefill) {
      const today = localDateStringToLocalDate(currentLocalDate);
      if (today) {
        const visible = getYearMonthFromRelativeOffset({
          currentYear: today.getFullYear(),
          currentMonthIndex: today.getMonth(),
          offset: visibleMonthOffset,
        });
        const day = clampDateSelectorPrefillDay({
          year: visible.year,
          month: visible.monthIndex + 1,
          preferredDay: today.getDate(),
        });
        const visibleDate = createLocalCalendarDate(visible.year, visible.monthIndex, day);
        if (visibleDate) prefill = toLocalDateString(visibleDate);
      }
    }
    prefill ??= currentLocalDate;
    fillSelector(prefill);
    setSelectorVisible(true);
  }, [currentLocalDate, fillSelector, highlightedLocalDate, visibleMonthOffset]);

  const showSelectedDateInCalendar = useCallback(() => {
    if (!selectorValidation.valid) return;
    Keyboard.dismiss();
    setHighlightedLocalDate(selectorValidation.localDate);
    navigationRequestIdRef.current += 1;
    setNavigationRequest({
      localDate: selectorValidation.localDate,
      requestId: navigationRequestIdRef.current,
    });
    setSelectorVisible(false);
    setSelectorTouched(false);
  }, [selectorValidation]);

  const handleVisibleMonthChange = useCallback((label: string, relativeOffset: number) => {
    setHeaderMonthLabel(label);
    setVisibleMonthOffset(relativeOffset);
  }, []);
  const handleCalendarNavigationComplete = useCallback((label: string) => {
    void AccessibilityInfo.announceForAccessibility(`Showing ${label}`);
  }, []);

  useEffect(() => {
    if (!selectorVisible || !selectorTouched || selectorValidation.valid) return;
    void AccessibilityInfo.announceForAccessibility(selectorValidation.message);
  }, [selectorTouched, selectorValidation, selectorVisible]);

  useEffect(() => () => {
    Keyboard.dismiss();
  }, []);

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
      accessibilityLabel="Earnings History"
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
          <Pressable
            onPress={openSelector}
            accessibilityRole="button"
            accessibilityLabel="Select a date"
            accessibilityHint="Choose a day, month, and year to show in the calendar"
            style={({ pressed }) => [styles.headerSideSlot, { opacity: pressed ? 0.65 : 1 }]}
            testID="earnings-history-date-selector-button"
          >
            <Feather name="calendar" size={20} color={colors.foreground} />
          </Pressable>
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
            selectedLocalDate={highlightedLocalDate}
            dailyStatisticsIndex={dailyStatisticsIndex}
            goalRecords={goalRecords}
            accentColor={colors.primaryHex}
            reducedMotion={reducedMotion}
            onSelectDate={returnWithDate}
            navigationRequest={navigationRequest}
            onVisibleMonthChange={handleVisibleMonthChange}
            onNavigationComplete={handleCalendarNavigationComplete}
          />
        )}
      </View>

      <Modal
        visible={selectorVisible}
        transparent
        animationType={reducedMotion ? "none" : "fade"}
        onRequestClose={closeSelector}
        accessibilityViewIsModal
        testID="earnings-history-date-selector-modal"
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[styles.selectorCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            accessibilityLabel="Select date"
          >
            <View style={styles.selectorTitleRow}>
              <AppText accessibilityRole="header" style={[styles.selectorTitle, { color: colors.foreground }]}>Select date</AppText>
              <Pressable
                onPress={() => fillSelector(currentLocalDate)}
                accessibilityRole="button"
                accessibilityLabel="Today"
                style={styles.todayAction}
              >
                <AppText style={[styles.todayActionText, { color: colors.primaryHex }]}>Today</AppText>
              </Pressable>
            </View>
            <AppText style={[styles.selectorHint, { color: colors.mutedForeground }]}>Choose a date from year 1 through today</AppText>
            <View style={styles.selectorFieldsRow}>
              {[
                { label: "Day", value: selectorDay, setter: setSelectorDay, maxLength: 2 },
                { label: "Month", value: selectorMonth, setter: setSelectorMonth, maxLength: 2 },
                { label: "Year", value: selectorYear, setter: setSelectorYear, maxLength: 4 },
              ].map((field) => (
                <View key={field.label} style={styles.selectorFieldGroup}>
                  <AppText style={[styles.selectorFieldLabel, { color: colors.mutedForeground }]}>{field.label}</AppText>
                  <TextInput
                    value={field.value}
                    onChangeText={(value) => {
                      field.setter(value);
                      setSelectorTouched(true);
                    }}
                    accessibilityLabel={field.label}
                    keyboardType="number-pad"
                    maxLength={field.maxLength}
                    selectTextOnFocus
                    style={[styles.selectorInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                    testID={`date-selector-${field.label.toLowerCase()}-input`}
                  />
                </View>
              ))}
            </View>
            <View style={styles.validationSlot} accessibilityLiveRegion="polite">
              {selectorTouched && !selectorValidation.valid ? (
                <AppText style={[styles.validationText, { color: colors.destructiveHex }]} testID="date-selector-validation-error">
                  {selectorValidation.message}
                </AppText>
              ) : null}
            </View>
            <View style={styles.selectorActions}>
              <Pressable onPress={closeSelector} accessibilityRole="button" style={styles.selectorSecondaryButton}>
                <AppText style={[styles.selectorSecondaryText, { color: colors.foreground }]}>Cancel</AppText>
              </Pressable>
              <Pressable
                onPress={showSelectedDateInCalendar}
                disabled={!selectorValidation.valid}
                accessibilityRole="button"
                accessibilityLabel="Show selected date in calendar"
                accessibilityState={{ disabled: !selectorValidation.valid }}
                style={[styles.selectorPrimaryButton, { backgroundColor: colors.primaryHex, opacity: selectorValidation.valid ? 1 : 0.4 }]}
                testID="date-selector-go-button"
              >
                <AppText style={styles.selectorPrimaryText}>Go</AppText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    alignItems: "center",
    justifyContent: "center",
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
  modalBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[24],
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  selectorCard: {
    width: "100%",
    maxWidth: 380,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.xl,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
    gap: spacing[8],
  },
  selectorTitleRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectorTitle: {
    ...typography.h2,
    fontSize: 20,
    fontWeight: "700",
  },
  todayAction: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[8],
  },
  todayActionText: {
    fontSize: 14,
    fontWeight: "700",
  },
  selectorHint: {
    fontSize: 12,
    lineHeight: 16,
  },
  selectorFieldsRow: {
    flexDirection: "row",
    gap: spacing[8],
  },
  selectorFieldGroup: {
    flex: 1,
    gap: spacing[4],
  },
  selectorFieldLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  selectorInput: {
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing[8],
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  validationSlot: {
    minHeight: 18,
  },
  validationText: {
    fontSize: 13,
    lineHeight: 18,
  },
  selectorActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing[8],
  },
  selectorSecondaryButton: {
    minHeight: 44,
    minWidth: 76,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[12],
  },
  selectorSecondaryText: {
    fontSize: 15,
    fontWeight: "700",
  },
  selectorPrimaryButton: {
    minHeight: 44,
    minWidth: 76,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    paddingHorizontal: spacing[16],
  },
  selectorPrimaryText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
