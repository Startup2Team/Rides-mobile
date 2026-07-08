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
import type { ApiIdempotencyMetadata } from '../contracts/api/shared';
import type {
  AddVehicleRequestDto,
  GetVehicleResponseDto,
  ListVehiclesResponseDto,
  SetPrimaryVehicleRequestDto,
  UpdateVehicleRequestDto,
  VehicleDto,
  VehiclePhotoDto,
} from '../contracts/api';
import type { DriverVehicleProfile } from '@/types';

function normalizePhoto(photo: DriverVehicleProfile['photos'] | VehiclePhotoDto | null | undefined): VehiclePhotoDto | null {
  if (!photo) return null;
  return {
    outside: photo.outside ?? null,
    inside: photo.inside ?? null,
  };
}

function dtoToVehicle(dto: VehicleDto): DriverVehicleProfile {
  return {
    id: dto.id,
    vehicleType: dto.vehicleType,
    status: dto.status,
    plateNumber: dto.plateNumber,
    licenseNumber: dto.licenseNumber,
    model: dto.model ?? undefined,
    brand: dto.brand ?? undefined,
    manufactureYear: dto.manufactureYear ?? undefined,
    passengerSeats: dto.passengerSeats ?? undefined,
    loadCapacityKg: dto.loadCapacityKg ?? undefined,
    licenseExpiryDate: dto.licenseExpiryDate ?? undefined,
    insuranceExpiryDate: dto.insuranceExpiryDate ?? undefined,
    authorizationExpiryDate: dto.authorizationExpiryDate ?? undefined,
    photos: dto.photos ? normalizePhoto(dto.photos) ?? undefined : undefined,
    documents: dto.documents ?? undefined,
    pendingDocumentUpdate: dto.pendingDocumentUpdate ?? null,
    submittedAt: dto.submittedAt ?? undefined,
    approvedAt: dto.approvedAt ?? undefined,
    rejectedAt: dto.rejectedAt ?? undefined,
    rejectionReason: dto.rejectionReason ?? undefined,
    reviewHistory: dto.reviewHistory ?? undefined,
  };
}

function vehicleToDto(vehicle: DriverVehicleProfile): VehicleDto {
  return {
    id: vehicle.id,
    vehicleType: vehicle.vehicleType,
    status: vehicle.status,
    plateNumber: vehicle.plateNumber,
    licenseNumber: vehicle.licenseNumber,
    model: vehicle.model ?? null,
    brand: vehicle.brand ?? null,
    manufactureYear: vehicle.manufactureYear ?? null,
    passengerSeats: vehicle.passengerSeats ?? null,
    loadCapacityKg: vehicle.loadCapacityKg ?? null,
    licenseExpiryDate: vehicle.licenseExpiryDate ?? null,
    insuranceExpiryDate: vehicle.insuranceExpiryDate ?? null,
    authorizationExpiryDate: vehicle.authorizationExpiryDate ?? null,
    photos: normalizePhoto(vehicle.photos),
    documents: vehicle.documents ?? null,
    pendingDocumentUpdate: vehicle.pendingDocumentUpdate ?? null,
    submittedAt: vehicle.submittedAt ?? null,
    approvedAt: vehicle.approvedAt ?? null,
    rejectedAt: vehicle.rejectedAt ?? null,
    rejectionReason: vehicle.rejectionReason ?? null,
    reviewHistory: vehicle.reviewHistory ?? null,
  };
}

export function dtoToDomainVehicle(dto: VehicleDto): DriverVehicleProfile {
  return dtoToVehicle(dto);
}

export function dtoListToDomainVehicles(dtos: VehicleDto[]): DriverVehicleProfile[] {
  return dtos.map(dtoToVehicle);
}

export function dtoToDomainVehicleList(response: ListVehiclesResponseDto['data']): DriverVehicleProfile[] {
  return dtoListToDomainVehicles(response.vehicles ?? []);
}

export function dtoToDomainVehicleDetail(response: GetVehicleResponseDto['data']): DriverVehicleProfile | null {
  return response ? dtoToVehicle(response) : null;
}

export function domainToAddVehicleDto(vehicle: DriverVehicleProfile, metadata: ApiIdempotencyMetadata): AddVehicleRequestDto {
  return {
    idempotencyKey: metadata.idempotencyKey,
    correlationId: metadata.correlationId,
    actorId: metadata.actorId,
    actorRole: metadata.actorRole,
    clientTimestamp: metadata.clientTimestamp,
    vehicleType: vehicle.vehicleType,
    plateNumber: vehicle.plateNumber,
    licenseNumber: vehicle.licenseNumber,
    model: vehicle.model ?? null,
    brand: vehicle.brand ?? null,
    manufactureYear: vehicle.manufactureYear ?? null,
    passengerSeats: vehicle.passengerSeats ?? null,
    loadCapacityKg: vehicle.loadCapacityKg ?? null,
    licenseExpiryDate: vehicle.licenseExpiryDate ?? null,
    insuranceExpiryDate: vehicle.insuranceExpiryDate ?? null,
    authorizationExpiryDate: vehicle.authorizationExpiryDate ?? null,
    photos: normalizePhoto(vehicle.photos),
    documents: vehicle.documents ?? null,
  };
}

export function domainToUpdateVehicleDto(vehicle: DriverVehicleProfile, metadata: ApiIdempotencyMetadata): UpdateVehicleRequestDto {
  return {
    idempotencyKey: metadata.idempotencyKey,
    correlationId: metadata.correlationId,
    actorId: metadata.actorId,
    actorRole: metadata.actorRole,
    clientTimestamp: metadata.clientTimestamp,
    vehicleId: vehicle.id,
    vehicleType: vehicle.vehicleType,
    plateNumber: vehicle.plateNumber,
    licenseNumber: vehicle.licenseNumber,
    model: vehicle.model ?? null,
    brand: vehicle.brand ?? null,
    manufactureYear: vehicle.manufactureYear ?? null,
    passengerSeats: vehicle.passengerSeats ?? null,
    loadCapacityKg: vehicle.loadCapacityKg ?? null,
    licenseExpiryDate: vehicle.licenseExpiryDate ?? null,
    insuranceExpiryDate: vehicle.insuranceExpiryDate ?? null,
    authorizationExpiryDate: vehicle.authorizationExpiryDate ?? null,
    photos: normalizePhoto(vehicle.photos),
    documents: vehicle.documents ?? null,
    pendingDocumentUpdate: vehicle.pendingDocumentUpdate ?? null,
    status: vehicle.status,
  };
}

export function domainToSetPrimaryVehicleDto(vehicleId: string | null, metadata: ApiIdempotencyMetadata): SetPrimaryVehicleRequestDto {
  return {
    idempotencyKey: metadata.idempotencyKey,
    correlationId: metadata.correlationId,
    actorId: metadata.actorId,
    actorRole: metadata.actorRole,
    clientTimestamp: metadata.clientTimestamp,
    vehicleId,
  };
}

export function domainToDtoVehicle<TDomain>(domain: TDomain): TDomain {
  return domain;
}

export function errorToRepositoryFailureVehicle(error: unknown): BackendError {
  if (error instanceof BackendError) return error;
  if (error instanceof Error) {
    if (error.name === 'UnauthorizedError') return new UnauthorizedError({ repository: 'vehicle', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'ForbiddenError') return new ForbiddenError({ repository: 'vehicle', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'ConflictError') return new ConflictError({ repository: 'vehicle', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'ValidationError') return new ValidationError({ repository: 'vehicle', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'RateLimitedError') return new RateLimitedError({ repository: 'vehicle', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'ServerError') return new ServerError({ repository: 'vehicle', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'TimeoutError') return new TimeoutError({ repository: 'vehicle', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'OfflineError') return new OfflineError({ repository: 'vehicle', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'SerializationError') return new SerializationError({ repository: 'vehicle', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'BackendUnavailableError') return new BackendUnavailableError({ repository: 'vehicle', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
  }
  return createNotImplementedError('vehicle', 'errorToRepositoryFailure', 'mapper');
}

export function toVehicleRepositoryFailure(error: unknown) {
  return errorToRepositoryFailureVehicle(error);
}
