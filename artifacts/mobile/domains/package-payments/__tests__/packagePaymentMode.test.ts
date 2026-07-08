import {
  canInitiatePackagePayment,
  canUseAutomaticPackagePayment,
  canUseManualPackagePayment,
  getPackagePaymentModePolicy,
  normalizePackagePaymentMode,
} from '../packagePaymentMode';

describe('package payment mode', () => {
  test('automatic mode allows automatic checkout only', () => {
    expect(normalizePackagePaymentMode('automatic')).toBe('automatic');
    expect(canUseAutomaticPackagePayment('automatic')).toBe(true);
    expect(canUseManualPackagePayment('automatic')).toBe(false);
    expect(canInitiatePackagePayment('automatic')).toBe(true);
    expect(getPackagePaymentModePolicy('automatic')).toEqual({
      mode: 'automatic',
      automaticAllowed: true,
      manualAllowed: false,
      initiationAllowed: true,
    });
  });

  test('manual mode allows manual checkout only', () => {
    expect(normalizePackagePaymentMode('manual')).toBe('manual');
    expect(canUseAutomaticPackagePayment('manual')).toBe(false);
    expect(canUseManualPackagePayment('manual')).toBe(true);
    expect(canInitiatePackagePayment('manual')).toBe(true);
  });

  test('disabled mode fails closed', () => {
    expect(normalizePackagePaymentMode('disabled')).toBe('disabled');
    expect(canUseAutomaticPackagePayment('disabled')).toBe(false);
    expect(canUseManualPackagePayment('disabled')).toBe(false);
    expect(canInitiatePackagePayment('disabled')).toBe(false);
  });

  test('unknown mode fails closed', () => {
    expect(normalizePackagePaymentMode('future_mode')).toBeNull();
    expect(getPackagePaymentModePolicy('future_mode')).toEqual({
      mode: 'disabled',
      automaticAllowed: false,
      manualAllowed: false,
      initiationAllowed: false,
    });
  });
});
