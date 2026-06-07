import type { LocationObject } from 'expo-location';
import {
  acquireBestHomeLocation,
  requestHomeLocationPermission,
  startHomeLocationWatch,
} from '@/services/homeLocationAcquisition';

function location(accuracy: number, latitude = -1.95): LocationObject {
  return {
    coords: {
      latitude,
      longitude: 30.1,
      accuracy,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
    timestamp: Date.now(),
  };
}

describe('acquireBestHomeLocation', () => {
  it('accepts good accuracy immediately', async () => {
    const expected = location(12);
    const getCurrentPosition = jest.fn().mockResolvedValue(expected);

    await expect(acquireBestHomeLocation({
      getCurrentPosition,
      isActive: () => true,
    })).resolves.toEqual(expected);
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it('retries poor accuracy and returns a better fix', async () => {
    const getCurrentPosition = jest.fn()
      .mockResolvedValueOnce(location(1414, -1.9))
      .mockResolvedValueOnce(location(24, -1.95));

    const result = await acquireBestHomeLocation({
      getCurrentPosition,
      isActive: () => true,
    });

    expect(result?.coords.accuracy).toBe(24);
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
  });

  it('keeps the best available fix after attempts are exhausted', async () => {
    const getCurrentPosition = jest.fn()
      .mockResolvedValueOnce(location(1414))
      .mockResolvedValueOnce(location(180))
      .mockResolvedValueOnce(location(350));

    const result = await acquireBestHomeLocation({
      getCurrentPosition,
      isActive: () => true,
    });

    expect(result?.coords.accuracy).toBe(180);
  });

  it('keeps the best available fix when a later attempt times out', async () => {
    jest.useFakeTimers();
    const getCurrentPosition = jest.fn()
      .mockResolvedValueOnce(location(180))
      .mockImplementationOnce(() => new Promise<LocationObject>(() => {}));
    const resultPromise = acquireBestHomeLocation({
      getCurrentPosition,
      isActive: () => true,
      maxAttempts: 2,
      attemptTimeoutMs: 100,
    });

    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(100);

    await expect(resultPromise).resolves.toMatchObject({ coords: { accuracy: 180 } });
    jest.useRealTimers();
  });

  it('ignores a GPS result after the request becomes stale', async () => {
    let active = true;
    const getCurrentPosition = jest.fn().mockImplementation(async () => {
      active = false;
      return location(10);
    });

    await expect(acquireBestHomeLocation({
      getCurrentPosition,
      isActive: () => active,
    })).resolves.toBeNull();
  });

  it('reports denied foreground permission without requesting again', async () => {
    const requestPermission = jest.fn();

    await expect(requestHomeLocationPermission({
      getPermission: jest.fn().mockResolvedValue({ granted: false, canAskAgain: false }),
      requestPermission,
    })).resolves.toBe(false);
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('fails after all GPS attempts time out', async () => {
    jest.useFakeTimers();
    const resultPromise = acquireBestHomeLocation({
      getCurrentPosition: jest.fn(() => new Promise<LocationObject>(() => {})),
      isActive: () => true,
      maxAttempts: 2,
      attemptTimeoutMs: 100,
    });
    const expectation = expect(resultPromise).rejects.toThrow('timed out');

    await jest.advanceTimersByTimeAsync(200);
    await expectation;
    jest.useRealTimers();
  });

  it('fails when GPS returns no location result', async () => {
    await expect(acquireBestHomeLocation({
      getCurrentPosition: jest.fn().mockResolvedValue(null),
      isActive: () => true,
      maxAttempts: 1,
    })).rejects.toThrow('no result');
  });
});

describe('startHomeLocationWatch', () => {
  it('forwards watched GPS updates while active and removes the subscription when stopped', async () => {
    let callback: ((value: LocationObject) => void) | undefined;
    const remove = jest.fn();
    const onLocation = jest.fn();
    const stop = await startHomeLocationWatch({
      isActive: () => true,
      onLocation,
      watchPosition: jest.fn(async nextCallback => {
        callback = nextCallback;
        return { remove };
      }),
    });

    const watchedLocation = location(15, -1.951);
    callback?.(watchedLocation);
    expect(onLocation).toHaveBeenCalledWith(watchedLocation);

    stop();
    callback?.(location(12, -1.952));
    expect(onLocation).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('removes a watch that becomes inactive before subscription setup completes', async () => {
    let active = true;
    const remove = jest.fn();
    const stopPromise = startHomeLocationWatch({
      isActive: () => active,
      onLocation: jest.fn(),
      watchPosition: jest.fn(async () => {
        active = false;
        return { remove };
      }),
    });

    const stop = await stopPromise;
    stop();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
