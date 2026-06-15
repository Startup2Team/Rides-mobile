import { formatOtpTime, OTP_VALIDITY_SECONDS } from '../otp';

describe('OTP validity', () => {
  test('uses a five-minute validity window', () => {
    expect(OTP_VALIDITY_SECONDS).toBe(300);
    expect(formatOtpTime(OTP_VALIDITY_SECONDS)).toBe('5:00');
  });

  test('formats the remaining validity time safely', () => {
    expect(formatOtpTime(61)).toBe('1:01');
    expect(formatOtpTime(0)).toBe('0:00');
    expect(formatOtpTime(-1)).toBe('0:00');
  });
});
