import { getAppBackendClient } from '@/data/remote/client/appBackendClient';
import { requestUploadTarget, uploadFileBytes } from './driverDocuments';

// Real-backend customer profile: GET/PUT /api/v1/customer/profile.
// profile_image_url is a plain URL string on `users` — the bytes go to object
// storage through the shared /uploads presign flow (purpose: 'profile_image',
// which the API keys under `avatars/`). The FCM push token lives here too.

export interface CustomerProfile {
  id: string;
  phoneNumber: string;
  fullName: string | null;
  email: string | null;
  fcmToken: string | null;
  roleState: string;
  profileImageUrl: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
}

interface ProfileDto {
  id: string;
  phone_number: string;
  full_name: string | null;
  email?: string | null;
  fcm_token?: string | null;
  role_state: string;
  profile_image_url?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
}

interface ApiEnvelope<T> {
  data: T;
}

// The backend clears a field by storing '' (see updateProfile). Treat that as
// "not set" so callers only ever deal with a usable value or null.
function orNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toDomain(dto: ProfileDto): CustomerProfile {
  return {
    id: dto.id,
    phoneNumber: dto.phone_number,
    fullName: dto.full_name ?? null,
    email: dto.email ?? null,
    fcmToken: dto.fcm_token ?? null,
    roleState: dto.role_state,
    profileImageUrl: orNull(dto.profile_image_url),
    emergencyContactName: orNull(dto.emergency_contact_name),
    emergencyContactPhone: orNull(dto.emergency_contact_phone),
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
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
}

// PUT /customer/profile returns 204. Only send the fields the caller provided
// (all backend fields are pointers/optional — omitted keys are left unchanged).
//
// NOTE on clearing: the UPDATE COALESCEs every column, so a JSON null also means
// "leave unchanged". To actually erase a value send an empty string — that is a
// non-null argument, so COALESCE takes it, and fetchProfile maps '' back to null.
export async function updateProfile(patch: ProfileUpdate): Promise<void> {
  const body: Record<string, unknown> = {};
  if (patch.fullName !== undefined) body.full_name = patch.fullName;
  if (patch.email !== undefined) body.email = patch.email;
  if (patch.fcmToken !== undefined) body.fcm_token = patch.fcmToken;
  if (patch.profileImageUrl !== undefined) body.profile_image_url = patch.profileImageUrl;
  if (patch.emergencyContactName !== undefined) body.emergency_contact_name = patch.emergencyContactName;
  if (patch.emergencyContactPhone !== undefined) body.emergency_contact_phone = patch.emergencyContactPhone;

  const client = getAppBackendClient();
  await client.put('/v1/customer/profile', { body });
}

/**
 * Store an avatar so it follows the account, not the handset.
 *
 * Picking a photo only ever produced a local `file://` URI kept in secure
 * storage, so a reinstall or a second device showed no photo at all. Two steps:
 *   1. presign (purpose 'profile_image') → PUT the bytes to object storage
 *   2. PUT /customer/profile { profile_image_url } so GET returns it everywhere
 *
 * Returns the stored URL, which is what the app should persist locally from now
 * on — it renders on any device, unlike the picker URI it replaces.
 */
export async function uploadProfilePhoto(
  localUri: string,
  contentType = 'image/jpeg',
): Promise<string> {
  const { uploadUrl, fileUrl } = await requestUploadTarget(contentType, 'profile_image');
  await uploadFileBytes(uploadUrl, localUri, contentType);
  await updateProfile({ profileImageUrl: fileUrl });
  return fileUrl;
}

/** Erase the account-level avatar. See the clearing note on updateProfile. */
export async function clearProfilePhoto(): Promise<void> {
  await updateProfile({ profileImageUrl: '' });
}
