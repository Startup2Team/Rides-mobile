import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { millisecondsUntilNextLocalMidnight } from '@/domains/driver-statistics/driverLocalDates';
import { toLocalDateString } from '@/domains/driver-statistics/driverDailyGoals';

export function useCurrentLocalDate() {
  const [currentLocalDate, setCurrentLocalDate] = useState(() => toLocalDateString(new Date()));

  const refreshCurrentLocalDate = useCallback(() => {
    const nextLocalDate = toLocalDateString(new Date());
    setCurrentLocalDate(current => current === nextLocalDate ? current : nextLocalDate);
    return nextLocalDate;
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let active = true;

    const scheduleNextMidnight = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (!active) return;
        refreshCurrentLocalDate();
        scheduleNextMidnight();
      }, millisecondsUntilNextLocalMidnight());
    };

    scheduleNextMidnight();
    const subscription = AppState?.addEventListener?.('change', state => {
      if (state === 'active') {
        refreshCurrentLocalDate();
        scheduleNextMidnight();
      }
    });

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      subscription?.remove?.();
    };
  }, [refreshCurrentLocalDate]);

  return { currentLocalDate, refreshCurrentLocalDate };
}
