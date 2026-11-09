import { useRef, useSyncExternalStore } from 'react';
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_PRICE_PER_KM, SUPABASE_KEY, SUPABASE_URL } from './config';
import type { Booking, CaptainProfile, Line, LivePos, Message, Notice, PaymentLog, State, User } from './types';

/**
 * Data layer backed by Supabase.
 * The server is the source of truth; this module keeps a read cache of what the
 * signed-in person is allowed to see (row level security decides), reloads it
 * whenever a row changes (realtime), and exposes it to React through useStore.
 */
export let db: SupabaseClient;

const empty = (): State => ({
  ready: false,
  users: [],
  captains: [],
  lines: [],
  bookings: [],
  notices: [],
  payments: [],
  live: [],
  pricePerKm: DEFAULT_PRICE_PER_KM,
  sessionUserId: null,
  isAdmin: false,
});

let state: State = empty();
const listeners = new Set<() => void>();
const errorListeners = new Set<(msg: string) => void>();
let channel: RealtimeChannel | null = null;
let liveChannel: RealtimeChannel | null = null;

export const getState = () => state;

export function setState(fn: (s: State) => State) {
  state = fn(state);
  listeners.forEach((l) => l());
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function onStoreError(l: (msg: string) => void) {
  errorListeners.add(l);
  return () => {
    errorListeners.delete(l);
  };
}
export const reportError = (msg: string) => errorListeners.forEach((l) => l(msg));

/**
 * Subscribe to a slice of state. The derived value is cached per state
 * snapshot so selectors may freely return new arrays/objects.
 */
export function useStore<T>(selector: (s: State) => T): T {
  const sel = useRef(selector);
  const cache = useRef<{ s: State | null; v: T }>({ s: null, v: undefined as T });
  sel.current = selector;
  cache.current.s = null;
  const get = () => {
    if (cache.current.s !== state) cache.current = { s: state, v: sel.current(state) };
    return cache.current.v;
  };
  return useSyncExternalStore(subscribe, get);
}

/* ---------------- loading ---------------- */
const ms = (t: string | null | undefined) => (t ? new Date(t).getTime() : undefined);

async function signedUrls(paths: string[]) {
  const unique = [...new Set(paths.filter(Boolean))];
  const map = new Map<string, string>();
  if (!unique.length) return map;
  const { data } = await db.storage.from('documents').createSignedUrls(unique, 3600);
  data?.forEach((d) => d.signedUrl && d.path && map.set(d.path, d.signedUrl));
  return map;
}

let loading: Promise<void> | null = null;
let again = false;

/** Reload everything this person may see. Coalesces bursts of calls. */
export function reload(): Promise<void> {
  if (loading) {
    again = true;
    return loading;
  }
  loading = (async () => {
    try {
      await loadOnce();
    } finally {
      loading = null;
      if (again) {
        again = false;
        void reload();
      }
    }
  })();
  return loading;
}

async function loadOnce() {
  const { data: sess } = await db.auth.getSession();
  const uid = sess.session?.user.id ?? null;

  const linesQ = db.from('lines').select('*').order('created_at');
  const { data: priceRow } = await db.from('app_settings').select('value').eq('key', 'price_per_km').maybeSingle();
  const pricePerKm = priceRow ? Number(priceRow.value) : DEFAULT_PRICE_PER_KM;
  if (!uid) {
    const { data: lines } = await linesQ;
    setState(() => ({ ...empty(), ready: true, pricePerKm, lines: (lines ?? []).map(mapLine) }));
    return;
  }

  const [profiles, captains, priv, payments, lines, bookings, messages, notices, admin, live, phones] = await Promise.all([
    // phone numbers are private: they come only from visible_phones() below
    db.from('profiles').select('id, role, name, gender, created_at, rider_rating, rider_rating_count, deleted_at'),
    db.from('captains').select('*'),
    db.from('captain_private').select('*'),
    db.from('payments').select('*').order('created_at', { ascending: false }),
    linesQ,
    db.from('bookings').select('*').order('created_at', { ascending: false }).limit(500),
    db.from('messages').select('*').order('id').limit(5000),
    db.from('notices').select('*').order('id', { ascending: false }).limit(200),
    db.rpc('is_admin'),
    db.from('captain_live').select('*'),
    db.rpc('visible_phones'),
  ]);
  const firstErr = [profiles, captains, priv, payments, lines, bookings, messages, notices].find((r) => r.error)?.error;
  if (firstErr) reportError('مشكلة في الاتصال — بنحاول تاني');

  const privBy = new Map((priv.data ?? []).map((p) => [p.user_id as string, p]));
  const pays = payments.data ?? [];
  const urls = await signedUrls([
    ...(captains.data ?? []).map((c) => c.photo_path),
    ...(priv.data ?? []).flatMap((p) => [p.id_path, p.license_path, p.bike_path]),
    ...pays.filter((p) => p.status === 'pending').map((p) => p.receipt_path),
  ]);
  const url = (p?: string | null) => (p ? urls.get(p) : undefined);

  const phoneBy = new Map<string, string>(((phones.data as { id: string; phone: string }[] | null) ?? []).map((x) => [x.id, x.phone]));
  const users: User[] = (profiles.data ?? []).map((p) => ({
    id: p.id,
    role: p.role,
    name: p.name,
    phone: phoneBy.get(p.id) ?? '',
    riderRating: p.rider_rating !== undefined && p.rider_rating !== null ? Number(p.rider_rating) : undefined,
    riderRatingCount: p.rider_rating_count ?? undefined,
    deletedAt: ms(p.deleted_at),
    gender: p.gender,
    createdAt: ms(p.created_at)!,
  }));

  const caps: CaptainProfile[] = (captains.data ?? []).map((c) => {
    const pv = privBy.get(c.user_id);
    const pending = pays.find((p) => p.captain_id === c.user_id && p.status === 'pending');
    return {
      userId: c.user_id,
      bikeClass: c.bike_class,
      bikeModel: c.bike_model,
      plate: c.plate,
      governorate: c.governorate,
      nationalId: pv?.national_id ?? '',
      photo: url(c.photo_path),
      idPhoto: url(pv?.id_path),
      licensePhoto: url(pv?.license_path),
      bikePhoto: url(pv?.bike_path),
      status: c.status,
      rejectReason: c.reject_reason ?? undefined,
      submittedAt: ms(c.submitted_at),
      reviewedAt: ms(c.reviewed_at),
      activeUntil: ms(c.active_until),
      pendingPayment: pending ? { id: pending.id, ref: pending.ref, receipt: url(pending.receipt_path), at: ms(pending.created_at)! } : undefined,
      rating: Number(c.rating),
      ratingCount: c.rating_count,
      trips: c.trips,
      online: c.online,
    };
  });

  const msgBy = new Map<string, Message[]>();
  (messages.data ?? []).forEach((m) => {
    const list = msgBy.get(m.booking_id) ?? [];
    list.push({ id: String(m.id), from: m.sender, text: m.text, at: ms(m.created_at)! });
    msgBy.set(m.booking_id, list);
  });

  const bks: Booking[] = (bookings.data ?? []).map((b) => ({
    id: b.id,
    clientId: b.client_id,
    captainId: b.captain_id,
    mode: b.mode,
    type: b.type,
    from: b.from_place,
    to: b.to_place,
    time: b.time,
    days: b.days ?? [],
    bikeClass: b.bike_class,
    offer: b.offer,
    counter: b.counter ?? undefined,
    price: b.price ?? undefined,
    status: b.status,
    createdAt: ms(b.created_at)!,
    messages: msgBy.get(b.id) ?? [],
    rating: b.rating ?? undefined,
    fromLat: b.from_lat ?? undefined,
    fromLng: b.from_lng ?? undefined,
    toLat: b.to_lat ?? undefined,
    toLng: b.to_lng ?? undefined,
    distanceKm: b.distance_km !== null && b.distance_km !== undefined ? Number(b.distance_km) : undefined,
    stage: b.stage ?? undefined,
    riderRating: b.rider_rating ?? undefined,
    finishedAt: ms(b.finished_at),
  }));

  const nts: Notice[] = (notices.data ?? []).map((n) => ({ id: String(n.id), to: n.to_admin ? 'admin' : n.to_user, text: n.text, at: ms(n.created_at)!, read: n.read }));

  const logs: PaymentLog[] = pays
    .filter((p) => p.status !== 'pending')
    .map((p) => ({ id: p.id, captainId: p.captain_id, ref: p.ref, amount: p.amount, at: ms(p.created_at)!, status: p.status, reviewedAt: ms(p.reviewed_at) ?? ms(p.created_at)! }));

  setState((s) => ({
    ...s,
    ready: true,
    pricePerKm,
    sessionUserId: users.some((u) => u.id === uid) ? uid : null,
    isAdmin: admin.data === true,
    users,
    captains: caps,
    lines: (lines.data ?? []).map(mapLine),
    bookings: bks,
    notices: nts,
    payments: logs,
    // table may not exist until 002_live_location.sql is run — then simply no live data
    live: live.error ? [] : (live.data ?? []).map(mapLive),
  }));
}

function mapLive(r: Record<string, unknown>): LivePos {
  return {
    captainId: r.captain_id as string,
    lat: r.lat as number,
    lng: r.lng as number,
    heading: (r.heading as number | null) ?? undefined,
    speed: (r.speed as number | null) ?? undefined,
    at: ms(r.updated_at as string)!,
  };
}

function mapLine(l: Record<string, unknown>): Line {
  return {
    id: l.id as string,
    name: l.name as string,
    governorate: l.governorate as string,
    from: l.from_place as string,
    to: l.to_place as string,
    time: l.time as string,
    price: l.price as number,
    active: l.active as boolean,
  };
}

/* ---------------- realtime ---------------- */
let timer: ReturnType<typeof setTimeout> | undefined;
const soon = () => {
  clearTimeout(timer);
  timer = setTimeout(() => void reload(), 250);
};

function listen() {
  if (channel) void db.removeChannel(channel);
  channel = db.channel('felsekka-live');
  for (const table of ['profiles', 'captains', 'payments', 'bookings', 'messages', 'notices', 'lines', 'app_settings']) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, soon);
  }
  // positions change every few seconds — patch them in place instead of reloading everything
  channel.subscribe();

  // positions on their own channel: if that table isn't set up yet, the rest keeps working
  if (liveChannel) void db.removeChannel(liveChannel);
  liveChannel = db.channel('felsekka-positions');
  liveChannel.on('postgres_changes', { event: '*', schema: 'public', table: 'captain_live' }, (p) => {
    if (p.eventType === 'DELETE') {
      const id = (p.old as { captain_id?: string }).captain_id;
      setState((s) => ({ ...s, live: s.live.filter((l) => l.captainId !== id) }));
    } else {
      const pos = mapLive(p.new as Record<string, unknown>);
      setState((s) => ({ ...s, live: [...s.live.filter((l) => l.captainId !== pos.captainId), pos] }));
    }
  });
  liveChannel.subscribe();
}

/**
 * @param scope separate session storage per app, so the admin panel and the
 *              rider/captain app can be signed in side by side in one browser.
 */
export async function initStore(scope: 'app' | 'admin' = 'app') {
  db = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { storageKey: `felsekka-${scope}`, persistSession: true, autoRefreshToken: true },
  });
  db.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
      listen();
      void reload();
    }
  });
  await reload();
  listen();
  // refresh signed document links and catch anything realtime missed
  setInterval(() => void reload(), 5 * 60_000);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void reload());
}
