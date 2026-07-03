import type { ActiveRideReadModel, RideHistoryReadModel, RideStatus as ReadModelRideStatus } from '@/domains/ride/readModels';
import type { Ride, RideStatus, VehicleType } from '@/types';
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

type RideReadDto = (RideHistoryReadModel | ActiveRideReadModel) & Partial<{
  vehicleType: VehicleType;
  vehicleId: string | null;
  requestedVehicleType: VehicleType | null;
  matchedVehicleType: VehicleType | null;
  matchedVehicleId: string | null;
  distance: number | null;
  distanceKm: number | null;
  duration: number | null;
  durationMinutes: number | null;
  suggestedFare: number | null;
  agreedFare: number | null;
}>;

function mapRideStatus(status: ReadModelRideStatus): RideStatus {
  switch (status) {
    case 'draft':
      return 'idle';
    case 'requested':
    case 'matching':
      return 'searching';
    case 'offered':
      return 'negotiating';
    case 'accepted':
      return 'confirmed';
    case 'driver_en_route':
      return 'arriving';
    case 'driver_arrived':
      return 'arrived';
    case 'started':
      return 'in_progress';
    case 'completed':
    case 'fare_finalized':
    case 'payment_authorized':
    case 'payment_completed':
    case 'rating_submitted':
      return 'completed';
    case 'cancelled':
    case 'timeout':
      return 'cancelled';
    default:
      return 'idle';
  }
}

function isActiveRideDto(dto: RideReadDto): dto is ActiveRideReadModel & RideReadDto {
  return 'updatedAt' in dto;
}

function numberOrDefault(value: number | null | undefined, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function dtoToDomainActiveRide(dto: ActiveRideReadModel | null | undefined): ActiveRideReadModel | null {
  if (!dto) return null;
  return {
    ...dto,
    projection: {
      appliedEventIds: [...(dto.projection?.appliedEventIds ?? [])],
    },
  };
}

export function dtoToDomainRide(dto: RideHistoryReadModel | ActiveRideReadModel | null | undefined): Ride | null {
  if (!dto) return null;
  const readDto = dto as RideReadDto;
  const fareAmount = readDto.fare?.amount ?? null;
  const requestedAt = isActiveRideDto(readDto) ? readDto.updatedAt : readDto.requestedAt;
  const completedAt = isActiveRideDto(readDto) ? null : readDto.completedAt ?? null;
  const vehicleType = readDto.vehicleType ?? readDto.requestedVehicleType ?? readDto.matchedVehicleType ?? 'moto';

  return {
    id: readDto.rideId,
    customerId: readDto.customer.userId,
    customerName: readDto.customer.displayName ?? undefined,
    driverId: readDto.driver?.userId,
    driverName: readDto.driver?.displayName ?? undefined,
    vehicleType,
    vehicleId: readDto.vehicleId ?? readDto.matchedVehicleId ?? undefined,
    requestedVehicleType: readDto.requestedVehicleType ?? vehicleType,
    matchedVehicleType: readDto.matchedVehicleType ?? undefined,
    matchedVehicleId: readDto.matchedVehicleId ?? readDto.vehicleId ?? undefined,
    pickup: {
      address: readDto.pickup.address,
      latitude: readDto.pickup.latitude,
      longitude: readDto.pickup.longitude,
    },
    destination: {
      address: readDto.destination.address,
      latitude: readDto.destination.latitude,
      longitude: readDto.destination.longitude,
    },
    status: mapRideStatus(readDto.status),
    distance: numberOrDefault(readDto.distance, numberOrDefault(readDto.distanceKm, 0)),
    duration: numberOrDefault(readDto.duration, numberOrDefault(readDto.durationMinutes, 0)),
    suggestedFare: numberOrDefault(readDto.suggestedFare, fareAmount ?? 0),
    agreedFare: readDto.agreedFare ?? fareAmount ?? undefined,
    negotiation: [],
    createdAt: requestedAt,
    completedAt: completedAt ?? undefined,
  };
}

export function dtoListToDomainRideHistory(items: RideHistoryReadModel[] | null | undefined): Ride[] {
  return (items ?? []).map(dtoToDomainRide).filter((ride): ride is Ride => Boolean(ride));
}

export function domainToDtoRide<TDomain>(domain: TDomain): TDomain {
  return domain;
}

export function errorToRepositoryFailureRide(error: unknown): BackendError {
  if (error instanceof BackendError) return error;
  if (error instanceof Error) {
    if (error.name === 'UnauthorizedError') return new UnauthorizedError({ repository: 'ride', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'ForbiddenError') return new ForbiddenError({ repository: 'ride', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'ConflictError') return new ConflictError({ repository: 'ride', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'ValidationError') return new ValidationError({ repository: 'ride', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'RateLimitedError') return new RateLimitedError({ repository: 'ride', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'ServerError') return new ServerError({ repository: 'ride', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'TimeoutError') return new TimeoutError({ repository: 'ride', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'OfflineError') return new OfflineError({ repository: 'ride', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'SerializationError') return new SerializationError({ repository: 'ride', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
    if (error.name === 'BackendUnavailableError') return new BackendUnavailableError({ repository: 'ride', method: 'errorToRepositoryFailure', transport: 'mapper', cause: error });
  }
  return createNotImplementedError('ride', 'errorToRepositoryFailure', 'mapper');
}

export function toRideRepositoryFailure(error: unknown) {
  return errorToRepositoryFailureRide(error);
}
