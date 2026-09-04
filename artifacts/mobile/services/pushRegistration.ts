import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getPushToken } from './fcmToken';
import { registerDeviceToken, unregisterDeviceToken } from './notifications';

// FCM push registration. The backend (Firebase Admin SDK) sends directly to a
// device's *native* FCM token, so we register the native token (a real FCM
// registration token on Android, and — via @react-native-firebase/messaging —
// on iOS too; see services/fcmToken.ts) with POST /users/me/device-token, the
// multi-device store the ride / negotiation / driver push paths read. All calls
// are best-effort: permission denied, no Google Play Services, a missing
// google-services.json (dev/emulator) or an offline backend simply results in a
// no-op, never a thrown error.

let configured = false;
let lastRegistered: string | null = null;

// Foreground presentation + Android channel. Safe to call more than once.
export function configurePushNotifications(): void {
  if (configured) return;
  configured = true;

  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    if (Platform.OS === 'android') {
      void Notifications.setNotificationChannelAsync('default', {
        name: 'Rides',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0A84FF',
      }).catch(() => {});
    }
  } catch {
    // Expo Go mode (SDK 53+ remote notifications unavailable in Expo Go)
  }
}

// Ask for permission (if needed), obtain the native FCM token and register it
// with the backend. Returns the token on success, or null when unavailable.
export async function registerPushToken(): Promise<string | null> {
  try {
    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted || existing.status === 'granted';
    if (!granted) {
      const requested = await Notifications.requestPermissionsAsync();
      granted = requested.granted || requested.status === 'granted';
    }
    if (!granted) return null;

    const push = await getPushToken();
    if (!push) return null;

    // Avoid a redundant POST if we already registered this exact token.
    if (push.token === lastRegistered) return push.token;
    await registerDeviceToken(push.token, push.platform);
    lastRegistered = push.token;
    return push.token;
  } catch {
    // No permission / no Play Services / no google-services.json / offline.
    return null;
  }
}

// Unregister this device's token with the backend (best-effort) so pushes stop
// reaching it, then clear the cache so a later login re-registers.
export function resetPushRegistration(): void {
  const token = lastRegistered;
  lastRegistered = null;
  if (!token) return;
  // Fire-and-forget: offline / already-gone tokens are pruned on first dead send.
  void unregisterDeviceToken(token).catch(() => {});
}
