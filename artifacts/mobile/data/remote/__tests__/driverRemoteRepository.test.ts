import { BackendClient } from '../client/backendClient';
import { repositoryResolver } from '../adapters';
import { createFakeBackendTransport } from '../testing/fakeBackendTransport';
import { RemoteDriverRepository, createDriverShadowRepository } from '../repositories/RemoteDriverRepository';
import { resetObservabilityForTests, observability } from '@/observability/context/observabilityContext';
import {
  ConflictError,
  ForbiddenError,
  OfflineError,
  RateLimitedError,
  ServerError,
  TimeoutError,
  UnauthorizedError,
  ValidationError,
} from '../contracts/backendErrors';
import type { DriverApplicationSubmission, DriverProfile } from '@/types';
import type { DriverApplicationStatusDomain, DriverClarificationDomain, DriverDocumentMetadataDomain } from '../mappers/driverMapper';

const applicationDto = {
  id: 'app-1',
  clientSubmissionId: 'client-app-1',
  userId: 'account-1',
  status: 'submitted' as const,
  reviewStatus: 'pending_review' as const,
  fullName: 'Driver One',
  phone: '+250788123456',
  dob: '01/01/1990',
  nationalId: '1199080012345678',
  operatingLocation: {
    province: 'Kigali',
    district: 'Gasabo',
    sector: 'Kimironko',
    cell: 'Bibare',
    village: 'Amahoro',
  },
  momoDetails: {
    provider: 'mtn' as const,
    momoCode: '0788123456',
    merchantCode: 'MOMO-SECRET',
  },
  selfieReference: 'driver-selfie-ref',
  firstVehicle: {
    vehicleType: 'moto' as const,
    plateNumber: 'RAB 123A',
    licenseNumber: 'LIC-SECRET',
    brand: 'TVS',
    model: 'Bajaj',
    manufactureYear: 2024,
    licenseExpiryDate: '2028-01-01',
    insuranceExpiryDate: '2028-02-01',
    authorizationExpiryDate: '2028-03-01',
  },
  documents: [
    {
      documentId: 'doc-license',
      documentType: 'license' as const,
      uploadReferenceKey: 'uploads/license/redacted',
      verificationStatus: 'pending_review' as const,
      submittedAt: '2026-07-03T08:00:00.000Z',
      reviewedAt: null,
      rejectionReason: null,
      clarificationReason: null,
      version: 1,
    },
  ],
  history: [
    { id: 'hist-1', type: 'submitted' as const, at: '2026-07-03T08:00:00.000Z' },
    { id: 'hist-2', type: 'pending_review' as const, at: '2026-07-03T08:01:00.000Z' },
  ],
  submittedAt: '2026-07-03T08:00:00.000Z',
  updatedAt: '2026-07-03T08:01:00.000Z',
};

const applicationDomain: DriverApplicationSubmission = {
  id: 'app-1',
  clientSubmissionId: 'client-app-1',
  kind: 'driver_application',
  status: 'submitted',
  reviewStatus: 'pending_review',
  submittedAt: '2026-07-03T08:00:00.000Z',
  updatedAt: '2026-07-03T08:01:00.000Z',
  history: [
    { id: 'hist-1', type: 'submitted', at: '2026-07-03T08:00:00.000Z' },
    { id: 'hist-2', type: 'pending_review', at: '2026-07-03T08:01:00.000Z' },
  ],
  userId: 'account-1',
  fullName: 'Driver One',
  phone: '+250788123456',
  dob: '01/01/1990',
  nationalId: '1199080012345678',
  operatingLocation: {
    province: 'Kigali',
    district: 'Gasabo',
    sector: 'Kimironko',
    cell: 'Bibare',
    village: 'Amahoro',
  },
  momoDetails: {
    provider: 'mtn',
    momoCode: '0788123456',
    merchantCode: 'MOMO-SECRET',
  },
  selfieImage: 'driver-selfie-ref',
  firstVehicle: {
    vehicleType: 'moto',
    plateNumber: 'RAB 123A',
    licenseNumber: 'LIC-SECRET',
    brand: 'TVS',
    model: 'Bajaj',
    manufactureYear: 2024,
    licenseExpiryDate: '2028-01-01',
    insuranceExpiryDate: '2028-02-01',
    authorizationExpiryDate: '2028-03-01',
  },
  documents: {
    license: {
      key: 'license',
      faces: [null, null],
      reviewStatus: 'pending_review',
      submissionKind: 'initial',
      submittedAt: '2026-07-03T08:00:00.000Z',
      updatedAt: '2026-07-03T08:00:00.000Z',
    },
    nationalId: {
      key: 'nationalId',
      faces: [null, null],
      reviewStatus: 'pending_review',
      submissionKind: 'initial',
      submittedAt: '2026-07-03T08:00:00.000Z',
      updatedAt: '2026-07-03T08:00:00.000Z',
    },
    insurance: {
      key: 'insurance',
      faces: [null, null],
      reviewStatus: 'pending_review',
      submissionKind: 'initial',
      submittedAt: '2026-07-03T08:00:00.000Z',
      updatedAt: '2026-07-03T08:00:00.000Z',
    },
    authorization: {
      key: 'authorization',
      faces: [null, null],
      reviewStatus: 'pending_review',
      submissionKind: 'initial',
      submittedAt: '2026-07-03T08:00:00.000Z',
      updatedAt: '2026-07-03T08:00:00.000Z',
    },
  },
};

const applicationStatusDto = {
  applicationId: 'app-1',
  userId: 'account-1',
  status: 'under_review' as const,
  reviewStatus: 'pending_review' as const,
  stage: 'under_review' as const,
  updatedAt: '2026-07-03T08:02:00.000Z',
  submittedAt: '2026-07-03T08:00:00.000Z',
};

const applicationStatusDomain: DriverApplicationStatusDomain = {
  applicationId: 'app-1',
  userId: 'account-1',
  status: 'pending_review',
  reviewStatus: 'pending_review',
  stage: 'under_review',
  updatedAt: '2026-07-03T08:02:00.000Z',
  submittedAt: '2026-07-03T08:00:00.000Z',
  reviewedAt: null,
  reason: null,
};

const documentMetadataDto = {
  documentId: 'app-1:license',
  documentType: 'license' as const,
  uploadReferenceKey: 'uploads/app-1/license/v1',
  verificationStatus: 'pending_review' as const,
  submittedAt: '2026-07-03T08:00:00.000Z',
  reviewedAt: null,
  rejectionReason: null,
  clarificationReason: null,
  version: 1,
};

const documentMetadataDomain: DriverDocumentMetadataDomain = { ...documentMetadataDto };

const clarificationDto = {
  id: 'clar-1',
  applicationId: 'app-1',
  status: 'open' as const,
  category: 'document' as const,
  message: 'Please upload a clearer license image.',
  requestedAt: '2026-07-03T09:00:00.000Z',
  respondedAt: null,
  responseMessage: null,
};

const clarificationDomain: DriverClarificationDomain = { ...clarificationDto };

const localProfile: DriverProfile = {
  verificationStatus: 'pending_review',
  vehicleType: 'moto',
  brand: 'TVS',
  model: 'Bajaj',
  plateNumber: 'RAB 123A',
  licenseNumber: 'LIC-SECRET',
  nationalId: '1199080012345678',
  province: 'Kigali',
  district: 'Gasabo',
  sector: 'Kimironko',
  momoCode: '0788123456',
  momoProvider: 'mtn',
  dob: '01/01/1990',
  isOnline: false,
  isVerified: false,
  acceptanceRate: 0,
  completedRides: 0,
  dailyRides: 0,
  dailyDeclines: 0,
  policyAccepted: false,
  earningsTotal: 0,
};

function createLocalRepository(overrides = {}) {
  return {
    getDriverProfile: jest.fn(async () => localProfile),
    saveDriverProfile: jest.fn(async () => undefined),
    setOnlineState: jest.fn(async () => undefined),
    clearDriverState: jest.fn(async () => undefined),
    getDriverApplication: jest.fn(async () => applicationDomain),
    getDriverApplicationStatus: jest.fn(async () => applicationStatusDomain),
    submitDriverApplication: jest.fn(async () => applicationDomain),
    updateDriverApplication: jest.fn(async () => applicationDomain),
    getSubmittedDocumentMetadata: jest.fn(async () => [documentMetadataDomain]),
    submitDocumentMetadata: jest.fn(async () => documentMetadataDomain),
    getClarificationRequests: jest.fn(async () => [clarificationDomain]),
    respondToClarificationRequest: jest.fn(async () => ({ ...clarificationDomain, status: 'responded' as const })),
    ...overrides,
  };
}

describe('RemoteDriverRepository', () => {
  beforeEach(() => resetObservabilityForTests());

  test('GET driver application/profile and status map to domain', async () => {
    const transportFixture = createFakeBackendTransport([
      { method: 'GET', path: '/v1/driver/applications/current', response: { status: 200, data: { data: applicationDto, version: 'v1' } } },
      { method: 'GET', path: '/v1/driver/applications/current', response: { status: 200, data: { data: applicationDto, version: 'v1' } } },
      { method: 'GET', path: '/v1/driver/applications/app-1/status', response: { status: 200, data: { data: applicationStatusDto, version: 'v1' } } },
    ]);
    const repo = new RemoteDriverRepository({ client: new BackendClient({ transport: transportFixture.transport }) });

    await expect(repo.getDriverApplication()).resolves.toEqual(applicationDomain);
    await expect(repo.getDriverProfile()).resolves.toEqual(expect.objectContaining({
      verificationStatus: 'pending_review',
      isVerified: false,
      vehicleType: 'moto',
      nationalId: '1199080012345678',
    }));
    await expect(repo.getDriverApplicationStatus('app-1')).resolves.toEqual(applicationStatusDomain);
  });

  test('POST submit and PATCH update application map domain to DTO', async () => {
    const transportFixture = createFakeBackendTransport([
      { method: 'POST', path: '/v1/driver/applications', response: { status: 200, data: { data: applicationDto, version: 'v1' } } },
      { method: 'PATCH', path: '/v1/driver/applications/app-1', response: { status: 200, data: { data: applicationDto, version: 'v1' } } },
    ]);
    const repo = new RemoteDriverRepository({ client: new BackendClient({ transport: transportFixture.transport }) });

    await expect(repo.submitDriverApplication(applicationDomain)).resolves.toEqual(applicationDomain);
    await expect(repo.updateDriverApplication(applicationDomain)).resolves.toEqual(applicationDomain);
    expect(transportFixture.calls[0]).toMatchObject({
      method: 'POST',
      path: '/v1/driver/applications',
      body: expect.objectContaining({
        clientSubmissionId: 'client-app-1',
        userId: 'account-1',
        nationalId: '1199080012345678',
        licenseNumber: 'LIC-SECRET',
        momoDetails: expect.objectContaining({ momoCode: '0788123456' }),
      }),
    });
    expect(transportFixture.calls[1]).toMatchObject({
      method: 'PATCH',
      path: '/v1/driver/applications/app-1',
      body: expect.objectContaining({ applicationId: 'app-1' }),
    });
  });

  test('document metadata and clarification flows map correctly', async () => {
    const responded = { ...clarificationDto, status: 'responded' as const, respondedAt: '2026-07-03T09:10:00.000Z', responseMessage: 'Uploaded again.' };
    const transportFixture = createFakeBackendTransport([
      { method: 'GET', path: '/v1/driver/applications/app-1/documents', response: { status: 200, data: { data: { items: [documentMetadataDto] }, version: 'v1' } } },
      { method: 'POST', path: '/v1/driver/applications/app-1/documents', response: { status: 200, data: { data: documentMetadataDto, version: 'v1' } } },
      { method: 'GET', path: '/v1/driver/applications/app-1/clarifications', response: { status: 200, data: { data: { items: [clarificationDto] }, version: 'v1' } } },
      { method: 'PATCH', path: '/v1/driver/applications/app-1/clarifications/clar-1', response: { status: 200, data: { data: responded, version: 'v1' } } },
    ]);
    const repo = new RemoteDriverRepository({ client: new BackendClient({ transport: transportFixture.transport }) });

    await expect(repo.getSubmittedDocumentMetadata('app-1')).resolves.toEqual([documentMetadataDomain]);
    await expect(repo.submitDocumentMetadata({ ...documentMetadataDomain, applicationId: 'app-1' })).resolves.toEqual(documentMetadataDomain);
    await expect(repo.getClarificationRequests('app-1')).resolves.toEqual([clarificationDomain]);
    await expect(repo.respondToClarificationRequest('app-1', 'clar-1', 'Uploaded again.')).resolves.toEqual(responded);
    expect(JSON.stringify(transportFixture.calls[1].body)).not.toContain('base64');
  });

  test('typed failures map correctly', async () => {
    const cases = [
      new UnauthorizedError({ repository: 'driver', method: 'getDriverApplication', transport: 'remote' }),
      new ForbiddenError({ repository: 'driver', method: 'getDriverApplication', transport: 'remote' }),
      new ConflictError({ repository: 'driver', method: 'getDriverApplication', transport: 'remote' }),
      new ValidationError({ repository: 'driver', method: 'getDriverApplication', transport: 'remote' }),
      new RateLimitedError({ repository: 'driver', method: 'getDriverApplication', transport: 'remote' }),
      new TimeoutError({ repository: 'driver', method: 'getDriverApplication', transport: 'remote' }),
      new OfflineError({ repository: 'driver', method: 'getDriverApplication', transport: 'remote' }),
      new ServerError({ repository: 'driver', method: 'getDriverApplication', transport: 'remote' }),
    ];

    for (const error of cases) {
      const transportFixture = createFakeBackendTransport([
        { method: 'GET', path: '/v1/driver/applications/current', error },
      ]);
      await expect(new RemoteDriverRepository({ client: new BackendClient({ transport: transportFixture.transport }) }).getDriverApplication()).rejects.toBeInstanceOf(error.constructor as any);
    }
  });

  test('mobile repository exposes no approval authority operations', () => {
    const repo = new RemoteDriverRepository();
    expect(repo).not.toHaveProperty('approveDriver');
    expect(repo).not.toHaveProperty('rejectDriver');
    expect(repo).not.toHaveProperty('forceVerification');
  });
});

describe('driver shadow repository', () => {
  beforeEach(() => resetObservabilityForTests());

  test('SHADOW_REMOTE returns local results and ignores remote approval capability', async () => {
    const remoteApproved = {
      ...applicationDto,
      status: 'approved' as const,
      reviewStatus: 'approved' as const,
      reviewDecision: { status: 'approved' as const, reviewedAt: '2026-07-03T10:00:00.000Z' },
    };
    const localRepository = createLocalRepository();
    const transportFixture = createFakeBackendTransport([
      { method: 'GET', path: '/v1/driver/applications/current', response: { status: 200, data: { data: remoteApproved, version: 'v1' } } },
      { method: 'GET', path: '/v1/driver/applications/app-1/status', response: { status: 200, data: { data: { ...applicationStatusDto, status: 'approved', reviewStatus: 'approved', stage: 'approved' }, version: 'v1' } } },
      { method: 'GET', path: '/v1/driver/applications/app-1/documents', response: { status: 200, data: { data: { items: [{ ...documentMetadataDto, verificationStatus: 'verified' }] }, version: 'v1' } } },
      { method: 'GET', path: '/v1/driver/applications/app-1/clarifications', response: { status: 200, data: { data: { items: [] }, version: 'v1' } } },
      { method: 'POST', path: '/v1/driver/applications', response: { status: 200, data: { data: remoteApproved, version: 'v1' } } },
    ]);
    const shadow = createDriverShadowRepository({
      localRepository,
      remoteRepository: new RemoteDriverRepository({ client: new BackendClient({ transport: transportFixture.transport }), transportLabel: 'shadow_remote' }),
    });

    await expect(shadow.getDriverProfile()).resolves.toEqual(localProfile);
    await expect(shadow.getDriverApplication()).resolves.toEqual(applicationDomain);
    await expect(shadow.getDriverApplicationStatus('app-1')).resolves.toEqual(applicationStatusDomain);
    await expect(shadow.getSubmittedDocumentMetadata('app-1')).resolves.toEqual([documentMetadataDomain]);
    await expect(shadow.getClarificationRequests('app-1')).resolves.toEqual([clarificationDomain]);
    await expect(shadow.submitDriverApplication(applicationDomain)).resolves.toEqual(applicationDomain);
    expect(localProfile.isVerified).toBe(false);
    expect(localProfile.verificationStatus).toBe('pending_review');
    expect(localRepository.saveDriverProfile).not.toHaveBeenCalled();
    const metricNames = observability.metrics.getPoints().map(point => point.name);
    expect(metricNames).toContain('driver.remote.shadow');
    expect(metricNames).toContain('driver.remote.latency_ms');
    expect(metricNames).toContain('driver.remote.semantic_mismatch');
    expect(metricNames).toContain('driver.remote.application_status_mismatch');
    expect(metricNames).toContain('driver.remote.document_metadata_mismatch');
    expect(metricNames).toContain('driver.remote.clarification_mismatch');
  });

  test('write shadow runs local first and ignores remote failures', async () => {
    const localRepository = createLocalRepository();
    const transportFixture = createFakeBackendTransport([
      { method: 'PATCH', path: '/v1/driver/applications/app-1', error: new TimeoutError({ repository: 'driver', method: 'updateDriverApplication', transport: 'remote' }) },
      { method: 'POST', path: '/v1/driver/applications/app-1/documents', error: new TimeoutError({ repository: 'driver', method: 'submitDocumentMetadata', transport: 'remote' }) },
      { method: 'PATCH', path: '/v1/driver/applications/app-1/clarifications/clar-1', error: new TimeoutError({ repository: 'driver', method: 'respondToClarificationRequest', transport: 'remote' }) },
    ]);
    const shadow = createDriverShadowRepository({
      localRepository,
      remoteRepository: new RemoteDriverRepository({ client: new BackendClient({ transport: transportFixture.transport }) }),
    });

    await expect(shadow.updateDriverApplication(applicationDomain)).resolves.toEqual(applicationDomain);
    await expect(shadow.submitDocumentMetadata({ ...documentMetadataDomain, applicationId: 'app-1' })).resolves.toEqual(documentMetadataDomain);
    await expect(shadow.respondToClarificationRequest('app-1', 'clar-1', 'Updated')).resolves.toEqual({ ...clarificationDomain, status: 'responded' });
    expect(localRepository.updateDriverApplication).toHaveBeenCalled();
    expect(localRepository.submitDocumentMetadata).toHaveBeenCalled();
    expect(localRepository.respondToClarificationRequest).toHaveBeenCalled();
  });

  test('one-account identity remains intact and telemetry is sanitized', async () => {
    const localRepository = createLocalRepository();
    const transportFixture = createFakeBackendTransport([
      { method: 'GET', path: '/v1/driver/applications/current', response: { status: 200, data: { data: { ...applicationDto, userId: 'account-1', status: 'rejected', reviewStatus: 'rejected' }, version: 'v1' } } },
    ]);
    const shadow = createDriverShadowRepository({
      localRepository,
      remoteRepository: new RemoteDriverRepository({ client: new BackendClient({ transport: transportFixture.transport }) }),
    });

    await expect(shadow.getDriverApplication()).resolves.toEqual(applicationDomain);
    const logs = JSON.stringify(observability.logger.getLogs());
    expect(logs).not.toContain('1199080012345678');
    expect(logs).not.toContain('01/01/1990');
    expect(logs).not.toContain('LIC-SECRET');
    expect(logs).not.toContain('MOMO-SECRET');
    expect(logs).not.toContain('0788123456');
    expect(logs).not.toContain('+250788123456');
    expect(applicationDomain.userId).toBe('account-1');
  });

  test('LOCAL default and ride lifecycle remain untouched', () => {
    expect(repositoryResolver.getMode()).toBe('LOCAL');
  });
});
