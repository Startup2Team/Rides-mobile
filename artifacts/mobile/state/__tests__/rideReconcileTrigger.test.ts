import { registerRideReconcileHandler, triggerRideReconcile } from '../rideReconcileTrigger';

describe('rideReconcileTrigger', () => {
  afterEach(() => {
    registerRideReconcileHandler(null);
  });

  test('triggering with no handler registered is a safe no-op', () => {
    expect(() => triggerRideReconcile()).not.toThrow();
  });

  test('triggering calls the registered handler', () => {
    const handler = jest.fn();
    registerRideReconcileHandler(handler);

    triggerRideReconcile();

    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('a later registration replaces the earlier handler', () => {
    const first = jest.fn();
    const second = jest.fn();
    registerRideReconcileHandler(first);
    registerRideReconcileHandler(second);

    triggerRideReconcile();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  test('unregistering (null) stops delivering triggers', () => {
    const handler = jest.fn();
    registerRideReconcileHandler(handler);
    registerRideReconcileHandler(null);

    triggerRideReconcile();

    expect(handler).not.toHaveBeenCalled();
  });
});
