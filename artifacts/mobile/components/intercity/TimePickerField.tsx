import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import React, { useCallback, useState } from 'react';
import { Platform, StyleSheet, TouchableOpacity, View, useColorScheme } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { icons } from '@/constants/icons';
import { radius } from '@/constants/radius';
import { sizes } from '@/constants/sizes';
import { semanticSpacing, spacing } from '@/constants/spacing';
import { typography } from '@/constants/typography';
import { useColors } from '@/hooks/useColors';

interface TimePickerFieldProps {
  label: string;
  value: Date;
  onChange: (next: Date) => void;
  disabled?: boolean;
  error?: string;
}

const HIT_SLOP = { top: spacing[8], bottom: spacing[8], left: spacing[8], right: spacing[8] } as const;

function formatTime(date: Date): string {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

/**
 * Departure time. `depart_at` is a promise the vehicle never leaves before
 * (INTERCITY_DESIGN §11 D2), so the driver sets it deliberately in the native
 * picker for their platform rather than typing it into a text field.
 */
export function TimePickerField({ disabled = false, error, label, onChange, value }: TimePickerFieldProps) {
  const colors = useColors();
  const scheme = useColorScheme();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Date>(value);

  const openPicker = useCallback(() => {
    if (disabled) return;
    setPending(value);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode: 'time',
        is24Hour: true,
        onChange: (event, date) => {
          if (event.type === 'set' && date) onChange(date);
        },
      });
      return;
    }
    setOpen(true);
  }, [disabled, onChange, value]);

  const borderColor = error ? colors.destructive : colors.border;

  return (
    <View style={styles.wrapper}>
      <AppText style={[styles.label, { color: colors.mutedForeground }]}>{label}</AppText>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatTime(value)}`}
        accessibilityHint="Opens the departure time picker"
        accessibilityState={{ disabled }}
        activeOpacity={0.7}
        disabled={disabled}
        onPress={openPicker}
        style={[styles.field, { borderColor, backgroundColor: colors.card }]}
      >
        <Feather name="clock" size={icons.semantic.row} color={colors.mutedForeground} />
        <AppText style={[styles.value, { color: colors.foreground }]}>{formatTime(value)}</AppText>
        <Feather name="chevron-down" size={icons.semantic.row} color={colors.mutedForeground} />
      </TouchableOpacity>

      {error ? <AppText style={[styles.error, { color: colors.destructive }]}>{error}</AppText> : null}

      {open && Platform.OS === 'ios' ? (
        <View style={[styles.pickerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.toolbar, { borderBottomColor: colors.border }]}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Cancel time selection"
              hitSlop={HIT_SLOP}
              onPress={() => setOpen(false)}
            >
              <AppText style={[styles.toolbarAction, { color: colors.mutedForeground }]}>Cancel</AppText>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Confirm departure time"
              hitSlop={HIT_SLOP}
              onPress={() => {
                onChange(pending);
                setOpen(false);
              }}
            >
              <AppText style={[styles.toolbarAction, { color: colors.primary }]}>Done</AppText>
            </TouchableOpacity>
          </View>
          <DateTimePicker
            value={pending}
            mode="time"
            display="spinner"
            is24Hour
            onChange={(_, date) => {
              if (date) setPending(date);
            }}
            themeVariant={scheme === 'dark' ? 'dark' : 'light'}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing[6] },
  label: { ...typography.tiny, textTransform: 'uppercase', letterSpacing: 0.6 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: semanticSpacing.inlineGap,
    minHeight: sizes.input.md,
    paddingHorizontal: semanticSpacing.cardPadding,
    borderRadius: radius.input,
    borderWidth: 1,
  },
  value: { ...typography.bodySmall, flex: 1 },
  error: { ...typography.tiny },
  pickerCard: { marginTop: spacing[8], borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: semanticSpacing.cardPadding,
    paddingVertical: spacing[10],
    borderBottomWidth: 1,
  },
  toolbarAction: { ...typography.label },
});
