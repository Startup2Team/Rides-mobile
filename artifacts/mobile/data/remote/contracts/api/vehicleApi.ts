import type { ApiEnvelope, ApiErrorDto, ApiIdempotencyMetadata } from './shared';

export interface VehicleDto {
  id: string;
  vehicleType: string;
  plateNumber: string;
  status: 'pending' | 'approved' | 'rejected' | 'inactive';
  isPrimary?: boolean;
}

export interface ListVehiclesResponseDto extends ApiEnvelope<{ vehicles: VehicleDto[] }> {}

export interface AddVehicleRequestDto extends ApiIdempotencyMetadata {
  vehicleType: string;
  plateNumber: string;
  licenseNumber: string;
}

export interface AddVehicleResponseDto extends ApiEnvelope<VehicleDto> {}

export interface UpdateVehicleRequestDto extends ApiIdempotencyMetadata {
  vehicleId: string;
  vehicleType?: string | null;
  plateNumber?: string | null;
  licenseNumber?: string | null;
  isPrimary?: boolean | null;
}

export interface UpdateVehicleResponseDto extends ApiEnvelope<VehicleDto> {}

export interface DeleteVehicleRequestDto extends ApiIdempotencyMetadata {
  vehicleId: string;
}

export interface DeleteVehicleResponseDto extends ApiEnvelope<{ deleted: true }> {}

export interface SetPrimaryVehicleRequestDto extends ApiIdempotencyMetadata {
  vehicleId: string | null;
}

export interface SetPrimaryVehicleResponseDto extends ApiEnvelope<{ primaryVehicleId: string | null }> {}

export interface VehicleErrorDto extends ApiErrorDto {}

export interface VehicleApiContract {
  listVehicles: undefined;
  addVehicle: AddVehicleRequestDto;
  updateVehicle: UpdateVehicleRequestDto;
  deleteVehicle: DeleteVehicleRequestDto;
  setPrimaryVehicle: SetPrimaryVehicleRequestDto;
}
