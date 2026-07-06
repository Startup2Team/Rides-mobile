import type { PackagePaymentRepository, PackagePaymentOutcome, PackagePaymentConfiguration, ManualPaymentClaim, CreateManualPaymentClaimInput, SubmitManualPaymentClaimInput, ResubmitManualPaymentClaimInput, CancelManualPaymentClaimInput } from '@/domains/package-payments';
import { InMemoryPackagePaymentRepository } from '@/domains/package-payments';
import { reportPackagePaymentShadowFailure, reportPackagePaymentShadowMismatch, reportPackagePaymentShadowRequest, reportPackagePaymentShadowSuccess, type PackagePaymentShadowTelemetry } from '../telemetry/packagePaymentTelemetry';

function isEqual(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function withTelemetryDefaults(context: PackagePaymentShadowTelemetry): PackagePaymentShadowTelemetry {
  return {
    operation: context.operation,
    provider: context.provider,
    status: context.status,
    result: context.result,
    mismatchCategory: context.mismatchCategory,
    latencyMs: context.latencyMs,
    duplicateDetected: context.duplicateDetected,
    proofAttached: context.proofAttached,
    claimAgeMinutes: context.claimAgeMinutes,
  };
}

function shadow<T>(
  operation: string,
  localCall: () => Promise<PackagePaymentOutcome<T>>,
  remoteCall: () => Promise<PackagePaymentOutcome<T>>,
  context: PackagePaymentShadowTelemetry = { operation },
) {
  const started = Date.now();
  reportPackagePaymentShadowRequest(withTelemetryDefaults(context));
  return Promise.allSettled([localCall(), remoteCall()]).then(results => {
    const finished = Date.now();
    const latencyMs = finished - started;
    const local: PackagePaymentOutcome<T> = results[0].status === 'fulfilled'
      ? results[0].value
      : {
          data: null,
          failure: {
            code: 'repository_unavailable',
            message: 'Local package payment repository failed.',
          },
        };
    const remote = results[1].status === 'fulfilled' ? results[1].value : null;

    if (local.failure) {
      reportPackagePaymentShadowFailure(withTelemetryDefaults({
        ...context,
        latencyMs,
        result: local.failure.code,
      }));
    } else {
      reportPackagePaymentShadowSuccess(withTelemetryDefaults({
        ...context,
        latencyMs,
        result: 'success',
      }));
    }

    if (remote && !isEqual(local, remote)) {
      reportPackagePaymentShadowMismatch(withTelemetryDefaults({
        ...context,
        latencyMs,
        result: local.failure ? 'local-failure' : 'success',
        mismatchCategory: remote.failure
          ? `remote-failure:${remote.failure.code}`
          : 'data-mismatch',
      }));
    }

    return local;
  });
}

export interface PackagePaymentShadowRepositoryOptions {
  localRepository?: PackagePaymentRepository;
  remoteRepository?: PackagePaymentRepository;
  shadowWrites?: boolean;
}

export function createPackagePaymentShadowRepository(
  options: PackagePaymentShadowRepositoryOptions = {},
): PackagePaymentRepository {
  const localRepository = options.localRepository ?? new InMemoryPackagePaymentRepository();
  const remoteRepository = options.remoteRepository ?? new InMemoryPackagePaymentRepository();
  const shadowWrites = options.shadowWrites ?? false;

  return {
    getPaymentConfiguration() {
      return shadow<PackagePaymentConfiguration>(
        'getPaymentConfiguration',
        () => localRepository.getPaymentConfiguration(),
        () => remoteRepository.getPaymentConfiguration(),
      );
    },
    createManualPaymentClaim(input: CreateManualPaymentClaimInput) {
      if (!shadowWrites) {
        return localRepository.createManualPaymentClaim(input);
      }
      return shadow<ManualPaymentClaim>(
        'createManualPaymentClaim',
        () => localRepository.createManualPaymentClaim(input),
        () => remoteRepository.createManualPaymentClaim(input),
        {
          operation: 'createManualPaymentClaim',
          provider: input.provider,
          proofAttached: Boolean(input.proofImageId),
        },
      );
    },
    getManualPaymentClaim(claimId: string) {
      return shadow<ManualPaymentClaim>(
        'getManualPaymentClaim',
        () => localRepository.getManualPaymentClaim(claimId),
        () => remoteRepository.getManualPaymentClaim(claimId),
      );
    },
    listDriverManualPaymentClaims(driverId: string) {
      return shadow<ManualPaymentClaim[]>(
        'listDriverManualPaymentClaims',
        () => localRepository.listDriverManualPaymentClaims(driverId),
        () => remoteRepository.listDriverManualPaymentClaims(driverId),
      );
    },
    submitManualPaymentClaim(input: SubmitManualPaymentClaimInput) {
      if (!shadowWrites) {
        return localRepository.submitManualPaymentClaim(input);
      }
      return shadow<ManualPaymentClaim>(
        'submitManualPaymentClaim',
        () => localRepository.submitManualPaymentClaim(input),
        () => remoteRepository.submitManualPaymentClaim(input),
        {
          operation: 'submitManualPaymentClaim',
          status: input.claim.status,
          proofAttached: Boolean(input.claim.proofImageId),
        },
      );
    },
    resubmitManualPaymentClaim(input: ResubmitManualPaymentClaimInput) {
      if (!shadowWrites) {
        return localRepository.resubmitManualPaymentClaim(input);
      }
      return shadow<ManualPaymentClaim>(
        'resubmitManualPaymentClaim',
        () => localRepository.resubmitManualPaymentClaim(input),
        () => remoteRepository.resubmitManualPaymentClaim(input),
        {
          operation: 'resubmitManualPaymentClaim',
          status: input.claim.status,
          proofAttached: Boolean(input.claim.proofImageId),
        },
      );
    },
    cancelManualPaymentClaim(input: CancelManualPaymentClaimInput) {
      if (!shadowWrites) {
        return localRepository.cancelManualPaymentClaim(input);
      }
      return shadow<ManualPaymentClaim>(
        'cancelManualPaymentClaim',
        () => localRepository.cancelManualPaymentClaim(input),
        () => remoteRepository.cancelManualPaymentClaim(input),
        {
          operation: 'cancelManualPaymentClaim',
          status: input.claim.status,
        },
      );
    },
  };
}
