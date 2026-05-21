import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

interface KandaInputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: keyof typeof Feather.glyphMap;
  rightIcon?: keyof typeof Feather.glyphMap;
  onRightIconPress?: () => void;
}

export function KandaInput({
  label,
  error,
  leftIcon,
  rightIcon,
  onRightIconPress,
  style,
  ...props
}: KandaInputProps) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? colors.destructive
    : focused
    ? colors.primary
    : colors.border;

  return (
    <View style={styles.wrapper}>
      {label && (
        <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      )}
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.input,
            borderColor,
            borderWidth: focused || error ? 1.5 : 1,
          },
        ]}
      >
        {leftIcon && (
          <Feather name={leftIcon} size={18} color={colors.mutedForeground} style={styles.leftIcon} />
        )}
        <TextInput
          {...props}
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.input,
            { color: colors.foreground },
            style,
          ]}
          onFocus={e => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={e => {
            setFocused(false);
            props.onBlur?.(e);
          }}
        />
        {rightIcon && (
          <TouchableOpacity onPress={onRightIconPress} style={styles.rightIcon}>
            <Feather name={rightIcon} size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>
      {error && (
        <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6, flex: 1 },
  label: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    marginLeft: 2,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  leftIcon: { marginRight: 10 },
  rightIcon: { padding: 4 },
  error: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginLeft: 2,
  },
});
