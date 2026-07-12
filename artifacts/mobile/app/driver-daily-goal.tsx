import React, { useCallback, useEffect, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "@/components/AppText";
import { GlassHeader, useGlassHeaderMetrics } from "@/components/GlassHeader";
import { useToast } from "@/context/ToastContext";
import { useColors } from "@/hooks/useColors";
import { formatRwf } from "@/domain/driverActivitySummary";
import {
  DAILY_GOAL_STEP_RWF,
  DEFAULT_DAILY_GOAL_RWF,
  MAX_DAILY_GOAL_RWF,
  MIN_DAILY_GOAL_RWF,
  resolveDailyGoalForDate,
  upsertDailyGoalForEffectiveDate,
  driverStatisticsHaptics,
} from "@/domains/driver-statistics";
import {
  loadStoredDriverDailyGoals,
  saveStoredDriverDailyGoals,
} from "@/persistence/driverDailyGoalPersistence";
import { publishDriverDailyGoalUpdate } from "@/persistence/driverDailyGoalUpdateSignal";
import { useCurrentLocalDate } from "@/hooks/useCurrentLocalDate";
import { fonts } from "@/constants/fonts";
import { radius } from "@/constants/radius";
import { spacing } from "@/constants/spacing";
import { typography } from "@/constants/typography";

function getFontSize(textLength: number) {
  if (textLength > 6) return 40;
  if (textLength > 5) return 48;
  return 56;
}

function getLineHeight(textLength: number) {
  if (textLength > 6) return 48;
  if (textLength > 5) return 56;
  return 64;
}

function getDisplayFontSize(textLength: number) {
  if (textLength > 9) return 36;
  if (textLength > 7) return 44;
  return 56;
}

function getDisplayLineHeight(textLength: number) {
  if (textLength > 9) return 44;
  if (textLength > 7) return 52;
  return 64;
}

export default function DriverDailyGoalScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { contentTop } = useGlassHeaderMetrics();
  const { showToast } = useToast();
  const [records, setRecords] = useState<
    Awaited<ReturnType<typeof loadStoredDriverDailyGoals>>["data"]
  >([]);
  const [initialGoal, setInitialGoal] = useState(DEFAULT_DAILY_GOAL_RWF);
  const [draftGoal, setDraftGoal] = useState(DEFAULT_DAILY_GOAL_RWF);
  const [inputText, setInputText] = useState(String(DEFAULT_DAILY_GOAL_RWF));
  const [isEditing, setIsEditing] = useState(false);
  const [selection, setSelection] = useState<
    { start: number; end: number } | undefined
  >(undefined);
  const [saving, setSaving] = useState(false);
  const { currentLocalDate: todayLocalDate, refreshCurrentLocalDate } =
    useCurrentLocalDate();
  const preEditValueRef = React.useRef(draftGoal);
  const inputRef = React.useRef<TextInput>(null);

  useEffect(() => {
    let mounted = true;
    async function loadGoal() {
      const stored = await loadStoredDriverDailyGoals();
      const nextRecords = stored.data ?? [];
      const goal = resolveDailyGoalForDate({
        records: nextRecords,
        selectedLocalDate: todayLocalDate,
        fallbackGoal: DEFAULT_DAILY_GOAL_RWF,
      });
      if (mounted) {
        setRecords(nextRecords);
        setInitialGoal(goal);
        setDraftGoal(goal);
        setInputText(String(goal));
      }
    }
    loadGoal();
    return () => {
      mounted = false;
    };
  }, [todayLocalDate]);

  const canDecrease = draftGoal > MIN_DAILY_GOAL_RWF;
  const canIncrease = draftGoal < MAX_DAILY_GOAL_RWF;

  const adjustGoal = useCallback(
    (direction: -1 | 1) => {
      setDraftGoal((current) => {
        let base = current;
        if (isNaN(base) || base === 0) {
          base = initialGoal;
        }
        const next = base + direction * DAILY_GOAL_STEP_RWF;
        if (next < MIN_DAILY_GOAL_RWF || next > MAX_DAILY_GOAL_RWF) {
          // Disabled controls should not fire; keep a silent clamp as a safety net.
          const clamped = Math.min(
            MAX_DAILY_GOAL_RWF,
            Math.max(MIN_DAILY_GOAL_RWF, next),
          );
          setInputText(String(clamped));
          return clamped;
        }
        void driverStatisticsHaptics.selection();
        setInputText(String(next));
        return next;
      });
    },
    [initialGoal],
  );

  const handleStartEditing = useCallback(() => {
    preEditValueRef.current = draftGoal;
    setIsEditing(true);
    const textVal = String(draftGoal);
    setInputText(textVal);
    setSelection({ start: 0, end: textVal.length });
  }, [draftGoal]);

  const handleInputChange = useCallback(
    (text: string) => {
      const cleaned = text.replace(/[^0-9]/g, '');
      if (cleaned === '') {
        setInputText('');
        setDraftGoal(0);
        return;
      }
      const parsed = parseInt(cleaned, 10);
      if (!isNaN(parsed) && parsed > MAX_DAILY_GOAL_RWF) {
        void driverStatisticsHaptics.warning();
        inputRef.current?.setNativeProps({ text: inputText });
        return;
      }
      setInputText(cleaned);
      setDraftGoal(isNaN(parsed) ? 0 : parsed);
    },
    [inputText],
  );

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    setSelection(undefined);
    if (inputText === "") {
      const restored = preEditValueRef.current;
      setDraftGoal(restored);
      setInputText(String(restored));
    } else {
      const parsed = parseInt(inputText, 10);
      if (isNaN(parsed) || parsed === 0) {
        const restored = preEditValueRef.current;
        setDraftGoal(restored);
        setInputText(String(restored));
      } else {
        const clamped = Math.min(
          MAX_DAILY_GOAL_RWF,
          Math.max(MIN_DAILY_GOAL_RWF, parsed),
        );
        setDraftGoal(clamped);
        setInputText(String(clamped));
      }
    }
  }, [inputText]);

  const isDraftValid =
    draftGoal >= MIN_DAILY_GOAL_RWF && draftGoal <= MAX_DAILY_GOAL_RWF;
  const hasChanged = draftGoal !== initialGoal;
  const canSave = isDraftValid && hasChanged && !saving;

  const handleSave = useCallback(async () => {
    if (!canSave || saving) return;
    Keyboard.dismiss();
    setSaving(true);
    try {
      const effectiveFromLocalDate = refreshCurrentLocalDate();
      const nextRecords = upsertDailyGoalForEffectiveDate({
        records: records ?? [],
        effectiveFromLocalDate,
        amountRwf: draftGoal,
      });
      await saveStoredDriverDailyGoals(nextRecords);
      publishDriverDailyGoalUpdate();
      void driverStatisticsHaptics.success();
      showToast("Daily goal updated", "success", { haptic: false });
      router.back();
    } catch {
      void driverStatisticsHaptics.warning();
      showToast("Could not save daily goal", "error", { haptic: false });
    } finally {
      setSaving(false);
    }
  }, [canSave, draftGoal, records, refreshCurrentLocalDate, saving, showToast]);

  const displayVal = formatRwf(draftGoal).replace(/\s*RWF/gi, "");
  const displayFontSize = getDisplayFontSize(displayVal.length);
  const displayLineHeight = getDisplayLineHeight(displayVal.length);

  const inputFontSize = getFontSize(inputText.length);
  const inputLineHeight = getLineHeight(inputText.length);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Pressable
        onPress={Keyboard.dismiss}
        style={[
          styles.screen,
          { backgroundColor: colors.background, paddingTop: contentTop },
        ]}
      >
        <GlassHeader
          title="Daily Earnings Goal"
          showBack
          onBackPress={() => router.back()}
        />

        <View style={styles.intro}>
          <AppText
            style={[styles.description, { color: colors.mutedForeground }]}
          >
            Set a daily goal based on how active you want to be on the road, or
            how much you would like to earn each day.
          </AppText>
        </View>

        <View style={styles.centerContent}>
          <View style={styles.amountContainer}>
            <View style={styles.controlRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Decrease daily earnings goal"
                disabled={!canDecrease}
                onPress={() => adjustGoal(-1)}
                style={({ pressed }) => [
                  styles.adjustButton,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    opacity: !canDecrease ? 0.35 : pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Feather name="minus" size={24} color={colors.foreground} />
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit daily earnings goal amount"
                accessibilityHint="Opens the numeric keyboard"
                onPress={handleStartEditing}
                style={[
                  styles.amountTouchArea,
                  {
                    borderBottomColor: isEditing
                      ? colors.primary
                      : "transparent",
                  },
                ]}
              >
                {isEditing ? (
                  <TextInput
                    ref={inputRef}
                    testID="daily-goal-amount-input"
                    accessibilityLabel="Daily goal amount input"
                    value={inputText}
                    onChangeText={handleInputChange}
                    onBlur={handleBlur}
                    selection={selection}
                    onSelectionChange={(e) =>
                      setSelection(e.nativeEvent.selection)
                    }
                    autoFocus
                    keyboardType="number-pad"
                    selectTextOnFocus
                    style={[
                      styles.amountInput,
                      {
                        color: colors.foreground,
                        fontSize: inputFontSize,
                        lineHeight: inputLineHeight,
                      },
                    ]}
                  />
                ) : (
                  <AppText
                    testID="daily-goal-amount-display"
                    style={[
                      styles.amount,
                      {
                        color: colors.foreground,
                        fontSize: displayFontSize,
                        lineHeight: displayLineHeight,
                      },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {displayVal}
                  </AppText>
                )}
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Increase daily earnings goal"
                disabled={!canIncrease}
                onPress={() => adjustGoal(1)}
                style={({ pressed }) => [
                  styles.adjustButton,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    opacity: !canIncrease ? 0.35 : pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Feather name="plus" size={24} color={colors.foreground} />
              </Pressable>
            </View>

            <AppText style={[styles.unit, { color: colors.mutedForeground }]}>
              RWF per day
            </AppText>
          </View>
        </View>

        <View
          style={[
            styles.bottomAction,
            { paddingBottom: Math.max(insets.bottom, 20) },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save daily earnings goal"
            disabled={!canSave}
            onPress={handleSave}
            style={({ pressed }) => [
              styles.saveButton,
              {
                backgroundColor: colors.primaryHex,
                opacity: !canSave ? 0.45 : pressed ? 0.78 : 1,
              },
            ]}
          >
            <AppText style={styles.saveButtonText}>
              {saving ? "Saving..." : "Save Goal"}
            </AppText>
          </Pressable>
        </View>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  intro: {
    paddingHorizontal: spacing[24],
    gap: spacing[8],
    alignItems: "center",
  },
  title: {
    ...typography.display,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    textAlign: "center",
  },
  description: {
    fontSize: 17,
    lineHeight: 24,
    textAlign: "center",
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  amountContainer: {
    alignItems: "center",
    width: "100%",
    paddingHorizontal: spacing[20],
  },
  controlRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    gap: spacing[16],
  },
  adjustButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  amountTouchArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 80,
    borderBottomWidth: 2,
  },
  amount: {
    fontFamily: fonts.bold,
    fontWeight: "700",
    textAlign: "center",
  },
  amountInput: {
    fontFamily: fonts.bold,
    fontWeight: "700",
    textAlign: "center",
    width: "100%",
    paddingVertical: 0,
  },
  unit: {
    ...typography.label,
    marginTop: spacing[8],
    textAlign: "center",
  },
  bottomAction: {
    paddingHorizontal: spacing[20],
    paddingTop: spacing[16],
    marginBottom: spacing[20],
  },
  saveButton: {
    height: 54,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  saveButtonText: {
    ...typography.button,
    color: "#FFFFFF",
  },
});
