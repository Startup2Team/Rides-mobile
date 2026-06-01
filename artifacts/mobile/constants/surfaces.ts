import { Platform, StyleSheet } from 'react-native';

/**
 * Top corner radius for edge-to-edge bottom sheets (home, booking, ride status).
 * Matches the Driver Arriving / Driver Arrived panel on the ride screen.
 */
export const FLOATING_PANEL_TOP_RADIUS = 24;

/** Shared surface for bottom-anchored floating panels. */
export const floatingPanelSurface = {
  borderRadius: FLOATING_PANEL_TOP_RADIUS,
  borderBottomLeftRadius: 0,
  borderBottomRightRadius: 0,
  ...Platform.select({
    ios: { borderCurve: 'continuous' as const },
    default: {},
  }),
  borderWidth: StyleSheet.hairlineWidth,
  overflow: 'hidden' as const,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.14,
  shadowRadius: 24,
  elevation: 14,
} as const;

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
