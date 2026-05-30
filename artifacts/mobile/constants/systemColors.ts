import { Platform, PlatformColor, type OpaqueColorValue } from 'react-native';

/**
 * Apple UIKit dynamic system colors — prefer PlatformColor on iOS.
 * @see https://developer.apple.com/documentation/uikit/standard-colors
 * @see https://developer.apple.com/design/human-interface-guidelines/color
 *
 * Hex values are HIG sRGB fallbacks for web/Android and alpha suffixes only.
 */

/** `UIColor.systemBlue` */
export const APPLE_SYSTEM_BLUE_HEX = {
  light: '#007AFF',
  dark: '#0A84FF',
} as const;

/** `UIColor.systemGreen` */
export const APPLE_SYSTEM_GREEN_HEX = {
  light: '#34C759',
  dark: '#30D158',
} as const;

/** `UIColor.systemOrange` */
export const APPLE_SYSTEM_ORANGE_HEX = {
  light: '#FF9500',
  dark: '#FF9F0A',
} as const;

/** `UIColor.systemRed` */
export const APPLE_SYSTEM_RED_HEX = {
  light: '#FF3B30',
  dark: '#FF453A',
} as const;

/** `UIColor.systemGray` — secondary labels / chrome */
export const APPLE_SYSTEM_GRAY_HEX = {
  light: '#8E8E93',
  dark: '#8E8E93',
} as const;

/** Taravelis brand green (original accent) — use for success / live / on-map “you”. */
export const TARAVELIS_BRAND_GREEN_HEX = {
  light: '#00C853',
  dark: '#32D74B',
} as const;

export type AppColor = string | OpaqueColorValue;

export function iosPlatformColor(name: string, fallbackLight: string): AppColor {
  return Platform.OS === 'ios' ? PlatformColor(name) : fallbackLight;
}

export const iosSystemBlue = iosPlatformColor('systemBlue', APPLE_SYSTEM_BLUE_HEX.light);
export const iosSystemGreen = iosPlatformColor('systemGreen', APPLE_SYSTEM_GREEN_HEX.light);
export const iosSystemOrange = iosPlatformColor('systemOrange', APPLE_SYSTEM_ORANGE_HEX.light);
export const iosSystemRed = iosPlatformColor('systemRed', APPLE_SYSTEM_RED_HEX.light);

export function systemBlueHex(scheme: 'light' | 'dark' | null | undefined): string {
  return scheme === 'dark' ? APPLE_SYSTEM_BLUE_HEX.dark : APPLE_SYSTEM_BLUE_HEX.light;
}

export function brandGreenHex(scheme: 'light' | 'dark' | null | undefined): string {
  return scheme === 'dark' ? TARAVELIS_BRAND_GREEN_HEX.dark : TARAVELIS_BRAND_GREEN_HEX.light;
}

export function systemOrangeHex(scheme: 'light' | 'dark' | null | undefined): string {
  return scheme === 'dark' ? APPLE_SYSTEM_ORANGE_HEX.dark : APPLE_SYSTEM_ORANGE_HEX.light;
}

export function systemRedHex(scheme: 'light' | 'dark' | null | undefined): string {
  return scheme === 'dark' ? APPLE_SYSTEM_RED_HEX.dark : APPLE_SYSTEM_RED_HEX.light;
}

export function systemBlueWithAlpha(
  scheme: 'light' | 'dark' | null | undefined,
  alphaHex: string,
): string {
  return `${systemBlueHex(scheme)}${alphaHex}`;
}

export function brandGreenWithAlpha(
  scheme: 'light' | 'dark' | null | undefined,
  alphaHex: string,
): string {
  return `${brandGreenHex(scheme)}${alphaHex}`;
}
