// Config plugin: resolve the Firebase-messaging manifest merger conflict.
//
// @react-native-firebase/messaging 26 ships its own default_notification_*
// meta-data in the library manifest. expo-notifications writes the same keys
// into the app manifest, so the merger fails:
//   Attribute meta-data#...default_notification_channel_id@value ... is also
//   present at [:react-native-firebase_messaging]
//   Suggestion: add 'tools:replace="android:value"'
// The app's values are the ones we want, so mark them as the winner. The
// manifest is generated on every prebuild, hence a plugin rather than an edit.
const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

// meta-data name → the attribute the app manifest owns.
const OVERRIDES = {
  'com.google.firebase.messaging.default_notification_channel_id': 'android:value',
  'com.google.firebase.messaging.default_notification_color': 'android:resource',
  'com.google.firebase.messaging.default_notification_icon': 'android:resource',
};

module.exports = function withFirebaseNotificationManifestFix(config) {
  return withAndroidManifest(config, mod => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
    for (const item of application['meta-data'] ?? []) {
      const name = item.$?.['android:name'];
      const attribute = OVERRIDES[name];
      if (!attribute) continue;
      item.$['tools:replace'] = attribute;
    }
    // `tools:` must be declared on <manifest> for the attribute to be legal.
    mod.modResults.manifest.$ = {
      ...mod.modResults.manifest.$,
      'xmlns:tools': 'http://schemas.android.com/tools',
    };
    return mod;
  });
};
