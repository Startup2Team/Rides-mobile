import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { icons } from '@/constants/icons';
import { radius } from '@/constants/radius';
import { spacing } from '@/constants/spacing';
import { typography } from '@/constants/typography';
import { useColors } from '@/hooks/useColors';

const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;

interface SeatStepperProps {
  value: number;
  min?: number;
  max: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  label?: string;
}

/**
 * Seat count control. Both targets are 48×48 with hit slop, and the value
 * carries `accessibilityRole="adjustable"` so VoiceOver / TalkBack can swipe
 * it up and down instead of hunting for the small buttons.
 */
export function SeatStepper({
  value,
  min = 1,
  max,
  onChange,
  disabled = false,
  label = 'Seats',
}: SeatStepperProps) {
  const colors = useColors();
  const canDecrease = !disabled && value > min;
  const canIncrease = !disabled && value < max;

  const step = (delta: number) => {
    const next = Math.min(max, Math.max(min, value + delta));
    if (next !== value) onChange(next);
  };

  return (
    <View style={[styles.row, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Remove a seat. ${value} selected`}
        accessibilityHint="Decreases the number of seats you are booking"
        accessibilityState={{ disabled: !canDecrease }}
        disabled={!canDecrease}
        hitSlop={HIT_SLOP}
        onPress={() => step(-1)}
        style={[styles.button, { opacity: canDecrease ? 1 : 0.35 }]}
      >
        <Feather name="minus" size={icons.size.lg} color={colors.foreground} />
      </TouchableOpacity>

      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: value, text: `${value} ${value === 1 ? 'seat' : 'seats'}` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={event => {
          if (event.nativeEvent.actionName === 'increment') step(1);
          if (event.nativeEvent.actionName === 'decrement') step(-1);
        }}
        style={styles.valueBlock}
      >
        <AppText style={[styles.value, { color: colors.foreground }]}>{value}</AppText>
        <AppText style={[styles.caption, { color: colors.mutedForeground }]}>
          {value === 1 ? 'seat' : 'seats'}
        </AppText>
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Add a seat. ${value} selected`}
        accessibilityHint="Increases the number of seats you are booking"
        accessibilityState={{ disabled: !canIncrease }}
        disabled={!canIncrease}
        hitSlop={HIT_SLOP}
        onPress={() => step(1)}
        style={[styles.button, { opacity: canIncrease ? 1 : 0.35 }]}
      >
        <Feather name="plus" size={icons.size.lg} color={colors.foreground} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[8],
  },
  button: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueBlock: { alignItems: 'center', minWidth: 72, paddingVertical: spacing[4] },
  value: { ...typography.h2, lineHeight: 28 },
  caption: { ...typography.tiny },
});
