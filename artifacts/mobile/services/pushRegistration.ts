import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { updateProfile } from './profile';

// FCM push registration. The backend (Firebase Admin SDK) sends directly to a
// device's *native* FCM token, so we register `getDevicePushToken()` (the raw
// FCM token on Android / APNs token on iOS) — NOT an Expo push token — via
// PUT /customer/profile, which writes users.fcm_token (the row the ride/
// negotiation push path reads). All calls are best-effort: permission denied,
// no Google Play Services, a missing google-services.json (dev/emulator) or an
// offline backend simply results in a no-op, never a thrown error.

let configured = false;
let lastRegistered: string | null = null;

// Foreground presentation + Android channel. Safe to call more than once.
export function configurePushNotifications(): void {
  if (configured) return;
  configured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync('default', {
      name: 'Rides',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
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

    const token = await Notifications.getDevicePushTokenAsync();
    const value = typeof token.data === 'string' ? token.data : String(token.data);
    if (!value) return null;

    // Avoid a redundant PUT if we already registered this exact token.
    if (value === lastRegistered) return value;
    await updateProfile({ fcmToken: value });
    lastRegistered = value;
    return value;
  } catch {
    // No permission / no Play Services / no google-services.json / offline.
    return null;
  }
}

// Clear the cached token so the next registerPushToken() re-sends (e.g. after
// logout → login as a different user).
export function resetPushRegistration(): void {
  lastRegistered = null;
}
