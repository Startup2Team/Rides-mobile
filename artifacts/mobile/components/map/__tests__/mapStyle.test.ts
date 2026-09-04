// Pure map-style-selection logic — light-by-default, dark only in dark mode,
// satellite/hybrid unaffected by theme. Covers both map providers since
// EXPO_PUBLIC_MAP_PROVIDER is a build-time switch and either can ship.

jest.mock('react-native', () => ({
  StyleSheet: { absoluteFill: {}, create: (styles: object) => styles },
  useColorScheme: jest.fn(() => 'light'),
}));

jest.mock('@rnmapbox/maps', () => ({
  __esModule: true,
  default: {
    setAccessToken: jest.fn(),
    StyleURL: {
      Street: 'mapbox://styles/mapbox/streets-v12',
      Light: 'mapbox://styles/mapbox/light-v11',
      Dark: 'mapbox://styles/mapbox/dark-v11',
      Satellite: 'mapbox://styles/mapbox/satellite-v9',
      SatelliteStreet: 'mapbox://styles/mapbox/satellite-streets-v12',
    },
  },
}), { virtual: true });

jest.mock('react-native-maps', () => ({
  __esModule: true,
  default: () => null,
  PROVIDER_DEFAULT: 'default',
}), { virtual: true });

import { styleUrlForMapType } from '../AppMap.mapbox';
import { googleCustomMapStyle } from '../AppMap.google';
import { GOOGLE_DARK_MAP_STYLE } from '../googleDarkMapStyle';

describe('styleUrlForMapType (Mapbox)', () => {
  it('defaults "standard" to a light street style, not dark', () => {
    expect(styleUrlForMapType('standard', 'light')).toBe('mapbox://styles/mapbox/streets-v12');
    expect(styleUrlForMapType('standard', undefined)).toBe('mapbox://styles/mapbox/streets-v12');
    expect(styleUrlForMapType('standard', null)).toBe('mapbox://styles/mapbox/streets-v12');
  });

  it('uses the real dark style only in dark mode', () => {
    expect(styleUrlForMapType('standard', 'dark')).toBe('mapbox://styles/mapbox/dark-v11');
  });

  it('satellite and hybrid are theme-independent', () => {
    expect(styleUrlForMapType('satellite', 'light')).toBe('mapbox://styles/mapbox/satellite-v9');
    expect(styleUrlForMapType('satellite', 'dark')).toBe('mapbox://styles/mapbox/satellite-v9');
    expect(styleUrlForMapType('hybrid', 'light')).toBe('mapbox://styles/mapbox/satellite-streets-v12');
    expect(styleUrlForMapType('hybrid', 'dark')).toBe('mapbox://styles/mapbox/satellite-streets-v12');
  });
});

describe('googleCustomMapStyle (react-native-maps / Google)', () => {
  it('leaves "standard" as the native light style in light mode', () => {
    expect(googleCustomMapStyle('standard', 'light')).toBeUndefined();
    expect(googleCustomMapStyle('standard', undefined)).toBeUndefined();
    expect(googleCustomMapStyle('standard', null)).toBeUndefined();
  });

  it('applies the custom navy style only in dark mode', () => {
    expect(googleCustomMapStyle('standard', 'dark')).toBe(GOOGLE_DARK_MAP_STYLE);
  });

  it('never applies a custom style for satellite/hybrid', () => {
    expect(googleCustomMapStyle('satellite', 'dark')).toBeUndefined();
    expect(googleCustomMapStyle('hybrid', 'dark')).toBeUndefined();
  });
});
