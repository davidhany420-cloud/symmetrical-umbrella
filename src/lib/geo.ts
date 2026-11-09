import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

/**
 * One location API for both places the app runs:
 *  - inside the Android app → the phone's native GPS (reliable permissions, better accuracy)
 *  - in a browser → the browser's geolocation
 */
export type LocateError = 'unsupported' | 'insecure' | 'denied' | 'off' | 'timeout';
export interface Fix {
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
}

export const isNativeApp = () => Capacitor.isNativePlatform();

const nativeError = (e: unknown): LocateError => {
  const m = String((e as { message?: string })?.message ?? e).toLowerCase();
  if (/denied|permission/.test(m)) return 'denied';
  if (/disabled|not enabled|location services|unavailable/.test(m)) return 'off';
  return 'timeout';
};
const webError = (e: GeolocationPositionError): LocateError =>
  e.code === e.PERMISSION_DENIED ? 'denied' : e.code === e.POSITION_UNAVAILABLE ? 'off' : 'timeout';

const toFix = (c: { latitude: number; longitude: number; heading?: number | null; speed?: number | null }): Fix => ({
  lat: c.latitude,
  lng: c.longitude,
  heading: c.heading ?? null,
  speed: c.speed ?? null,
});

async function ensureNativePermission() {
  let p = await Geolocation.checkPermissions();
  if (p.location !== 'granted' && p.coarseLocation !== 'granted') p = await Geolocation.requestPermissions();
  if (p.location !== 'granted' && p.coarseLocation !== 'granted') throw 'denied' as LocateError;
}

/** Current position: a quick fix first, then real GPS. Rejects with a LocateError. */
export async function getFix(): Promise<Fix> {
  if (isNativeApp()) {
    try {
      await ensureNativePermission();
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 });
      return toFix(pos.coords);
    } catch (e) {
      throw typeof e === 'string' ? (e as LocateError) : nativeError(e);
    }
  }
  if (!window.isSecureContext) throw 'insecure' as LocateError;
  if (!('geolocation' in navigator)) throw 'unsupported' as LocateError;
  const get = (o: PositionOptions) => new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, o));
  try {
    return toFix((await get({ enableHighAccuracy: false, timeout: 7000, maximumAge: 120000 })).coords);
  } catch (e) {
    if (webError(e as GeolocationPositionError) === 'denied') throw 'denied' as LocateError;
  }
  try {
    return toFix((await get({ enableHighAccuracy: true, timeout: 20000, maximumAge: 0 })).coords);
  } catch (e) {
    throw webError(e as GeolocationPositionError);
  }
}

/** Follow the position until the returned stop() is called. */
export async function watchFix(onFix: (f: Fix) => void, onError: (e: LocateError) => void): Promise<() => void> {
  if (isNativeApp()) {
    try {
      await ensureNativePermission();
    } catch (e) {
      onError(typeof e === 'string' ? (e as LocateError) : nativeError(e));
      return () => {};
    }
    const id = await Geolocation.watchPosition({ enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }, (pos, err) => {
      if (err) onError(nativeError(err));
      else if (pos) onFix(toFix(pos.coords));
    });
    return () => void Geolocation.clearWatch({ id });
  }
  if (!('geolocation' in navigator)) {
    onError('unsupported');
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    (p) => onFix(toFix(p.coords)),
    (e) => onError(webError(e)),
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}
