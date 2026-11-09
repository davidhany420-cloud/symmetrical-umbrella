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
/** Native GPS only when this app build actually contains the plugin (older APKs don't). */
const useNativeGps = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Geolocation');

/** Last raw error, shown in small print so a screenshot tells us exactly what failed. */
export let lastGeoError = '';
const remember = (e: unknown) => {
  lastGeoError = String((e as { message?: string })?.message ?? (e as { code?: number })?.code ?? e).slice(0, 120);
};

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
  if (useNativeGps()) {
    try {
      await ensureNativePermission();
      try {
        return toFix((await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 10000, maximumAge: 120000 })).coords);
      } catch {
        return toFix((await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 25000, maximumAge: 0 })).coords);
      }
    } catch (e) {
      remember(e);
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
    remember(e);
    throw webError(e as GeolocationPositionError);
  }
}

/**
 * Follow the position until the returned stop() is called.
 * Starts with a quick approximate fix (Wi-Fi / cell towers) so the captain shows up right away,
 * then keeps the precise GPS stream. A GPS timeout is only reported when no position at all
 * has arrived for a while — indoors GPS often times out while Wi-Fi location still works.
 */
export async function watchFix(onFix: (f: Fix) => void, onError: (e: LocateError) => void): Promise<() => void> {
  let lastFixAt = 0;
  let stopped = false;
  const got = (f: Fix) => {
    lastFixAt = Date.now();
    onFix(f);
  };
  const fallback = async () => {
    // approximate location when precise GPS is silent
    try {
      if (useNativeGps()) {
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 });
        if (!stopped) got(toFix(pos.coords));
      } else {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }),
        );
        if (!stopped) got(toFix(pos.coords));
      }
      return true;
    } catch (e) {
      remember(e);
      return false;
    }
  };
  const handleError = async (e: LocateError) => {
    if (stopped) return;
    if (e === 'denied' || e === 'unsupported' || e === 'insecure') return onError(e);
    if (Date.now() - lastFixAt < 90_000) return; // a recent position is still good
    if (!(await fallback())) onError(e);
  };

  let stopInner: () => void = () => {};
  if (useNativeGps()) {
    try {
      await ensureNativePermission();
    } catch (e) {
      onError(typeof e === 'string' ? (e as LocateError) : nativeError(e));
      return () => {};
    }
    void fallback(); // quick first position
    const id = await Geolocation.watchPosition({ enableHighAccuracy: true, timeout: 30000, maximumAge: 10000 }, (pos, err) => {
      if (err) {
        remember(err);
        void handleError(nativeError(err));
      }
      else if (pos) got(toFix(pos.coords));
    });
    stopInner = () => void Geolocation.clearWatch({ id });
  } else {
    if (!('geolocation' in navigator)) {
      onError('unsupported');
      return () => {};
    }
    void fallback();
    const id = navigator.geolocation.watchPosition(
      (p) => got(toFix(p.coords)),
      (e) => {
        remember(e);
        void handleError(webError(e));
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 },
    );
    stopInner = () => navigator.geolocation.clearWatch(id);
  }
  // keep the captain visible even if precise GPS stays silent: refresh the approximate fix every minute
  const keepAlive = setInterval(() => {
    if (Date.now() - lastFixAt > 60_000) void fallback();
  }, 30_000);
  return () => {
    stopped = true;
    clearInterval(keepAlive);
    stopInner();
  };
}
