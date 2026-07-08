import {
  validateManualPaymentVerificationEvidence,
  type ManualPaymentVerificationEvidence,
} from '../manualPaymentVerification';

describe('manual payment verification evidence', () => {
  const claim = {
    provider: 'mtn' as const,
    expectedAmountRwf: 2000,
    transactionReference: 'ABC123',
  };

  const evidence: ManualPaymentVerificationEvidence = {
    method: 'merchant_message',
    verifiedAt: '2026-07-06T10:05:00.000Z',
    verifiedBy: 'admin-1',
    provider: 'mtn',
    amountMatched: true,
    providerReferenceMatched: true,
  };

  test('accepts valid evidence and keeps raw SMS content out of the model', () => {
    const result = validateManualPaymentVerificationEvidence(evidence, claim);
    expect(result.failure).toBeNull();
    expect(JSON.stringify(result.data)).not.toContain('SMS');
  });

  test('rejects provider mismatch and amount/reference mismatches', () => {
    expect(validateManualPaymentVerificationEvidence({ ...evidence, provider: 'airtel' }, claim).failure?.code).toBe('verification_provider_mismatch');
    expect(validateManualPaymentVerificationEvidence({ ...evidence, amountMatched: false }, claim).failure?.code).toBe('payment_amount_not_matched');
    expect(validateManualPaymentVerificationEvidence({ ...evidence, providerReferenceMatched: false }, claim).failure?.code).toBe('provider_reference_not_matched');
  });
});
