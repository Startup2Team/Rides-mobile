import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { icons } from '@/constants/icons';
import { radius } from '@/constants/radius';
import { sizes } from '@/constants/sizes';
import { spacing, semanticSpacing } from '@/constants/spacing';
import { formatDateDdMmYyyy, parseDateDdMmYyyy } from '@/utils/dateUtils';
import { typography } from '@/constants/typography';

export { formatDateDdMmYyyy, parseDateDdMmYyyy } from '@/utils/dateUtils';

interface DatePickerFieldProps {
  label: string;
  value: string;
  onChange: (formatted: string) => void;
  error?: string;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  disabled?: boolean;
}

export function DatePickerField({
  label,
  value,
  onChange,
  error,
  placeholder = 'Select date',
  minimumDate,
  maximumDate,
  disabled = false,
}: DatePickerFieldProps) {
  const colors = useColors();
  const scheme = useColorScheme();
  const [open, setOpen] = useState(false);

  const parsedDate = useMemo(() => parseDateDdMmYyyy(value), [value]);
  const fallbackDate = minimumDate ?? maximumDate ?? new Date(2000, 0, 1);

  const [pendingDate, setPendingDate] = useState<Date>(parsedDate ?? fallbackDate);

  const openPicker = useCallback(() => {
    if (disabled) return;
    setPendingDate(parsedDate ?? fallbackDate);

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: parsedDate ?? fallbackDate,
        mode: 'date',
        minimumDate,
        maximumDate,
        onChange: (event, date) => {
          if (event.type === 'set' && date) {
            onChange(formatDateDdMmYyyy(date));
          }
        },
      });
      return;
    }

    setOpen(true);
  }, [fallbackDate, maximumDate, minimumDate, onChange, parsedDate]);

  const confirmIos = () => {
    onChange(formatDateDdMmYyyy(pendingDate));
    setOpen(false);
  };

  const borderColor = error ? colors.destructive : value ? colors.primary : colors.border;

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <TouchableOpacity
        style={[
          styles.field,
          {
            borderColor,
            backgroundColor: colors.card,
          },
        ]}
        onPress={openPicker}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Opens date picker"
      >
        <Feather name="calendar" size={icons.semantic.row} color={colors.mutedForeground} style={styles.leadingIcon} />
        <Text
          style={[
            styles.value,
            { color: value ? colors.foreground : colors.mutedForeground },
          ]}
        >
          {value || placeholder}
        </Text>
        <Feather name="chevron-down" size={icons.semantic.row} color={colors.mutedForeground} />
      </TouchableOpacity>

      {open && Platform.OS === 'ios' && (
        <View style={[styles.pickerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.pickerToolbar, { borderBottomColor: colors.border }]}>
            <TouchableOpacity
              onPress={() => setOpen(false)}
              hitSlop={{ top: spacing[8], bottom: spacing[8], left: spacing[8], right: spacing[8] }}
              accessibilityRole="button"
              accessibilityLabel="Cancel date selection"
            >
              <Text style={[styles.toolbarAction, { color: colors.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={confirmIos}
              hitSlop={{ top: spacing[8], bottom: spacing[8], left: spacing[8], right: spacing[8] }}
              accessibilityRole="button"
              accessibilityLabel="Confirm date of birth"
            >
              <Text style={[styles.toolbarAction, { color: colors.primary }]}>Done</Text>
            </TouchableOpacity>
          </View>
          <DateTimePicker
            value={pendingDate}
            mode="date"
            display="spinner"
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onChange={(_, date) => {
              if (date) setPendingDate(date);
            }}
            themeVariant={scheme === 'dark' ? 'dark' : 'light'}
            style={styles.picker}
          />
        </View>
      )}

      {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: semanticSpacing.compactGap },
  label: {
    ...typography.label,
    fontFamily: typography.label.fontFamily,
    marginLeft: spacing[2],
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: semanticSpacing.listItemPadding,
    height: sizes.input.lg,
    borderRadius: radius.input,
    borderWidth: 1,
  },
  leadingIcon: { marginRight: spacing[10] },
  value: {
    flex: 1,
    ...typography.body,
  },
  pickerCard: {
    marginTop: spacing[2],
    borderWidth: 1,
    borderRadius: radius.input,
    overflow: 'hidden',
  },
  pickerToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: semanticSpacing.cardPadding,
    paddingVertical: spacing[10],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toolbarAction: {
    ...typography.title,
    fontFamily: typography.title.fontFamily,
  },
  picker: {
    height: 216,
  },
  error: {
    ...typography.caption,
    marginLeft: spacing[2],
  },
});
