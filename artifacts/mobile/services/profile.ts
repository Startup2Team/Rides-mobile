import { getAppBackendClient } from '@/data/remote/client/appBackendClient';

// Real-backend customer profile: GET/PUT /api/v1/customer/profile.
// The backend has NO customer image-upload endpoint — profile_image_url is a
// plain URL string; the FCM push token is registered here too (fcm_token).

export interface CustomerProfile {
  id: string;
  phoneNumber: string;
  fullName: string | null;
  email: string | null;
  fcmToken: string | null;
  roleState: string;
  profileImageUrl: string | null;
}

interface ProfileDto {
  id: string;
  phone_number: string;
  full_name: string | null;
  email?: string | null;
  fcm_token?: string | null;
  role_state: string;
  profile_image_url?: string | null;
}

interface ApiEnvelope<T> {
  data: T;
}

function toDomain(dto: ProfileDto): CustomerProfile {
  return {
    id: dto.id,
    phoneNumber: dto.phone_number,
    fullName: dto.full_name ?? null,
    email: dto.email ?? null,
    fcmToken: dto.fcm_token ?? null,
    roleState: dto.role_state,
    profileImageUrl: dto.profile_image_url ?? null,
  };
}

export async function fetchProfile(): Promise<CustomerProfile> {
  const client = getAppBackendClient();
  const response = await client.get<ApiEnvelope<ProfileDto>>('/v1/customer/profile');
  return toDomain(response.data.data);
}

export interface ProfileUpdate {
  fullName?: string | null;
  email?: string | null;
  fcmToken?: string | null;
  profileImageUrl?: string | null;
}

// PUT /customer/profile returns 204. Only send the fields the caller provided
// (all backend fields are pointers/optional — omitted keys are left unchanged).
export async function updateProfile(patch: ProfileUpdate): Promise<void> {
  const body: Record<string, unknown> = {};
  if (patch.fullName !== undefined) body.full_name = patch.fullName;
  if (patch.email !== undefined) body.email = patch.email;
  if (patch.fcmToken !== undefined) body.fcm_token = patch.fcmToken;
  if (patch.profileImageUrl !== undefined) body.profile_image_url = patch.profileImageUrl;

  const client = getAppBackendClient();
  await client.put('/v1/customer/profile', { body });
}
