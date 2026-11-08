import type { BikeClassId } from './types';

/** ⚠️ غيّر البيانات دي ببيانات حسابك الحقيقي قبل الإطلاق */
export const INSTAPAY_HANDLE = 'felsekka@instapay';
export const SUBSCRIPTION_PRICE = 200; // جنيه للسنة
export const SUBSCRIPTION_DAYS = 365;
export const SUPPORT_WHATSAPP = '201000000000';

/* ---------- Google Maps (browser key, restrict it to your site's address in Google Cloud) ---------- */
export const GOOGLE_MAPS_KEY = '';

/* ---------- Supabase (publishable key — safe to ship in the app) ---------- */
export const SUPABASE_URL = 'https://jazgvrvtqahsrgeyufkn.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_z8O8BcmmYyGj5OWUXxFqOA_-wHV-NTK';

/**
 * Supabase accounts need an email. Riders and captains sign in with their phone,
 * so each phone maps to an internal alias on the owner's mailbox (no mail is sent).
 */
const AUTH_MAILBOX = 'shadyhany439@gmail.com';
export const phoneToEmail = (phone: string) => AUTH_MAILBOX.replace('@', `+${phone}@`);
export const ADMIN_EMAIL = AUTH_MAILBOX.replace('@', '+admin@');

export const GOVERNORATES = ['القاهرة', 'الجيزة', 'الإسكندرية', 'القليوبية', 'الشرقية', 'الدقهلية'];

export interface BikeClass {
  id: BikeClassId;
  name: string;
  en: string;
  tagline: string;
  monthly: number;
  once: number;
  perks: string[];
}

/** The one vehicle the app offers. (Older records may still carry other class ids — they all map here.) */
export const MOTO: BikeClass = {
  id: 'scooter',
  name: 'موتوسيكل',
  en: 'MOTO',
  tagline: 'الأسهل · الأقوى · الأسرع',
  monthly: 1100,
  once: 40,
  perks: ['خوذة مع كل مشوار', 'كابتن موثّق', 'أسرع من الزحمة'],
};
export const BIKE_CLASSES: BikeClass[] = [MOTO];

/* ---------- Pricing: fixed per kilometre, no haggling (the server enforces the same rule) ---------- */
/** Used only until the live price loads from the database (app_settings.price_per_km). */
export const DEFAULT_PRICE_PER_KM = 4.5;
/** Monthly subscription = one ride per chosen day for 4 weeks. */
export const WEEKS_PER_MONTH = 4;
export function tripPrice(km: number, type: 'once' | 'monthly', days: number[], perKm: number) {
  // same rounding as the server: whole pounds, rounded up (avoid float noise like 4.5 × 2 = 9.000000001)
  const one = Math.max(Math.ceil(Math.round(km * perKm * 1000) / 1000), 1);
  return type === 'monthly' ? one * Math.max(days.length, 1) * WEEKS_PER_MONTH : one;
}
export const bikeClass = (_id?: BikeClassId) => MOTO;

export const DAYS = ['أحد', 'اتنين', 'تلات', 'أربع', 'خميس', 'جمعة', 'سبت'];
