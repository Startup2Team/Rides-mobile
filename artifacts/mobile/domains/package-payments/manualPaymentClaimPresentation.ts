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
    title: 'Payment confirmation submitted',
    message: 'Your payment claim is waiting for review.',
    tone: 'info',
    terminal: false,
    canResubmit: false,
    canCancel: true,
    expectActivation: false,
    refreshIntervalMs: 45_000,
  },
  pending_review: {
    title: 'Payment under review',
    message: 'Support is verifying your payment claim.',
    tone: 'info',
    terminal: false,
    canResubmit: false,
    canCancel: true,
    expectActivation: false,
    refreshIntervalMs: 45_000,
  },
  needs_clarification: {
    title: 'More information needed',
    message: 'Support needs more information before the payment can be approved.',
    tone: 'warning',
    terminal: false,
    canResubmit: true,
    canCancel: true,
    expectActivation: false,
    refreshIntervalMs: false,
  },
  approved: {
    title: 'Payment approved',
    message: 'Your package is active.',
    tone: 'success',
    terminal: true,
    canResubmit: false,
    canCancel: false,
    expectActivation: true,
    refreshIntervalMs: false,
  },
  rejected: {
    title: 'Payment could not be verified',
    message: 'This payment claim was rejected by support.',
    tone: 'danger',
    terminal: true,
    canResubmit: false,
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
