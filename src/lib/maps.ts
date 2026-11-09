import { GOOGLE_MAPS_KEY } from './config';
import { isNativeApp } from './geo';

/**
 * Two map providers behind one interface:
 *  - Google Maps when GOOGLE_MAPS_KEY is set in config.ts
 *  - otherwise OpenStreetMap (free, no key): Leaflet for the map, Photon for search
 */
export const provider: 'google' | 'osm' = GOOGLE_MAPS_KEY ? 'google' : 'osm';

/** A real map is always available (free OpenStreetMap when there's no Google key). */
export const mapsEnabled = () => true;

let loader: Promise<typeof google | null> | null = null;

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

/* ---------------- unified search / reverse geocode ---------------- */
let gToken: google.maps.places.AutocompleteSessionToken | null = null;

export async function findPlaces(input: string, near?: { lat: number; lng: number }): Promise<Suggestion[]> {
  if (input.trim().length < 2) return [];
  if (provider === 'osm') return photonSearch(input, near);
  if (!gToken) gToken = await newSessionToken();
  if (!gToken) return [];
  const t = gToken;
  return (await googleSearch(input, t, near)).map((s) => ({
    ...s,
    pick: async () => {
      gToken = null; // a session ends when a place is picked
      return s.pick();
    },
  }));
}

export async function placeName(lat: number, lng: number): Promise<string | null> {
  return provider === 'osm' ? photonReverse(lat, lng) : reverseGeocode(lat, lng);
}

/* ---- OpenStreetMap (Photon by Komoot — free, built for type-ahead search) ---- */
const EGYPT_BBOX = '24.7,22.0,36.9,31.7'; // minLon,minLat,maxLon,maxLat

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: { osm_id: number; name?: string; street?: string; housenumber?: string; district?: string; city?: string; county?: string; state?: string };
}

const photonLabel = (p: PhotonFeature['properties']) => {
  const main = p.name || [p.street, p.housenumber].filter(Boolean).join(' ') || p.district || p.city || '';
  const sub = [p.name ? p.street : undefined, p.district, p.city || p.county, p.state].filter((x, i, a) => x && x !== main && a.indexOf(x) === i).join('، ');
  return { main, sub };
};

async function photonSearch(q: string, near?: { lat: number; lng: number }): Promise<Suggestion[]> {
  const u = new URL('https://photon.komoot.io/api/');
  u.searchParams.set('q', q);
  u.searchParams.set('limit', '6');
  u.searchParams.set('bbox', EGYPT_BBOX);
  if (near) {
    u.searchParams.set('lat', String(near.lat));
    u.searchParams.set('lon', String(near.lng));
  }
  const res = await fetch(u);
  if (!res.ok) return [];
  const { features } = (await res.json()) as { features: PhotonFeature[] };
  return features
    .map((f) => {
      const { main, sub } = photonLabel(f.properties);
      const [lng, lat] = f.geometry.coordinates;
      return { id: `${f.properties.osm_id}-${lat}`, main, secondary: sub, pick: async () => ({ label: main, lat, lng }) };
    })
    .filter((s) => s.main);
}

async function photonReverse(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`);
    if (!res.ok) return null;
    const { features } = (await res.json()) as { features: PhotonFeature[] };
    if (!features[0]) return null;
    const { main, sub } = photonLabel(features[0].properties);
    return [main, sub.split('، ')[0]].filter(Boolean).join('، ') || null;
  } catch {
    return null;
  }
}

/* ---- Google (Places API "New") ---- */
async function googleSearch(input: string, token: google.maps.places.AutocompleteSessionToken, near?: { lat: number; lng: number }): Promise<Suggestion[]> {
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

async function newSessionToken() {
  const g = await loadMaps();
  if (!g) return null;
  const { AutocompleteSessionToken } = (await g.maps.importLibrary('places')) as google.maps.PlacesLibrary;
  return new AutocompleteSessionToken();
}

/** Coordinates → short Arabic address (Google). */
async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
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

export type { LocateError } from './geo';
import type { LocateError } from './geo';
import { getFix } from './geo';

/** The phone's location (native GPS inside the Android app, browser location otherwise). */
export async function currentPosition(): Promise<{ coords: { latitude: number; longitude: number } }> {
  const f = await getFix();
  return { coords: { latitude: f.lat, longitude: f.lng } };
}

export const LOCATE_HELP: Record<LocateError, { title: string; steps: string[] }> = {
  denied: {
    title: 'التطبيق مش مسموح له يعرف مكانك',
    steps: isNativeApp()
      ? ['افتح إعدادات الموبايل ← التطبيقات ← في السكة', 'الأذونات ← الموقع', 'اختار "السماح أثناء استخدام التطبيق"، وارجع دوس "موقعي"']
      : ['دوس على علامة القفل 🔒 جنب الرابط فوق', 'اختار "الأذونات" أو "إعدادات الموقع"', 'خلّي "الموقع" على "سماح"، وبعدين دوس "موقعي" تاني'],
  },
  off: {
    title: 'الـ GPS مقفول في الموبايل',
    steps: ['افتح شريط الإعدادات السريعة من فوق الشاشة', 'شغّل "الموقع" / Location', 'ارجع ودوس "موقعي" تاني'],
  },
  timeout: {
    title: 'الموبايل لسه مش لاقي مكانك',
    steps: ['اتأكد إن الـ GPS شغّال', 'لو إنت جوه مكان مقفول قرّب من الشباك', 'دوس "موقعي" تاني — أو اكتب اسم المكان'],
  },
  unsupported: { title: 'المتصفح ده مش بيدعم تحديد المكان', steps: ['اكتب اسم المكان واختاره من الاقتراحات'] },
  insecure: { title: 'تحديد المكان محتاج رابط آمن (https)', steps: ['افتح التطبيق من الرابط الأصلي'] },
};
