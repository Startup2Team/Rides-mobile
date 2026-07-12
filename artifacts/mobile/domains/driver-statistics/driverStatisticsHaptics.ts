import * as Haptics from 'expo-haptics';

async function safe(run: () => Promise<unknown>) {
  try {
    await run();
  } catch {
    // Unsupported platform / Expo Go / simulator — ignore.
  }
}

/** Feature-scoped haptic adapter. Mock this boundary in tests. */
export const driverStatisticsHaptics = {
  selection() {
    return safe(() => Haptics.selectionAsync());
  },
  lightImpact() {
    return safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  },
  success() {
    return safe(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    );
  },
  warning() {
    return safe(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
    );
  },
};
