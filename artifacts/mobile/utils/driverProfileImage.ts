import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/constants/storage';
import type { DriverProfile, MockDriver } from '@/types';

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

/** Driver selfie saved during onboarding (demo until API returns per-driver photos). */
export async function loadRegisteredDriverPhotoUri(): Promise<string | undefined> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.driverProfile);
    if (!raw) return undefined;
    const profile = JSON.parse(raw) as Pick<DriverProfile, 'profileImage'>;
    return resolveDriverProfileImage(profile);
  } catch {
    return undefined;
  }
}

export async function buildDriverWithUploadedPhoto(picked: MockDriver): Promise<MockDriver> {
  const fromRide = resolveDriverProfileImage(picked);
  if (fromRide) return { ...picked, profileImage: fromRide };

  const registered = await loadRegisteredDriverPhotoUri();
  if (registered) return { ...picked, profileImage: registered };

  const { profileImage: _unused, ...withoutPlaceholder } = picked;
  return withoutPlaceholder;
}
