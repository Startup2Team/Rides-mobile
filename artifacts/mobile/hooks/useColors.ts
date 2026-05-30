import { Platform, PlatformColor, useColorScheme } from 'react-native';

import colors from '@/constants/colors';
import {
  brandGreenHex,
  systemBlueHex,
  systemOrangeHex,
  systemRedHex,
} from '@/constants/systemColors';

/**
 * Semantic colors for the active scheme.
 *
 * iOS: primary / destructive / warning use native `PlatformColor` (systemBlue, systemRed, systemOrange).
 * Brand green (`success`) keeps Taravelis #00C853 for map + live/success moments.
 * Use `*Hex` siblings for alpha suffixes (`primaryHex + '18'`).
 */
export function useColors() {
  const scheme = useColorScheme();
  const palette =
    scheme === 'dark' && 'dark' in colors
      ? (colors as unknown as Record<string, typeof colors.light>).dark
      : colors.light;

  const primaryHex = systemBlueHex(scheme);
  const successHex = brandGreenHex(scheme);
  const warningHex = systemOrangeHex(scheme);
  const destructiveHex = systemRedHex(scheme);

  const useNative = Platform.OS === 'ios';
  const systemBlue = useNative ? PlatformColor('systemBlue') : primaryHex;
  const systemRed = useNative ? PlatformColor('systemRed') : destructiveHex;
  const systemOrange = useNative ? PlatformColor('systemOrange') : warningHex;

  return {
    ...palette,
    radius: colors.radius,
    primary: systemBlue,
    primaryHex,
    tint: systemBlue,
    star: systemBlue,
    accentForeground: systemBlue,
    starMuted: `${primaryHex}55`,
    success: successHex,
    successHex,
    successMuted: palette.successMuted,
    warning: systemOrange,
    warningHex,
    warningMuted: palette.warningMuted,
    destructive: systemRed,
    destructiveHex,
  };
}
