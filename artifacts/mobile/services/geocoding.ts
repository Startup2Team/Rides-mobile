import { Coords } from '@/types';

const TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';
const RWANDA_BBOX = '28.85,-2.84,30.90,-1.04';
const RWANDA_CENTER: Coords = { latitude: -1.9441, longitude: 30.0619 };

export interface GeocodeSuggestion {
  id: string;
  place_name: string;
  coords: Coords;
}

export async function geocodeAddress(
  query: string,
  proximity?: Coords,
): Promise<GeocodeSuggestion[]> {
  if (!query || query.length < 2) return [];

  const params = new URLSearchParams({
    access_token: TOKEN,
    autocomplete: 'true',
    limit: '5',
    country: 'rw',
    bbox: RWANDA_BBOX,
    language: 'en',
  });
  const nearby = proximity ?? RWANDA_CENTER;
  params.set('proximity', `${nearby.longitude},${nearby.latitude}`);

  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/` +
    `${encodeURIComponent(query)}.json` +
    `?${params.toString()}`;

  const res = await fetch(url);
  if (!res.ok) return [];

  const json = await res.json();
  return (json.features ?? []).map((f: any) => ({
    id: f.id,
    place_name: f.place_name,
    coords: { latitude: f.center[1], longitude: f.center[0] },
  }));
}
