import type { ManualPaymentClaimStatus } from './types';

export type ManualPaymentClaimTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface ManualPaymentClaimPresentation {
  title: string;
  message: string;
  tone: ManualPaymentClaimTone;
  terminal: boolean;
  canResubmit: boolean;
  canCancel: boolean;
  expectActivation: boolean;
  refreshIntervalMs: number | false;
}

const PRESENTATIONS: Record<ManualPaymentClaimStatus, ManualPaymentClaimPresentation> = {
  draft: {
    title: 'Payment confirmation not submitted',
    message: 'Complete the payment confirmation form to continue.',
    tone: 'neutral',
    terminal: false,
    canResubmit: false,
    canCancel: true,
    expectActivation: false,
    refreshIntervalMs: false,
  },
  submitted: {
    title: 'Waiting for approval',
    message: "We've received your payment. An admin usually confirms it within about 2 minutes — this screen updates on its own. Only cancel if you didn't actually pay.",
    tone: 'info',
    terminal: false,
    canResubmit: false,
    canCancel: true,
    expectActivation: false,
    refreshIntervalMs: 15_000,
  },
  pending_review: {
    title: 'Waiting for approval',
    message: 'An admin is confirming your payment now. This screen updates automatically once it goes through.',
    tone: 'info',
    terminal: false,
    canResubmit: false,
    canCancel: true,
    expectActivation: false,
    refreshIntervalMs: 15_000,
  },
  needs_clarification: {
    title: 'More information needed',
    message: 'We need a little more detail to confirm your payment. Update the details below and resubmit.',
    tone: 'warning',
    terminal: false,
    canResubmit: true,
    canCancel: true,
    expectActivation: false,
    refreshIntervalMs: false,
  },
  approved: {
    title: 'Payment confirmed',
    message: 'Your payment was approved and your rides have been added to your balance. You’re ready to drive.',
    tone: 'success',
    terminal: true,
    canResubmit: false,
    canCancel: false,
    expectActivation: true,
    refreshIntervalMs: false,
  },
  rejected: {
    title: 'Payment not confirmed',
    message: "We couldn't confirm this payment. Check the amount and transaction ID, then try again — or contact support if you already paid.",
    tone: 'danger',
    terminal: true,
    canResubmit: true,
    canCancel: false,
    expectActivation: false,
    refreshIntervalMs: false,
  },
  expired: {
    title: 'Payment claim expired',
    message: 'This payment claim expired before verification was completed. Contact Rides support if you already paid.',
    tone: 'warning',
    terminal: true,
    canResubmit: false,
    canCancel: false,
    expectActivation: false,
    refreshIntervalMs: false,
  },
  cancelled: {
    title: 'Payment claim cancelled',
    message: 'This payment claim was cancelled.',
    tone: 'neutral',
    terminal: true,
    canResubmit: false,
    canCancel: false,
    expectActivation: false,
    refreshIntervalMs: false,
  },
};

export function getManualPaymentClaimPresentation(status: ManualPaymentClaimStatus): ManualPaymentClaimPresentation {
  return PRESENTATIONS[status];
}

export function getManualPaymentClaimRefreshPolicy(status: ManualPaymentClaimStatus) {
  const presentation = getManualPaymentClaimPresentation(status);
  return {
    staleTime: presentation.terminal ? 10 * 60 * 1000 : status === 'needs_clarification' ? 60_000 : 20_000,
    refetchInterval: presentation.refreshIntervalMs,
    refetchOnWindowFocus: !presentation.terminal,
    refetchOnReconnect: !presentation.terminal,
    retry: false as const,
  };
}
