import { db, getState, reload, reportError } from './store';
import { normalizeDigits } from './format';
import { ADMIN_EMAIL, phoneToEmail } from './config';
import type { Booking, CaptainProfile, Gender, Line, Mode, Role, User } from './types';

/* ---------------- helpers ---------------- */
export const userById = (id: string) => getState().users.find((u) => u.id === id);
export const captainById = (id: string) => getState().captains.find((c) => c.userId === id);
export const modeOf = (g: Gender): Mode => (g === 'female' ? 'girls' : 'boys');
export const isSubscribed = (c?: CaptainProfile) => !!c?.activeUntil && c.activeUntil > Date.now();
export const canTakeRides = (c?: CaptainProfile) => c?.status === 'approved' && isSubscribed(c);

const ERRORS: [RegExp, string][] = [
  [/already registered|already been registered|duplicate key.*phone/i, 'الرقم ده متسجل قبل كده — جرّب تسجّل دخول'],
  [/invalid login credentials/i, 'رقم الموبايل أو كلمة السر مش صح'],
  [/captain not available/i, 'الكابتن ده مش متاح دلوقتي — اختار كابتن تاني'],
  [/payments_one_pending|duplicate key.*payments/i, 'عندك دفعة لسه بتتراجع'],
  [/same_password|different from the old/i, 'كلمة السر الجديدة لازم تبقى مختلفة عن القديمة'],
  [/weak_password|at least \d+ characters|password should/i, 'كلمة السر الجديدة ضعيفة — خليها 8 حروف أو أكتر'],
  [/price mismatch|distance mismatch/i, 'السعر اتغيّر — ارجع خطوة وجرّب تاني'],
  [/pickup and destination required/i, 'حدد مكان الركوب والوجهة على الخريطة'],
  [/price is fixed/i, 'السعر ثابت — تقدر تقبل أو تعتذر بس'],
  [/rate limit/i, 'محاولات كتير ورا بعض — استنى دقيقة وجرّب تاني'],
  [/failed to fetch|network/i, 'مفيش اتصال بالإنترنت'],
  [/admin only/i, 'العملية دي للأدمن بس'],
  [/not pending|not found/i, 'الطلب ده اتغيّر — حدّث الصفحة'],
];
export function friendly(e: unknown) {
  const msg = (e as { message?: string })?.message ?? String(e);
  return ERRORS.find(([re]) => re.test(msg))?.[1] ?? 'حصلت مشكلة — جرّب تاني';
}

/** Call an RPC, refresh the cache, and surface errors in Arabic. Returns true on success. */
async function call(fn: string, args: Record<string, unknown> = {}) {
  const { error } = await db.rpc(fn, args);
  if (error) {
    reportError(friendly(error));
    return false;
  }
  await reload();
  return true;
}

async function uploadDataUrl(path: string, dataUrl?: string) {
  if (!dataUrl) return null;
  if (!dataUrl.startsWith('data:')) return undefined; // unchanged signed URL — keep existing file
  const blob = await (await fetch(dataUrl)).blob();
  const { error } = await db.storage.from('documents').upload(path, blob, { upsert: true, contentType: blob.type || 'image/jpeg' });
  if (error) throw error;
  return path;
}

/* ---------------- auth ---------------- */
export async function register(input: { role: Role; name: string; phone: string; gender: Gender; password: string }): Promise<User> {
  const phone = normalizeDigits(input.phone).trim();
  const { data, error } = await db.auth.signUp({ email: phoneToEmail(phone), password: input.password });
  if (error) throw new Error(friendly(error));
  const id = data.user?.id;
  if (!id || !data.session) throw new Error('حصلت مشكلة في التسجيل — جرّب تاني');
  const { error: pe } = await db.from('profiles').insert({ id, role: input.role, name: input.name.trim(), phone, gender: input.gender });
  if (pe) {
    await db.auth.signOut();
    throw new Error(friendly(pe));
  }
  await reload();
  return userById(id)!;
}

export async function login(phoneRaw: string, password: string): Promise<User> {
  const phone = normalizeDigits(phoneRaw).trim();
  const { data, error } = await db.auth.signInWithPassword({ email: phoneToEmail(phone), password });
  if (error) throw new Error(friendly(error));
  await reload();
  const u = userById(data.user.id);
  if (!u) {
    await db.auth.signOut();
    throw new Error('الحساب ده مش متسجل كراكب أو كابتن');
  }
  return u;
}

export const logout = async () => {
  await db.auth.signOut();
  await reload();
};

/* ---------------- admin auth ---------------- */
export async function adminExists() {
  const { data } = await db.rpc('admin_exists');
  return data === true;
}

export async function setupAdmin(password: string) {
  const { error } = await db.auth.signUp({ email: ADMIN_EMAIL, password });
  if (error && !/already/i.test(error.message)) throw new Error(friendly(error));
  if (error) await adminLogin(password);
  const { data, error: ce } = await db.rpc('claim_admin');
  if (ce || data !== true) {
    await db.auth.signOut();
    throw new Error('فيه أدمن متسجل بالفعل');
  }
  await reload();
}

export async function adminLogin(password: string) {
  const { error } = await db.auth.signInWithPassword({ email: ADMIN_EMAIL, password });
  if (error) throw new Error(/invalid/i.test(error.message) ? 'كلمة السر غلط' : friendly(error));
  const { data } = await db.rpc('is_admin');
  if (data !== true) {
    await db.auth.signOut();
    throw new Error('الحساب ده مش أدمن');
  }
  await reload();
}

export const adminSignOut = logout;

export async function changeAdminPassword(current: string, next: string) {
  await adminLogin(current);
  const { error } = await db.auth.updateUser({ password: next });
  if (error) throw new Error(friendly(error));
}

/* ---------------- captain ---------------- */
export async function submitCaptainProfile(p: Pick<CaptainProfile, 'userId' | 'bikeClass' | 'bikeModel' | 'plate' | 'governorate' | 'nationalId' | 'photo' | 'idPhoto' | 'licensePhoto' | 'bikePhoto'>) {
  try {
    const dir = p.userId;
    const t = Date.now();
    const [photo, id, license, bike] = await Promise.all([
      uploadDataUrl(`${dir}/photo-${t}.jpg`, p.photo),
      uploadDataUrl(`${dir}/id-${t}.jpg`, p.idPhoto),
      uploadDataUrl(`${dir}/license-${t}.jpg`, p.licensePhoto),
      uploadDataUrl(`${dir}/bike-${t}.jpg`, p.bikePhoto),
    ]);
    return await call('submit_application', {
      p_bike_class: p.bikeClass,
      p_bike_model: p.bikeModel,
      p_plate: p.plate,
      p_governorate: p.governorate,
      p_national_id: p.nationalId,
      p_photo_path: photo,
      p_id_path: id,
      p_license_path: license,
      p_bike_path: bike,
    });
  } catch (e) {
    reportError(friendly(e));
    return false;
  }
}

export const setOnline = (_userId: string, online: boolean) => call('set_online', { p_online: online });

export async function submitPayment(userId: string, ref: string, receipt?: string) {
  try {
    const path = await uploadDataUrl(`${userId}/receipt-${Date.now()}.jpg`, receipt);
    return await call('submit_payment', { p_ref: ref, p_receipt_path: path ?? null });
  } catch (e) {
    reportError(friendly(e));
    return false;
  }
}

/* ---------------- admin actions ---------------- */
export const reviewCaptain = (userId: string, approve: boolean, reason?: string) => call('admin_review_captain', { p_user: userId, p_approve: approve, p_reason: reason ?? null });
export const grantSubscription = (userId: string, days: number) => call('admin_grant_subscription', { p_user: userId, p_days: days });
export const suspendCaptain = (userId: string, suspend: boolean, reason?: string) => call('admin_suspend_captain', { p_user: userId, p_suspend: suspend, p_reason: reason ?? null });
export async function reviewPayment(userId: string, approve: boolean) {
  const id = captainById(userId)?.pendingPayment?.id;
  if (!id) return false;
  return call('admin_review_payment', { p_payment: id, p_approve: approve });
}

export async function saveLine(line: Line) {
  const row = { name: line.name, governorate: line.governorate, from_place: line.from, to_place: line.to, time: line.time, price: line.price, active: line.active };
  const exists = getState().lines.some((l) => l.id === line.id);
  const { error } = exists ? await db.from('lines').update(row).eq('id', line.id) : await db.from('lines').insert(row);
  if (error) return reportError(friendly(error)), false;
  await reload();
  return true;
}
export async function deleteLine(id: string) {
  const { error } = await db.from('lines').delete().eq('id', id);
  if (error) return reportError(friendly(error)), false;
  await reload();
  return true;
}

/* ---------------- bookings ---------------- */
export function eligibleCaptains(mode: Mode) {
  const wanted: Gender = mode === 'girls' ? 'female' : 'male';
  return getState()
    .captains.filter((c) => canTakeRides(c) && userById(c.userId)?.gender === wanted)
    .sort((a, b) => Number(b.online) - Number(a.online) || b.rating - a.rating);
}

export async function createBooking(input: Omit<Booking, 'id' | 'status' | 'createdAt' | 'messages' | 'clientId' | 'mode'>): Promise<string | null> {
  const { data, error } = await db.rpc('create_booking', {
    p_captain: input.captainId,
    p_type: input.type,
    p_from: input.from,
    p_to: input.to,
    p_time: input.time,
    p_days: input.days,
    p_bike_class: input.bikeClass,
    p_offer: input.offer,
    p_from_lat: input.fromLat ?? null,
    p_from_lng: input.fromLng ?? null,
    p_to_lat: input.toLat ?? null,
    p_to_lng: input.toLng ?? null,
    p_distance_km: input.distanceKm ?? null,
  });
  if (error) {
    reportError(friendly(error));
    return null;
  }
  await reload();
  return data as string;
}

export const captainRespond = (id: string, action: 'accept' | 'reject') => call('captain_respond', { p_booking: id, p_action: action });
export const clientAnswerCounter = (id: string, accept: boolean) => call('client_answer_counter', { p_booking: id, p_accept: accept });
export const cancelBooking = (id: string) => call('cancel_booking', { p_booking: id });
export const completeBooking = (id: string, rating: number) => call('complete_booking', { p_booking: id, p_rating: rating });
export const sendMessage = (id: string, _from: 'client' | 'captain', text: string) => (text.trim() ? call('send_message', { p_booking: id, p_text: text.trim() }) : Promise.resolve(false));

/* ---------------- live location ---------------- */
export async function pushLocation(lat: number, lng: number, heading?: number | null, speed?: number | null) {
  const { error } = await db.rpc('update_location', { p_lat: lat, p_lng: lng, p_heading: heading ?? null, p_speed: speed ?? null });
  return !error;
}
export async function stopLocation() {
  await db.rpc('stop_location');
}

/** Distance in km between two points (haversine). */
export function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** How far riders can see captains (km). */
export const NEARBY_KM = 20;
/** A position older than this is treated as unknown. */
export const FRESH_MS = 3 * 60_000;

/** Captains that can take this ride, nearest first, with distance to the pickup point. */
export function nearbyCaptains(mode: Mode, pickup?: { lat: number; lng: number }) {
  const all = eligibleCaptains(mode);
  if (!pickup) return all.map((c) => ({ c, dist: null as number | null }));
  const now = Date.now();
  const live = getState().live;
  return all
    .map((c) => {
      const p = live.find((l) => l.captainId === c.userId && now - l.at < FRESH_MS);
      return { c, dist: p ? km(p, pickup) : null };
    })
    .filter((x): x is { c: CaptainProfile; dist: number } => x.dist !== null && x.dist <= NEARBY_KM)
    .sort((a, b) => a.dist - b.dist);
}

/** Opens turn-by-turn directions in the Google Maps app / site. */
export const directionsUrl = (lat: number, lng: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;

/* ---------------- notices ---------------- */
export async function markNoticesRead(_to: string) {
  if (!getState().notices.some((n) => !n.read)) return;
  await call('mark_notices_read');
}

