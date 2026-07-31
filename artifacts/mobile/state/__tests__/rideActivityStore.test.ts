import { isRideSwitchBlocking, resetRideActivity, setRideActivity } from '../rideActivityStore';

describe('rideActivityStore', () => {
  afterEach(() => {
    resetRideActivity();
  });

  test('no ride → switching is allowed', () => {
    expect(isRideSwitchBlocking()).toBe(false);
  });

  test('an in-flight ride blocks switching', () => {
    setRideActivity('confirmed', false);
    expect(isRideSwitchBlocking()).toBe(true);
  });

  test('a pending driver request blocks switching even without a ride', () => {
    setRideActivity(null, true);
    expect(isRideSwitchBlocking()).toBe(true);
  });

  test('terminal statuses do not block switching', () => {
    setRideActivity('completed', false);
    expect(isRideSwitchBlocking()).toBe(false);
    setRideActivity('cancelled', false);
    expect(isRideSwitchBlocking()).toBe(false);
  });

  test('reset clears everything', () => {
    setRideActivity('searching', true);
    resetRideActivity();
    expect(isRideSwitchBlocking()).toBe(false);
  });
});
