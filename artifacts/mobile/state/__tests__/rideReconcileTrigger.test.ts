import { registerRideReconcileHandler, triggerRideReconcile } from '../rideReconcileTrigger';

describe('rideReconcileTrigger', () => {
  afterEach(() => {
    registerRideReconcileHandler(null);
  });

  test('triggerRideReconcile calls the currently registered handler', () => {
    const handler = jest.fn();
    registerRideReconcileHandler(handler);

    triggerRideReconcile();

    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('triggerRideReconcile is a no-op when nothing is registered', () => {
    expect(() => triggerRideReconcile()).not.toThrow();
  });

  test('re-registering replaces the previous handler', () => {
    const first = jest.fn();
    const second = jest.fn();
    registerRideReconcileHandler(first);
    registerRideReconcileHandler(second);

    triggerRideReconcile();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  test('registering null (unmount) stops further triggers', () => {
    const handler = jest.fn();
    registerRideReconcileHandler(handler);
    registerRideReconcileHandler(null);

    triggerRideReconcile();

    expect(handler).not.toHaveBeenCalled();
  });
});
