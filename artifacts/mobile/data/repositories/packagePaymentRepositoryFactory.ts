import { expireManualPaymentClaim, resubmitManualPaymentClaim, submitManualPaymentClaim, createManualPaymentClaim, type CancelManualPaymentClaimInput, type CreateManualPaymentClaimInput, type ManualPaymentClaim, type PackagePaymentConfiguration, type PackagePaymentOutcome, type PackagePaymentRepository, type ResubmitManualPaymentClaimInput, type SubmitManualPaymentClaimInput } from '@/domains/package-payments';
import type { PackagePaymentFailure } from '@/domains/package-payments';
import { getSafePackagePaymentConfiguration } from '@/domains/package-payments/packagePaymentConfiguration';
import { assertNoDuplicateManualPaymentTransactionReference } from '@/domains/package-payments/manualPaymentDuplicatePolicy';
import { transitionManualPaymentClaim } from '@/domains/package-payments/manualPaymentClaimTransitions';
import { loadStoredManualPaymentClaims, saveStoredManualPaymentClaims } from '@/persistence/manualPaymentClaimsPersistence';
import { createPackagePaymentShadowRepository } from '@/data/remote/repositories/packagePaymentShadowRepository';
import { normalizePackagePaymentRepositoryMode, type PackagePaymentRepositoryMode } from '@/domains/package-payments/packagePaymentRepositoryMode';

export interface PackagePaymentRepositoryFactoryOptions {
  configuration?: PackagePaymentConfiguration | null;
  remoteRepository?: PackagePaymentRepository;
  enableRemoteDiagnostics?: boolean;
  mode?: PackagePaymentRepositoryMode | null;
}

function success<T>(data: T): PackagePaymentOutcome<T> {
  return { data, failure: null };
}

function failure<T>(
  code: PackagePaymentFailure['code'],
  message: string,
  details?: PackagePaymentFailure['details'],
): PackagePaymentOutcome<T> {
  return { data: null, failure: { code, message, details } };
}

async function loadClaims() {
  return (await loadStoredManualPaymentClaims()).data ?? [];
}

async function persistClaims(claims: ManualPaymentClaim[]) {
  await saveStoredManualPaymentClaims(claims);
}

class LocalPackagePaymentRepository implements PackagePaymentRepository {
  constructor(private readonly configuration: PackagePaymentConfiguration | null = null) {}

  private get config() {
    return getSafePackagePaymentConfiguration(this.configuration);
  }

  async getPaymentConfiguration() {
    return success(this.config);
  }

  async createManualPaymentClaim(input: CreateManualPaymentClaimInput) {
    const claims = await loadClaims();
    const idempotent = claims.find(claim => claim.idempotencyKey === (input.idempotencyKey ?? `manual-payment-claim:${input.claimId ?? input.offer.offerId}`));
    if (idempotent) {
      return success(idempotent);
    }

    const validation = createManualPaymentClaim(input, this.config);
    if (validation.failure) {
      return failure<ManualPaymentClaim>(validation.failure.code, validation.failure.message, validation.failure.details);
    }
    const validatedClaim = validation.data;
    if (!validatedClaim) {
      return failure<ManualPaymentClaim>('invalid_claim', 'Manual payment claim is invalid.');
    }

    const duplicate = assertNoDuplicateManualPaymentTransactionReference(claims, {
      provider: validatedClaim.provider,
      transactionReference: validatedClaim.transactionReference,
    });
    if (duplicate.failure) {
      return failure<ManualPaymentClaim>(duplicate.failure.code, duplicate.failure.message, duplicate.failure.details);
    }

    const nextClaims = [validatedClaim, ...claims.filter(claim => claim.id !== validatedClaim.id)];
    await persistClaims(nextClaims);
    return success(validatedClaim);
  }

  async getManualPaymentClaim(claimId: string) {
    const claims = await loadClaims();
    const claim = claims.find(item => item.id === claimId);
    if (!claim) {
      return failure<ManualPaymentClaim>('claim_not_found', 'Manual payment claim was not found.');
    }
    const expired = expireManualPaymentClaim(claim);
    if (expired.data && expired.data.status === 'expired' && expired.data.status !== claim.status) {
      await persistClaims(claims.map(item => item.id === claimId ? expired.data! : item));
    }
    return success(expired.data ?? claim);
  }

  async listDriverManualPaymentClaims(driverId: string) {
    const claims = await loadClaims();
    return success(
      claims
        .filter(claim => claim.driverId === driverId)
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  }

  async submitManualPaymentClaim(input: SubmitManualPaymentClaimInput) {
    const claims = await loadClaims();
    const index = claims.findIndex(claim => claim.id === input.claim.id);
    if (index < 0) {
      return failure<ManualPaymentClaim>('claim_not_found', 'Manual payment claim was not found.');
    }
    const current = claims[index];
    const result = submitManualPaymentClaim({ claim: current, submittedAt: input.submittedAt, actorId: input.actorId }, this.config);
    if (result.failure) return failure<ManualPaymentClaim>(result.failure.code, result.failure.message, result.failure.details);
    if (!result.data) return failure<ManualPaymentClaim>('invalid_claim', 'Manual payment claim is invalid.');
    const nextClaims = [...claims];
    nextClaims[index] = result.data;
    await persistClaims(nextClaims);
    return success(result.data);
  }

  async resubmitManualPaymentClaim(input: ResubmitManualPaymentClaimInput) {
    const claims = await loadClaims();
    const index = claims.findIndex(claim => claim.id === input.claim.id);
    if (index < 0) {
      return failure<ManualPaymentClaim>('claim_not_found', 'Manual payment claim was not found.');
    }
    const current = claims[index];
    const result = resubmitManualPaymentClaim({ claim: current, submittedAt: input.submittedAt, actorId: input.actorId }, this.config);
    if (result.failure) return failure<ManualPaymentClaim>(result.failure.code, result.failure.message, result.failure.details);
    if (!result.data) return failure<ManualPaymentClaim>('invalid_claim', 'Manual payment claim is invalid.');
    const nextClaims = [...claims];
    nextClaims[index] = result.data;
    await persistClaims(nextClaims);
    return success(result.data);
  }

  async cancelManualPaymentClaim(input: CancelManualPaymentClaimInput) {
    const claims = await loadClaims();
    const index = claims.findIndex(claim => claim.id === input.claim.id);
    if (index < 0) {
      return failure<ManualPaymentClaim>('claim_not_found', 'Manual payment claim was not found.');
    }
    const result = transitionManualPaymentClaim(claims[index], 'cancelled', {
      at: input.cancelledAt,
      actorType: 'driver',
      actorId: input.actorId,
      reasonCode: input.reasonCode,
    });
    if (result.failure) return failure<ManualPaymentClaim>(result.failure.code, result.failure.message, result.failure.details);
    if (!result.data) return failure<ManualPaymentClaim>('invalid_claim', 'Manual payment claim is invalid.');
    const nextClaims = [...claims];
    nextClaims[index] = result.data;
    await persistClaims(nextClaims);
    return success(result.data);
  }
}

export function createPackagePaymentRepository(
  options: PackagePaymentRepositoryFactoryOptions = {},
): PackagePaymentRepository {
  const localRepository = new LocalPackagePaymentRepository(
    options.configuration ?? null,
  );
  const requestedMode = normalizePackagePaymentRepositoryMode(options.mode) ?? (
    options.enableRemoteDiagnostics && options.remoteRepository ? 'shadow_remote' : 'local'
  );

  if (requestedMode === 'remote' && options.remoteRepository) {
    return options.remoteRepository;
  }

  if (requestedMode === 'shadow_remote' && options.remoteRepository) {
    return createPackagePaymentShadowRepository({
      localRepository,
      remoteRepository: options.remoteRepository,
      shadowWrites: false,
    });
  }

  return localRepository;
}
