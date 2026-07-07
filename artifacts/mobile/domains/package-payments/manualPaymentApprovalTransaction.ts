import { MANUAL_PAYMENT_APPROVAL_TRANSACTION_BLUEPRINT } from './manualPaymentPackageActivationPort';

export const manualPaymentApprovalTransactionBlueprint = MANUAL_PAYMENT_APPROVAL_TRANSACTION_BLUEPRINT;

export function describeManualPaymentApprovalTransaction() {
  return manualPaymentApprovalTransactionBlueprint;
}

export interface ManualPaymentClaimApprovedEvent {
  eventId: string;
  claimId: string;
  driverId: string;
  packageId: string;
  vehicleId: string;
  activationId: string;
  entitlementVersion: number;
  occurredAt: string;
}
