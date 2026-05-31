import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import {
  BUTTON_FONT_SIZE,
  BUTTON_HEIGHT,
  buttonCornerRadius,
} from '@/constants/buttons';
import { useColors } from '@/hooks/useColors';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

interface KandaButtonProps {
  title: string;
  onPress: () => void;
  /** @default primary — filled accent (iOS borderedProminent) */
  variant?: 'primary' | 'secondary' | 'outline' | 'plain' | 'danger' | 'dangerPlain' | 'ghost' | 'call';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
  icon?: FeatherIcon;
  iconOnly?: boolean;
  /** Tighter padding and label — for three-button action rows */
  compact?: boolean;
  accessibilityLabel?: string;
}

export function KandaButton({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  fullWidth = false,
  icon,
  iconOnly = false,
  compact = false,
  accessibilityLabel,
}: KandaButtonProps) {
  const colors = useColors();
  const resolvedVariant = variant === 'outline' ? 'secondary' : variant;

  const handlePress = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const isFilled =
    resolvedVariant === 'primary'
    || resolvedVariant === 'secondary'
    || resolvedVariant === 'danger'
    || resolvedVariant === 'dangerPlain'
    || resolvedVariant === 'call';

  const bgColor = {
    primary: colors.primary,
    secondary: colors.muted,
    plain: 'transparent',
    danger: colors.destructive,
    dangerPlain: colors.destructive + '14',
    ghost: 'transparent',
    call: colors.call,
  }[resolvedVariant];

  const textColor = {
    primary: colors.primaryForeground,
    secondary: colors.foreground,
    plain: colors.primary,
    danger: colors.destructiveForeground,
    dangerPlain: colors.destructive,
    ghost: colors.foreground,
    call: '#FFFFFF',
  }[resolvedVariant];

  const height = BUTTON_HEIGHT[size];
  const cornerRadius = buttonCornerRadius(height);
  const fontSize = compact && size === 'sm' ? 12 : BUTTON_FONT_SIZE[size];
  const iconSize = compact ? 16 : size === 'sm' ? 18 : 20;

  return (
    <TouchableOpacity
      activeOpacity={isFilled ? 0.72 : 0.55}
      onPress={handlePress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={[
        styles.base,
        iconOnly && styles.iconOnly,
        compact && styles.compact,
        fullWidth && !iconOnly && !compact && styles.fullWidth,
        {
          backgroundColor: bgColor,
          minHeight: height,
          height,
          borderRadius: cornerRadius,
          opacity: disabled ? 0.45 : 1,
          width: fullWidth ? '100%' : iconOnly ? height : undefined,
          minWidth: fullWidth ? undefined : 0,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <>
          {icon && (
            <View style={styles.iconWrap}>
              <Feather name={icon} size={iconSize} color={textColor} />
            </View>
          )}
          {!iconOnly && (
            <Text
              style={[styles.label, { color: textColor, fontSize }]}
              numberOfLines={1}
              adjustsFontSizeToFit={compact}
              minimumFontScale={compact ? 0.85 : 1}
            >
              {title}
            </Text>
          )}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  iconOnly: {
    paddingHorizontal: 0,
  },
  compact: {
    paddingHorizontal: 8,
    gap: 4,
  },
  iconWrap: {
    flexShrink: 0,
  },
  fullWidth: {
    paddingHorizontal: 16,
  },
  label: {
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: -0.2,
    flexShrink: 1,
    textAlign: 'center',
  },
});
