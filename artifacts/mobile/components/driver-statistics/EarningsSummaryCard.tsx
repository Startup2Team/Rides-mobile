import React, { useRef } from "react";
import { Animated, Platform, Pressable, StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { AppText } from "@/components/AppText";
import { radius } from "@/constants/radius";
import { spacing, semanticSpacing } from "@/constants/spacing";
import { typography } from "@/constants/typography";
import { useColors } from "@/hooks/useColors";
import { driverStatisticsHaptics } from "@/domains/driver-statistics/driverStatisticsHaptics";
import { DRIVER_STATISTICS_MOTION } from "@/domains/driver-statistics/driverStatisticsMotion";
import { ProgressRing } from "./ProgressRing";
import { formatRwf } from "@/domain/driverActivitySummary";

export type EarningsGoalDisplayStatus =
  | "loading"
  | "configured"
  | "not-configured"
  | "error";

interface EarningsSummaryCardProps {
  periodLabel: string;
  earningsLabel: string;
  completedTrips: number;
  periodEarnings: number;
  /** Only used when goalStatus is "configured". */
  targetEarnings?: number | null;
  goalStatus?: EarningsGoalDisplayStatus;
  onPress?: () => void;
  onPressSetGoal?: () => void;
  reducedMotion?: boolean;
}

export function EarningsSummaryCard({
  completedTrips,
  earningsLabel,
  periodLabel,
  periodEarnings,
  targetEarnings = null,
  goalStatus = "not-configured",
  onPress,
  onPressSetGoal,
  reducedMotion = false,
}: EarningsSummaryCardProps) {
  const colors = useColors();
  const pressScale = useRef(new Animated.Value(1)).current;
  const pressOpacity = useRef(new Animated.Value(1)).current;
  const suppressCardPressRef = useRef(false);

  const goalConfigured =
    goalStatus === "configured"
    && typeof targetEarnings === "number"
    && targetEarnings > 0;
  const goalUnconfigured = goalStatus === "not-configured";
  const showSetGoal =
    goalUnconfigured && typeof onPressSetGoal === "function";

  let activeTarget = goalConfigured ? targetEarnings : 0;
  if (goalConfigured) {
    const lowerPeriod = periodLabel.toLowerCase();
    if (lowerPeriod.includes("week")) {
      activeTarget = targetEarnings * 5;
    } else if (lowerPeriod.includes("month")) {
      activeTarget = targetEarnings * 20;
    }
  }

  const progress = goalConfigured && activeTarget > 0
    ? periodEarnings / activeTarget
    : 0;
  const displayEarnings = earningsLabel.replace(/\s*RWF/gi, "");
  const targetLabel = goalConfigured ? formatRwf(activeTarget) : null;

  const goalValueText = goalStatus === "loading"
    ? "…"
    : goalStatus === "error"
      ? "—/—"
      : goalConfigured
        ? `${displayEarnings}/${targetLabel}`
        : "--/--";

  const accessibilityLabel = goalConfigured
    ? `Earnings for ${periodLabel}. ${earningsLabel} of ${targetLabel} goal. ${completedTrips} completed trips.`
    : goalStatus === "loading"
      ? `Earnings for ${periodLabel}. ${earningsLabel}. Daily goal loading.`
      : goalStatus === "error"
        ? `Earnings for ${periodLabel}. ${earningsLabel}. Daily goal unavailable.`
        : `Earnings for ${periodLabel}. ${earningsLabel}. Daily earnings goal not set. Set daily earnings goal.`;

  const animatePress = (pressed: boolean) => {
    if (!onPress || reducedMotion) return;
    Animated.parallel([
      Animated.timing(pressScale, {
        toValue: pressed ? DRIVER_STATISTICS_MOTION.summaryCardPressedScale : 1,
        duration: pressed
          ? DRIVER_STATISTICS_MOTION.summaryCardPressInMs
          : DRIVER_STATISTICS_MOTION.summaryCardPressOutMs,
        useNativeDriver: true,
      }),
      Animated.timing(pressOpacity, {
        toValue: pressed ? DRIVER_STATISTICS_MOTION.summaryCardPressedOpacity : 1,
        duration: pressed
          ? DRIVER_STATISTICS_MOTION.summaryCardPressInMs
          : DRIVER_STATISTICS_MOTION.summaryCardPressOutMs,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePress = () => {
    if (suppressCardPressRef.current) {
      suppressCardPressRef.current = false;
      return;
    }
    if (!onPress) return;
    void driverStatisticsHaptics.lightImpact();
    onPress();
  };

  const handleSetGoalPress = () => {
    if (!onPressSetGoal) return;
    suppressCardPressRef.current = true;
    void driverStatisticsHaptics.lightImpact();
    onPressSetGoal();
  };

  return (
    <Pressable
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={onPress ? "button" : undefined}
      onPress={handlePress}
      onPressIn={() => animatePress(true)}
      onPressOut={() => animatePress(false)}
      testID="earnings-summary-card"
    >
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            opacity: onPress ? pressOpacity : 1,
            transform: [{ scale: onPress ? pressScale : 1 }],
          },
        ]}
      >
      <View style={styles.header}>
        <View style={styles.titleGroup}>
          <AppText
            style={[styles.title, { color: colors.foreground }]}
            numberOfLines={1}
          >
            Earnings
          </AppText>
          {periodLabel && periodLabel.toLowerCase() !== "today" ? (
            <AppText
              style={[styles.period, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              {periodLabel}
            </AppText>
          ) : null}
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.ringWrapper}>
          <ProgressRing
            size={140}
            strokeWidth={28}
            progress={progress}
            color={colors.primaryHex}
            trackColor={colors.primaryHex}
            trackOpacity={0.24}
            showArrow={true}
            goalState={goalConfigured ? "configured" : "unconfigured"}
            animationMode={goalConfigured ? "entry-and-updates" : "none"}
            animateArrow={false}
            detailLevel="full"
            reducedMotion={reducedMotion}
            testID="summary-earnings-progress-ring"
          />
        </View>

        <View style={styles.valueWrapper}>
          <AppText style={[styles.targetLabel, { color: colors.foreground }]}>
            Goal
          </AppText>
          {goalUnconfigured ? (
            <AppText
              style={[styles.value, { color: colors.primary }]}
              numberOfLines={1}
              testID="summary-goal-unset-label"
            >
              {goalValueText}
            </AppText>
          ) : (
            <View style={styles.valuesContainer}>
              <AppText
                style={[styles.value, { color: colors.primary }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                testID="summary-goal-value"
              >
                {goalValueText}
              </AppText>
            </View>
          )}
        </View>
      </View>

      {showSetGoal ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Set daily earnings goal"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={handleSetGoalPress}
          style={({ pressed }) => [
            styles.setGoalChip,
            {
              backgroundColor: colors.foreground,
              opacity: pressed ? 0.72 : 1,
            },
          ]}
          testID="summary-set-goal-cta"
        >
          <AppText style={[styles.setGoalChipText, { color: colors.background }]}>
            Set goal
          </AppText>
        </Pressable>
      ) : null}

      {onPress && (
        <View style={[styles.chevronBadge, { backgroundColor: colors.border }]}>
          <Feather
            name="chevron-right"
            size={12}
            color={colors.mutedForeground}
          />
        </View>
      )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius["3xl"],
    padding: semanticSpacing.cardPadding,
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 3,
    ...Platform.select({ web: { boxShadow: "0 6px 18px rgba(0,0,0,0.08)" } }),
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[16],
  },
  ringWrapper: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing[8],
    paddingRight: spacing[24],
    marginBottom: spacing[12],
  },
  titleGroup: {
    flex: 1,
    minWidth: 0,
    gap: spacing[2],
  },
  title: {
    ...typography.label,
    fontSize: 13,
  },
  period: {
    ...typography.tiny,
  },
  targetLabel: {
    ...typography.tiny,
    textTransform: "uppercase",
    marginBottom: spacing[2],
  },
  valueWrapper: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  valuesContainer: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  setGoalChip: {
    position: "absolute",
    right: spacing[12],
    bottom: spacing[12],
    minHeight: 32,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[6],
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  setGoalChipText: {
    ...typography.label,
    fontSize: 12,
    fontWeight: "700",
  },
  value: {
    ...typography.h1,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
  },
  chevronBadge: {
    position: "absolute",
    top: spacing[12],
    right: spacing[12],
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
