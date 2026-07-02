import type { ApiEnvelope, ApiErrorDto, ApiIdempotencyMetadata } from './shared';
import type {
  DriverVehicleDocumentRecord,
  DriverVehicleDocumentSet,
  DriverVehicleDocumentUpdate,
  DriverVehicleReviewEvent,
  DriverVehicleStatus,
  VehicleType,
} from '@/types';

export interface VehiclePhotoDto {
  outside?: string | null;
  inside?: string | null;
}

export interface VehicleDocumentRecordDto extends DriverVehicleDocumentRecord {}

export interface VehicleDocumentSetDto extends DriverVehicleDocumentSet {}

export interface VehicleDocumentUpdateDto extends DriverVehicleDocumentUpdate {}

export interface VehicleReviewEventDto extends DriverVehicleReviewEvent {}

export interface VehicleDto {
  id: string;
  vehicleType: VehicleType;
  status: DriverVehicleStatus;
  plateNumber: string;
  licenseNumber: string;
  model?: string | null;
  brand?: string | null;
  manufactureYear?: number | null;
  passengerSeats?: number | null;
  loadCapacityKg?: number | null;
  licenseExpiryDate?: string | null;
  insuranceExpiryDate?: string | null;
  authorizationExpiryDate?: string | null;
  photos?: VehiclePhotoDto | null;
  documents?: VehicleDocumentSetDto | null;
  pendingDocumentUpdate?: VehicleDocumentUpdateDto | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  reviewHistory?: VehicleReviewEventDto[] | null;
  isPrimary?: boolean;
}

export interface ListVehiclesResponseDto extends ApiEnvelope<{ vehicles: VehicleDto[] }> {}

export interface GetVehicleRequestDto {
  vehicleId: string;
}

export interface GetVehicleResponseDto extends ApiEnvelope<VehicleDto | null> {}

export interface AddVehicleRequestDto extends ApiIdempotencyMetadata {
  vehicleType: VehicleType;
  plateNumber: string;
  licenseNumber: string;
  model?: string | null;
  brand?: string | null;
  manufactureYear?: number | null;
  passengerSeats?: number | null;
  loadCapacityKg?: number | null;
  licenseExpiryDate?: string | null;
  insuranceExpiryDate?: string | null;
  authorizationExpiryDate?: string | null;
  photos?: VehiclePhotoDto | null;
  documents?: VehicleDocumentSetDto | null;
}

export interface AddVehicleResponseDto extends ApiEnvelope<VehicleDto> {}

export interface UpdateVehicleRequestDto extends ApiIdempotencyMetadata {
  vehicleId: string;
  vehicleType?: VehicleType | null;
  plateNumber?: string | null;
  licenseNumber?: string | null;
  model?: string | null;
  brand?: string | null;
  manufactureYear?: number | null;
  passengerSeats?: number | null;
  loadCapacityKg?: number | null;
  licenseExpiryDate?: string | null;
  insuranceExpiryDate?: string | null;
  authorizationExpiryDate?: string | null;
  photos?: VehiclePhotoDto | null;
  documents?: VehicleDocumentSetDto | null;
  pendingDocumentUpdate?: VehicleDocumentUpdateDto | null;
  status?: DriverVehicleStatus | null;
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
  getVehicle: GetVehicleRequestDto;
  addVehicle: AddVehicleRequestDto;
  updateVehicle: UpdateVehicleRequestDto;
  deleteVehicle: DeleteVehicleRequestDto;
  setPrimaryVehicle: SetPrimaryVehicleRequestDto;
  setActiveVehicle: SetPrimaryVehicleRequestDto;
}

export const VehicleDto = {} as VehicleDto;
export const VehiclePhotoDto = {} as VehiclePhotoDto;
export const VehicleDocumentRecordDto = {} as VehicleDocumentRecordDto;
export const VehicleDocumentSetDto = {} as VehicleDocumentSetDto;
export const VehicleDocumentUpdateDto = {} as VehicleDocumentUpdateDto;
export const VehicleReviewEventDto = {} as VehicleReviewEventDto;
export const ListVehiclesResponseDto = {} as ListVehiclesResponseDto;
export const GetVehicleRequestDto = {} as GetVehicleRequestDto;
export const GetVehicleResponseDto = {} as GetVehicleResponseDto;
export const AddVehicleRequestDto = {} as AddVehicleRequestDto;
export const AddVehicleResponseDto = {} as AddVehicleResponseDto;
export const UpdateVehicleRequestDto = {} as UpdateVehicleRequestDto;
export const UpdateVehicleResponseDto = {} as UpdateVehicleResponseDto;
export const DeleteVehicleRequestDto = {} as DeleteVehicleRequestDto;
export const DeleteVehicleResponseDto = {} as DeleteVehicleResponseDto;
export const SetPrimaryVehicleRequestDto = {} as SetPrimaryVehicleRequestDto;
export const SetPrimaryVehicleResponseDto = {} as SetPrimaryVehicleResponseDto;
export const VehicleErrorDto = {} as VehicleErrorDto;
export const VehicleApiContract = {} as VehicleApiContract;
