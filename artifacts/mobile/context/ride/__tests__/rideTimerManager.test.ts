import { createRideTimerManager } from '../rideTimerManager';

describe('ride timer lifecycle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('clears pending timeouts when a new ride session starts', () => {
    const timers = createRideTimerManager();
    const callback = jest.fn();

    timers.startSession();
    timers.scheduleTimeout(callback, 1000);
    timers.startSession();
    jest.runAllTimers();

    expect(callback).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  test('prevents a stale callback from mutating a newer session', () => {
    const timers = createRideTimerManager();
    const firstSession = timers.startSession();
    const callback = jest.fn();

    timers.startSession();
    timers.scheduleTimeout(callback, 1000, firstSession);
    jest.runAllTimers();

    expect(callback).not.toHaveBeenCalled();
  });

  test('clears active intervals when a ride session ends', () => {
    const timers = createRideTimerManager();
    const callback = jest.fn();

    timers.startSession();
    timers.scheduleInterval(callback, 1000);
    jest.advanceTimersByTime(1000);
    timers.endSession();
    jest.advanceTimersByTime(3000);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('can clear one search timer without affecting other ride timers', () => {
    const timers = createRideTimerManager();
    const searchCallback = jest.fn();
    const otherCallback = jest.fn();

    timers.startSession();
    const searchTimer = timers.scheduleTimeout(searchCallback, 1000);
    timers.scheduleTimeout(otherCallback, 1000);
    timers.clearTimeout(searchTimer);
    jest.runAllTimers();

    expect(searchCallback).not.toHaveBeenCalled();
    expect(otherCallback).toHaveBeenCalledTimes(1);
  });
});
