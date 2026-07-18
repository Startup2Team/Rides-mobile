import * as Notifications from 'expo-notifications';
import { NativeModules, Platform } from 'react-native';

// Acquires the correct native push token per platform for the backend, which
// sends via the Firebase Admin SDK (`messaging.Send`) and therefore needs a
// real *FCM registration token* — NOT an Expo push token.
//
//   • Android — `getDevicePushTokenAsync()` already returns a native FCM token
//     (google-services.json wires Firebase into the app), so we use it directly.
//
//   • iOS — `getDevicePushTokenAsync()` returns an *APNs* token, which the
//     Firebase Admin SDK cannot target. Firebase must exchange it for an FCM
//     token on-device. We do that via `@react-native-firebase/messaging` when
//     it's present in the build (it bridges FCM→APNs). The dependency is
//     OPTIONAL and loaded through a runtime require so the app still bundles and
//     runs in Expo Go / on web where the native module is absent — in that case
//     we fall back to the APNs token and log a hint. Full iOS delivery needs the
//     owner to add GoogleService-Info.plist + an APNs auth key in the Firebase
//     console and run a native build (see docs/PUSH_NOTIFICATIONS.md).

export interface PushToken {
  token: string;
  platform: string; // 'ios' | 'android' | 'web'
}

// Loads @react-native-firebase/messaging if the native module is installed.
// Returns the messaging() factory, or null when unavailable. The require is
// indirected through a variable so the bundler treats it as optional rather
// than a hard, must-resolve dependency.
function loadFirebaseMessaging(): (() => FirebaseMessaging) | null {
  // In Expo Go / any build without the native Firebase module, requiring it
  // throws "Native module RNFBAppModule not found". Check the native module is
  // actually present first so the optional dependency stays truly silent.
  if (!NativeModules.RNFBAppModule) return null;
  try {
    const moduleName = '@react-native-firebase/messaging';
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = (require as (name: string) => unknown)(moduleName) as
      | { default?: () => FirebaseMessaging }
      | (() => FirebaseMessaging)
      | undefined;
    if (!mod) return null;
    const factory = typeof mod === 'function' ? mod : mod.default;
    return factory ?? null;
  } catch {
    return null;
  }
}

interface FirebaseMessaging {
  registerDeviceForRemoteMessages?: () => Promise<unknown>;
  getToken: () => Promise<string>;
  requestPermission?: () => Promise<number>;
}

// Returns the best push token for this device, or null when none is available
// (no permission, no Play Services, missing native Firebase config, offline).
export async function getPushToken(): Promise<PushToken | null> {
  // iOS: try to obtain a true FCM token via Firebase; fall back to APNs.
  if (Platform.OS === 'ios') {
    const messagingFactory = loadFirebaseMessaging();
    if (messagingFactory) {
      try {
        const messaging = messagingFactory();
        await messaging.registerDeviceForRemoteMessages?.();
        const fcmToken = await messaging.getToken();
        if (fcmToken) return { token: fcmToken, platform: 'ios' };
      } catch {
        // Fall through to the APNs token below.
      }
    }
  }

  try {
    const native = await Notifications.getDevicePushTokenAsync();
    const value = typeof native.data === 'string' ? native.data : String(native.data);
    if (!value) return null;
    return { token: value, platform: Platform.OS };
  } catch {
    return null;
  }
}
