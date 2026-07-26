import type { DriverPackageOfferSnapshot } from '@/domain/driverRidePackages';
import type { VehicleType } from '@/types';

export type PackagePaymentMode = 'automatic' | 'manual' | 'disabled';

export type ManualPaymentProvider = 'mtn' | 'airtel';

export interface ManualPaymentProviderConfiguration {
  provider: ManualPaymentProvider;
  displayName?: string;
  merchantCode: string;
  ussdTemplate: string;
  enabled: boolean;
}

export interface ManualPackagePaymentConfiguration {
  providers: ManualPaymentProviderConfiguration[];
  claimExpiresAfterMinutes: number;
  transactionReferenceRequired: boolean;
  proofImageEnabled: boolean;
  proofImageRequired?: boolean;
  /** Business account name to pay to (shown on the manual-payment screen). */
  recipientName?: string;
  /** Business MoMo phone to pay to, as an alternative to the merchant code. */
  recipientPhone?: string;
}

export interface PackagePaymentConfiguration {
  mode: PackagePaymentMode;
  manual?: ManualPackagePaymentConfiguration;
  /**
   * Owner-set price (RWF) of one ride credit, keyed by BACKEND vehicle-type code
   * (MOTO_BIKE, CAB_TAXI, HEAVY_FUSO, LIGHT_HILUX, TUK_TUK). Single source of
   * truth for the custom-amount top-up preview: rides = floor(amount / price).
   * Optional so older configs / fallbacks stay valid.
   */
  pricePerRideRwf?: Record<string, number>;
  version: string;
  updatedAt: string;
}

export type ManualPaymentClaimStatus =
  | 'draft'
  | 'submitted'
  | 'pending_review'
  | 'needs_clarification'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'cancelled';

export type ManualPaymentClaimAuditActorType = 'driver' | 'admin' | 'support' | 'system';

export type ManualPaymentClaimAuditAction =
  | 'claim_created'
  | 'claim_submitted'
  | 'review_started'
  | 'clarification_requested'
  | 'clarification_resubmitted'
  | 'claim_approved'
  | 'claim_rejected'
  | 'claim_expired'
  | 'claim_cancelled'
  | 'activation_requested'
  | 'activation_completed';

export interface ManualPaymentClaimAuditEntry {
  id: string;
  at: string;
  actorType: ManualPaymentClaimAuditActorType;
  actorId?: string;
  action: ManualPaymentClaimAuditAction;
  reasonCode?: string;
}

export interface ManualPaymentClaim {
  id: string;
  version: number;
  driverId: string;
  vehicleId: string;
  vehicleType: VehicleType;
  offerId: string;
  packageId: string;
  packageVersion: string;
  packageName: string;
  expectedAmountRwf: number;
  provider: ManualPaymentProvider;
  merchantCodeSnapshot: string;
  payerPhoneNumber: string;
  transactionReference?: string;
  proofImageId?: string;
  status: ManualPaymentClaimStatus;
  createdAt: string;
  submittedAt?: string;
  expiresAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
  clarificationMessage?: string;
  supportNote?: string;
  activationId?: string;
  purchaseTransactionId?: string;
  idempotencyKey: string;
  auditLog: ManualPaymentClaimAuditEntry[];
}

export interface ManualPaymentClaimSnapshot {
  offer: DriverPackageOfferSnapshot;
  driverId: string;
  provider: ManualPaymentProvider;
  payerPhoneNumber: string;
  transactionReference?: string;
  proofImageId?: string;
}

export interface CreateManualPaymentClaimInput extends ManualPaymentClaimSnapshot {
  claimId?: string;
  idempotencyKey?: string;
}

export interface SubmitManualPaymentClaimInput {
  claim: ManualPaymentClaim;
  submittedAt?: string;
  actorId?: string;
}

export interface ResubmitManualPaymentClaimInput {
  claim: ManualPaymentClaim;
  submittedAt?: string;
  actorId?: string;
}

export interface CancelManualPaymentClaimInput {
  claim: ManualPaymentClaim;
  cancelledAt?: string;
  actorId?: string;
  reasonCode?: string;
}

export interface ManualPaymentClaimReviewInput {
  claim: ManualPaymentClaim;
  actorId?: string;
  at?: string;
  reasonCode?: string;
}

export interface PackagePaymentModePolicy {
  mode: PackagePaymentMode;
  automaticAllowed: boolean;
  manualAllowed: boolean;
  initiationAllowed: boolean;
}

export type PackagePaymentFailureCode =
  | 'payment_mode_disabled'
  | 'manual_payment_unavailable'
  | 'provider_disabled'
  | 'invalid_payment_configuration'
  | 'invalid_ussd_template'
  | 'invalid_claim'
  | 'invalid_claim_transition'
  | 'claim_expired'
  | 'duplicate_transaction_reference'
  | 'transaction_reference_required'
  | 'proof_required'
  | 'claim_not_found'
  | 'claim_not_activation_eligible'
  | 'claim_version_conflict'
  | 'claim_not_reviewable'
  | 'claim_not_approvable'
  | 'invalid_verification_evidence'
  | 'verification_provider_mismatch'
  | 'payment_amount_not_matched'
  | 'provider_reference_not_matched'
  | 'idempotency_conflict'
  | 'approval_already_completed'
  | 'activation_transaction_failed'
  | 'package_purchase_transaction_failed'
  | 'credit_transaction_failed'
  | 'approval_transaction_failed'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited'
  | 'timeout'
  | 'network_error'
  | 'service_unavailable'
  | 'repository_unavailable';

export interface PackagePaymentFailure {
  code: PackagePaymentFailureCode;
  message: string;
  details?: Record<string, string | number | boolean | null | undefined>;
}

export interface PackagePaymentOutcome<T> {
  data: T | null;
  failure: PackagePaymentFailure | null;
}

export interface ManualPaymentValidationIssue {
  field: string;
  code: string;
  message: string;
}

export interface ManualPaymentValidationResult<T> {
  data: T | null;
  failure: PackagePaymentFailure | null;
  issues?: ManualPaymentValidationIssue[];
}

export interface PackagePaymentRepository {
  getPaymentConfiguration(): Promise<PackagePaymentOutcome<PackagePaymentConfiguration>>;
  createManualPaymentClaim(input: CreateManualPaymentClaimInput): Promise<PackagePaymentOutcome<ManualPaymentClaim>>;
  getManualPaymentClaim(claimId: string): Promise<PackagePaymentOutcome<ManualPaymentClaim>>;
  listDriverManualPaymentClaims(driverId: string): Promise<PackagePaymentOutcome<ManualPaymentClaim[]>>;
  submitManualPaymentClaim(input: SubmitManualPaymentClaimInput): Promise<PackagePaymentOutcome<ManualPaymentClaim>>;
  resubmitManualPaymentClaim(input: ResubmitManualPaymentClaimInput): Promise<PackagePaymentOutcome<ManualPaymentClaim>>;
  cancelManualPaymentClaim(input: CancelManualPaymentClaimInput): Promise<PackagePaymentOutcome<ManualPaymentClaim>>;
}
