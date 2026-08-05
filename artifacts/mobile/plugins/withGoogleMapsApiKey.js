// Config plugin: inject the Google Maps Android API key into the manifest.
//
// react-native-maps renders Google Maps on Android, and the Maps SDK REFUSES
// to initialise without com.google.android.geo.API_KEY:
//   FabricUIManager: java.lang.IllegalStateException: API key not found.
// That throw happens while mounting the MapView, which kills the app — so the
// first screen with a map (customer home / driver dashboard) crashes on sight.
// Pre-login screens have no map, which is why the app "opened once" and then
// open-and-closed forever after signing in. iOS is unaffected: it uses Apple
// Maps, which needs no key.
//
// The key is read from GOOGLE_MAPS_ANDROID_API_KEY when set; otherwise it falls
// back to the Android API key already in google-services.json (same Firebase /
// GCP project and package name), so no secret has to be duplicated. Requires
// "Maps SDK for Android" to be enabled on that project.
const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const META_NAME = 'com.google.android.geo.API_KEY';

function readKeyFromGoogleServices(projectRoot) {
  try {
    const file = path.join(projectRoot, 'google-services.json');
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const client of json.client ?? []) {
      const key = client.api_key?.[0]?.current_key;
      if (key) return key;
    }
  } catch {
    // No google-services.json (or unreadable) — fall through to no key.
  }
  return null;
}

module.exports = function withGoogleMapsApiKey(config) {
  return withAndroidManifest(config, mod => {
    const key =
      process.env.GOOGLE_MAPS_ANDROID_API_KEY ||
      readKeyFromGoogleServices(mod.modRequest.projectRoot);
    if (!key) {
      throw new Error(
        '[withGoogleMapsApiKey] No Google Maps Android API key. Set GOOGLE_MAPS_ANDROID_API_KEY or provide google-services.json — without it every map screen crashes on Android.',
      );
    }
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
    application['meta-data'] = application['meta-data'] ?? [];
    const existing = application['meta-data'].find(item => item.$?.['android:name'] === META_NAME);
    if (existing) {
      existing.$['android:value'] = key;
    } else {
      application['meta-data'].push({ $: { 'android:name': META_NAME, 'android:value': key } });
    }
    return mod;
  });
};
