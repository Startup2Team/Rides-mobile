import { getAppBackendClient } from '@/data/remote/client/appBackendClient';
import { requestUploadTarget, uploadFileBytes } from '@/services/driverDocuments';

// Real-backend customer profile: GET/PUT /api/v1/customer/profile.
// Profile photos ARE stored in R2 (Cloudflare) via the shared /uploads presign
// flow (purpose: profile_image → avatars/ prefix); profile_image_url then holds
// the public CDN URL. The FCM push token is registered here too (fcm_token).

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

function toDomain(dto: ProfileDto): CustomerProfile {
  return {
    id: dto.id,
    phoneNumber: dto.phone_number,
    fullName: dto.full_name ?? null,
    email: dto.email ?? null,
    fcmToken: dto.fcm_token ?? null,
    roleState: dto.role_state,
    profileImageUrl: dto.profile_image_url ?? null,
    emergencyContactName: dto.emergency_contact_name ?? null,
    emergencyContactPhone: dto.emergency_contact_phone ?? null,
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

// Best-effort content type from a local image URI (expo-image-picker gives
// file://…jpg|jpeg|png|heic). Defaults to JPEG, which the picker produces for
// camera + edited images.
function contentTypeForUri(uri: string): string {
  const path = uri.split('?')[0].toLowerCase();
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.heic') || path.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

// Upload a locally-picked avatar to R2 (avatars/ prefix) via the shared presign
// flow, then persist its public URL on the customer profile. Returns the CDN
// URL so callers can render/cache it. Throws on failure so the UI can revert an
// optimistic preview instead of silently keeping a device-only image.
export async function uploadProfilePhoto(localUri: string): Promise<string> {
  const contentType = contentTypeForUri(localUri);
  const { uploadUrl, fileUrl } = await requestUploadTarget(contentType, 'profile_image');
  await uploadFileBytes(uploadUrl, localUri, contentType);
  await updateProfile({ profileImageUrl: fileUrl });
  return fileUrl;
}
