import type { DriverRepository } from '@/data/repositories/interfaces';
import { driverRepository as localDriverRepository } from '@/data/repositories';
import type { DriverApplicationSubmission, DriverProfile } from '@/types';
import { observability } from '@/observability/context/observabilityContext';
import { BackendClient } from '../client/backendClient';
import { BackendError, createBackendUnavailableError, createNotImplementedError } from '../contracts/backendErrors';
import type {
  AdminClarificationResponseResponseDto,
  DriverApplicationResponseDto,
  DriverApplicationStatusResponseDto,
  DriverClarificationListResponseDto,
  DriverDocumentMetadataResponseDto,
  SubmitDriverApplicationResponseDto,
  UpdateDriverApplicationResponseDto,
  UploadDriverDocumentResponseDto,
} from '../contracts/api';
import type { ApiIdempotencyMetadata } from '../contracts/api/shared';
import {
  domainToClarificationResponseDto,
  domainToDriverDocumentUploadDto,
  domainToSubmitDriverApplicationDto,
  domainToUpdateDriverApplicationDto,
  dtoListToDomainDriverClarifications,
  dtoListToDomainDriverDocumentMetadata,
  dtoToDomainDriverApplication,
  dtoToDomainDriverApplicationStatus,
  dtoToDomainDriverClarification,
  dtoToDomainDriverDocumentMetadata,
  errorToRepositoryFailureDriver,
  type DriverApplicationStatusDomain,
  type DriverClarificationDomain,
  type DriverDocumentMetadataDomain,
} from '../mappers/driverMapper';

export interface RemoteDriverRepositoryOptions {
  client?: BackendClient;
  transportLabel?: 'remote' | 'shadow_remote' | 'hybrid';
}

export interface DriverApplicationRepository extends DriverRepository {
  getDriverApplication(): Promise<DriverApplicationSubmission | null>;
  getDriverApplicationStatus(applicationId: string): Promise<DriverApplicationStatusDomain | null>;
  submitDriverApplication(application: DriverApplicationSubmission): Promise<DriverApplicationSubmission>;
  updateDriverApplication(application: DriverApplicationSubmission): Promise<DriverApplicationSubmission>;
  getSubmittedDocumentMetadata(applicationId: string): Promise<DriverDocumentMetadataDomain[]>;
  submitDocumentMetadata(input: DriverDocumentMetadataDomain & { applicationId: string }): Promise<DriverDocumentMetadataDomain>;
  getClarificationRequests(applicationId: string): Promise<DriverClarificationDomain[]>;
  respondToClarificationRequest(applicationId: string, clarificationId: string, message: string): Promise<DriverClarificationDomain | null>;
}

type DriverShadowLocalRepository = DriverRepository & Partial<DriverApplicationRepository>;

function summarizeShape(value: unknown) {
  if (Array.isArray(value)) return `array:${value.length}`;
  if (value === null) return 'null';
  if (typeof value === 'object') return `object:${Object.keys(value as Record<string, unknown>).length}`;
  return typeof value;
}

function reviewCategory(status?: string | null) {
  if (status === 'verified') return 'verified';
  if (status === 'approved') return 'approved';
  if (status === 'rejected') return 'rejected';
  if (status === 'needs_clarification') return 'needs_clarification';
  return 'pending';
}

function summarizeApplication(application: DriverApplicationSubmission | null | undefined) {
  if (!application) return null;
  return {
    exists: true,
    stage: application.status,
    reviewCategory: reviewCategory(application.reviewStatus),
    vehicleType: application.firstVehicle.vehicleType,
    documentTypes: Object.keys(application.documents).sort(),
    historyCount: application.history.length,
  };
}

function summarizeProfile(profile: DriverProfile | null | undefined) {
  if (!profile) return null;
  return {
    exists: true,
    verificationCategory: profile.isVerified ? 'verified' : reviewCategory(profile.verificationStatus ?? 'pending_review'),
    vehicleType: profile.vehicleType,
    vehicleCount: profile.vehicles?.length ?? 0,
    onlineCapable: profile.isVerified && profile.policyAccepted,
  };
}

function summarizeStatus(status: DriverApplicationStatusDomain | null | undefined) {
  if (!status) return null;
  return {
    exists: true,
    stage: status.stage,
    reviewCategory: reviewCategory(status.reviewStatus),
  };
}

function summarizeDocuments(documents: DriverDocumentMetadataDomain[] | null | undefined) {
  return (documents ?? []).map(document => ({
    documentType: document.documentType,
    verificationCategory: reviewCategory(document.verificationStatus),
    hasReference: Boolean(document.uploadReferenceKey),
    version: document.version,
  })).sort((a, b) => a.documentType.localeCompare(b.documentType));
}

function summarizeClarifications(clarifications: DriverClarificationDomain[] | null | undefined) {
  return (clarifications ?? []).map(item => ({
    status: item.status,
    category: item.category,
  }));
}

function recordTelemetry(
  event: 'driver remote shadow request' | 'driver remote shadow success' | 'driver remote shadow failure',
  context: {
    method: string;
    latencyMs: number;
    responseShape: string;
    transport: 'remote' | 'shadow_remote' | 'hybrid';
    error?: unknown;
  },
) {
  observability.metrics.counter('driver.remote.shadow', 1, {
    method: context.method,
    transport: context.transport,
    event,
  });
  observability.metrics.histogram('driver.remote.latency_ms', context.latencyMs, {
    method: context.method,
    transport: context.transport,
  });
  observability.logger.info('DriverRemoteShadow', {
    event,
    method: context.method,
    transport: context.transport,
    latencyMs: context.latencyMs,
    responseShape: context.responseShape,
    error: context.error instanceof Error ? context.error.name : undefined,
  });
}

function recordMismatch(method: string, local: unknown, remote: unknown, category: string) {
  if (summarizeShape(local) !== summarizeShape(remote)) {
    observability.metrics.counter('driver.remote.shape_mismatch', 1, { method, category });
  }
  observability.metrics.counter('driver.remote.semantic_mismatch', 1, { method, category });
  observability.metrics.counter(`driver.remote.${category}_mismatch`, 1, { method });
  observability.logger.warn('DriverRemoteShadowMismatch', {
    method,
    category,
    localShape: summarizeShape(local),
    remoteShape: summarizeShape(remote),
  });
}

function metadata(action: string, subjectId: string): ApiIdempotencyMetadata {
  const timestamp = new Date().toISOString();
  return {
    idempotencyKey: `driver:${action}:${subjectId}`,
    correlationId: `driver:${action}:${subjectId}`,
    actorId: subjectId,
    actorRole: 'driver',
    clientTimestamp: timestamp,
  };
}

function resolveClient(method: string, client?: BackendClient) {
  if (!client) throw createBackendUnavailableError('driver', method, 'remote');
  return client;
}

function toRepositoryFailure(error: unknown): BackendError {
  return errorToRepositoryFailureDriver(error);
}

export class RemoteDriverRepository implements DriverApplicationRepository {
  private readonly client?: BackendClient;
  private readonly transportLabel: 'remote' | 'shadow_remote' | 'hybrid';

  constructor(options: RemoteDriverRepositoryOptions = {}) {
    this.client = options.client;
    this.transportLabel = options.transportLabel ?? 'remote';
  }

  private async shadow<T>(method: string, execute: () => Promise<T>): Promise<T> {
    const startedAt = Date.now();
    recordTelemetry('driver remote shadow request', {
      method,
      latencyMs: 0,
      responseShape: 'pending',
      transport: this.transportLabel,
    });
    try {
      const value = await execute();
      recordTelemetry('driver remote shadow success', {
        method,
        latencyMs: Date.now() - startedAt,
        responseShape: summarizeShape(value),
        transport: this.transportLabel,
      });
      return value;
    } catch (error) {
      recordTelemetry('driver remote shadow failure', {
        method,
        latencyMs: Date.now() - startedAt,
        responseShape: summarizeShape(error),
        transport: this.transportLabel,
        error,
      });
      throw toRepositoryFailure(error);
    }
  }

  async getDriverProfile(): Promise<DriverProfile | null> {
    const application = await this.getDriverApplication();
    if (!application) return null;
    return {
      verificationStatus: application.reviewStatus === 'approved' ? 'approved' : application.reviewStatus === 'rejected' ? 'rejected' : 'pending_review',
      vehicleType: application.firstVehicle.vehicleType,
      brand: application.firstVehicle.brand,
      model: application.firstVehicle.model,
      manufactureYear: application.firstVehicle.manufactureYear,
      plateNumber: application.firstVehicle.plateNumber,
      licenseNumber: application.firstVehicle.licenseNumber,
      nationalId: application.nationalId,
      licenseExpiryDate: application.firstVehicle.licenseExpiryDate,
      insuranceExpiryDate: application.firstVehicle.insuranceExpiryDate,
      authorizationExpiryDate: application.firstVehicle.authorizationExpiryDate,
      province: application.operatingLocation.province,
      district: application.operatingLocation.district,
      sector: application.operatingLocation.sector,
      cell: application.operatingLocation.cell,
      village: application.operatingLocation.village,
      city: application.operatingLocation.city,
      momoCode: application.momoDetails.momoCode,
      merchantCode: application.momoDetails.merchantCode,
      momoProvider: application.momoDetails.provider,
      dob: application.dob,
      profileImage: application.selfieImage ?? undefined,
      isOnline: false,
      isVerified: application.reviewStatus === 'approved',
      acceptanceRate: 0,
      completedRides: 0,
      dailyRides: 0,
      dailyDeclines: 0,
      policyAccepted: false,
      earningsTotal: 0,
      passengerSeats: application.firstVehicle.passengerSeats,
      loadCapacityKg: application.firstVehicle.loadCapacityKg,
      rejectionReason: application.reviewDecision?.reason,
    };
  }

  async saveDriverProfile(profile: DriverProfile): Promise<void> {
    throw createNotImplementedError('driver', 'saveDriverProfile', this.transportLabel);
  }

  async setOnlineState(): Promise<void> {
    throw createNotImplementedError('driver', 'setOnlineState', this.transportLabel);
  }

  async clearDriverState(): Promise<void> {
    throw createNotImplementedError('driver', 'clearDriverState', this.transportLabel);
  }

  async getDriverApplication(): Promise<DriverApplicationSubmission | null> {
    return this.shadow('getDriverApplication', async () => {
      const client = resolveClient('getDriverApplication', this.client);
      const response = await client.get<DriverApplicationResponseDto>('/v1/driver/applications/current');
      return response.data.data ? dtoToDomainDriverApplication(response.data.data) : null;
    });
  }

  async getDriverApplicationStatus(applicationId: string): Promise<DriverApplicationStatusDomain | null> {
    return this.shadow('getDriverApplicationStatus', async () => {
      const client = resolveClient('getDriverApplicationStatus', this.client);
      const response = await client.get<DriverApplicationStatusResponseDto>(`/v1/driver/applications/${applicationId}/status`);
      return response.data.data ? dtoToDomainDriverApplicationStatus(response.data.data) : null;
    });
  }

  async submitDriverApplication(application: DriverApplicationSubmission): Promise<DriverApplicationSubmission> {
    return this.shadow('submitDriverApplication', async () => {
      const client = resolveClient('submitDriverApplication', this.client);
      const response = await client.post<SubmitDriverApplicationResponseDto>('/v1/driver/applications', {
        body: domainToSubmitDriverApplicationDto(application, metadata('submit-application', application.userId)),
      });
      return dtoToDomainDriverApplication(response.data.data);
    });
  }

  async updateDriverApplication(application: DriverApplicationSubmission): Promise<DriverApplicationSubmission> {
    return this.shadow('updateDriverApplication', async () => {
      const client = resolveClient('updateDriverApplication', this.client);
      const response = await client.patch<UpdateDriverApplicationResponseDto>(`/v1/driver/applications/${application.id}`, {
        body: domainToUpdateDriverApplicationDto(application, metadata('update-application', application.id)),
      });
      return dtoToDomainDriverApplication(response.data.data);
    });
  }

  async getSubmittedDocumentMetadata(applicationId: string): Promise<DriverDocumentMetadataDomain[]> {
    return this.shadow('getSubmittedDocumentMetadata', async () => {
      const client = resolveClient('getSubmittedDocumentMetadata', this.client);
      const response = await client.get<DriverDocumentMetadataResponseDto>(`/v1/driver/applications/${applicationId}/documents`);
      return dtoListToDomainDriverDocumentMetadata(response.data.data.items ?? []);
    });
  }

  async submitDocumentMetadata(input: DriverDocumentMetadataDomain & { applicationId: string }): Promise<DriverDocumentMetadataDomain> {
    return this.shadow('submitDocumentMetadata', async () => {
      const client = resolveClient('submitDocumentMetadata', this.client);
      const response = await client.post<UploadDriverDocumentResponseDto>(`/v1/driver/applications/${input.applicationId}/documents`, {
        body: {
          ...domainToDriverDocumentUploadDto(input, metadata('document-metadata', input.documentId)),
          applicationId: input.applicationId,
        },
      });
      return dtoToDomainDriverDocumentMetadata(response.data.data);
    });
  }

  async getClarificationRequests(applicationId: string): Promise<DriverClarificationDomain[]> {
    return this.shadow('getClarificationRequests', async () => {
      const client = resolveClient('getClarificationRequests', this.client);
      const response = await client.get<DriverClarificationListResponseDto>(`/v1/driver/applications/${applicationId}/clarifications`);
      return dtoListToDomainDriverClarifications(response.data.data.items ?? []);
    });
  }

  async respondToClarificationRequest(applicationId: string, clarificationId: string, message: string): Promise<DriverClarificationDomain | null> {
    return this.shadow('respondToClarificationRequest', async () => {
      const client = resolveClient('respondToClarificationRequest', this.client);
      const response = await client.patch<AdminClarificationResponseResponseDto>(`/v1/driver/applications/${applicationId}/clarifications/${clarificationId}`, {
        body: domainToClarificationResponseDto(applicationId, clarificationId, message, metadata('clarification-response', clarificationId)),
      });
      if ('accepted' in response.data.data) return null;
      return dtoToDomainDriverClarification(response.data.data);
    });
  }
}

export function createRemoteDriverRepositoryPrototype(options: RemoteDriverRepositoryOptions = {}) {
  return new RemoteDriverRepository(options);
}

export function createDriverShadowRepository(options: {
  localRepository?: DriverShadowLocalRepository;
  remoteRepository: RemoteDriverRepository;
}): DriverApplicationRepository {
  const localRepository: DriverShadowLocalRepository = options.localRepository ?? localDriverRepository;
  const { remoteRepository } = options;

  async function compareAndReturn<T>(
    method: string,
    local: () => Promise<T>,
    remote: () => Promise<T>,
    summarize: (value: T) => unknown,
    category: string,
  ): Promise<T> {
    const localValue = await local();
    try {
      const remoteValue = await remote();
      const localSummary = summarize(localValue);
      const remoteSummary = summarize(remoteValue);
      if (JSON.stringify(localSummary ?? null) !== JSON.stringify(remoteSummary ?? null)) {
        recordMismatch(method, localSummary, remoteSummary, category);
      }
    } catch (error) {
      observability.logger.warn('DriverRemoteShadowFailure', {
        method,
        error: error instanceof Error ? error.name : 'unknown',
      });
    }
    return localValue;
  }

  return {
    async getDriverProfile() {
      return compareAndReturn(
        'getDriverProfile',
        () => localRepository.getDriverProfile(),
        () => remoteRepository.getDriverProfile(),
        summarizeProfile,
        'application_status',
      );
    },
    async saveDriverProfile(profile: DriverProfile) {
      await localRepository.saveDriverProfile(profile);
      try {
        await remoteRepository.saveDriverProfile(profile);
      } catch (error) {
        observability.logger.warn('DriverRemoteShadowFailure', {
          method: 'saveDriverProfile',
          error: error instanceof Error ? error.name : 'unknown',
        });
      }
    },
    async setOnlineState(isOnline: boolean) {
      await localRepository.setOnlineState(isOnline);
    },
    async clearDriverState() {
      await localRepository.clearDriverState();
    },
    async getDriverApplication() {
      return compareAndReturn(
        'getDriverApplication',
        async () => localRepository.getDriverApplication ? localRepository.getDriverApplication() : null,
        () => remoteRepository.getDriverApplication(),
        summarizeApplication,
        'application_status',
      );
    },
    async getDriverApplicationStatus(applicationId: string) {
      return compareAndReturn(
        'getDriverApplicationStatus',
        async () => localRepository.getDriverApplicationStatus ? localRepository.getDriverApplicationStatus(applicationId) : null,
        () => remoteRepository.getDriverApplicationStatus(applicationId),
        summarizeStatus,
        'application_status',
      );
    },
    async submitDriverApplication(application: DriverApplicationSubmission) {
      const local = localRepository.submitDriverApplication
        ? await localRepository.submitDriverApplication(application)
        : application;
      try {
        const remote = await remoteRepository.submitDriverApplication(application);
        const localSummary = summarizeApplication(local);
        const remoteSummary = summarizeApplication(remote);
        if (JSON.stringify(localSummary) !== JSON.stringify(remoteSummary)) {
          recordMismatch('submitDriverApplication', localSummary, remoteSummary, 'application_status');
        }
      } catch (error) {
        observability.logger.warn('DriverRemoteShadowFailure', {
          method: 'submitDriverApplication',
          error: error instanceof Error ? error.name : 'unknown',
        });
      }
      return local;
    },
    async updateDriverApplication(application: DriverApplicationSubmission) {
      const local = localRepository.updateDriverApplication
        ? await localRepository.updateDriverApplication(application)
        : application;
      try {
        await remoteRepository.updateDriverApplication(application);
      } catch (error) {
        observability.logger.warn('DriverRemoteShadowFailure', {
          method: 'updateDriverApplication',
          error: error instanceof Error ? error.name : 'unknown',
        });
      }
      return local;
    },
    async getSubmittedDocumentMetadata(applicationId: string) {
      return compareAndReturn(
        'getSubmittedDocumentMetadata',
        async () => localRepository.getSubmittedDocumentMetadata ? localRepository.getSubmittedDocumentMetadata(applicationId) : [],
        () => remoteRepository.getSubmittedDocumentMetadata(applicationId),
        summarizeDocuments,
        'document_metadata',
      );
    },
    async submitDocumentMetadata(input: DriverDocumentMetadataDomain & { applicationId: string }) {
      const local = localRepository.submitDocumentMetadata
        ? await localRepository.submitDocumentMetadata(input)
        : input;
      try {
        await remoteRepository.submitDocumentMetadata(input);
      } catch (error) {
        observability.logger.warn('DriverRemoteShadowFailure', {
          method: 'submitDocumentMetadata',
          error: error instanceof Error ? error.name : 'unknown',
        });
      }
      return local;
    },
    async getClarificationRequests(applicationId: string) {
      return compareAndReturn(
        'getClarificationRequests',
        async () => localRepository.getClarificationRequests ? localRepository.getClarificationRequests(applicationId) : [],
        () => remoteRepository.getClarificationRequests(applicationId),
        summarizeClarifications,
        'clarification',
      );
    },
    async respondToClarificationRequest(applicationId: string, clarificationId: string, message: string) {
      const local = localRepository.respondToClarificationRequest
        ? await localRepository.respondToClarificationRequest(applicationId, clarificationId, message)
        : null;
      try {
        await remoteRepository.respondToClarificationRequest(applicationId, clarificationId, message);
      } catch (error) {
        observability.logger.warn('DriverRemoteShadowFailure', {
          method: 'respondToClarificationRequest',
          error: error instanceof Error ? error.name : 'unknown',
        });
      }
      return local;
    },
  };
}
