import { getAppBackendClient } from '@/data/remote/client/appBackendClient';
import { fromBackendTransportType } from '@/constants/vehicles';
import type { VehicleType } from '@/types';
import type {
  CancelManualPaymentClaimInput,
  CreateManualPaymentClaimInput,
  ManualPaymentClaim,
  ManualPaymentClaimAuditEntry,
  ManualPaymentClaimStatus,
  ManualPaymentProvider,
  PackagePaymentConfiguration,
  PackagePaymentFailure,
  PackagePaymentFailureCode,
  PackagePaymentOutcome,
  PackagePaymentRepository,
  ResubmitManualPaymentClaimInput,
  SubmitManualPaymentClaimInput,
} from '@/domains/package-payments';

// Real-backend manual package-payment claims under
// /api/v1/package-payments/manual-claims. Snake_case wire format matching the
// contract in Rides-api/docs/backend/MOBILE_PAYMENT_CONTRACTS.md. Implements the
// same PackagePaymentRepository interface as the local repo, so the factory can
// swap to it with a single default change once the endpoints ship.

const ENDPOINTS = {
  configuration: '/v1/package-payments/configuration',
  claims: '/v1/package-payments/manual-claims',
  claim: (id: string) => `/v1/package-payments/manual-claims/${encodeURIComponent(id)}`,
  submit: (id: string) => `/v1/package-payments/manual-claims/${encodeURIComponent(id)}/submit`,
  resubmit: (id: string) => `/v1/package-payments/manual-claims/${encodeURIComponent(id)}/resubmit`,
  cancel: (id: string) => `/v1/package-payments/manual-claims/${encodeURIComponent(id)}/cancel`,
};

interface Envelope<T> {
  data: T;
}

interface AuditEntryDto {
  id: string;
  at: string;
  actor_type: ManualPaymentClaimAuditEntry['actorType'];
  actor_id?: string | null;
  action: ManualPaymentClaimAuditEntry['action'];
  reason_code?: string | null;
}

interface ClaimDto {
  id: string;
  version: number;
  driver_id: string;
  vehicle_id: string;
  vehicle_type: string;
  offer_id: string;
  package_id: string;
  package_version: string;
  package_name: string;
  expected_amount_rwf: number;
  provider: ManualPaymentProvider;
  merchant_code_snapshot: string;
  payer_phone_number: string;
  transaction_reference?: string | null;
  proof_image_id?: string | null;
  status: ManualPaymentClaimStatus;
  created_at: string;
  submitted_at?: string | null;
  expires_at: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  rejection_reason?: string | null;
  clarification_message?: string | null;
  support_note?: string | null;
  activation_id?: string | null;
  purchase_transaction_id?: string | null;
  idempotency_key: string;
  audit_log?: AuditEntryDto[] | null;
}

interface ConfigurationDto {
  mode: PackagePaymentConfiguration['mode'];
  manual?: {
    providers: {
      provider: ManualPaymentProvider;
      display_name?: string | null;
      merchant_code: string;
      ussd_template: string;
      enabled: boolean;
    }[];
    claim_expires_after_minutes: number;
    transaction_reference_required: boolean;
    proof_image_enabled: boolean;
    proof_image_required?: boolean | null;
  } | null;
  version: string;
  updated_at: string;
}

function toVehicleType(value: string): VehicleType {
  // Accept either a domain value ('moto') or a backend code ('MOTO_BIKE').
  const mapped = fromBackendTransportType(value);
  return (mapped ?? (value as VehicleType));
}

function toAuditEntry(dto: AuditEntryDto): ManualPaymentClaimAuditEntry {
  return {
    id: dto.id,
    at: dto.at,
    actorType: dto.actor_type,
    actorId: dto.actor_id ?? undefined,
    action: dto.action,
    reasonCode: dto.reason_code ?? undefined,
  };
}

function toClaim(dto: ClaimDto): ManualPaymentClaim {
  return {
    id: dto.id,
    version: dto.version,
    driverId: dto.driver_id,
    vehicleId: dto.vehicle_id,
    vehicleType: toVehicleType(dto.vehicle_type),
    offerId: dto.offer_id,
    packageId: dto.package_id,
    packageVersion: dto.package_version,
    packageName: dto.package_name,
    expectedAmountRwf: dto.expected_amount_rwf,
    provider: dto.provider,
    merchantCodeSnapshot: dto.merchant_code_snapshot,
    payerPhoneNumber: dto.payer_phone_number,
    transactionReference: dto.transaction_reference ?? undefined,
    proofImageId: dto.proof_image_id ?? undefined,
    status: dto.status,
    createdAt: dto.created_at,
    submittedAt: dto.submitted_at ?? undefined,
    expiresAt: dto.expires_at,
    reviewedAt: dto.reviewed_at ?? undefined,
    reviewedBy: dto.reviewed_by ?? undefined,
    rejectionReason: dto.rejection_reason ?? undefined,
    clarificationMessage: dto.clarification_message ?? undefined,
    supportNote: dto.support_note ?? undefined,
    activationId: dto.activation_id ?? undefined,
    purchaseTransactionId: dto.purchase_transaction_id ?? undefined,
    idempotencyKey: dto.idempotency_key,
    auditLog: (dto.audit_log ?? []).map(toAuditEntry),
  };
}

function toConfiguration(dto: ConfigurationDto): PackagePaymentConfiguration {
  return {
    mode: dto.mode,
    version: dto.version,
    updatedAt: dto.updated_at,
    manual: dto.manual
      ? {
          providers: dto.manual.providers.map(p => ({
            provider: p.provider,
            displayName: p.display_name ?? undefined,
            merchantCode: p.merchant_code,
            ussdTemplate: p.ussd_template,
            enabled: p.enabled,
          })),
          claimExpiresAfterMinutes: dto.manual.claim_expires_after_minutes,
          transactionReferenceRequired: dto.manual.transaction_reference_required,
          proofImageEnabled: dto.manual.proof_image_enabled,
          proofImageRequired: dto.manual.proof_image_required ?? undefined,
        }
      : undefined,
  };
}

function success<T>(data: T): PackagePaymentOutcome<T> {
  return { data, failure: null };
}

// Map backend errors (BackendError.status/.code) onto the domain failure codes
// the UI already knows how to present.
function toFailure<T>(error: unknown): PackagePaymentOutcome<T> {
  const status = (error as { status?: number })?.status;
  const message = error instanceof Error ? error.message : 'Package payment request failed.';
  let code: PackagePaymentFailureCode;
  switch (status) {
    case 401: code = 'unauthorized'; break;
    case 403: code = 'forbidden'; break;
    case 404: code = 'claim_not_found'; break;
    case 409: code = 'claim_version_conflict'; break;
    case 422: code = 'invalid_claim'; break;
    case 429: code = 'rate_limited'; break;
    case 408: code = 'timeout'; break;
    default: code = status && status >= 500 ? 'service_unavailable' : 'repository_unavailable';
  }
  const failure: PackagePaymentFailure = { code, message };
  return { data: null, failure };
}

let idemCounter = 0;
function idempotencyKey(explicit: string | undefined, prefix: string): string {
  if (explicit) return explicit;
  idemCounter += 1;
  return `${prefix}-${Date.now()}-${idemCounter}`;
}

const client = () => getAppBackendClient();

export const backendPackagePaymentRepository: PackagePaymentRepository = {
  async getPaymentConfiguration() {
    try {
      const res = await client().get<Envelope<ConfigurationDto>>(ENDPOINTS.configuration);
      return success(toConfiguration(res.data.data));
    } catch (error) {
      return toFailure(error);
    }
  },

  async createManualPaymentClaim(input: CreateManualPaymentClaimInput) {
    try {
      const { offer } = input;
      const res = await client().post<Envelope<{ claim: ClaimDto }>>(ENDPOINTS.claims, {
        body: {
          driver_id: input.driverId,
          vehicle_id: offer.vehicleId,
          vehicle_type: offer.vehicleType,
          offer_id: offer.offerId,
          package_id: offer.packageId,
          package_version: offer.packageVersion,
          package_name: offer.packageName,
          expected_amount_rwf: offer.priceRwf,
          provider: input.provider,
          payer_phone_number: input.payerPhoneNumber,
          transaction_reference: input.transactionReference ?? null,
          proof_image_id: input.proofImageId ?? null,
          idempotency_key: idempotencyKey(input.idempotencyKey, 'create-claim'),
        },
      });
      return success(toClaim(res.data.data.claim));
    } catch (error) {
      return toFailure(error);
    }
  },

  async getManualPaymentClaim(claimId: string) {
    try {
      const res = await client().get<Envelope<ClaimDto>>(ENDPOINTS.claim(claimId));
      return success(toClaim(res.data.data));
    } catch (error) {
      return toFailure(error);
    }
  },

  async listDriverManualPaymentClaims(_driverId: string) {
    try {
      const res = await client().get<Envelope<{ items: ClaimDto[]; next_cursor?: string | null }>>(
        ENDPOINTS.claims,
      );
      return success((res.data.data.items ?? []).map(toClaim));
    } catch (error) {
      return toFailure(error);
    }
  },

  async submitManualPaymentClaim(input: SubmitManualPaymentClaimInput) {
    try {
      const res = await client().post<Envelope<{ claim: ClaimDto }>>(ENDPOINTS.submit(input.claim.id), {
        body: { claim_id: input.claim.id, idempotency_key: idempotencyKey(undefined, 'submit-claim') },
      });
      return success(toClaim(res.data.data.claim));
    } catch (error) {
      return toFailure(error);
    }
  },

  async resubmitManualPaymentClaim(input: ResubmitManualPaymentClaimInput) {
    try {
      const res = await client().post<Envelope<{ claim: ClaimDto }>>(ENDPOINTS.resubmit(input.claim.id), {
        body: { claim_id: input.claim.id, idempotency_key: idempotencyKey(undefined, 'resubmit-claim') },
      });
      return success(toClaim(res.data.data.claim));
    } catch (error) {
      return toFailure(error);
    }
  },

  async cancelManualPaymentClaim(input: CancelManualPaymentClaimInput) {
    try {
      const res = await client().post<Envelope<{ claim: ClaimDto }>>(ENDPOINTS.cancel(input.claim.id), {
        body: {
          claim_id: input.claim.id,
          reason_code: input.reasonCode ?? null,
          idempotency_key: idempotencyKey(undefined, 'cancel-claim'),
        },
      });
      return success(toClaim(res.data.data.claim));
    } catch (error) {
      return toFailure(error);
    }
  },
};
