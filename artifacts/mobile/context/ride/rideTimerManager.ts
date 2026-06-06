export type RideSessionToken = number;

export function createRideTimerManager() {
  let session = 0;
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  const intervals = new Set<ReturnType<typeof setInterval>>();

  const clearTimeoutHandle = (handle: ReturnType<typeof setTimeout> | null) => {
    if (!handle) return;
    clearTimeout(handle);
    timeouts.delete(handle);
  };

  const clearIntervalHandle = (handle: ReturnType<typeof setInterval> | null) => {
    if (!handle) return;
    clearInterval(handle);
    intervals.delete(handle);
  };

  const clearAll = () => {
    timeouts.forEach(clearTimeout);
    intervals.forEach(clearInterval);
    timeouts.clear();
    intervals.clear();
  };

  const startSession = (): RideSessionToken => {
    clearAll();
    session += 1;
    return session;
  };

  const endSession = (): RideSessionToken => startSession();

  const isActive = (token: RideSessionToken) => token === session;

  const scheduleTimeout = (
    callback: () => void,
    delayMs: number,
    token: RideSessionToken = session,
  ) => {
    const handle = setTimeout(() => {
      timeouts.delete(handle);
      if (isActive(token)) callback();
    }, delayMs);
    timeouts.add(handle);
    return handle;
  };

  const scheduleInterval = (
    callback: () => void,
    delayMs: number,
    token: RideSessionToken = session,
  ) => {
    const handle = setInterval(() => {
      if (isActive(token)) {
        callback();
      } else {
        clearIntervalHandle(handle);
      }
    }, delayMs);
    intervals.add(handle);
    return handle;
  };

  return {
    startSession,
    endSession,
    currentSession: () => session,
    isActive,
    scheduleTimeout,
    scheduleInterval,
    clearTimeout: clearTimeoutHandle,
    clearInterval: clearIntervalHandle,
    clearAll,
  };
}

export type RideTimerManager = ReturnType<typeof createRideTimerManager>;
