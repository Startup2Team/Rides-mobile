import { Platform, StyleSheet } from 'react-native';
import { elevation } from '@/constants/elevation';
import { radius } from '@/constants/radius';

/**
 * Top corner radius for edge-to-edge bottom sheets (home, booking, ride status).
 * Matches the Driver Arriving / Driver Arrived panel on the ride screen.
 */
export const FLOATING_PANEL_TOP_RADIUS = radius.sheet;

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
  ...elevation.sheet,
} as const;

/**
 * iOS-style surfaces: grouped content uses background contrast, not card outlines.
 * Reserve visible borders for inputs, chips, and outlined controls.
 */
export const CONTENT_CARD_RADIUS = radius.xl;

export const contentCardStyle = {
  borderRadius: CONTENT_CARD_RADIUS,
} as const;

export const groupedDividerStyle = {
  borderTopWidth: StyleSheet.hairlineWidth,
} as const;
