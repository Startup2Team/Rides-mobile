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
  floatingLabel?: string;
  error?: string;
  leftIcon?: keyof typeof Feather.glyphMap;
  rightIcon?: keyof typeof Feather.glyphMap;
  onRightIconPress?: () => void;
}

export function KandaInput({
  label,
  floatingLabel,
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
  floatingLabel: {
    position: 'absolute',
    top: -8,
    paddingHorizontal: 3,
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    zIndex: 2,
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
