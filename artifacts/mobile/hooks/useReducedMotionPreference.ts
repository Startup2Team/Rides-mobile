import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReducedMotionPreference() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.resolve(AccessibilityInfo?.isReduceMotionEnabled?.() ?? false)
      .then(enabled => {
        if (active) setReducedMotion(Boolean(enabled));
      })
      .catch(() => undefined);

    const subscription = AccessibilityInfo?.addEventListener?.(
      'reduceMotionChanged',
      setReducedMotion,
    );
    return () => {
      active = false;
      subscription?.remove?.();
    };
  }, []);

  return reducedMotion;
}
