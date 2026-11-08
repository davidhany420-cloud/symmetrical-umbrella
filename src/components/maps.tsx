import { useEffect, useRef, useState, type ReactNode } from 'react';
import { LocateFixed, Loader2, MapPin } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { cx } from './ui';
import { DARK_STYLE, LOCATE_HELP, currentPosition, findPlaces, loadMaps, placeName, provider, type LocateError, type Suggestion } from '@/lib/maps';
import { toast } from '@/lib/toast';
import type { Place } from '@/lib/types';

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  kind: 'captain' | 'pickup' | 'drop';
  title?: string;
  heading?: number;
}

/** keep the caller's positioning (absolute) instead of forcing relative */
const frame = (className?: string) => (/\b(absolute|fixed)\b/.test(className ?? '') ? '' : 'relative');

const cssVar = (n: string, fallback: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || fallback;

function iconFor(g: typeof google, p: MapPoint): google.maps.Symbol {
  const acc = cssVar('--acc', '#3df5ff');
  const acc2 = cssVar('--acc-2', '#7c5cff');
  if (p.kind === 'captain') {
    return { path: g.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 6, rotation: p.heading ?? 0, fillColor: acc, fillOpacity: 1, strokeColor: '#05060a', strokeWeight: 2 };
  }
  return {
    path: g.maps.SymbolPath.CIRCLE,
    scale: p.kind === 'drop' ? 9 : 8,
    fillColor: p.kind === 'drop' ? acc : '#05060a',
    fillOpacity: 1,
    strokeColor: p.kind === 'drop' ? '#05060a' : acc2,
    strokeWeight: p.kind === 'drop' ? 3 : 4,
  };
}

interface MapProps {
  points: MapPoint[];
  className?: string;
  fallback?: ReactNode;
  follow?: string;
  line?: boolean;
}

/** Live map in the app's dark style — Google Maps with a key, OpenStreetMap otherwise. */
export function MapView(props: MapProps) {
  return provider === 'google' ? <GoogleMapView {...props} /> : <OsmMapView {...props} />;
}

/* ---------------- OpenStreetMap (Leaflet) ---------------- */
function osmIcon(p: MapPoint) {
  const html =
    p.kind === 'captain'
      ? `<div class="fs-pin-captain" style="transform:rotate(${p.heading ?? 0}deg)"><span></span></div>`
      : `<div class="fs-pin-${p.kind}"></div>`;
  const size = p.kind === 'captain' ? 34 : 20;
  return L.divIcon({ html, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

function OsmMapView({ points, className, follow, line = true }: MapProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef(new Map<string, L.Marker>());
  const poly = useRef<L.Polyline | null>(null);
  const fittedFor = useRef('');

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: false, attributionControl: true }).setView([30.0444, 31.2357], 12);
    L.control.zoom({ position: 'bottomleft' }).addTo(m);
    m.attributionControl.setPrefix(false);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      className: 'fs-dark-tiles',
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    }).addTo(m);
    map.current = m;
    // the container may be laid out after mount (animations) — fix tile sizing
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
      markers.current.clear();
      fittedFor.current = '';
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const seen = new Set<string>();
    for (const p of points) {
      seen.add(p.id);
      const existing = markers.current.get(p.id);
      if (existing) {
        existing.setLatLng([p.lat, p.lng]);
        existing.setIcon(osmIcon(p));
      } else {
        markers.current.set(p.id, L.marker([p.lat, p.lng], { icon: osmIcon(p), title: p.title, zIndexOffset: p.kind === 'captain' ? 1000 : 0, keyboard: false }).addTo(m));
      }
    }
    for (const [id, mk] of markers.current) {
      if (!seen.has(id)) {
        mk.remove();
        markers.current.delete(id);
      }
    }
    const a = points.find((p) => p.kind === 'pickup');
    const b = points.find((p) => p.kind === 'drop');
    poly.current?.remove();
    poly.current = null;
    if (line && a && b) {
      poly.current = L.polyline(
        [
          [a.lat, a.lng],
          [b.lat, b.lng],
        ],
        { color: cssVar('--acc', '#3df5ff'), weight: 3, dashArray: '6 10', opacity: 0.9 },
      ).addTo(m);
    }
    const key = points.map((p) => p.id).sort().join('|');
    if (points.length && key !== fittedFor.current) {
      fittedFor.current = key;
      if (points.length === 1) m.setView([points[0].lat, points[0].lng], 15);
      else m.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), { padding: [48, 48], maxZoom: 16 });
    } else if (follow) {
      const f = points.find((p) => p.id === follow);
      if (f) m.panTo([f.lat, f.lng], { animate: true });
    }
  }, [points, follow, line]);

  return (
    <div className={cx(frame(className), 'overflow-hidden rounded-3xl border border-line bg-[#0b0e16] isolate', className)}>
      <div ref={el} className="absolute inset-0" />
    </div>
  );
}

/* ---------------- Google Maps ---------------- */
function GoogleMapView({ points, className, fallback, follow, line = true }: MapProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const markers = useRef(new Map<string, google.maps.Marker>());
  const poly = useRef<google.maps.Polyline | null>(null);
  const fittedFor = useRef('');
  const [g, setG] = useState<typeof google | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    void loadMaps().then((x) => alive && setG(x));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!g || !el.current || map.current) return;
    map.current = new g.maps.Map(el.current, {
      center: { lat: 30.0444, lng: 31.2357 },
      zoom: 12,
      styles: DARK_STYLE,
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: 'greedy',
      clickableIcons: false,
      backgroundColor: '#0b0e16',
    });
  }, [g]);

  useEffect(() => {
    const m = map.current;
    if (!g || !m) return;
    const seen = new Set<string>();
    for (const p of points) {
      seen.add(p.id);
      const pos = { lat: p.lat, lng: p.lng };
      const existing = markers.current.get(p.id);
      if (existing) {
        existing.setPosition(pos);
        existing.setIcon(iconFor(g, p));
      } else {
        markers.current.set(p.id, new g.maps.Marker({ map: m, position: pos, icon: iconFor(g, p), title: p.title, zIndex: p.kind === 'captain' ? 10 : 5 }));
      }
    }
    for (const [id, mk] of markers.current) {
      if (!seen.has(id)) {
        mk.setMap(null);
        markers.current.delete(id);
      }
    }
    // dashed line pickup → drop
    const a = points.find((p) => p.kind === 'pickup');
    const b = points.find((p) => p.kind === 'drop');
    poly.current?.setMap(null);
    poly.current = null;
    if (line && a && b) {
      poly.current = new g.maps.Polyline({
        map: m,
        path: [a, b].map((p) => ({ lat: p.lat, lng: p.lng })),
        geodesic: true,
        strokeOpacity: 0,
        icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.9, strokeColor: cssVar('--acc', '#3df5ff'), scale: 3 }, offset: '0', repeat: '14px' }],
      });
    }
    // fit when the set of points changes; afterwards only follow the tracked marker
    const key = points.map((p) => p.id).sort().join('|');
    if (points.length && key !== fittedFor.current) {
      fittedFor.current = key;
      if (points.length === 1) {
        m.setCenter(points[0]);
        m.setZoom(15);
      } else {
        const bounds = new g.maps.LatLngBounds();
        points.forEach((p) => bounds.extend(p));
        m.fitBounds(bounds, 56);
      }
    } else if (follow) {
      const f = points.find((p) => p.id === follow);
      if (f) m.panTo(f);
    }
  }, [g, points, follow, line]);

  if (g === null) return <div className={className}>{fallback}</div>;
  return (
    <div className={cx(frame(className), 'overflow-hidden rounded-3xl border border-line bg-[#0b0e16]', className)}>
      <div ref={el} className="absolute inset-0" />
      {g === undefined && (
        <div className="absolute inset-0 grid place-items-center">
          <Loader2 className="size-6 animate-spin text-muted" />
        </div>
      )}
    </div>
  );
}

/* ---------------- place search field ---------------- */
export function PlaceField({ label, icon, value, onChange, placeholder, near }: { label: string; icon: ReactNode; value: Place; onChange: (p: Place) => void; placeholder: string; near?: { lat: number; lng: number } }) {
  const [text, setText] = useState(value.label);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [locErr, setLocErr] = useState<LocateError | null>(null);
  const seq = useRef(0);
  const picked = useRef(value.label); // label of the last chosen place — no need to search it again

  useEffect(() => setText(value.label), [value.label]);

  useEffect(() => {
    if (!open) return;
    const q = text.trim();
    if (q.length < 2 || q === picked.current) {
      setItems([]);
      return;
    }
    const n = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const res = await findPlaces(q, near);
        if (n === seq.current) setItems(res);
      } catch {
        if (n === seq.current) setItems([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [text, open, near]);

  const choose = async (s: Suggestion) => {
    setBusy(true);
    setOpen(false);
    const p = await s.pick().catch(() => null);
    setBusy(false);
    const next = p ?? { label: s.main };
    picked.current = next.label;
    setItems([]);
    onChange(next);
  };

  const locate = async () => {
    setBusy(true);
    setLocErr(null);
    try {
      const pos = await currentPosition();
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      // show the pin right away; the street name follows when it arrives
      picked.current = 'موقعي الحالي';
      setItems([]);
      onChange({ label: 'موقعي الحالي', lat, lng });
      setBusy(false);
      const name = await placeName(lat, lng);
      if (name) {
        picked.current = name;
        onChange({ label: name, lat, lng });
      }
    } catch (e) {
      const err: LocateError = typeof e === 'string' && e in LOCATE_HELP ? (e as LocateError) : 'timeout';
      setLocErr(err);
      toast(LOCATE_HELP[err].title, 'err');
    } finally {
      setBusy(false);
    }
  };

  const pinned = value.lat !== undefined;
  return (
    <div className="relative space-y-1.5">
      <span className="text-xs font-medium text-muted px-1">{label}</span>
      <div className="flex items-center gap-3 h-14 pr-4 pl-1.5 rounded-2xl glass transition focus-within:border-acc/60 focus-within:bg-surface-2">
        <span className="text-muted shrink-0 [&>svg]:size-5">{icon}</span>
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            // typing replaces a previously pinned place until a suggestion is picked
            onChange({ label: e.target.value });
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 180)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && items[0]) {
              e.preventDefault();
              void choose(items[0]);
            }
          }}
          placeholder={placeholder}
          className="flex-1 min-w-0 bg-transparent outline-none text-[15px] placeholder:text-muted/60"
        />
        {busy ? (
          <Loader2 className="size-5 animate-spin text-muted mx-2.5" />
        ) : (
          <button type="button" onClick={locate} className="h-11 px-3 rounded-xl bg-acc/10 text-acc text-xs flex items-center gap-1.5 shrink-0" aria-label="موقعي الحالي">
            <LocateFixed className="size-4" /> موقعي
          </button>
        )}
      </div>
      {locErr && !pinned && (
        <div className="rounded-2xl border border-warn/30 bg-warn/[.06] p-3 text-xs space-y-1.5">
          <p className="font-semibold text-warn">{LOCATE_HELP[locErr].title}</p>
          <ol className="list-decimal pr-4 space-y-0.5 text-muted">
            {LOCATE_HELP[locErr].steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
      )}
      {pinned && (
        <span className="flex items-center gap-1 text-[11px] text-ok px-1">
          <MapPin className="size-3" /> متحدد على الخريطة
        </span>
      )}
      {open && items.length > 0 && (
        <div className="absolute z-30 inset-x-0 top-[calc(100%+4px)] rounded-2xl bg-[#11141d] border border-line shadow-2xl overflow-hidden">
          {items.map((s) => (
            <button key={s.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => void choose(s)} className="w-full flex items-start gap-3 px-4 py-3 text-right hover:bg-white/[.05] border-b border-line/60 last:border-0">
              <MapPin className="size-4 mt-0.5 text-muted shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm truncate">{s.main}</span>
                {s.secondary && <span className="block text-[11px] text-muted truncate">{s.secondary}</span>}
              </span>
            </button>
          ))}
          <div className="px-4 py-1.5 text-[10px] text-muted/60 text-left" dir="ltr">
            {provider === 'google' ? 'Google' : '© OpenStreetMap'}
          </div>
        </div>
      )}
    </div>
  );
}
