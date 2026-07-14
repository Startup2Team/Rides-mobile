import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
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
  CALENDAR_PREPEND_THRESHOLD,
  appendNewerRelativeMonthOffsetBatch,
  buildCalendarMonthLayouts,
  buildDriverStatisticsCalendarMonthAtOffset,
  createInitialRelativeMonthOffsets,
  createRelativeMonthWindowAroundTarget,
  formatCalendarMonthShortLabel,
  getCalendarMonthLabelForRelativeOffset,
  getRestoredScrollOffsetAfterPrepend,
  getRelativeOffsetForLocalDate,
  prependRelativeMonthOffsetBatch,
  createLocalCalendarDate,
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
  accentColor,
  reducedMotion,
}: {
  todayLocalDate: string;
  accentColor: string;
  reducedMotion: boolean;
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
            <View key={cell.key} style={[styles.daySlot, { opacity: 0.45 }]}>
              {cell.kind === "date" ? (
                <>
                  <AppText
                    style={[
                      styles.monthAbbrev,
                      {
                        color: colors.foreground,
                        opacity: cell.monthShortLabel ? 1 : 0,
                      },
                    ]}
                  >
                    {cell.monthShortLabel ?? " "}
                  </AppText>
                  <View style={styles.dayBubble}>
                    <AppText style={[styles.dayNumber, { color: colors.mutedForeground }]}>
                      {cell.dayNumber}
                    </AppText>
                  </View>
                  <ProgressRing
                    size={40}
                    strokeWidth={9}
                    progress={0}
                    color={accentColor}
                    trackColor={accentColor}
                    trackOpacity={0.24}
                    goalState="unconfigured"
                    animationMode="none"
                    animateArrow={false}
                    detailLevel="compact"
                    reducedMotion={reducedMotion}
                  />
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
  const date = createLocalCalendarDate(
    Number(cell.localDate.slice(0, 4)),
    Number(cell.localDate.slice(5, 7)) - 1,
    Number(cell.localDate.slice(8, 10)),
  );
  const base = date ? dateA11yFormatter.format(date) : cell.localDate;
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
  relativeOffset,
  todayLocalDate,
  selectedLocalDate,
  dailyStatisticsIndex,
  goalRecords,
  accentColor,
  reducedMotion,
  onSelectDate,
}: {
  relativeOffset: number;
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
      buildDriverStatisticsCalendarMonthAtOffset({
        relativeOffset,
        todayLocalDate,
        selectedLocalDate,
        dailyStatisticsIndex,
        goalRecords,
      }),
    [
      dailyStatisticsIndex,
      goalRecords,
      relativeOffset,
      selectedLocalDate,
      todayLocalDate,
    ],
  );

  const monthShortLabel = useMemo(
    () => formatCalendarMonthShortLabel(month.year, month.monthIndex),
    [month.monthIndex, month.year],
  );

  return (
    <View
      style={[styles.monthSection, { height: month.exactHeight }]}
      testID={`calendar-month-${month.monthKey}`}
    >
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
                        color: cell.isFuture
                          ? colors.mutedForeground
                          : cell.isSelected
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
                <ProgressRing
                  size={40}
                  strokeWidth={9}
                  progress={cell.isFuture ? 0 : cell.progress}
                  color={accentColor}
                  trackColor={accentColor}
                  trackOpacity={0.24}
                  goalState={cell.isFuture ? "unconfigured" : cell.goalState}
                  allowSmallOverflowShadow={
                    !cell.isFuture && cell.goalState === "configured"
                  }
                  animationMode="none"
                  animateArrow={false}
                  detailLevel="compact"
                  reducedMotion={reducedMotion}
                  testID={`calendar-progress-ring-${cell.localDate}`}
                />
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
  navigationRequest?: { localDate: string; requestId: number } | null;
  onVisibleMonthChange?: (label: string, relativeOffset: number) => void;
  onNavigationComplete?: (label: string) => void;
}

export function EarningsHistoryCalendar({
  todayLocalDate,
  selectedLocalDate,
  dailyStatisticsIndex,
  goalRecords,
  accentColor,
  reducedMotion = false,
  onSelectDate,
  navigationRequest = null,
  onVisibleMonthChange,
  onNavigationComplete,
}: EarningsHistoryCalendarProps) {
  const colors = useColors();
  const listRef = useRef<FlatList<number>>(null);
  const scrollOffsetRef = useRef(0);
  const firstVisibleOffsetRef = useRef(0);
  const hasInitialScrollRef = useRef(false);
  const isPrependingRef = useRef(false);
  const pendingRestoreRef = useRef<{ relativeOffset: number; displacement: number } | null>(null);
  const pendingTargetOffsetRef = useRef<number | null>(null);
  const handledNavigationRequestRef = useRef<number | null>(null);
  const targetScrollFrameRef = useRef<number | null>(null);
  const [listHeight, setListHeight] = useState(0);
  const currentDate = useMemo(() => localDateStringToLocalDate(todayLocalDate), [todayLocalDate]);
  const currentYear = currentDate?.getFullYear() ?? 1;
  const currentMonthIndex = currentDate?.getMonth() ?? 0;
  const [monthOffsets, setMonthOffsets] = useState(() =>
    createInitialRelativeMonthOffsets(currentYear, currentMonthIndex),
  );
  const monthLayouts = useMemo(
    () => buildCalendarMonthLayouts({ relativeOffsets: monthOffsets, currentYear, currentMonthIndex }),
    [currentMonthIndex, currentYear, monthOffsets],
  );
  const layoutByOffset = useMemo(
    () => new Map(monthLayouts.map((layout) => [layout.relativeOffset, layout])),
    [monthLayouts],
  );
  const selectedOffset = useMemo(
    () => getRelativeOffsetForLocalDate(selectedLocalDate, todayLocalDate),
    [selectedLocalDate, todayLocalDate],
  );
  const foundSelectedIndex = monthOffsets.indexOf(selectedOffset);
  const initialIndex = foundSelectedIndex >= 0 ? foundSelectedIndex : monthOffsets.length - 1;
  const initialLayout = monthLayouts[initialIndex];
  const edgeSpacerHeight = useMemo(
    () => listHeight > 0 && initialLayout
      ? Math.max(0, Math.round((listHeight - initialLayout.length) / 2))
      : 0,
    [initialLayout, listHeight],
  );
  const lastReportedLabelRef = useRef<string | null>(null);
  const visibleMonthCallbackRef = useRef(onVisibleMonthChange);
  visibleMonthCallbackRef.current = onVisibleMonthChange;
  const navigationCompleteCallbackRef = useRef(onNavigationComplete);
  navigationCompleteCallbackRef.current = onNavigationComplete;

  const reportVisibleMonth = useCallback((relativeOffset: number) => {
    const label = getCalendarMonthLabelForRelativeOffset(relativeOffset, todayLocalDate);
    if (lastReportedLabelRef.current === label) return;
    lastReportedLabelRef.current = label;
    visibleMonthCallbackRef.current?.(label, relativeOffset);
  }, [todayLocalDate]);

  const scrollToMonthIndex = useCallback((index: number, animated = false) => {
    const layout = monthLayouts[Math.min(Math.max(0, index), monthLayouts.length - 1)];
    if (!layout) return;
    listRef.current?.scrollToOffset({
      offset: Math.max(0, edgeSpacerHeight + layout.offset - listHeight / 2 + layout.length / 2),
      animated,
    });
    reportVisibleMonth(layout.relativeOffset);
  }, [edgeSpacerHeight, listHeight, monthLayouts, reportVisibleMonth]);

  useEffect(() => {
    if (listHeight <= 0 || monthOffsets.length === 0 || hasInitialScrollRef.current) return;
    hasInitialScrollRef.current = true;
    const handle = requestAnimationFrame(() => scrollToMonthIndex(initialIndex, false));
    return () => cancelAnimationFrame(handle);
  }, [initialIndex, listHeight, monthOffsets.length, scrollToMonthIndex]);

  const prependOlderMonths = useCallback(() => {
    if (isPrependingRef.current) return;
    isPrependingRef.current = true;
    setMonthOffsets((loadedOffsets) => {
      const firstLayout = layoutByOffset.get(firstVisibleOffsetRef.current);
      if (Platform.OS !== "ios" && firstLayout) {
        pendingRestoreRef.current = {
          relativeOffset: firstLayout.relativeOffset,
          displacement: scrollOffsetRef.current - edgeSpacerHeight - firstLayout.offset,
        };
      }
      return prependRelativeMonthOffsetBatch({ loadedOffsets, currentYear, currentMonthIndex });
    });
  }, [currentMonthIndex, currentYear, edgeSpacerHeight, layoutByOffset]);

  const prependOlderMonthsRef = useRef(prependOlderMonths);
  prependOlderMonthsRef.current = prependOlderMonths;
  const reportVisibleMonthRef = useRef(reportVisibleMonth);
  reportVisibleMonthRef.current = reportVisibleMonth;
  const appendNewerMonths = useCallback(() => {
    setMonthOffsets((loadedOffsets) => appendNewerRelativeMonthOffsetBatch({ loadedOffsets }));
  }, []);
  const appendNewerMonthsRef = useRef(appendNewerMonths);
  appendNewerMonthsRef.current = appendNewerMonths;
  const loadedOffsetCountRef = useRef(monthOffsets.length);
  loadedOffsetCountRef.current = monthOffsets.length;

  useLayoutEffect(() => {
    isPrependingRef.current = false;
    const pending = pendingRestoreRef.current;
    if (!pending) return;
    const layout = layoutByOffset.get(pending.relativeOffset);
    if (!layout) return;
    pendingRestoreRef.current = null;
    listRef.current?.scrollToOffset({
      offset: getRestoredScrollOffsetAfterPrepend({
        headerHeight: edgeSpacerHeight,
        monthOffset: layout.offset,
        displacementWithinMonth: pending.displacement,
      }),
      animated: false,
    });
  }, [edgeSpacerHeight, layoutByOffset]);

  useEffect(() => {
    if (!navigationRequest || handledNavigationRequestRef.current === navigationRequest.requestId) return;
    handledNavigationRequestRef.current = navigationRequest.requestId;
    const targetOffset = getRelativeOffsetForLocalDate(navigationRequest.localDate, todayLocalDate);
    const existingIndex = monthOffsets.indexOf(targetOffset);
    if (existingIndex >= 0) {
      targetScrollFrameRef.current = requestAnimationFrame(() => {
        scrollToMonthIndex(existingIndex, false);
        navigationCompleteCallbackRef.current?.(
          getCalendarMonthLabelForRelativeOffset(targetOffset, todayLocalDate),
        );
      });
      return;
    }
    pendingTargetOffsetRef.current = targetOffset;
    setMonthOffsets(createRelativeMonthWindowAroundTarget({
      targetOffset,
      currentYear,
      currentMonthIndex,
    }));
  }, [currentMonthIndex, currentYear, monthOffsets, navigationRequest, scrollToMonthIndex, todayLocalDate]);

  useLayoutEffect(() => {
    const targetOffset = pendingTargetOffsetRef.current;
    if (targetOffset == null) return;
    const targetIndex = monthOffsets.indexOf(targetOffset);
    if (targetIndex < 0) return;
    pendingTargetOffsetRef.current = null;
    targetScrollFrameRef.current = requestAnimationFrame(() => {
      scrollToMonthIndex(targetIndex, false);
      navigationCompleteCallbackRef.current?.(
        getCalendarMonthLabelForRelativeOffset(targetOffset, todayLocalDate),
      );
    });
  }, [monthOffsets, scrollToMonthIndex, todayLocalDate]);

  useEffect(() => () => {
    if (targetScrollFrameRef.current != null) cancelAnimationFrame(targetScrollFrameRef.current);
    pendingTargetOffsetRef.current = null;
  }, []);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<ViewToken> }) => {
      const visible = viewableItems.filter(
        (token) => token.isViewable && typeof token.index === "number" && typeof token.item === "number",
      );
      if (visible.length === 0) return;
      firstVisibleOffsetRef.current = visible[0].item as number;
      reportVisibleMonthRef.current(visible[Math.floor(visible.length / 2)].item as number);
      if ((visible[0].index ?? Number.MAX_SAFE_INTEGER) < CALENDAR_PREPEND_THRESHOLD) {
        prependOlderMonthsRef.current();
      }
      const last = visible.at(-1);
      if (last && (last.index ?? -1) >= loadedOffsetCountRef.current - CALENDAR_PREPEND_THRESHOLD) {
        appendNewerMonthsRef.current();
      }
    },
  ).current;

  const renderMonth = useCallback(({ item }: ListRenderItemInfo<number>) => (
    <CalendarMonthSection
      relativeOffset={item}
      todayLocalDate={todayLocalDate}
      selectedLocalDate={selectedLocalDate}
      dailyStatisticsIndex={dailyStatisticsIndex}
      goalRecords={goalRecords}
      accentColor={accentColor}
      reducedMotion={reducedMotion}
      onSelectDate={onSelectDate}
    />
  ), [accentColor, dailyStatisticsIndex, goalRecords, onSelectDate, reducedMotion, selectedLocalDate, todayLocalDate]);

  const keyExtractor = useCallback((item: number) => {
    const layout = layoutByOffset.get(item);
    return layout ? `calendar-month-${layout.year}-${layout.monthIndex}` : `calendar-month-offset-${item}`;
  }, [layoutByOffset]);
  const getItemLayout = useCallback((_: ArrayLike<number> | null | undefined, index: number) => {
    const layout = monthLayouts[index];
    return layout
      ? { length: layout.length, offset: edgeSpacerHeight + layout.offset, index }
      : { length: 0, offset: edgeSpacerHeight, index };
  }, [edgeSpacerHeight, monthLayouts]);
  const atCommonEraBoundary = monthLayouts[0]?.year === 1 && monthLayouts[0]?.monthIndex === 0;

  return (
    <FlatList
      ref={listRef}
      data={monthOffsets}
      keyExtractor={keyExtractor}
      renderItem={renderMonth}
      getItemLayout={getItemLayout}
      onScrollToIndexFailed={({ index }) => scrollToMonthIndex(index, false)}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={{ itemVisiblePercentThreshold: 45, minimumViewTime: 40 }}
      maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      ListHeaderComponent={(
        <View style={{ minHeight: edgeSpacerHeight }} testID="calendar-edge-spacer-top">
          {atCommonEraBoundary ? (
            <AppText style={[styles.calendarBoundaryText, { color: colors.mutedForeground }]}>Beginning of supported calendar</AppText>
          ) : null}
        </View>
      )}
      ListFooterComponent={(
        <View style={{ minHeight: edgeSpacerHeight }} testID="calendar-edge-spacer-bottom">
          <NextMonthPeek todayLocalDate={todayLocalDate} accentColor={accentColor} reducedMotion={reducedMotion} />
        </View>
      )}
      onLayout={(event) => {
        const nextHeight = Math.round(event.nativeEvent.layout.height);
        if (nextHeight > 0 && nextHeight !== listHeight) setListHeight(nextHeight);
      }}
      onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
        scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
      }}
      scrollEventThrottle={16}
      initialScrollIndex={Math.min(initialIndex, Math.max(0, monthOffsets.length - 1))}
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
  },
  calendarBoundaryText: {
    paddingVertical: spacing[16],
    textAlign: "center",
    fontSize: 13,
  },
  weekRow: {
    flexDirection: "row",
    marginBottom: spacing[8],
  },
  daySlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    minHeight: 78,
    paddingTop: 2,
    gap: 2,
  },
  monthAbbrev: {
    fontSize: 17,
    lineHeight: 20,
    fontFamily: fonts.bold,
    marginBottom: 0,
    textAlign: "center",
  },
  dayBubble: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  dayNumber: {
    fontSize: 12,
    fontWeight: "700",
  },
  nextMonthPeek: {
    paddingTop: spacing[8],
    opacity: 1,
  },
});
