// Manual (proof-based) payment target. These are the fallback values used until
// the backend's GET /driver/packages/payment-info returns live config; when it
// does, resolveManualPaymentInfo() overrides these with the server values.
export const MANUAL_PAYMENT_FALLBACK = {
  payCode: '0202565',
  phoneNumber: '0796591452',
  instructions:
    'Open MTN MoMo → Pay → enter Pay code 0202565 → enter the exact amount → confirm. ' +
    'You can also send the amount to 0796591452. Then paste the transaction ID from your ' +
    'MoMo confirmation SMS below and submit it for verification.',
};
