import { useState } from 'react';
import { Phone, MessageCircle, LocateFixed, ShieldCheck, Share2 } from 'lucide-react';
import { IconBtn, Page, Avatar, TopBar, Pill } from '@/components/ui';
import { LiveMap, useLoopProgress } from '@/components/art';
import { back, go } from '@/lib/router';
import { useStore } from '@/lib/store';
import { num } from '@/lib/format';
import { toast } from '@/lib/toast';

export function Track({ id }: { id: string }) {
  const b = useStore((s) => s.bookings.find((x) => x.id === id));
  const capUser = useStore((s) => s.users.find((u) => u.id === b?.captainId));
  const cap = useStore((s) => s.captains.find((c) => c.userId === b?.captainId));
  const p = useLoopProgress(45);
  const [geo, setGeo] = useState<{ lat: number; lng: number } | 'denied' | 'loading' | null>(null);

  if (!b || !capUser || !cap) return null;
  const eta = Math.max(1, Math.round((1 - p) * 14));
  const km = ((1 - p) * 5.8).toFixed(1);

  const locate = () => {
    if (!navigator.geolocation) return setGeo('denied');
    setGeo('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeo('denied'),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const share = async () => {
    const text = `أنا راكب مع ${capUser.name} (${cap.plate}) من ${b.from} إلى ${b.to} — تطبيق في السكة`;
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

  return (
    <Page className="flex flex-col min-h-dvh md:min-h-[calc(100dvh-48px)]">
      <TopBar title="تتبع مباشر" sub={`${b.from} ← ${b.to}`} onBack={() => back(`/ride/${id}`)} right={<IconBtn onClick={share} aria-label="مشاركة"><Share2 className="size-5" /></IconBtn>} />
      <div className="px-4 flex-1 flex flex-col gap-3 pb-[max(env(safe-area-inset-bottom),16px)]">
        <div className="relative flex-1 min-h-[360px]">
          <LiveMap progress={p} className="absolute inset-0" />
          <div className="absolute top-3 inset-x-3 flex justify-between items-start">
            <Pill tone="acc" className="!bg-bg/70 backdrop-blur">
              <span className="size-1.5 rounded-full bg-acc animate-pulse" /> LIVE
            </Pill>
            <button onClick={locate} className="h-9 px-3 rounded-xl bg-bg/70 backdrop-blur border border-line text-xs flex items-center gap-1.5">
              <LocateFixed className="size-4 text-acc" />
              {geo === 'loading' ? 'بنحدد…' : 'موقعي'}
            </button>
          </div>
          {geo && geo !== 'loading' && (
            <div className="absolute bottom-3 inset-x-3 rounded-xl bg-bg/80 backdrop-blur border border-line px-3 py-2 text-[11px]">
              {geo === 'denied' ? (
                <span className="text-warn">مقدرناش نوصل لموقعك — فعّل صلاحية الموقع من إعدادات المتصفح. التتبع شغال عادي.</span>
              ) : (
                <span className="text-muted" dir="ltr">
                  📍 {geo.lat.toFixed(5)}, {geo.lng.toFixed(5)}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="glass rounded-3xl p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-xs text-muted">الكابتن هيوصل خلال</p>
              <p className="text-3xl font-bold text-grad tabular-nums">
                {num(eta)} <span className="text-base font-normal text-muted">دقيقة</span>
              </p>
            </div>
            <div className="text-left">
              <p className="text-xs text-muted">المسافة</p>
              <p className="text-lg font-semibold tabular-nums" dir="ltr">{km} km</p>
            </div>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-white/8 overflow-hidden" dir="ltr">
            <div className="h-full bg-grad transition-[width] duration-300" style={{ width: `${p * 100}%` }} />
          </div>
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
