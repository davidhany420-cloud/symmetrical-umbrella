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

export const BIKE_CLASSES: BikeClass[] = [
  { id: 'scooter', name: 'سكوتر', en: 'SCOOTER', tagline: 'خفيف وسريع في الزحمة', monthly: 900, once: 35, perks: ['خوذة', 'مثالي للمسافات القصيرة'] },
  { id: 'electric', name: 'كهربا', en: 'E-BIKE', tagline: 'هادي وصديق للبيئة', monthly: 1100, once: 40, perks: ['صفر عادم', 'خوذة', 'شاحن موبايل'] },
  { id: 'classic', name: 'كلاسيك', en: 'CLASSIC', tagline: 'مريح للمشاوير الطويلة', monthly: 1300, once: 50, perks: ['مقعد واسع', 'خوذة', 'صندوق شنطة'] },
  { id: 'sport', name: 'سبورت', en: 'SPORT', tagline: 'أسرع وصول للمعاد', monthly: 1600, once: 65, perks: ['كابتن خبرة +3 سنين', 'خوذة بريميوم', 'جاكت حماية'] },
];

export const bikeClass = (id: BikeClassId) => BIKE_CLASSES.find((b) => b.id === id)!;

export const DAYS = ['أحد', 'اتنين', 'تلات', 'أربع', 'خميس', 'جمعة', 'سبت'];
