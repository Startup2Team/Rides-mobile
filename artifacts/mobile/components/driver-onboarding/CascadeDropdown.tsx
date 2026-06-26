import { AppText } from '@/components/AppText';
import React, { useState } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { styles } from './onboardingStyles';

export function CascadeDropdown({ label, value, options, onSelect, disabled, placeholder }: {
  label: string; value: string; options: string[]; onSelect: (value: string) => void; disabled?: boolean; placeholder?: string;
}) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  return <View style={{ gap: 6 }}>
    <AppText style={[styles.inputLabel, { color: colors.mutedForeground }]}>{label}</AppText>
    <TouchableOpacity style={[styles.dropdown, { borderColor: disabled ? colors.border + '50' : value ? colors.primary : colors.border, backgroundColor: disabled ? colors.muted + '60' : colors.card, opacity: disabled ? 0.6 : 1 }]} onPress={() => { if (!disabled) setOpen(current => !current); }} activeOpacity={0.7}>
      <AppText style={[styles.dropdownText, { color: value ? colors.foreground : colors.mutedForeground }]}>{value || placeholder || `Select ${label}`}</AppText>
      <Feather name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.mutedForeground} />
    </TouchableOpacity>
    {open && options.length > 0 && <View style={[styles.dropdownList, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>{options.map(option => <TouchableOpacity key={option} style={[styles.dropdownItem, { borderBottomColor: colors.border }]} onPress={() => { onSelect(option); setOpen(false); }}>
        <AppText style={[styles.dropdownItemText, { color: option === value ? colors.primary : colors.foreground }]}>{option}</AppText>
        {option === value && <Feather name="check" size={14} color={colors.primary} />}
      </TouchableOpacity>)}</ScrollView>
    </View>}
  </View>;
}
