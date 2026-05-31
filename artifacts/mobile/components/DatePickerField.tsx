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

export function formatDateDdMmYyyy(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function parseDateDdMmYyyy(value: string): Date | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]) - 1;
  const year = Number(match[3]);
  const date = new Date(year, month, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

interface DatePickerFieldProps {
  label: string;
  value: string;
  onChange: (formatted: string) => void;
  error?: string;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
}

export function DatePickerField({
  label,
  value,
  onChange,
  error,
  placeholder = 'Select date',
  minimumDate,
  maximumDate,
}: DatePickerFieldProps) {
  const colors = useColors();
  const scheme = useColorScheme();
  const [open, setOpen] = useState(false);

  const parsedDate = useMemo(() => parseDateDdMmYyyy(value), [value]);
  const fallbackDate = maximumDate ?? new Date(2000, 0, 1);

  const [pendingDate, setPendingDate] = useState<Date>(parsedDate ?? fallbackDate);

  const openPicker = useCallback(() => {
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
        <Feather name="calendar" size={18} color={colors.mutedForeground} style={styles.leadingIcon} />
        <Text
          style={[
            styles.value,
            { color: value ? colors.foreground : colors.mutedForeground },
          ]}
        >
          {value || placeholder}
        </Text>
        <Feather name="chevron-down" size={18} color={colors.mutedForeground} />
      </TouchableOpacity>

      {open && Platform.OS === 'ios' && (
        <View style={[styles.pickerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.pickerToolbar, { borderBottomColor: colors.border }]}>
            <TouchableOpacity
              onPress={() => setOpen(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Cancel date selection"
            >
              <Text style={[styles.toolbarAction, { color: colors.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={confirmIos}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
  wrapper: { gap: 6 },
  label: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    marginLeft: 2,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
  },
  leadingIcon: { marginRight: 10 },
  value: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  pickerCard: {
    marginTop: 2,
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  pickerToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toolbarAction: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  picker: {
    height: 216,
  },
  error: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginLeft: 2,
  },
});
