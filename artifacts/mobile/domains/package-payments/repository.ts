import type {
  CancelManualPaymentClaimInput,
  CreateManualPaymentClaimInput,
  ManualPaymentClaim,
  PackagePaymentConfiguration,
  PackagePaymentRepository,
  PackagePaymentOutcome,
  ResubmitManualPaymentClaimInput,
  SubmitManualPaymentClaimInput,
} from './types';

export type { PackagePaymentRepository } from './types';

export interface PackagePaymentRepositoryPrototype extends PackagePaymentRepository {}

function unavailable<T>(message = 'Package payment repository is unavailable.'): PackagePaymentOutcome<T> {
  return {
    data: null,
    failure: {
      code: 'repository_unavailable',
      message,
    },
  };
}

export class InMemoryPackagePaymentRepository implements PackagePaymentRepositoryPrototype {
  constructor(private readonly configuration: PackagePaymentConfiguration | null = null) {}

  async getPaymentConfiguration() {
    return this.configuration
      ? { data: this.configuration, failure: null }
      : unavailable<PackagePaymentConfiguration>();
  }

  async createManualPaymentClaim(_input: CreateManualPaymentClaimInput) {
    return unavailable<ManualPaymentClaim>();
  }

  async getManualPaymentClaim(_claimId: string) {
    return unavailable<ManualPaymentClaim>();
  }

  async listDriverManualPaymentClaims(_driverId: string) {
    return unavailable<ManualPaymentClaim[]>();
  }

  async submitManualPaymentClaim(_input: SubmitManualPaymentClaimInput) {
    return unavailable<ManualPaymentClaim>();
  }

  async resubmitManualPaymentClaim(_input: ResubmitManualPaymentClaimInput) {
    return unavailable<ManualPaymentClaim>();
  }

  async cancelManualPaymentClaim(_input: CancelManualPaymentClaimInput) {
    return unavailable<ManualPaymentClaim>();
  }
}
