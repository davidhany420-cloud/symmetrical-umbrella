import { useSyncExternalStore } from 'react';
import { pushLocation, stopLocation } from './actions';
import { lastGeoError, watchFix, type Fix, type LocateError } from './geo';

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

let stopWatch: (() => void) | null = null;
let lastPush = 0;
let pending: Fix | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let wake: { release: () => Promise<void> } | null = null;

async function send(p: Fix) {
  lastPush = Date.now();
  const ok = await pushLocation(p.lat, p.lng, p.heading, p.speed);
  set(ok ? { lastSent: Date.now(), error: null } : { error: 'مقدرناش نبعت موقعك — اتأكد من النت' });
}

function onPosition(p: Fix) {
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

const SHARE_ERRORS: Record<LocateError, string> = {
  denied: 'لازم تسمح للتطبيق بالوصول للموقع (الإعدادات ← التطبيقات ← في السكة ← الأذونات)',
  off: 'الـ GPS مقفول — شغّل "الموقع" من الإعدادات السريعة',
  timeout: 'مش قادرين نحدد مكانك دلوقتي — اتأكد إن الـ GPS شغّال',
  unsupported: 'الموبايل ده مش بيدعم تحديد الموقع',
  insecure: 'افتح التطبيق من الرابط الأصلي',
};

export function startSharing() {
  if (status.on) return;
  set({ on: true, error: null });
  void watchFix(onPosition, (e) => set({ error: SHARE_ERRORS[e] + (lastGeoError ? ` (${lastGeoError})` : '') })).then((stop) => {
    if (status.on) stopWatch = stop;
    else stop(); // sharing was stopped while permission was being asked
  });
  void keepAwake();
}

export async function stopSharing() {
  stopWatch?.();
  stopWatch = null;
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
