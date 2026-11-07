import { GOOGLE_MAPS_KEY } from './config';

/**
 * Loads the Google Maps JavaScript API once. Resolves to null when no key is
 * configured or the script fails, so callers can fall back to the built-in map.
 */
let loader: Promise<typeof google | null> | null = null;

export const mapsEnabled = () => !!GOOGLE_MAPS_KEY;

export function loadMaps(): Promise<typeof google | null> {
  if (!GOOGLE_MAPS_KEY) return Promise.resolve(null);
  if (loader) return loader;
  loader = new Promise((resolve) => {
    const cb = `__fsMaps${Date.now()}`;
    const w = window as unknown as Record<string, unknown>;
    w[cb] = () => resolve(window.google);
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_KEY)}&v=weekly&libraries=places,geometry&language=ar&region=EG&loading=async&callback=${cb}`;
    s.async = true;
    s.onerror = () => resolve(null);
    // Google calls this when the key is rejected (wrong key, API not enabled, site not allowed)
    w.gm_authFailure = () => {
      console.warn('Google Maps key rejected');
      resolve(null);
    };
    document.head.appendChild(s);
  });
  return loader;
}

/** Dark map style matching the app (works without a Map ID). */
export const DARK_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#0b0e16' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8b90a5' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#05060a' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#1c2130' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0e1a17' }, { visibility: 'on' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1a1f2c' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0b0e16' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#262d40' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#b7bccc' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f2a3d' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d6b8a' }] },
];

export interface Suggestion {
  id: string;
  main: string;
  secondary: string;
  pick: () => Promise<{ label: string; lat: number; lng: number } | null>;
}

/** Place search limited to Egypt (Places API "New"). */
export async function searchPlaces(input: string, token: google.maps.places.AutocompleteSessionToken, near?: { lat: number; lng: number }): Promise<Suggestion[]> {
  const g = await loadMaps();
  if (!g || input.trim().length < 2) return [];
  const { AutocompleteSuggestion } = (await g.maps.importLibrary('places')) as google.maps.PlacesLibrary;
  const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
    input,
    sessionToken: token,
    includedRegionCodes: ['eg'],
    language: 'ar',
    region: 'eg',
    ...(near ? { origin: near, locationBias: { center: near, radius: 30000 } } : {}),
  });
  return suggestions
    .filter((s) => s.placePrediction)
    .slice(0, 6)
    .map((s) => {
      const p = s.placePrediction!;
      return {
        id: p.placeId,
        main: p.mainText?.text ?? p.text.text,
        secondary: p.secondaryText?.text ?? '',
        pick: async () => {
          const place = p.toPlace();
          await place.fetchFields({ fields: ['location', 'displayName', 'formattedAddress'] });
          if (!place.location) return null;
          return { label: place.displayName || place.formattedAddress || p.text.text, lat: place.location.lat(), lng: place.location.lng() };
        },
      };
    });
}

export async function newSessionToken() {
  const g = await loadMaps();
  if (!g) return null;
  const { AutocompleteSessionToken } = (await g.maps.importLibrary('places')) as google.maps.PlacesLibrary;
  return new AutocompleteSessionToken();
}

/** Coordinates → short Arabic address. */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const g = await loadMaps();
  if (!g) return null;
  try {
    const { results } = await new g.maps.Geocoder().geocode({ location: { lat, lng }, language: 'ar' });
    const r = results.find((x) => x.types.some((t) => ['street_address', 'route', 'neighborhood', 'sublocality', 'premise'].includes(t))) ?? results[0];
    if (!r) return null;
    return r.formatted_address.split('،').slice(0, 2).join('،').replace(/، مصر$/, '');
  } catch {
    return null;
  }
}

export function currentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('unsupported'));
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
  });
}
