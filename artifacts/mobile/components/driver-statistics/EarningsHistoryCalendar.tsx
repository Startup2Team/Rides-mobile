import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  type ListRenderItemInfo,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type ViewToken,
} from "react-native";
import { AppText } from "@/components/AppText";
import { ProgressRing } from "@/components/driver-statistics/ProgressRing";
import { formatRwf } from "@/domain/driverActivitySummary";
import {
  DRIVER_STATISTICS_CALENDAR_MONTH_ESTIMATED_HEIGHT,
  buildDriverStatisticsCalendarMonthAtIndex,
  createCalendarMonthIndexData,
  formatCalendarMonthShortLabel,
  getCalendarIndexForLocalDate,
  getCalendarMonthLabelForIndex,
  localDateStringToLocalDate,
  type CalendarDayCell,
  type DriverDailyGoalRecord,
  type DriverDailyStatistics,
  type DriverStatisticsCalendarMonth,
} from "@/domains/driver-statistics";
import { useColors } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { spacing } from "@/constants/spacing";

type PeekDay =
  | { kind: "empty"; key: string }
  | { kind: "date"; key: string; dayNumber: number; monthShortLabel?: string };

function buildNextMonthPeekWeeks(todayLocalDate: string): PeekDay[][] {
  const today = localDateStringToLocalDate(todayLocalDate);
  if (!today) return [];

  const firstDay = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const year = firstDay.getFullYear();
  const monthIndex = firstDay.getMonth();
  const monthShortLabel = formatCalendarMonthShortLabel(year, monthIndex);
  const firstDayIndex = firstDay.getDay();
  const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: PeekDay[] = [];

  for (let i = 0; i < startOffset; i += 1) {
    cells.push({ kind: "empty", key: `peek-empty-lead-${i}` });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      kind: "date",
      key: `peek-${year}-${monthIndex + 1}-${day}`,
      dayNumber: day,
      monthShortLabel: day === 1 ? monthShortLabel : undefined,
    });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ kind: "empty", key: `peek-empty-trail-${cells.length}` });
  }

  const weeks: PeekDay[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

const NextMonthPeek = React.memo(function NextMonthPeek({
  todayLocalDate,
}: {
  todayLocalDate: string;
}) {
  const colors = useColors();
  const weeks = useMemo(
    () => buildNextMonthPeekWeeks(todayLocalDate),
    [todayLocalDate],
  );

  if (weeks.length === 0) return null;

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="calendar-next-month-peek"
      style={styles.nextMonthPeek}
    >
      {weeks.map((week, weekIndex) => (
        <View key={`peek-w-${weekIndex}`} style={styles.weekRow}>
          {week.map((cell) => (
            <View key={cell.key} style={styles.daySlot}>
              {cell.kind === "date" ? (
                <>
                  <AppText
                    style={[
                      styles.monthAbbrev,
                      {
                        color: colors.mutedForeground,
                        opacity: cell.monthShortLabel ? 0.55 : 0,
                      },
                    ]}
                  >
                    {cell.monthShortLabel ?? " "}
                  </AppText>
                  <AppText style={[styles.dayNumber, { color: colors.mutedForeground, opacity: 0.45 }]}>
                    {cell.dayNumber}
                  </AppText>
                </>
              ) : (
                <AppText style={[styles.monthAbbrev, { opacity: 0 }]}> </AppText>
              )}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
});

const dateA11yFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

function buildCalendarDateAccessibilityLabel(cell: Extract<CalendarDayCell, { kind: "date" }>) {
  const date = new Date(
    Number(cell.localDate.slice(0, 4)),
    Number(cell.localDate.slice(5, 7)) - 1,
    Number(cell.localDate.slice(8, 10)),
  );
  const base = dateA11yFormatter.format(date);
  if (cell.isFuture) {
    return `${base}. Future date. Disabled.`;
  }
  const selected = cell.isSelected ? " Selected." : "";
  const today = cell.isToday ? " Today." : "";
  if (cell.goalState !== "configured" || cell.goalRwf == null) {
    return `${base}.${today}${selected} Earnings ${formatRwf(cell.earningsRwf)}. No daily earnings goal configured.`;
  }
  return `${base}.${today}${selected} Earnings ${formatRwf(cell.earningsRwf)} of ${formatRwf(cell.goalRwf)}.`;
}

const CalendarMonthSection = React.memo(function CalendarMonthSection({
  monthListIndex,
  todayLocalDate,
  selectedLocalDate,
  dailyStatisticsIndex,
  goalRecords,
  accentColor,
  reducedMotion,
  onSelectDate,
}: {
  monthListIndex: number;
  todayLocalDate: string;
  selectedLocalDate: string;
  dailyStatisticsIndex: Map<string, DriverDailyStatistics>;
  goalRecords: DriverDailyGoalRecord[];
  accentColor: string;
  reducedMotion: boolean;
  onSelectDate: (localDate: string) => void;
}) {
  const colors = useColors();

  const month: DriverStatisticsCalendarMonth = useMemo(
    () =>
      buildDriverStatisticsCalendarMonthAtIndex({
        index: monthListIndex,
        todayLocalDate,
        selectedLocalDate,
        dailyStatisticsIndex,
        goalRecords,
      }),
    [
      dailyStatisticsIndex,
      goalRecords,
      monthListIndex,
      selectedLocalDate,
      todayLocalDate,
    ],
  );

  const monthShortLabel = useMemo(
    () => formatCalendarMonthShortLabel(month.year, month.monthIndex),
    [month.monthIndex, month.year],
  );

  return (
    <View style={styles.monthSection} testID={`calendar-month-${month.monthKey}`}>
      {month.weeks.map((week, weekIndex) => (
        <View key={`${month.monthKey}-w-${weekIndex}`} style={styles.weekRow}>
          {week.map((cell) => {
            if (cell.kind === "empty") {
              return (
                <View key={cell.key} style={styles.daySlot}>
                  <AppText style={[styles.monthAbbrev, { opacity: 0 }]}> </AppText>
                </View>
              );
            }

            const showMonthAbbrev = cell.dayNumber === 1;

            return (
              <Pressable
                key={cell.localDate}
                disabled={cell.isFuture}
                accessibilityRole="button"
                accessibilityState={{
                  disabled: cell.isFuture,
                  selected: cell.isSelected,
                }}
                accessibilityLabel={buildCalendarDateAccessibilityLabel(cell)}
                onPress={() => onSelectDate(cell.localDate)}
                style={({ pressed }) => [
                  styles.daySlot,
                  {
                    opacity: cell.isFuture ? 0.4 : pressed ? 0.72 : 1,
                  },
                ]}
                testID={`calendar-day-${cell.localDate}`}
              >
                <AppText
                  style={[
                    styles.monthAbbrev,
                    {
                      color: colors.foreground,
                      opacity: showMonthAbbrev ? 1 : 0,
                    },
                  ]}
                  testID={showMonthAbbrev ? `calendar-month-abbrev-${month.monthKey}` : undefined}
                >
                  {showMonthAbbrev ? monthShortLabel : " "}
                </AppText>
                {cell.isFuture ? (
                  <AppText
                    style={[styles.dayNumber, { color: colors.mutedForeground }]}
                  >
                    {cell.dayNumber}
                  </AppText>
                ) : (
                  <ProgressRing
                    size={40}
                    strokeWidth={4}
                    progress={cell.progress}
                    color={accentColor}
                    trackColor={colors.border}
                    trackOpacity={0.9}
                    goalState={cell.goalState}
                    animationMode="none"
                    animateArrow={false}
                    detailLevel="compact"
                    reducedMotion={reducedMotion}
                    testID={`calendar-progress-ring-${cell.localDate}`}
                  >
                    <View
                      style={[
                        styles.dayBubble,
                        cell.isSelected && { backgroundColor: accentColor },
                        cell.isToday && !cell.isSelected
                          ? {
                              borderWidth: StyleSheet.hairlineWidth * 2,
                              borderColor: accentColor,
                            }
                          : null,
                      ]}
                    >
                      <AppText
                        style={[
                          styles.dayNumber,
                          {
                            color: cell.isSelected
                              ? "#FFFFFF"
                              : cell.isToday
                                ? accentColor
                                : colors.foreground,
                          },
                        ]}
                      >
                        {cell.dayNumber}
                      </AppText>
                    </View>
                  </ProgressRing>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
});

export interface EarningsHistoryCalendarProps {
  todayLocalDate: string;
  selectedLocalDate: string;
  dailyStatisticsIndex: Map<string, DriverDailyStatistics>;
  goalRecords: DriverDailyGoalRecord[];
  accentColor: string;
  reducedMotion?: boolean;
  onSelectDate: (localDate: string) => void;
  onVisibleMonthChange?: (label: string) => void;
}

export function EarningsHistoryCalendar({
  todayLocalDate,
  selectedLocalDate,
  dailyStatisticsIndex,
  goalRecords,
  accentColor,
  reducedMotion = false,
  onSelectDate,
  onVisibleMonthChange,
}: EarningsHistoryCalendarProps) {
  const listRef = useRef<FlatList<number>>(null);
  const hasScrolledRef = useRef(false);
  const lastReportedMonthLabelRef = useRef<string | null>(null);
  const onVisibleMonthChangeRef = useRef(onVisibleMonthChange);
  onVisibleMonthChangeRef.current = onVisibleMonthChange;
  const [listHeight, setListHeight] = useState(0);

  const reportVisibleMonthRef = useRef((monthListIndex: number) => {
    const label = getCalendarMonthLabelForIndex(monthListIndex);
    if (lastReportedMonthLabelRef.current === label) return;
    lastReportedMonthLabelRef.current = label;
    onVisibleMonthChangeRef.current?.(label);
  });

  const monthIndexes = useMemo(
    () => createCalendarMonthIndexData(todayLocalDate),
    [todayLocalDate],
  );

  const initialIndex = useMemo(
    () => getCalendarIndexForLocalDate(selectedLocalDate, todayLocalDate),
    [selectedLocalDate, todayLocalDate],
  );

  // Enough empty space above/below so any month — including the current last month —
  // can sit in the vertical center of the viewport.
  const edgeSpacerHeight = useMemo(() => {
    if (listHeight <= 0) return 0;
    return Math.max(
      0,
      Math.round((listHeight - DRIVER_STATISTICS_CALENDAR_MONTH_ESTIMATED_HEIGHT) / 2),
    );
  }, [listHeight]);

  const scrollToMonthIndex = useCallback((index: number, animated = false) => {
    const clamped = Math.min(Math.max(0, index), Math.max(0, monthIndexes.length - 1));
    try {
      listRef.current?.scrollToIndex({
        index: clamped,
        animated,
        viewPosition: 0.5,
      });
    } catch {
      const offset = Math.max(
        0,
        edgeSpacerHeight
          + clamped * DRIVER_STATISTICS_CALENDAR_MONTH_ESTIMATED_HEIGHT
          - listHeight * 0.5
          + DRIVER_STATISTICS_CALENDAR_MONTH_ESTIMATED_HEIGHT * 0.5,
      );
      listRef.current?.scrollToOffset({
        offset,
        animated,
      });
    }
    reportVisibleMonthRef.current(clamped);
  }, [edgeSpacerHeight, listHeight, monthIndexes.length]);

  useEffect(() => {
    if (listHeight <= 0 || monthIndexes.length === 0) return;
    hasScrolledRef.current = false;
    reportVisibleMonthRef.current(initialIndex);
    const handle = requestAnimationFrame(() => {
      if (hasScrolledRef.current) return;
      hasScrolledRef.current = true;
      scrollToMonthIndex(initialIndex, false);
    });
    return () => cancelAnimationFrame(handle);
  }, [edgeSpacerHeight, initialIndex, listHeight, monthIndexes.length, scrollToMonthIndex]);

  const handleScrollToIndexFailed = useCallback(
    (info: { index: number }) => {
      const offset = Math.max(
        0,
        edgeSpacerHeight
          + info.index * DRIVER_STATISTICS_CALENDAR_MONTH_ESTIMATED_HEIGHT
          - listHeight * 0.5
          + DRIVER_STATISTICS_CALENDAR_MONTH_ESTIMATED_HEIGHT * 0.5,
      );
      listRef.current?.scrollToOffset({
        offset,
        animated: false,
      });
      requestAnimationFrame(() => {
        listRef.current?.scrollToIndex({
          index: info.index,
          animated: false,
          viewPosition: 0.5,
        });
      });
    },
    [edgeSpacerHeight, listHeight],
  );

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<ViewToken> }) => {
      const visible = viewableItems.filter(
        (token) => token.isViewable && typeof token.index === "number",
      );
      if (visible.length === 0) return;
      const middle = visible[Math.floor(visible.length / 2)];
      const monthListIndex =
        typeof middle.item === "number" ? middle.item : middle.index;
      if (typeof monthListIndex !== "number") return;
      reportVisibleMonthRef.current(monthListIndex);
    },
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 45,
    minimumViewTime: 40,
  }).current;

  const renderMonth = useCallback(
    ({ item }: ListRenderItemInfo<number>) => (
      <CalendarMonthSection
        monthListIndex={item}
        todayLocalDate={todayLocalDate}
        selectedLocalDate={selectedLocalDate}
        dailyStatisticsIndex={dailyStatisticsIndex}
        goalRecords={goalRecords}
        accentColor={accentColor}
        reducedMotion={reducedMotion}
        onSelectDate={onSelectDate}
      />
    ),
    [
      accentColor,
      dailyStatisticsIndex,
      goalRecords,
      onSelectDate,
      reducedMotion,
      selectedLocalDate,
      todayLocalDate,
    ],
  );

  const keyExtractor = useCallback((item: number) => `month-index-${item}`, []);

  const getItemLayout = useCallback(
    (_: ArrayLike<number> | null | undefined, index: number) => ({
      length: DRIVER_STATISTICS_CALENDAR_MONTH_ESTIMATED_HEIGHT,
      offset: DRIVER_STATISTICS_CALENDAR_MONTH_ESTIMATED_HEIGHT * index,
      index,
    }),
    [],
  );

  const listEdgeSpacerTop = useMemo(
    () => <View style={{ height: edgeSpacerHeight }} testID="calendar-edge-spacer-top" />,
    [edgeSpacerHeight],
  );

  const listEdgeSpacerBottom = useMemo(
    () => (
      <View style={{ minHeight: edgeSpacerHeight }} testID="calendar-edge-spacer-bottom">
        <NextMonthPeek todayLocalDate={todayLocalDate} />
      </View>
    ),
    [edgeSpacerHeight, todayLocalDate],
  );

  return (
    <FlatList
      ref={listRef}
      data={monthIndexes}
      keyExtractor={keyExtractor}
      renderItem={renderMonth}
      getItemLayout={getItemLayout}
      onScrollToIndexFailed={handleScrollToIndexFailed}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
      ListHeaderComponent={listEdgeSpacerTop}
      ListFooterComponent={listEdgeSpacerBottom}
      onLayout={(event) => {
        const nextHeight = Math.round(event.nativeEvent.layout.height);
        if (nextHeight > 0 && nextHeight !== listHeight) {
          setListHeight(nextHeight);
        }
      }}
      initialScrollIndex={Math.min(initialIndex, Math.max(0, monthIndexes.length - 1))}
      initialNumToRender={3}
      maxToRenderPerBatch={2}
      windowSize={5}
      removeClippedSubviews={Platform.OS === "android"}
      showsVerticalScrollIndicator={false}
      testID="earnings-history-calendar-list"
      contentContainerStyle={styles.listContent}
      style={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing[16],
  },
  monthSection: {
    paddingTop: spacing[16],
    paddingBottom: spacing[12],
    minHeight: DRIVER_STATISTICS_CALENDAR_MONTH_ESTIMATED_HEIGHT - 24,
  },
  weekRow: {
    flexDirection: "row",
    marginBottom: spacing[8],
  },
  daySlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    minHeight: 68,
    paddingTop: 2,
  },
  monthAbbrev: {
    fontSize: 17,
    lineHeight: 20,
    fontFamily: fonts.bold,
    marginBottom: 4,
    textAlign: "center",
  },
  dayBubble: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dayNumber: {
    fontSize: 11,
    fontWeight: "700",
  },
  nextMonthPeek: {
    paddingTop: spacing[8],
    opacity: 1,
  },
});
