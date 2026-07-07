import { getPackagePaymentFailurePresentation } from '../packagePaymentFailurePresentation';

describe('package payment failure presentation', () => {
  test('maps version conflicts to safe refetch guidance', () => {
    expect(getPackagePaymentFailurePresentation({
      code: 'claim_version_conflict',
      message: 'conflict',
    })).toMatchObject({
      refetchClaim: true,
      message: 'The payment status changed. Refreshing the claim will show the latest state.',
    });
  });

  test('maps duplicate references and internal approval errors safely', () => {
    expect(getPackagePaymentFailurePresentation({
      code: 'duplicate_transaction_reference',
      message: 'duplicate',
    })).toMatchObject({
      message: 'This transaction reference has already been used for a payment claim.',
    });
    expect(getPackagePaymentFailurePresentation({
      code: 'rate_limited',
      message: 'too many',
    })).toMatchObject({
      retryable: true,
    });
    expect(getPackagePaymentFailurePresentation({
      code: 'timeout',
      message: 'timeout',
    })).toMatchObject({
      message: 'The request took too long. Please try again.',
      retryable: true,
    });
    expect(getPackagePaymentFailurePresentation({
      code: 'approval_transaction_failed',
      message: 'approval failed',
    })).toMatchObject({
      message: 'Your payment status could not be refreshed right now. Please try again.',
      retryable: true,
    });
  });
});
