import { useSyncExternalStore } from 'react';
import { pushLocation, stopLocation } from './actions';

/**
 * The captain's location sharing. Lives outside React so it keeps running while
 * the captain moves between screens. Positions are sent at most every 8 seconds.
 */
type Status = { on: boolean; error: string | null; lastSent: number | null };
let status: Status = { on: false, error: null, lastSent: null };
const ls = new Set<() => void>();
const set = (s: Partial<Status>) => {
  status = { ...status, ...s };
  ls.forEach((l) => l());
};

let watchId: number | null = null;
let lastPush = 0;
let pending: GeolocationPosition | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let wake: { release: () => Promise<void> } | null = null;

async function send(p: GeolocationPosition) {
  lastPush = Date.now();
  const ok = await pushLocation(p.coords.latitude, p.coords.longitude, p.coords.heading, p.coords.speed);
  set(ok ? { lastSent: Date.now(), error: null } : { error: 'مقدرناش نبعت موقعك — اتأكد من النت' });
}

function onPosition(p: GeolocationPosition) {
  const wait = 8000 - (Date.now() - lastPush);
  if (wait <= 0) return void send(p);
  pending = p;
  if (!timer)
    timer = setTimeout(() => {
      timer = null;
      if (pending) void send(pending);
      pending = null;
    }, wait);
}

async function keepAwake() {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    wake = (await nav.wakeLock?.request('screen')) ?? null;
  } catch {
    wake = null;
  }
}

export function startSharing() {
  if (status.on) return;
  if (!navigator.geolocation) return set({ error: 'الموبايل ده مش بيدعم تحديد الموقع' });
  set({ on: true, error: null });
  watchId = navigator.geolocation.watchPosition(onPosition, (e) => set({ error: e.code === e.PERMISSION_DENIED ? 'لازم تسمح بالوصول للموقع من إعدادات المتصفح' : 'مش قادرين نحدد موقعك دلوقتي' }), {
    enableHighAccuracy: true,
    maximumAge: 5000,
    timeout: 20000,
  });
  void keepAwake();
}

export async function stopSharing() {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  if (timer) clearTimeout(timer);
  timer = null;
  pending = null;
  void wake?.release().catch(() => {});
  wake = null;
  set({ on: false, error: null, lastSent: null });
  await stopLocation();
}

// the screen lock is dropped when the tab is hidden; take it again on return
document.addEventListener('visibilitychange', () => {
  if (status.on && document.visibilityState === 'visible') void keepAwake();
});

export const useSharing = () =>
  useSyncExternalStore(
    (l) => {
      ls.add(l);
      return () => ls.delete(l);
    },
    () => status,
  );
