import React from 'react';
import { Image, StyleSheet } from 'react-native';

interface VerifiedBadgeProps {
  size?: number;
  testID?: string;
}

export function VerifiedBadge({
  size = 18,
  testID,
}: VerifiedBadgeProps) {
  return (
    <Image
      source={require('../assets/images/verified_badge.png')}
      style={[styles.badge, { width: size, height: size }]}
      accessibilityLabel="Verified driver"
      accessibilityIgnoresInvertColors
      testID={testID}
    />
  );
}

const styles = StyleSheet.create({
  badge: {
    flexShrink: 0,
    transform: [{ translateY: -1 }],
  },
});
