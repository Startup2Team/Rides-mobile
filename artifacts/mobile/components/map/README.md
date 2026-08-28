# Map abstraction

Every screen renders maps through `AppMap` / `AppMarker` / `AppPolyline` /
`AppCircle` (this directory) — never `@rnmapbox/maps` or `react-native-maps`
directly. That's the whole point: the native map SDK is swappable without
touching screens.

## Why Mapbox is the default now

Android was rendering a blank gray map. Root cause: `plugins/withGoogleMapsApiKey.js`
falls back to the Firebase project's auto-generated API key when
`GOOGLE_MAPS_ANDROID_API_KEY` isn't set — that key exists but isn't
authorized for "Maps SDK for Android" in Google Cloud Console, so Google Maps
silently renders an empty canvas instead of crashing. `EXPO_PUBLIC_MAPBOX_TOKEN`
already exists in `.env` and is already live (used for Directions/geocoding in
`services/mapbox.ts`), so switching map *rendering* onto the same account
sidesteps the unauthorized-key problem entirely.

## How the switch works

1. **Runtime selection**: `constants/mapProvider.ts` reads
   `EXPO_PUBLIC_MAP_PROVIDER` (inlined by Metro at build time, same mechanism
   as `EXPO_PUBLIC_MAPBOX_TOKEN`). `AppMap.tsx` renders `AppMapMapbox` or
   `AppMapGoogle` based on that one constant — no screen ever branches on it.
2. **Both native SDKs ship in the binary today** — Expo autolinking links
   every installed native module regardless of which one is selected at
   runtime, so `pnpm add @rnmapbox/maps` + keeping `react-native-maps`
   installed means both are compiled in. This was a deliberate tradeoff: it
   makes "switch back to Google" a *pure config flip + rebuild*
   (`EXPO_PUBLIC_MAP_PROVIDER=google` in `.env`, then `eas build`), not a
   dependency reinstall. `react-native-maps` (Apple/Google Maps, no bundled
   SDK) is not a heavy addition; if binary size ever matters more than
   switch-convenience, `pnpm remove` the unused one and delete its
   `AppMap.*.tsx` + app.json plugin entry.
3. **app.json plugins**: both the `@rnmapbox/maps` config plugin (needs
   `RNMapboxMapsVersion`/downloads token — see below) and the existing
   `./plugins/withGoogleMapsApiKey` plugin (Android Google Maps API key) stay
   registered. Neither plugin does anything at runtime; they only affect the
   native build.
4. **What Pacifique needs to set**:
   - `EXPO_PUBLIC_MAPBOX_TOKEN` — already set in `.env` (public `pk.*` token,
     reused from `services/mapbox.ts`). No new secret needed.
   - Mapbox **downloads token**: as of `@rnmapbox/maps` 10.3.x / Mapbox Maps
     SDK v11, **this is no longer required** — Mapbox lifted the auth
     requirement on their Maven/CocoaPods release repos (confirmed in the
     package's own `android/install.md`: *"mapbox lifted auth requirement
     from downloads so MAPBOX_DOWNLOADS_TOKEN is no longer needed"*). Older
     guides mention `RNMapboxMapsDownloadToken` / `SDK_REGISTRY_TOKEN` — those
     are now deprecated no-ops. Nothing to configure here.
   - To flip back to Google later: set `EXPO_PUBLIC_MAP_PROVIDER=google`,
     confirm `GOOGLE_MAPS_ANDROID_API_KEY` is set to a key authorized for
     "Maps SDK for Android" (this was the original bug — the Firebase
     fallback key is NOT authorized), and rebuild.

## Provider-specific gaps (visual, not functional)

- **`mapType: 'standard'` dark theme**: the app's custom navy Google JSON
  style (`components/map/googleDarkMapStyle.ts`) has no Mapbox equivalent —
  Mapbox uses vector-tile style specs, not Google's `stylers` format. The
  Mapbox implementation uses the built-in `StyleURL.Dark` as a stand-in.
  Matching the exact navy palette needs a custom style authored in Mapbox
  Studio (design task — flag to senior-uiux, not an engineering blocker).
- **Marker z-order**: Google's `Marker` respects an explicit `zIndex` prop.
  Mapbox's `MarkerView` has no z-index prop; stacking follows JSX render
  order instead. Screens already render markers in a sensible order (pins,
  then vehicle, then "you are here" on top), so this should look the same in
  practice — worth an eyeball check on-device.
- **`onPanDrag`** (map-picker overlay) maps to Mapbox's `onRegionWillChange`
  filtered by `isUserInteraction`. It fires for the same user gesture, but
  the Mapbox event model doesn't distinguish "drag" from other user-driven
  region changes (e.g. a pinch) as precisely as react-native-maps does —
  functionally fine for the picker's "raise the pin" indicator, unverified
  on-device.

## What's NOT verified

Everything above is verified by `tsc`, unit tests, and reading the installed
package's type declarations + install docs — **not** by an actual on-device
render. Get an `eas build` (Android especially, since that's the bug this
migration fixes) before shipping.
