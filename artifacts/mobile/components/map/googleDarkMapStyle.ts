/**
 * Google Maps JSON style (night/navy theme) applied for `mapType ===
 * 'standard'` ONLY in dark mode, on the react-native-maps (Google)
 * implementation — see `googleCustomMapStyle` in AppMap.google.tsx. In light
 * mode "standard" uses Google's own default light style (no custom style
 * object) so the map reads clean/light, not this navy theme. This format is
 * Google-specific — it has no Mapbox equivalent, which is why it lives here
 * rather than on AppMap's public props.
 *
 * Consolidated from four screens that each carried a near-identical copy
 * (app/ride.tsx, app/driver-navigate.tsx, app/(driver)/index.tsx,
 * components/home/homeStyles.ts) before the Mapbox migration.
 */
export const GOOGLE_DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#4b6878' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#98a5be' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
];
