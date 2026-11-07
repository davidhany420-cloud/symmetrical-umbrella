import { ArrowLeft, Bell, MapPin, Navigation, Clock3, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { Card, IconBtn, Page, Pill, SectionTitle } from '@/components/ui';
import { BikeArt, Logo } from '@/components/art';
import { RouteLine, StatusPill, useUnread } from '@/components/shared';
import { go } from '@/lib/router';
import { useStore } from '@/lib/store';
import { BIKE_CLASSES } from '@/lib/config';
import { egp } from '@/lib/format';
import { modeOf } from '@/lib/actions';
import type { User } from '@/lib/types';

const greet = () => {
  const h = new Date().getHours();
  return h < 12 ? 'صباح الفل' : h < 18 ? 'نهارك سعيد' : 'مساء الخير';
};

export function Home({ user }: { user: User }) {
  const unread = useUnread(user.id);
  const lines = useStore((s) => s.lines.filter((l) => l.active));
  const live = useStore((s) => s.bookings.find((b) => b.clientId === user.id && ['accepted', 'pending', 'countered'].includes(b.status)));
  const girls = modeOf(user.gender) === 'girls';

  return (
    <Page className="px-5 pt-[max(env(safe-area-inset-top),18px)] pb-6 space-y-6">
      <header className="flex items-center gap-3">
        <Logo size={44} />
        <div className="flex-1">
          <p className="text-xs text-muted">{greet()}</p>
          <p className="text-lg font-semibold">{user.name} 👋</p>
        </div>
        <IconBtn onClick={() => go('/alerts')} aria-label="التنبيهات">
          <Bell className="size-5" />
          {!!unread && <span className="absolute top-2.5 right-2.5 size-2 rounded-full bg-danger" />}
        </IconBtn>
      </header>

      {/* where to */}
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={() => go('/book')}
        className="relative w-full text-right rounded-[30px] overflow-hidden p-5 bg-grad text-acc-ink glow"
      >
        <div className="absolute inset-0 grid-bg opacity-40" />
        <div className="relative">
          <Pill className="!bg-black/15 !text-acc-ink !border-black/10">
            <Sparkles className="size-3" /> {girls ? 'سكة البنات' : 'سكة الشباب'}
          </Pill>
          <h2 className="mt-3 text-2xl font-bold leading-snug">رايح فين النهارده؟</h2>
          <p className="mt-1 text-sm opacity-75">اشتراك شهري أو مشوار واحد — إنت اللي تحدد السعر</p>
          <div className="mt-4 flex items-center gap-3 h-12 px-4 rounded-2xl bg-black/20 backdrop-blur">
            <MapPin className="size-5" />
            <span className="flex-1 text-sm opacity-80">اكتب وجهتك…</span>
            <ArrowLeft className="size-5" />
          </div>
        </div>
        <BikeArt kind={girls ? 'electric' : 'sport'} className="absolute -left-8 -top-3 w-44 opacity-25 [--acc:#000] [--acc-2:#000]" />
      </motion.button>

      {live && (
        <Card onClick={() => go(`/ride/${live.id}`)} className="!p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-muted flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-acc animate-pulse" /> مشوارك الحالي
            </span>
            <StatusPill s={live.status} />
          </div>
          <RouteLine from={live.from} to={live.to} compact />
          {live.status === 'accepted' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                go(`/ride/${live.id}/track`);
              }}
              className="mt-4 w-full h-11 rounded-2xl bg-acc/12 text-acc border border-acc/25 text-sm font-medium flex items-center justify-center gap-2"
            >
              <Navigation className="size-4" /> تتبع الكابتن مباشر
            </button>
          )}
        </Card>
      )}

      {/* fixed lines */}
      <section>
        <SectionTitle action={<span className="text-[11px] text-muted">اشتراك شهري</span>}>خطوط ثابتة قريبة منك</SectionTitle>
        <div className="-mx-5 px-5 flex gap-3 overflow-x-auto snap-x pb-1">
          {lines.map((l) => (
            <button key={l.id} onClick={() => go(`/book?line=${l.id}`)} className="snap-start shrink-0 w-[230px] text-right glass rounded-3xl p-4 hover:bg-surface-2 transition">
              <div className="flex items-center justify-between">
                <Pill tone="muted">{l.governorate}</Pill>
                <span className="text-[11px] text-muted inline-flex items-center gap-1">
                  <Clock3 className="size-3" /> {l.time}
                </span>
              </div>
              <div className="mt-3">
                <RouteLine from={l.from} to={l.to} compact />
              </div>
              <div className="mt-3 flex items-end justify-between">
                <span className="text-[11px] text-muted">من</span>
                <span className="text-lg font-semibold text-grad">{egp(l.price)}<span className="text-[11px] text-muted font-normal"> /شهر</span></span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* fleet */}
      <section>
        <SectionTitle>الأسطول</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          {BIKE_CLASSES.map((b) => (
            <button key={b.id} onClick={() => go(`/book?bike=${b.id}`)} className="text-right glass rounded-3xl p-3.5 hover:bg-surface-2 transition">
              <BikeArt kind={b.id} className="w-full h-16" />
              <div className="mt-2 flex items-center justify-between">
                <span className="font-semibold">{b.name}</span>
                <span className="text-[9px] tracking-widest text-muted" dir="ltr">{b.en}</span>
              </div>
              <p className="text-[11px] text-muted mt-0.5">{b.tagline}</p>
              <p className="text-xs mt-2">
                <span className="text-acc font-semibold">{egp(b.once)}</span>
                <span className="text-muted"> للمشوار</span>
              </p>
            </button>
          ))}
        </div>
      </section>
    </Page>
  );
}
