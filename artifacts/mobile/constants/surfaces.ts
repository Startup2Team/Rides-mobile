import { StyleSheet } from 'react-native';

/**
 * iOS-style surfaces: grouped content uses background contrast, not card outlines.
 * Reserve visible borders for inputs, chips, and outlined controls.
 */
export const CONTENT_CARD_RADIUS = 14;

export const contentCardStyle = {
  borderRadius: CONTENT_CARD_RADIUS,
} as const;

export const groupedDividerStyle = {
  borderTopWidth: StyleSheet.hairlineWidth,
} as const;
