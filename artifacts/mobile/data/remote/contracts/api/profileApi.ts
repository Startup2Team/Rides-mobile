import type { ApiEnvelope, ApiErrorDto, ApiIdempotencyMetadata, ApiPaginationRequest, ApiPaginationResponse } from './shared';

export interface ProfileDto {
  id: string;
  displayName: string;
  phoneNumber: string;
  photoUrl?: string | null;
}

export interface GetProfileResponseDto extends ApiEnvelope<ProfileDto> {}

export interface UpdateProfileRequestDto extends ApiIdempotencyMetadata {
  displayName?: string | null;
  phoneNumber?: string | null;
  photoUrl?: string | null;
}

export interface UpdateProfileResponseDto extends ApiEnvelope<ProfileDto> {}

export interface UploadProfilePhotoRequestDto extends ApiIdempotencyMetadata {
  fileName: string;
  mimeType: string;
  fileSize: number;
}

export interface UploadProfilePhotoResponseDto extends ApiEnvelope<{ photoUrl: string }> {}

export interface ChangePhoneRequestDto extends ApiIdempotencyMetadata {
  phoneNumber: string;
  otp: string;
}

export interface ChangePhoneResponseDto extends ApiEnvelope<ProfileDto> {}

export interface ProfileErrorDto extends ApiErrorDto {}

export interface ProfileApiContract {
  getProfile: undefined;
  updateProfile: UpdateProfileRequestDto;
  uploadProfilePhoto: UploadProfilePhotoRequestDto;
  changePhone: ChangePhoneRequestDto;
}
