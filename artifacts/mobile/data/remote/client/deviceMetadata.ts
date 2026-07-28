import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Device metadata sent to the backend on auth (register / verify). The backend
 * requires device_id + platform and records them, so this is also the source of
 * device/install analytics for downstream pipelines — send it consistently.
 */
export interface DeviceMetadata {
  device_id: string;
  platform: 'ios' | 'android';
  app_version: string;
}

const DEVICE_ID_KEY = 'rides.device_id';

let cached: DeviceMetadata | null = null;

/**
 * Resolves a stable device_id (persisted once in SecureStore), the platform,
 * and the app version. Cached for the process lifetime.
 */
export async function getDeviceMetadata(): Promise<DeviceMetadata> {
  if (cached) return cached;

  let deviceId: string | null = null;
  try {
    deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  } catch {
    deviceId = null;
  }
  if (!deviceId) {
    deviceId = generateDeviceId();
    try {
      await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
    } catch {
      // Non-fatal: a fresh id next launch is acceptable if secure storage fails.
    }
  }

  cached = {
    device_id: deviceId,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    app_version: Constants.expoConfig?.version ?? '1.0.0',
  };
  return cached;
}

function generateDeviceId(): string {
  const globalCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (globalCrypto?.randomUUID) {
    return globalCrypto.randomUUID();
  }
  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
