import { useCallback, useEffect, useRef } from 'react';

export function usePressGuard(action: () => void, cooldownMs = 800) {
  const lockedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  return useCallback(() => {
    if (lockedRef.current) {
      return;
    }

    lockedRef.current = true;

    try {
      action();
    } finally {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        lockedRef.current = false;
        timeoutRef.current = null;
      }, cooldownMs);
    }
  }, [action, cooldownMs]);
}
