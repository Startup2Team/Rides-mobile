import type { DriverEntitlement, DriverPackagePurchase, PackageActivation } from '@/domain/driverRidePackages';
import type { ManualPaymentApprovalResult } from './manualPaymentApproval';
import type { ManualPaymentClaim } from './types';

export interface ManualPaymentPackageActivationPort {
  createSuccessfulPackagePurchase(input: {
    claim: ManualPaymentClaim;
    requestedAt: string;
    idempotencyKey: string;
  }): Promise<DriverPackagePurchase>;
  activatePackageFromApprovedManualPayment(input: {
    claim: ManualPaymentClaim;
    requestedAt: string;
    idempotencyKey: string;
  }): Promise<PackageActivation>;
  grantPackageCreditsOnce(input: {
    claim: ManualPaymentClaim;
    requestedAt: string;
    idempotencyKey: string;
  }): Promise<DriverEntitlement>;
  getExistingApprovalResult(claimId: string): Promise<ManualPaymentApprovalResult | null>;
}

export interface ManualPaymentApprovalTransactionPort {
  execute(commandIdempotencyKey: string): Promise<ManualPaymentApprovalResult>;
}

export interface ManualPaymentApprovalTransactionBlueprintStep {
  step: number;
  description: string;
}

export interface ManualPaymentApprovalTransactionBlueprint {
  idempotencyScopes: {
    approval: string;
    purchase: string;
    activation: string;
    credits: string;
    approvedEvent: string;
  };
  steps: ManualPaymentApprovalTransactionBlueprintStep[];
  rollbackGuarantee: string;
}

export const MANUAL_PAYMENT_APPROVAL_TRANSACTION_BLUEPRINT: ManualPaymentApprovalTransactionBlueprint = {
  idempotencyScopes: {
    approval: 'manual-payment-claim:{claimId}:approval',
    purchase: 'manual-payment-claim:{claimId}:purchase',
    activation: 'manual-payment-claim:{claimId}:activation',
    credits: 'manual-payment-claim:{claimId}:credits',
    approvedEvent: 'manual-payment-claim:{claimId}:approved-event',
  },
  steps: [
    { step: 1, description: 'Load claim with transactional lock.' },
    { step: 2, description: 'Verify claim version and idempotency key.' },
    { step: 3, description: 'Validate review eligibility and verification evidence.' },
    { step: 4, description: 'Check duplicate provider reference constraints.' },
    { step: 5, description: 'Create or resolve one successful package purchase.' },
    { step: 6, description: 'Activate package using trusted backend authority.' },
    { step: 7, description: 'Grant exactly one credit transaction.' },
    { step: 8, description: 'Mark claim approved and append audit records.' },
    { step: 9, description: 'Write transactional outbox event for notification and refresh.' },
  ],
  rollbackGuarantee: 'Any failure before commit must leave no partial approval state.',
};

export function describeManualPaymentApprovalTransactionBlueprint() {
  return MANUAL_PAYMENT_APPROVAL_TRANSACTION_BLUEPRINT;
}
