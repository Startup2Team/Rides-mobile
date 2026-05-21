import { Coords } from '@/types';

const TOKEN: string =
  process.env.EXPO_PUBLIC_MAPBOX_TOKEN

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

  const prox = proximity
    ? `&proximity=${proximity.longitude},${proximity.latitude}`
    : '';

  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/` +
    `${encodeURIComponent(query)}.json` +
    `?access_token=${TOKEN}&autocomplete=true&limit=5${prox}`;

  const res = await fetch(url);
  if (!res.ok) return [];

  const json = await res.json();
  return (json.features ?? []).map((f: any) => ({
    id: f.id,
    place_name: f.place_name,
    coords: { latitude: f.center[1], longitude: f.center[0] },
  }));
}
