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
import { typography } from '@/constants/typography';
import { useColors } from '@/hooks/useColors';

interface AppInputProps extends TextInputProps {
  label?: string;
  floatingLabel?: string;
  error?: string;
  leftIcon?: keyof typeof Feather.glyphMap;
  leftLabel?: string;
  leftLabelDivider?: boolean;
  rightIcon?: keyof typeof Feather.glyphMap;
  onRightIconPress?: () => void;
}

export function AppInput({
  label,
  floatingLabel,
  error,
  leftIcon,
  leftLabel,
  leftLabelDivider = true,
  rightIcon,
  onRightIconPress,
  style,
  ...props
}: AppInputProps) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? colors.destructive
    : focused
    ? colors.primary
    : colors.border;
  const showFloatingLabel = Boolean(floatingLabel && (focused || String(props.value ?? '').length > 0));

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
        {showFloatingLabel && (
          <Text
            style={[
              styles.floatingLabel,
              {
                backgroundColor: colors.background,
                color: focused ? colors.primary : colors.mutedForeground,
                left: leftIcon ? 38 : 12,
              },
            ]}
          >
            {floatingLabel}
          </Text>
        )}
        {leftIcon && (
          <Feather name={leftIcon} size={18} color={colors.mutedForeground} style={styles.leftIcon} />
        )}
        {leftLabel && (
          <Text
            style={[
              styles.leftLabel,
              leftLabelDivider ? styles.leftLabelDivider : styles.leftLabelNoDivider,
              { color: colors.foreground },
            ]}
          >
            {leftLabel}
          </Text>
        )}
        <TextInput
          {...props}
          placeholder={showFloatingLabel ? '' : props.placeholder}
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
    ...typography.label,
    marginLeft: 2,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 14,
  },
  floatingLabel: {
    position: 'absolute',
    top: -8,
    paddingHorizontal: 3,
    ...typography.tiny,
    zIndex: 2,
  },
  input: {
    flex: 1,
    ...typography.body,
  },
  leftIcon: { marginRight: 10 },
  leftLabel: {
    ...typography.body,
    fontFamily: typography.label.fontFamily,
    marginRight: 4,
    paddingRight: 8,
  },
  leftLabelDivider: {
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  leftLabelNoDivider: {
    borderRightWidth: 0,
    paddingRight: 0,
    marginRight: 6,
  },
  rightIcon: { padding: 4 },
  error: {
    ...typography.caption,
    marginLeft: 2,
  },
});
