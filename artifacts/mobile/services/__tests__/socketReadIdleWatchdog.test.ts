import { createReadIdleWatchdog } from '../socketReadIdleWatchdog';

describe('createReadIdleWatchdog', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('fires onIdle once the timeout elapses with no reset() call', () => {
    const onIdle = jest.fn();
    const watchdog = createReadIdleWatchdog(onIdle, 70_000);

    watchdog.reset();
    jest.advanceTimersByTime(69_999);
    expect(onIdle).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  test('reset() pushes the deadline out instead of firing early', () => {
    const onIdle = jest.fn();
    const watchdog = createReadIdleWatchdog(onIdle, 70_000);

    watchdog.reset();
    jest.advanceTimersByTime(60_000);
    watchdog.reset(); // simulates an inbound frame arriving
    jest.advanceTimersByTime(60_000); // 60s since the reset — still under 70s
    expect(onIdle).not.toHaveBeenCalled();

    jest.advanceTimersByTime(10_000); // now 70s since the reset
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  test('clear() stops a pending timer from firing', () => {
    const onIdle = jest.fn();
    const watchdog = createReadIdleWatchdog(onIdle, 70_000);

    watchdog.reset();
    watchdog.clear();
    jest.advanceTimersByTime(100_000);
    expect(onIdle).not.toHaveBeenCalled();
  });

  test('reset() after firing arms a fresh window', () => {
    const onIdle = jest.fn();
    const watchdog = createReadIdleWatchdog(onIdle, 70_000);

    watchdog.reset();
    jest.advanceTimersByTime(70_000);
    expect(onIdle).toHaveBeenCalledTimes(1);

    watchdog.reset();
    jest.advanceTimersByTime(69_999);
    expect(onIdle).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1);
    expect(onIdle).toHaveBeenCalledTimes(2);
  });
});
