import type { ApiIdempotencyMetadata } from '../contracts/api/shared';
import type {
  AdminClarificationResponseRequestDto,
  DriverApplicationDto,
  DriverApplicationStatusDto,
  DriverClarificationDto,
  DriverDocumentMetadataDto,
  SubmitDriverApplicationRequestDto,
  UpdateDriverApplicationRequestDto,
  UploadDriverDocumentRequestDto,
} from '../contracts/api';
import {
  BackendError,
  BackendUnavailableError,
  ConflictError,
  ForbiddenError,
  OfflineError,
  RateLimitedError,
  SerializationError,
  ServerError,
  TimeoutError,
  UnauthorizedError,
  ValidationError,
  createNotImplementedError,
} from '../contracts/backendErrors';
import type {
  DriverApplicationSubmission,
  DriverProfile,
  DriverVehicleDocumentRecord,
  VerificationSubmissionHistoryEvent,
  VerificationSubmissionStatus,
} from '@/types';
import type { DocumentKey } from '@/hooks/driver-onboarding/onboardingTypes';

export interface DriverApplicationStatusDomain {
  applicationId: string;
  userId: string;
  status: VerificationSubmissionStatus | 'needs_clarification';
  reviewStatus: 'pending_review' | 'approved' | 'rejected' | 'needs_clarification';
  stage: DriverApplicationStatusDto['stage'];
  updatedAt: string;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  reason?: string | null;
}

export interface DriverDocumentMetadataDomain {
  documentId: string;
  documentType: DocumentKey;
  uploadReferenceKey: string;
  verificationStatus: DriverDocumentMetadataDto['verificationStatus'];
  submittedAt: string;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  clarificationReason?: string | null;
  version: number;
}

export interface DriverClarificationDomain {
  id: string;
  applicationId: string;
  status: DriverClarificationDto['status'];
  category: DriverClarificationDto['category'];
  message: string;
  requestedAt: string;
  respondedAt?: string | null;
  responseMessage?: string | null;
}

function normalizeStatus(status: DriverApplicationDto['status']): VerificationSubmissionStatus | 'needs_clarification' {
  if (status === 'under_review') return 'pending_review';
  if (status === 'needs_clarification') return 'needs_clarification';
  return status;
}

function normalizeReviewStatus(dto: DriverApplicationDto): DriverApplicationSubmission['reviewStatus'] {
  if (dto.reviewStatus === 'approved') return 'approved';
  if (dto.reviewStatus === 'rejected') return 'rejected';
  return 'pending_review';
}

function dtoHistory(dto: DriverApplicationDto): VerificationSubmissionHistoryEvent[] {
  return (dto.history ?? []).map(event => ({
    id: event.id,
    type: event.type === 'under_review' ? 'pending_review' : event.type as VerificationSubmissionHistoryEvent['type'],
    at: event.at,
    reason: event.reason ?? undefined,
    rejectedFields: event.rejectedFields ?? undefined,
    rejectedDocuments: event.rejectedDocuments ?? undefined,
    reviewedBy: event.reviewedBy ?? undefined,
  })).filter(event => [
    'draft',
    'submitted',
    'pending_review',
    'resubmitted',
    'approved',
    'rejected',
    'cancelled',
  ].includes(event.type));
}

export function dtoToDomainDriverApplication(dto: DriverApplicationDto): DriverApplicationSubmission {
  const submittedAt = dto.submittedAt ?? dto.updatedAt ?? new Date(0).toISOString();
  const updatedAt = dto.updatedAt ?? submittedAt;
  const vehicle = dto.firstVehicle;
  return {
    id: dto.id,
    clientSubmissionId: dto.clientSubmissionId ?? dto.id,
    kind: 'driver_application',
    status: normalizeStatus(dto.status) === 'needs_clarification' ? 'pending_review' : normalizeStatus(dto.status) as VerificationSubmissionStatus,
    reviewStatus: normalizeReviewStatus(dto),
    submittedAt,
    updatedAt,
    reviewDecision: dto.reviewDecision
      ? {
        status: dto.reviewDecision.status,
        reviewedAt: dto.reviewDecision.reviewedAt,
        reviewedBy: dto.reviewDecision.reviewedBy ?? undefined,
        reason: dto.reviewDecision.reason ?? undefined,
        rejectedFields: dto.reviewDecision.rejectedFields ?? undefined,
        rejectedDocuments: dto.reviewDecision.rejectedDocuments ?? undefined,
      }
      : undefined,
    history: dtoHistory(dto),
    userId: dto.userId,
    fullName: dto.fullName ?? '',
    phone: dto.phone ?? '',
    dob: dto.dob ?? '',
    nationalId: dto.nationalId ?? '',
    operatingLocation: {
      province: dto.operatingLocation?.province ?? '',
      district: dto.operatingLocation?.district ?? '',
      sector: dto.operatingLocation?.sector ?? '',
      cell: dto.operatingLocation?.cell ?? undefined,
      village: dto.operatingLocation?.village ?? undefined,
      city: dto.operatingLocation?.city ?? undefined,
    },
    momoDetails: {
      provider: dto.momoDetails?.provider ?? 'mtn',
      momoCode: dto.momoDetails?.momoCode ?? '',
      merchantCode: dto.momoDetails?.merchantCode ?? undefined,
    },
    selfieImage: dto.selfieReference ?? null,
    firstVehicle: {
      vehicleType: vehicle?.vehicleType ?? 'moto',
      plateNumber: vehicle?.plateNumber ?? '',
      licenseNumber: vehicle?.licenseNumber ?? '',
      brand: vehicle?.brand ?? undefined,
      model: vehicle?.model ?? undefined,
      manufactureYear: vehicle?.manufactureYear ?? undefined,
      passengerSeats: vehicle?.passengerSeats ?? undefined,
      loadCapacityKg: vehicle?.loadCapacityKg ?? undefined,
      licenseExpiryDate: vehicle?.licenseExpiryDate ?? undefined,
      insuranceExpiryDate: vehicle?.insuranceExpiryDate ?? undefined,
      authorizationExpiryDate: vehicle?.authorizationExpiryDate ?? undefined,
    },
    documents: {
      license: metadataToDocumentRecord('license', dto.documents?.find(item => item.documentType === 'license'), submittedAt),
      nationalId: metadataToDocumentRecord('nationalId', dto.documents?.find(item => item.documentType === 'nationalId'), submittedAt),
      insurance: metadataToDocumentRecord('insurance', dto.documents?.find(item => item.documentType === 'insurance'), submittedAt),
      authorization: metadataToDocumentRecord('authorization', dto.documents?.find(item => item.documentType === 'authorization'), submittedAt),
    },
  };
}

function metadataToDocumentRecord(key: DocumentKey, dto: DriverDocumentMetadataDto | undefined, submittedAt: string): DriverVehicleDocumentRecord {
  return {
    key,
    faces: [null, null],
    reviewStatus: dto?.verificationStatus === 'verified' ? 'verified' : dto?.verificationStatus === 'rejected' ? 'rejected' : 'pending_review',
    submissionKind: 'initial',
    submittedAt: dto?.submittedAt ?? submittedAt,
    updatedAt: dto?.reviewedAt ?? dto?.submittedAt ?? submittedAt,
  };
}

export function dtoToDomainDriverApplicationStatus(dto: DriverApplicationStatusDto): DriverApplicationStatusDomain {
  return {
    applicationId: dto.applicationId,
    userId: dto.userId,
    status: normalizeStatus(dto.status),
    reviewStatus: dto.reviewStatus,
    stage: dto.stage,
    updatedAt: dto.updatedAt,
    submittedAt: dto.submittedAt ?? null,
    reviewedAt: dto.reviewedAt ?? null,
    reason: dto.reason ?? null,
  };
}

export function dtoToDomainDriverDocumentMetadata(dto: DriverDocumentMetadataDto): DriverDocumentMetadataDomain {
  return { ...dto };
}

export function dtoListToDomainDriverDocumentMetadata(items: DriverDocumentMetadataDto[] | null | undefined): DriverDocumentMetadataDomain[] {
  return (items ?? []).map(dtoToDomainDriverDocumentMetadata);
}

export function dtoToDomainDriverClarification(dto: DriverClarificationDto): DriverClarificationDomain {
  return { ...dto };
}

export function dtoListToDomainDriverClarifications(items: DriverClarificationDto[] | null | undefined): DriverClarificationDomain[] {
  return (items ?? []).map(dtoToDomainDriverClarification);
}

export function domainToSubmitDriverApplicationDto(application: DriverApplicationSubmission, metadata: ApiIdempotencyMetadata): SubmitDriverApplicationRequestDto {
  return {
    ...metadata,
    clientSubmissionId: application.clientSubmissionId,
    userId: application.userId,
    fullName: application.fullName,
    phone: application.phone,
    dob: application.dob,
    nationalId: application.nationalId,
    vehicleType: application.firstVehicle.vehicleType,
    plateNumber: application.firstVehicle.plateNumber,
    licenseNumber: application.firstVehicle.licenseNumber,
    operatingLocation: application.operatingLocation,
    momoDetails: application.momoDetails,
    documentIds: Object.keys(application.documents),
    documents: Object.values(application.documents).map(documentRecordToMetadataDto),
    selfieReference: application.selfieImage,
  };
}

export function domainToUpdateDriverApplicationDto(application: DriverApplicationSubmission, metadata: ApiIdempotencyMetadata): UpdateDriverApplicationRequestDto {
  return {
    ...domainToSubmitDriverApplicationDto(application, metadata),
    applicationId: application.id,
  };
}

function documentRecordToMetadataDto(record: DriverVehicleDocumentRecord): DriverDocumentMetadataDto {
  return {
    documentId: record.key,
    documentType: record.key,
    uploadReferenceKey: `${record.key}:metadata`,
    verificationStatus: record.reviewStatus,
    submittedAt: record.submittedAt,
    reviewedAt: record.reviewStatus === 'pending_review' ? null : record.updatedAt,
    rejectionReason: record.reviewStatus === 'rejected' ? 'redacted' : null,
    clarificationReason: null,
    version: 1,
  };
}

export function domainToDriverDocumentUploadDto(
  input: DriverDocumentMetadataDomain,
  metadata: ApiIdempotencyMetadata,
): UploadDriverDocumentRequestDto {
  return {
    ...metadata,
    applicationId: input.documentId.split(':')[0] || input.documentId,
    documentId: input.documentId,
    documentType: input.documentType,
    uploadReferenceKey: input.uploadReferenceKey,
    version: input.version,
  };
}

export function domainToClarificationResponseDto(
  applicationId: string,
  clarificationId: string,
  message: string,
  metadata: ApiIdempotencyMetadata,
): AdminClarificationResponseRequestDto {
  return {
    ...metadata,
    applicationId,
    clarificationId,
    message,
  };
}

export function dtoToDomainDriver<TDto>(dto: TDto): TDto {
  return dto;
}

export function domainToDtoDriver<TDomain>(domain: TDomain): TDomain {
  return domain;
}

export function errorToRepositoryFailureDriver(error: unknown): BackendError {
  if (error instanceof BackendError) return error;
  if (error instanceof Error) {
    if (error.name === 'UnauthorizedError') return new UnauthorizedError({ repository: 'driver', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'ForbiddenError') return new ForbiddenError({ repository: 'driver', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'ConflictError') return new ConflictError({ repository: 'driver', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'ValidationError') return new ValidationError({ repository: 'driver', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'RateLimitedError') return new RateLimitedError({ repository: 'driver', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'ServerError') return new ServerError({ repository: 'driver', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'TimeoutError') return new TimeoutError({ repository: 'driver', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'OfflineError') return new OfflineError({ repository: 'driver', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'SerializationError') return new SerializationError({ repository: 'driver', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'BackendUnavailableError') return new BackendUnavailableError({ repository: 'driver', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
  }
  return createNotImplementedError('driver', 'errorToRepositoryFailure', 'mapper');
}

export function toDriverRepositoryFailure(error: unknown) {
  return errorToRepositoryFailureDriver(error);
}
