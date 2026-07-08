import { getAppBackendClient } from '@/data/remote/client/appBackendClient';

// Phone-number change (OTP-verified) for a signed-in user.
//   POST /v1/customer/phone/change/request  { new_phone }        -> sends OTP
//   POST /v1/customer/phone/change/verify   { new_phone, otp }   -> swaps number
// `newPhone` must be E.164 (+2507XXXXXXXX); use normalizeRwandaPhoneNumber().
// Errors surface the backend code (SAME_PHONE, PHONE_TAKEN, OTP_*), so the
// caller can show the message from the thrown error.

export async function requestPhoneChange(newPhone: string): Promise<void> {
  await getAppBackendClient().post('/v1/customer/phone/change/request', {
    body: { new_phone: newPhone },
  });
}

export async function verifyPhoneChange(newPhone: string, otp: string): Promise<void> {
  await getAppBackendClient().post('/v1/customer/phone/change/verify', {
    body: { new_phone: newPhone, otp },
  });
}
