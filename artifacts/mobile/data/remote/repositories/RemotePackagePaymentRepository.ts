import type { BackendClient } from '../backendClient';
import { BackendClientError } from '../backendClient';
import type {
  ManualPaymentClaimDetailResponseDto,
  ManualPaymentClaimListResponseDto,
  ManualPaymentClaimMutationResponseDto,
  PackagePaymentConfigurationDto,
} from '../contracts/api/packagePaymentApi';
import {
  mapBackendPackagePaymentError,
  mapCancelManualPaymentClaimInputToDto,
  mapManualPaymentClaimCreateInputToDto,
  mapManualPaymentClaimDetailResponseDtoToDomain,
  mapManualPaymentClaimListResponseDtoToDomain,
  mapPackagePaymentConfigurationDtoToDomain,
  mapResubmitManualPaymentClaimInputToDto,
  mapSubmitManualPaymentClaimInputToDto,
  mapManualPaymentClaimDtoToDomain,
} from '../mappers/packagePaymentMapper';
import {
  type CancelManualPaymentClaimInput,
  type CreateManualPaymentClaimInput,
  type ManualPaymentClaim,
  type PackagePaymentConfiguration,
  type PackagePaymentOutcome,
  type PackagePaymentRepository,
  type ResubmitManualPaymentClaimInput,
  type SubmitManualPaymentClaimInput,
} from '@/domains/package-payments';

const ENDPOINTS = {
  configuration: '/package-payments/configuration',
  claims: '/package-payments/claims',
  claimDetail: (claimId: string) => `/package-payments/claims/${encodeURIComponent(claimId)}`,
  submit: (claimId: string) => `/package-payments/claims/${encodeURIComponent(claimId)}/submit`,
  resubmit: (claimId: string) => `/package-payments/claims/${encodeURIComponent(claimId)}/resubmit`,
  cancel: (claimId: string) => `/package-payments/claims/${encodeURIComponent(claimId)}/cancel`,
};

function success<T>(data: T): PackagePaymentOutcome<T> {
  return { data, failure: null };
}

function failure<T>(error: unknown): PackagePaymentOutcome<T> {
  return { data: null, failure: mapBackendPackagePaymentError(error) };
}

export class RemotePackagePaymentRepository implements PackagePaymentRepository {
  constructor(private readonly client: BackendClient) {}

  async getPaymentConfiguration(): Promise<PackagePaymentOutcome<PackagePaymentConfiguration>> {
    try {
      const response = await this.client.get<PackagePaymentConfigurationDto>(ENDPOINTS.configuration);
      const configuration = mapPackagePaymentConfigurationDtoToDomain(response);
      return success(configuration);
    } catch (error) {
      return failure(error);
    }
  }

  async createManualPaymentClaim(input: CreateManualPaymentClaimInput): Promise<PackagePaymentOutcome<ManualPaymentClaim>> {
    try {
      const response = await this.client.post<ManualPaymentClaimMutationResponseDto>(
        ENDPOINTS.claims,
        mapManualPaymentClaimCreateInputToDto(input),
      );
      const claim = response.data.claim ?? response.data.approvedClaim;
      if (!claim) throw new BackendClientError({
        kind: 'invalid-response',
        service: 'package-payments',
        operation: 'createManualPaymentClaim',
        message: 'Manual payment claim response did not include a claim.',
      });
      return success(mapManualPaymentClaimDtoToDomain(claim));
    } catch (error) {
      return failure(error);
    }
  }

  async getManualPaymentClaim(claimId: string): Promise<PackagePaymentOutcome<ManualPaymentClaim>> {
    try {
      const response = await this.client.get<ManualPaymentClaimDetailResponseDto>(
        ENDPOINTS.claimDetail(claimId),
      );
      const claim = mapManualPaymentClaimDetailResponseDtoToDomain(response);
      return success(claim);
    } catch (error) {
      return failure(error);
    }
  }

  async listDriverManualPaymentClaims(driverId: string): Promise<PackagePaymentOutcome<ManualPaymentClaim[]>> {
    try {
      const response = await this.client.get<ManualPaymentClaimListResponseDto>(
        `${ENDPOINTS.claims}?driverId=${encodeURIComponent(driverId)}`,
      );
      return success(mapManualPaymentClaimListResponseDtoToDomain(response));
    } catch (error) {
      return failure(error);
    }
  }

  async submitManualPaymentClaim(input: SubmitManualPaymentClaimInput): Promise<PackagePaymentOutcome<ManualPaymentClaim>> {
    try {
      const response = await this.client.post<ManualPaymentClaimMutationResponseDto>(
        ENDPOINTS.submit(input.claim.id),
        mapSubmitManualPaymentClaimInputToDto(input),
      );
      const claim = response.data.claim ?? response.data.approvedClaim;
      if (!claim) throw new BackendClientError({
        kind: 'invalid-response',
        service: 'package-payments',
        operation: 'submitManualPaymentClaim',
        message: 'Manual payment claim response did not include a claim.',
      });
      return success(mapManualPaymentClaimDtoToDomain(claim));
    } catch (error) {
      return failure(error);
    }
  }

  async resubmitManualPaymentClaim(input: ResubmitManualPaymentClaimInput): Promise<PackagePaymentOutcome<ManualPaymentClaim>> {
    try {
      const response = await this.client.post<ManualPaymentClaimMutationResponseDto>(
        ENDPOINTS.resubmit(input.claim.id),
        mapResubmitManualPaymentClaimInputToDto(input),
      );
      const claim = response.data.claim ?? response.data.approvedClaim;
      if (!claim) throw new BackendClientError({
        kind: 'invalid-response',
        service: 'package-payments',
        operation: 'resubmitManualPaymentClaim',
        message: 'Manual payment claim response did not include a claim.',
      });
      return success(mapManualPaymentClaimDtoToDomain(claim));
    } catch (error) {
      return failure(error);
    }
  }

  async cancelManualPaymentClaim(input: CancelManualPaymentClaimInput): Promise<PackagePaymentOutcome<ManualPaymentClaim>> {
    try {
      const response = await this.client.post<ManualPaymentClaimMutationResponseDto>(
        ENDPOINTS.cancel(input.claim.id),
        mapCancelManualPaymentClaimInputToDto(input),
      );
      const claim = response.data.claim ?? response.data.approvedClaim;
      if (!claim) throw new BackendClientError({
        kind: 'invalid-response',
        service: 'package-payments',
        operation: 'cancelManualPaymentClaim',
        message: 'Manual payment claim response did not include a claim.',
      });
      return success(mapManualPaymentClaimDtoToDomain(claim));
    } catch (error) {
      return failure(error);
    }
  }
}
