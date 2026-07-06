import {
  APPLE_SYSTEM_BLUE_HEX,
  APPLE_SYSTEM_ORANGE_HEX,
  APPLE_SYSTEM_RED_HEX,
  BRAND_GREEN_HEX,
} from '@/constants/systemColors';

/**
 * Design tokens. On iOS, `useColors()` maps semantic roles to `PlatformColor` where noted
 * in systemColors.ts (primary → systemBlue, destructive → systemRed, etc.).
 */
const colors = {
  light: {
    text: '#0a0a0a',
    tint: APPLE_SYSTEM_BLUE_HEX.light,

    background: '#F2F2F7',
    foreground: '#0a0a0a',

    card: '#FFFFFF',
    cardForeground: '#0a0a0a',

    primary: APPLE_SYSTEM_BLUE_HEX.light,
    primaryForeground: '#FFFFFF',
    star: APPLE_SYSTEM_BLUE_HEX.light,
    starMuted: `${APPLE_SYSTEM_BLUE_HEX.light}55`,

    /** Live / completed / on-map presence — brand green */
    success: BRAND_GREEN_HEX.light,
    successForeground: '#000000',
    successMuted: `${BRAND_GREEN_HEX.light}18`,

    /** Searching, limits, generic locations */
    warning: APPLE_SYSTEM_ORANGE_HEX.light,
    warningForeground: '#FFFFFF',
    warningMuted: `${APPLE_SYSTEM_ORANGE_HEX.light}18`,

    secondary: '#E8F1FF',
    secondaryForeground: '#1a1a1a',

    muted: '#F0F0F0',
    mutedForeground: '#737373',

    accent: '#E8F1FF',
    accentForeground: APPLE_SYSTEM_BLUE_HEX.light,

    destructive: APPLE_SYSTEM_RED_HEX.light,
    destructiveForeground: '#ffffff',

    border: '#E0E0E0',
    input: '#E0E0E0',

    surface: '#FAFAFA',
    surfaceAlt: '#F0F0F0',
  },

  dark: {
    text: '#FFFFFF',
    tint: APPLE_SYSTEM_BLUE_HEX.dark,

    background: '#000000',
    foreground: '#FFFFFF',

    card: '#1C1C1E',
    cardForeground: '#FFFFFF',

    primary: APPLE_SYSTEM_BLUE_HEX.dark,
    primaryForeground: '#FFFFFF',
    star: APPLE_SYSTEM_BLUE_HEX.dark,
    starMuted: `${APPLE_SYSTEM_BLUE_HEX.dark}55`,

    success: BRAND_GREEN_HEX.dark,
    successForeground: '#000000',
    successMuted: `${BRAND_GREEN_HEX.dark}22`,

    warning: APPLE_SYSTEM_ORANGE_HEX.dark,
    warningForeground: '#000000',
    warningMuted: `${APPLE_SYSTEM_ORANGE_HEX.dark}22`,

    secondary: '#0C1929',
    secondaryForeground: '#FFFFFF',

    muted: '#1E1E1E',
    mutedForeground: '#9E9E9E',

    accent: `${APPLE_SYSTEM_BLUE_HEX.dark}20`,
    accentForeground: APPLE_SYSTEM_BLUE_HEX.dark,

    destructive: APPLE_SYSTEM_RED_HEX.dark,
    destructiveForeground: '#FFFFFF',

    border: '#2A2A2A',
    input: '#1E1E1E',

    surface: '#1C1C1E',
    surfaceAlt: '#1E1E1E',
  },

  radius: 12,
};

export default colors;

export { APPLE_SYSTEM_BLUE_HEX as IOS_SYSTEM_BLUE } from '@/constants/systemColors';
export { BRAND_GREEN_HEX } from '@/constants/systemColors';
