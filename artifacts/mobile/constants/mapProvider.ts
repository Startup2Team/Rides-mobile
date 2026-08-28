/**
 * Selects which native map SDK the app renders with.
 *
 * `EXPO_PUBLIC_*` env vars are inlined by Metro at build time (see
 * services/mapbox.ts for the same pattern), so this is a BUILD-TIME switch,
 * not something that can change without a rebuild.
 *
 * Both `@rnmapbox/maps` and `react-native-maps` ship in the binary regardless
 * of this flag (Expo autolinking links every installed native module) — this
 * constant only controls which one the JS layer renders. To fully drop a
 * provider's native footprint, uninstall its package too. See
 * components/map/README.md for the full switch-back procedure.
 */
export type MapProvider = 'mapbox' | 'google';

function readMapProvider(): MapProvider {
  const raw = process.env.EXPO_PUBLIC_MAP_PROVIDER;
  return raw === 'google' ? 'google' : 'mapbox';
}

export const MAP_PROVIDER: MapProvider = readMapProvider();

export const isMapboxProvider = MAP_PROVIDER === 'mapbox';
export const isGoogleProvider = MAP_PROVIDER === 'google';
