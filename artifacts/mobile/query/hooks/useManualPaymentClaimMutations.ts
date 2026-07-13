import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createPackagePaymentRepository } from '@/data/repositories/packagePaymentRepositoryFactory';
import { getPackagePaymentFailurePresentation } from '@/domains/package-payments';
import type {
  CancelManualPaymentClaimInput,
  CreateManualPaymentClaimInput,
  ManualPaymentClaim,
  PackagePaymentFailure,
  PackagePaymentOutcome,
  PackagePaymentRepository,
  ResubmitManualPaymentClaimInput,
  SubmitManualPaymentClaimInput,
} from '@/domains/package-payments';
import { reportOperationalWarning } from '@/observability/monitoring';
import { invalidatePackagePaymentClaim, invalidatePackagePaymentClaims, packagePaymentKeys } from '../keys/packagePaymentKeys';

export interface UseManualPaymentClaimMutationOptions {
  repository?: PackagePaymentRepository;
}

export interface ManualPaymentClaimMutationResult<T> {
  data: T | null | undefined;
  failure: PackagePaymentFailure | null;
  presentation: ReturnType<typeof getPackagePaymentFailurePresentation>;
}

function toRepositoryFailure(error: unknown): PackagePaymentFailure {
  return {
    code: 'repository_unavailable',
    message: error instanceof Error ? error.message : 'Package payment repository is unavailable.',
  };
}

async function handleMutationResult(
  outcome: PackagePaymentOutcome<ManualPaymentClaim>,
  claimId: string,
  queryClient: ReturnType<typeof useQueryClient>,
) {
  if (outcome.failure?.code === 'claim_version_conflict') {
    await queryClient.refetchQueries({ queryKey: packagePaymentKeys.claim(claimId) });
  }
  if (outcome.data) {
    await invalidatePackagePaymentClaim(queryClient, claimId);
    await invalidatePackagePaymentClaims(queryClient);
  }
}

export function useCreateManualPaymentClaimMutation(options: UseManualPaymentClaimMutationOptions = {}) {
  const repository = options.repository ?? createPackagePaymentRepository();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateManualPaymentClaimInput) => {
      try {
        return await repository.createManualPaymentClaim(input);
      } catch (error) {
        return { data: null, failure: toRepositoryFailure(error) } satisfies PackagePaymentOutcome<ManualPaymentClaim>;
      }
    },
    retry: false,
    onSuccess: async (outcome, input) => {
      const claimId = input.claimId ?? outcome.data?.id ?? '';
      if (claimId) await handleMutationResult(outcome, claimId, queryClient);
      reportOperationalWarning('package-payment.claim.create', {
        operation: 'useCreateManualPaymentClaimMutation',
        result: outcome.failure?.code ?? 'success',
      });
    },
  });
}

export function useSubmitManualPaymentClaimMutation(options: UseManualPaymentClaimMutationOptions = {}) {
  const repository = options.repository ?? createPackagePaymentRepository();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SubmitManualPaymentClaimInput) => {
      try {
        return await repository.submitManualPaymentClaim(input);
      } catch (error) {
        return { data: null, failure: toRepositoryFailure(error) } satisfies PackagePaymentOutcome<ManualPaymentClaim>;
      }
    },
    retry: false,
    onSuccess: async (outcome, input) => {
      await handleMutationResult(outcome, input.claim.id, queryClient);
      reportOperationalWarning('package-payment.claim.submit', {
        operation: 'useSubmitManualPaymentClaimMutation',
        result: outcome.failure?.code ?? 'success',
      });
    },
  });
}

export function useResubmitManualPaymentClaimMutation(options: UseManualPaymentClaimMutationOptions = {}) {
  const repository = options.repository ?? createPackagePaymentRepository();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ResubmitManualPaymentClaimInput) => {
      try {
        return await repository.resubmitManualPaymentClaim(input);
      } catch (error) {
        return { data: null, failure: toRepositoryFailure(error) } satisfies PackagePaymentOutcome<ManualPaymentClaim>;
      }
    },
    retry: false,
    onSuccess: async (outcome, input) => {
      await handleMutationResult(outcome, input.claim.id, queryClient);
      reportOperationalWarning('package-payment.claim.resubmit', {
        operation: 'useResubmitManualPaymentClaimMutation',
        result: outcome.failure?.code ?? 'success',
      });
    },
  });
}

export function useCancelManualPaymentClaimMutation(options: UseManualPaymentClaimMutationOptions = {}) {
  const repository = options.repository ?? createPackagePaymentRepository();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CancelManualPaymentClaimInput) => {
      try {
        return await repository.cancelManualPaymentClaim(input);
      } catch (error) {
        return { data: null, failure: toRepositoryFailure(error) } satisfies PackagePaymentOutcome<ManualPaymentClaim>;
      }
    },
    retry: false,
    onSuccess: async (outcome, input) => {
      await handleMutationResult(outcome, input.claim.id, queryClient);
      reportOperationalWarning('package-payment.claim.cancel', {
        operation: 'useCancelManualPaymentClaimMutation',
        result: outcome.failure?.code ?? 'success',
      });
    },
  });
}
