import { normalizeRwandaPhoneNumber } from '@/utils/rwandaValidation';
import type { ManualPaymentClaim, ManualPaymentClaimStatus, ManualPaymentProvider } from './types';
import type { VehicleType } from '@/types';

export type ManualPaymentClaimAuthority = 'local_only_prototype' | 'legacy_local_untrusted' | 'remote_backed';

export interface ManualPaymentClaimReadModel {
  id: string;
  displayClaimId: string;
  status: ManualPaymentClaimStatus;
  version: number;
  /** Locked-offer id — needed to reopen the checkout screen for an in-flight claim. */
  offerId: string;
  packageId: string;
  packageVersion: string;
  packageName: string;
  vehicleId: string;
  vehicleType: VehicleType;
  expectedAmountRwf: number;
  provider: ManualPaymentProvider;
  maskedPayerPhone?: string;
  transactionReferencePresent: boolean;
  maskedTransactionReference?: string;
  createdAt: string;
  submittedAt?: string;
  expiresAt: string;
  updatedAt: string;
  clarificationMessage?: string;
  rejectionReasonCode?: string;
  rejectionMessage?: string;
  approvedAt?: string;
  activationId?: string;
  entitlementVersion?: number;
  authority: ManualPaymentClaimAuthority;
}

export interface ManualPaymentClaimReadModelOptions {
  authority?: ManualPaymentClaimAuthority;
  approvedAt?: string;
  entitlementVersion?: number;
  displayClaimId?: string;
}

function maskSensitiveValue(value: string | null | undefined, visibleSuffixLength = 4) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const suffix = trimmed.slice(-Math.max(0, visibleSuffixLength));
  return suffix ? `***${suffix}` : '***';
}

function maskRwandaPhoneNumber(value: string | null | undefined) {
  const normalized = typeof value === 'string' ? normalizeRwandaPhoneNumber(value) : null;
  if (!normalized) return undefined;
  return `+250***${normalized.slice(-4)}`;
}

export function toManualPaymentClaimReadModel(
  claim: ManualPaymentClaim,
  options: ManualPaymentClaimReadModelOptions = {},
): ManualPaymentClaimReadModel {
  const displayClaimId = options.displayClaimId ?? claim.id;
  const updatedAt = claim.reviewedAt ?? claim.submittedAt ?? claim.createdAt;
  return {
    id: claim.id,
    displayClaimId,
    status: claim.status,
    version: claim.version,
    offerId: claim.offerId,
    packageId: claim.packageId,
    packageVersion: claim.packageVersion,
    packageName: claim.packageName,
    vehicleId: claim.vehicleId,
    vehicleType: claim.vehicleType,
    expectedAmountRwf: claim.expectedAmountRwf,
    provider: claim.provider,
    maskedPayerPhone: maskRwandaPhoneNumber(claim.payerPhoneNumber),
    transactionReferencePresent: Boolean(claim.transactionReference?.trim()),
    maskedTransactionReference: maskSensitiveValue(claim.transactionReference),
    createdAt: claim.createdAt,
    submittedAt: claim.submittedAt,
    expiresAt: claim.expiresAt,
    updatedAt,
    clarificationMessage: claim.clarificationMessage,
    rejectionReasonCode: claim.rejectionReason,
    rejectionMessage: claim.rejectionReason,
    approvedAt: options.approvedAt ?? (claim.status === 'approved' ? claim.reviewedAt ?? updatedAt : undefined),
    activationId: claim.activationId,
    entitlementVersion: options.entitlementVersion,
    authority: options.authority ?? 'local_only_prototype',
  };
}
