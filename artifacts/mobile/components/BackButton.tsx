import { Feather } from '@expo/vector-icons';
import React from 'react';
import {
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { useColors } from '@/hooks/useColors';

interface BackButtonProps {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

export function BackButton({ onPress, style }: BackButtonProps) {
  const colors = useColors();

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.button,
        { backgroundColor: colors.card, borderColor: colors.border },
        style,
      ]}
      activeOpacity={0.8}
    >
      <Feather name="chevron-left" size={24} color={colors.foreground} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
