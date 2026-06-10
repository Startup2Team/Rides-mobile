import type { MockDriver } from '@/types';

/** True for local picker URIs or non-placeholder remote uploads. */
export function isUploadedProfileImageUri(uri: string | undefined | null): uri is string {
  if (!uri?.trim()) return false;
  const normalized = uri.trim().toLowerCase();
  if (normalized.includes('pravatar.cc')) return false;
  return (
    normalized.startsWith('file://')
    || normalized.startsWith('content://')
    || normalized.startsWith('ph://')
    || normalized.startsWith('assets-library://')
    || normalized.startsWith('http://')
    || normalized.startsWith('https://')
  );
}

/** Uploaded photo on the ride driver only — no generated placeholders. */
export function resolveDriverProfileImage(
  driver: { profileImage?: string } | null | undefined,
): string | undefined {
  if (!driver?.profileImage) return undefined;
  return isUploadedProfileImageUri(driver.profileImage) ? driver.profileImage.trim() : undefined;
}

export function buildDriverWithUploadedPhoto(picked: MockDriver): MockDriver {
  const fromRide = resolveDriverProfileImage(picked);
  if (fromRide) return { ...picked, profileImage: fromRide };

  const { profileImage: _unused, ...withoutPlaceholder } = picked;
  return withoutPlaceholder;
}
