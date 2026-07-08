import type {
  StagingConnectionDomain,
  StagingConnectionDomainContractDefinition,
  StagingConnectionDomainContractStatus,
  StagingConnectionDomainContractOperation,
  StagingConnectionEvidence,
} from './stagingConnectionTypes';

export interface StagingBackendContractManifest {
  version: 1;
  domains: Record<string, StagingConnectionDomainContractDefinition>;
}

const savedLocationsExpectedOperations: StagingConnectionDomainContractOperation[] = [
  {
    operation: 'list',
    method: 'GET',
    path: '/v1/saved-locations',
    requestContract: 'none',
    responseContract: 'ListSavedLocationsResponseDto',
    authenticationExpected: 'required',
    idempotencyExpected: false,
    correlationExpected: true,
  },
  {
    operation: 'create',
    method: 'POST',
    path: '/v1/saved-locations',
    requestContract: 'CreateSavedLocationRequestDto',
    responseContract: 'CreateSavedLocationResponseDto',
    authenticationExpected: 'required',
    idempotencyExpected: true,
    correlationExpected: true,
  },
  {
    operation: 'update',
    method: 'PATCH',
    path: '/v1/saved-locations/{id}',
    requestContract: 'UpdateSavedLocationRequestDto',
    responseContract: 'UpdateSavedLocationResponseDto',
    authenticationExpected: 'required',
    idempotencyExpected: true,
    correlationExpected: true,
  },
  {
    operation: 'delete',
    method: 'DELETE',
    path: '/v1/saved-locations/{id}',
    requestContract: 'DeleteSavedLocationRequestDto',
    responseContract: 'DeleteSavedLocationResponseDto',
    authenticationExpected: 'required',
    idempotencyExpected: true,
    correlationExpected: true,
  },
];

const profileExpectedOperations: StagingConnectionDomainContractOperation[] = [
  {
    operation: 'getCurrentProfile',
    method: 'GET',
    path: '/v1/profile/me',
    requestContract: 'none',
    responseContract: 'GetProfileResponseDto',
    authenticationExpected: 'required',
    idempotencyExpected: false,
    correlationExpected: true,
  },
  {
    operation: 'updateProfile',
    method: 'PATCH',
    path: '/v1/profile/me',
    requestContract: 'UpdateProfileRequestDto',
    responseContract: 'UpdateProfileResponseDto',
    authenticationExpected: 'required',
    idempotencyExpected: true,
    correlationExpected: true,
  },
  {
    operation: 'uploadProfilePhoto',
    method: 'POST',
    path: '/v1/profile/me/photo',
    requestContract: 'UploadProfilePhotoRequestDto',
    responseContract: 'UploadProfilePhotoResponseDto',
    authenticationExpected: 'required',
    idempotencyExpected: true,
    correlationExpected: true,
  },
  {
    operation: 'updatePhoneNumber',
    method: 'PATCH',
    path: '/v1/profile/me/phone',
    requestContract: 'ChangePhoneRequestDto',
    responseContract: 'ChangePhoneResponseDto',
    authenticationExpected: 'required',
    idempotencyExpected: true,
    correlationExpected: true,
  },
];

export const stagingExpectedDomainContracts: Record<string, StagingConnectionDomainContractDefinition> = {
  savedLocations: { operations: savedLocationsExpectedOperations },
  profile: { operations: profileExpectedOperations },
};

export const stagingExpectedBackendContractManifest: StagingBackendContractManifest = {
  version: 1,
  domains: stagingExpectedDomainContracts,
};

function getManifestDomains(
  manifest: StagingBackendContractManifest | Record<string, StagingConnectionDomainContractDefinition>,
): Record<string, StagingConnectionDomainContractDefinition> {
  if ('version' in manifest && 'domains' in manifest) {
    return (manifest as StagingBackendContractManifest).domains;
  }
  return manifest as Record<string, StagingConnectionDomainContractDefinition>;
}

function normalizePath(pathValue: string) {
  return pathValue.replace(/\/\{id\}/g, '/{id}').replace(/\/+/g, '/');
}

function compareOperations(
  domain: StagingConnectionDomain,
  expected: StagingConnectionDomainContractOperation[],
  actual: StagingConnectionDomainContractDefinition | undefined,
): StagingConnectionDomainContractStatus {
  const missingOperations: string[] = [];
  const contractBlockers: string[] = [];
  const warnings: string[] = [];

  const actualOperations = new Map((actual?.operations ?? []).map(operation => [operation.operation, operation]));

  for (const expectedOperation of expected) {
    const candidate = actualOperations.get(expectedOperation.operation);
    if (!candidate) {
      missingOperations.push(expectedOperation.operation);
      continue;
    }

    if (candidate.method !== expectedOperation.method) {
      contractBlockers.push(`${expectedOperation.operation}: method ${candidate.method} != ${expectedOperation.method}`);
    }
    if (normalizePath(candidate.path) !== normalizePath(expectedOperation.path)) {
      contractBlockers.push(`${expectedOperation.operation}: path ${candidate.path} != ${expectedOperation.path}`);
    }
    if (candidate.requestContract !== expectedOperation.requestContract) {
      contractBlockers.push(`${expectedOperation.operation}: request contract mismatch`);
    }
    if (candidate.responseContract !== expectedOperation.responseContract) {
      contractBlockers.push(`${expectedOperation.operation}: response contract mismatch`);
    }
    if (candidate.authenticationExpected !== expectedOperation.authenticationExpected) {
      contractBlockers.push(`${expectedOperation.operation}: authentication expectation mismatch`);
    }
    if (candidate.idempotencyExpected !== expectedOperation.idempotencyExpected) {
      warnings.push(`${expectedOperation.operation}: idempotency expectation differs`);
    }
    if (candidate.correlationExpected !== expectedOperation.correlationExpected) {
      warnings.push(`${expectedOperation.operation}: correlation expectation differs`);
    }
  }

  return {
    domain,
    passed: missingOperations.length === 0 && contractBlockers.length === 0,
    missingOperations,
    contractBlockers,
    warnings,
  };
}

export function evaluateStagingDomainContract(
  domain: StagingConnectionDomain,
  manifest: StagingBackendContractManifest | Record<string, StagingConnectionDomainContractDefinition> = stagingExpectedBackendContractManifest,
  evidence?: StagingConnectionEvidence,
): StagingConnectionDomainContractStatus {
  const expected = stagingExpectedDomainContracts[domain];
  const actual = getManifestDomains(manifest)[domain];
  if (!expected) {
    return {
      domain,
      passed: false,
      missingOperations: [],
      contractBlockers: [`${domain}: no expected contract definition`],
      warnings: [],
    };
  }

  const status = compareOperations(domain, expected.operations, actual);
  const backendConfirmed = evidence?.contracts.endpointContractConfirmation === 'confirmed';
  if (!backendConfirmed) {
    status.warnings.push(`${domain}: backend contract confirmation is not yet confirmed`);
  }

  if (evidence?.contracts.endpointContractConfirmation === 'failed') {
    status.contractBlockers.push(`${domain}: backend contract confirmation failed`);
  }

  return {
    ...status,
    passed: status.missingOperations.length === 0 && status.contractBlockers.length === 0,
  };
}

export function getExpectedStagingDomainContracts() {
  return stagingExpectedDomainContracts;
}
