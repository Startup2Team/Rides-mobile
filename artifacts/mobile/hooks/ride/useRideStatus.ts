import { useEffect, useMemo, useState } from 'react';
import type { Ride } from '@/types';

const STATUS_MESSAGES: Record<string, string> = {
  confirmed: 'Ride confirmed',
  arriving: 'Driver is on the way',
  arrived: 'Your driver has arrived!',
  in_progress: 'Heading to destination',
  completed: 'Ride completed!',
};

const PICKUP_WAIT_LIMIT_SECONDS = 180;

function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
}

function formatLateDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes === 0) return `${remainingSeconds} sec`;
  if (remainingSeconds === 0) return `${minutes} min`;
  return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
}

export function useRideStatus(currentRide: Ride | null) {
  const [waitClockTick, setWaitClockTick] = useState(0);
  const isArriving = currentRide?.status === 'arriving';
  const isArrived = currentRide?.status === 'arrived';
  const isInProgress = currentRide?.status === 'in_progress';

  useEffect(() => {
    if (!isArrived) return;
    const interval = setInterval(() => {
      setWaitClockTick(tick => tick + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isArrived]);

  const waitElapsedSeconds = useMemo(() => {
    if (!isArrived || !currentRide?.waitStartedAt) return 0;
    const startedMs = new Date(currentRide.waitStartedAt).getTime();
    if (Number.isNaN(startedMs)) return 0;
    return Math.max(0, Math.floor((Date.now() - startedMs) / 1000));
  }, [currentRide?.waitStartedAt, isArrived, waitClockTick]);

  const waitRemainingSeconds = Math.max(PICKUP_WAIT_LIMIT_SECONDS - waitElapsedSeconds, 0);
  const lateSeconds = Math.max(waitElapsedSeconds - PICKUP_WAIT_LIMIT_SECONDS, 0);
  const isPickupLate = lateSeconds > 0;
  const arrivedBannerMessage = isPickupLate
    ? `Your driver is still waiting. You are ${formatLateDuration(lateSeconds)} late. Please come to the pickup point.`
    : `Your driver has arrived. Please come to the pickup point. (Waiting: ${formatCountdown(waitRemainingSeconds)})`;

  return {
    arrivedBannerMessage,
    isArrived,
    isArriving,
    isInProgress,
    isPickupLate,
    statusMessage: currentRide ? STATUS_MESSAGES[currentRide.status] ?? 'Ride confirmed' : 'Ride confirmed',
  };
}
