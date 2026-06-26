import React from 'react';
import { StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

interface VerifiedBadgeProps {
  size?: number;
  testID?: string;
}

export function VerifiedBadge({
  size = 18,
  testID,
}: VerifiedBadgeProps) {
  const colors = useColors();
  return (
    <MaterialCommunityIcons
      name="check-decagram"
      size={size}
      color={colors.primary}
      testID={testID}
      accessibilityLabel="Verified driver"
      style={styles.badge}
    />
  );
}

const styles = StyleSheet.create({
  badge: {
    flexShrink: 0,
  },
});

