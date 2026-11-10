import { useEffect, useRef, useState } from 'react';
import { Phone, MessageCircle, ShieldCheck, Share2, Radio, Navigation } from 'lucide-react';
import { IconBtn, Page, Avatar, TopBar, Pill } from '@/components/ui';
import { LiveMap, useLoopProgress } from '@/components/art';
import { MapView, type MapPoint } from '@/components/maps';
import { back, go } from '@/lib/router';
import { useStore } from '@/lib/store';
import { num, timeAgo } from '@/lib/format';
import { km } from '@/lib/actions';
import { mapsEnabled } from '@/lib/maps';
import { toast } from '@/lib/toast';
import type { LivePos } from '@/lib/types';

const AVG_KMH = 25; // typical motorbike speed in Cairo traffic

function useNow(everyMs = 15000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

/** Current speed in km/h — reported by the captain's phone, or derived from consecutive positions. */
function useSpeed(live?: LivePos) {
  const prev = useRef<LivePos | null>(null);
  const [kmh, setKmh] = useState<number | null>(null);
  useEffect(() => {
    if (!live) return;
    if (live.speed !== undefined && live.speed !== null && live.speed >= 0) {
      setKmh(live.speed * 3.6);
    } else if (prev.current && live.at > prev.current.at) {
      const hours = (live.at - prev.current.at) / 3_600_000;
      const v = km(prev.current, live) / hours;
      if (v < 150) setKmh(v); // ignore GPS jumps
    }
    prev.current = live;
  }, [live]);
  return kmh;
}

export function Track({ id }: { id: string }) {
  const b = useStore((s) => s.bookings.find((x) => x.id === id));
  const capUser = useStore((s) => s.users.find((u) => u.id === b?.captainId));
  const cap = useStore((s) => s.captains.find((c) => c.userId === b?.captainId));
  const live = useStore((s) => s.live.find((l) => l.captainId === b?.captainId));
  const now = useNow();
  const sim = useLoopProgress(45);
  // speed: from the phone when it reports it, otherwise from the last two positions
  const speedKmh = useSpeed(live);

  if (!b || !capUser || !cap) return null;

  const fresh = !!live && now - live.at < 2 * 60_000;
  const pickup = b.fromLat !== undefined ? { lat: b.fromLat, lng: b.fromLng! } : null;
  const drop = b.toLat !== undefined ? { lat: b.toLat, lng: b.toLng! } : null;

  // heading to the rider until close to the pickup point, then to the destination
  let phase: 'coming' | 'riding' | null = null;
  let dist: number | null = null;
  // the captain's own progress wins over distance guesses
  if (fresh && live) {
    if (b.stage === 'started' && drop) {
      phase = 'riding';
      dist = km(live, drop);
    } else if (pickup && b.stage !== 'arrived' && km(live, pickup) > 0.15) {
      phase = 'coming';
      dist = km(live, pickup);
    } else if (drop) {
      phase = 'riding';
      dist = km(live, drop);
    }
  }
  const eta = dist !== null ? Math.max(1, Math.round((dist / Math.max(AVG_KMH, speedKmh ?? 0)) * 60)) : null;

  const points: MapPoint[] = [
    ...(pickup ? [{ id: 'pickup', kind: 'pickup' as const, ...pickup, title: b.from }] : []),
    ...(drop ? [{ id: 'drop', kind: 'drop' as const, ...drop, title: b.to }] : []),
    ...(live ? [{ id: 'captain', kind: 'captain' as const, lat: live.lat, lng: live.lng, heading: live.heading, title: capUser.name }] : []),
  ];

  const share = async () => {
    const where = live ? ` — مكان الكابتن: https://maps.google.com/?q=${live.lat},${live.lng}` : '';
    const text = `أنا راكب مع ${capUser.name} (${cap.plate}) من ${b.from} إلى ${b.to} — تطبيق في السكة${where}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast('اتنسخت تفاصيل المشوار — ابعتها لأهلك');
      }
    } catch {
      /* user cancelled */
    }
  };

  const realMap = mapsEnabled();

  return (
    <Page className="flex flex-col min-h-dvh md:min-h-[calc(100dvh-48px)]">
      <TopBar
        title="تتبع مباشر"
        sub={`${b.from} ← ${b.to}`}
        onBack={() => back(`/ride/${id}`)}
        right={
          <IconBtn onClick={share} aria-label="مشاركة">
            <Share2 className="size-5" />
          </IconBtn>
        }
      />
      <div className="px-4 flex-1 flex flex-col gap-3 pb-[max(var(--sab),16px)]">
        <div className="relative flex-1 min-h-[360px]">
          <MapView points={points} follow={fresh ? 'captain' : undefined} className="absolute inset-0" fallback={<LiveMap progress={sim} className="absolute inset-0" />} />
          <div className="absolute top-3 inset-x-3 flex justify-between items-start pointer-events-none">
            {fresh ? (
              <Pill tone="acc" className="!bg-bg/80 backdrop-blur">
                <span className="size-1.5 rounded-full bg-acc animate-pulse" /> LIVE
              </Pill>
            ) : (
              <Pill tone="muted" className="!bg-bg/80 backdrop-blur">
                {live ? `آخر تحديث ${timeAgo(live.at)}` : realMap ? 'مستنيين موقع الكابتن' : 'معاينة'}
              </Pill>
            )}
          </div>
          {!fresh && (
            <div className="absolute bottom-3 inset-x-3 rounded-xl bg-bg/85 backdrop-blur border border-line px-3 py-2.5 text-xs flex items-center gap-2">
              <Radio className="size-4 text-warn shrink-0" />
              <span className="text-muted">الكابتن لسه ما فعّلش مشاركة موقعه — أول ما يبدأ هتشوفه بيتحرك هنا.</span>
            </div>
          )}
        </div>

        <div className="glass rounded-3xl p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-xs text-muted">{phase === 'riding' ? 'هتوصل خلال' : 'الكابتن هيوصلك خلال'}</p>
              <p className="text-3xl font-bold text-grad tabular-nums">
                {eta !== null ? num(eta) : '—'} <span className="text-base font-normal text-muted">دقيقة</span>
              </p>
            </div>
            <div className="text-left">
              <p className="text-xs text-muted">المسافة</p>
              <p className="text-lg font-semibold tabular-nums" dir="ltr">
                {dist !== null ? `${dist.toFixed(1)} km` : '—'}
              </p>
            </div>
            <div className="text-left">
              <p className="text-xs text-muted">السرعة</p>
              <p className="text-lg font-semibold tabular-nums" dir="ltr">
                {fresh && speedKmh !== null ? `${Math.round(speedKmh)}` : '—'} <span className="text-xs font-normal text-muted">km/h</span>
              </p>
            </div>
          </div>
          {phase && (
            <p className="mt-2 text-xs text-acc flex items-center gap-1.5">
              <Navigation className="size-3.5" /> {phase === 'coming' ? 'الكابتن في الطريق لمكان الركوب' : 'في الطريق للوجهة'}
            </p>
          )}
          <div className="mt-4 flex items-center gap-3">
            <Avatar name={capUser.name} src={cap.photo} size={46} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold flex items-center gap-1">
                {capUser.name} <ShieldCheck className="size-4 text-acc" />
              </p>
              <p className="text-xs text-muted truncate">
                {cap.bikeModel} · <span dir="ltr">{cap.plate}</span>
              </p>
            </div>
            <a href={`tel:${capUser.phone}`} className="size-11 rounded-2xl glass grid place-items-center" aria-label="اتصال">
              <Phone className="size-5" />
            </a>
            <button onClick={() => go(`/ride/${id}/chat`)} className="size-11 rounded-2xl bg-acc/15 text-acc grid place-items-center" aria-label="شات">
              <MessageCircle className="size-5" />
            </button>
          </div>
        </div>
      </div>
    </Page>
  );
}
