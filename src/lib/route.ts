import { km } from './actions';

type Pt = { lat: number; lng: number };

/**
 * Road distance in km between two points, using the free OSRM routing service.
 * Falls back to the straight line × 1.3 (typical Cairo road factor) if routing is unavailable.
 */
export async function roadKm(a: Pt, b: Pt): Promise<{ km: number; minutes: number | null; estimated: boolean }> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=false`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (res.ok) {
      const d = (await res.json()) as { code: string; routes?: { distance: number; duration: number }[] };
      const r = d.routes?.[0];
      if (d.code === 'Ok' && r) return { km: Math.round((r.distance / 1000) * 100) / 100, minutes: Math.round(r.duration / 60), estimated: false };
    }
  } catch {
    /* fall through */
  }
  return { km: Math.round(km(a, b) * 1.3 * 100) / 100, minutes: null, estimated: true };
}
