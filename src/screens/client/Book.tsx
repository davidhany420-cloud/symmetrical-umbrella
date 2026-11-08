import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { MapPin, Flag, Clock3, Check, UserX, Send, Zap, Lock } from 'lucide-react';
import { Button, Field, Page, Segmented, TopBar, Empty, Pill, cx } from '@/components/ui';
import { MotoArt } from '@/components/art';
import { CaptainRow, RouteLine } from '@/components/shared';
import { back, go, useRoute } from '@/lib/router';
import { getState, useStore } from '@/lib/store';
import { DAYS, MOTO, PRICE_PER_KM, WEEKS_PER_MONTH, tripPrice } from '@/lib/config';
import { roadKm } from '@/lib/route';
import { egp } from '@/lib/format';
import { NEARBY_KM, createBooking, modeOf, nearbyCaptains, userById } from '@/lib/actions';
import { toast } from '@/lib/toast';
import type { BookingType, Place, User } from '@/lib/types';
import { MapView, PlaceField } from '@/components/maps';
import { mapsEnabled } from '@/lib/maps';

const STEPS = ['المشوار', 'الكابتن', 'السعر'];

export function Book({ user }: { user: User }) {
  const { query } = useRoute();
  const line = useStore((s) => s.lines.find((l) => l.id === query.get('line')));
  const mode = modeOf(user.gender);

  const [step, setStep] = useState(0);
  const [type, setType] = useState<BookingType>(line ? 'monthly' : 'once');
  const [from, setFrom] = useState<Place>({ label: line?.from ?? '' });
  const [to, setTo] = useState<Place>({ label: line?.to ?? '' });
  const [time, setTime] = useState(line?.time ?? '08:00');
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [captainId, setCaptainId] = useState<string | null>(null);

  // fixed price: road distance × PRICE_PER_KM (no haggling)
  const [route, setRoute] = useState<{ km: number; minutes: number | null; estimated: boolean } | null>(null);
  const [measuring, setMeasuring] = useState(false);
  useEffect(() => {
    setRoute(null);
    if (from.lat === undefined || to.lat === undefined) return;
    let alive = true;
    setMeasuring(true);
    void roadKm({ lat: from.lat, lng: from.lng! }, { lat: to.lat, lng: to.lng! }).then((r) => {
      if (!alive) return;
      setRoute(r);
      setMeasuring(false);
    });
    return () => {
      alive = false;
    };
  }, [from.lat, from.lng, to.lat, to.lng]);
  const price = route ? tripPrice(route.km, type, days) : 0;

  // nearest available captains to the pickup point; re-evaluated whenever captains or positions change
  const captainsVersion = useStore((s) => s.captains);
  const liveVersion = useStore((s) => s.live);
  const pickup = from.lat !== undefined ? { lat: from.lat, lng: from.lng! } : undefined;
  const captains = useMemo(() => nearbyCaptains(mode, pickup), [mode, captainsVersion, liveVersion, pickup?.lat, pickup?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const canNext = [!!route && (type === 'once' || days.length > 0), !!captainId, !!route][step];

  const [sending, setSending] = useState(false);
  const next = async () => {
    if (step < 2) {
      if (step === 0) setCaptainId(null);
      setStep(step + 1);
      return;
    }
    setSending(true);
    const id = await createBooking({
      captainId: captainId!,
      type,
      from: from.label.trim(),
      to: to.label.trim(),
      time,
      days: type === 'monthly' ? days : [],
      bikeClass: captains.find((x) => x.c.userId === captainId)?.c.bikeClass ?? MOTO.id,
      offer: price,
      distanceKm: route!.km,
      fromLat: from.lat,
      fromLng: from.lng,
      toLat: to.lat,
      toLng: to.lng,
    });
    setSending(false);
    if (!id) return;
    toast('اتبعت طلبك للكابتن ⚡');
    go(`/ride/${id}`, true);
  };


  return (
    <Page className="flex flex-col min-h-dvh md:min-h-[calc(100dvh-48px)]">
      <TopBar title={type === 'monthly' ? 'اشتراك شهري' : 'مشوار جديد'} sub={`خطوة ${step + 1} من ${STEPS.length} · ${STEPS[step]}`} onBack={() => (step ? setStep(step - 1) : back('/home'))} />
      <div className="px-5">
        <div className="flex gap-1.5">
          {STEPS.map((s, i) => (
            <div key={s} className="h-1 flex-1 rounded-full bg-white/8 overflow-hidden">
              <motion.div className="h-full bg-grad" initial={false} animate={{ width: i <= step ? '100%' : '0%' }} />
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 px-5 pt-6 pb-4">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.22 }} className="space-y-4">
            {step === 0 && (
              <>
                <div className="relative overflow-hidden rounded-3xl glass p-4 flex items-center gap-3">
                  <div className="absolute -left-10 top-1/2 -translate-y-1/2 size-40 rounded-full bg-acc/15 blur-2xl" />
                  <div className="relative flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg">{MOTO.name}</span>
                      <span className="text-[9px] tracking-[0.3em] text-muted" dir="ltr">{MOTO.en}</span>
                    </div>
                    <p className="text-xs text-acc mt-1 flex items-center gap-1">
                      <Zap className="size-3.5" /> {MOTO.tagline}
                    </p>
                  </div>
                  <MotoArt className="relative w-36 h-auto shrink-0 -my-2" />
                </div>
                <Segmented value={type} onChange={setType} options={[{ value: 'once', label: 'مشوار واحد' }, { value: 'monthly', label: 'اشتراك شهري' }]} />
                <PlaceField label="من" icon={<MapPin />} value={from} onChange={setFrom} placeholder="مكان الركوب — ابحث أو دوس موقعي" />
                {from.label.trim().length > 1 && from.lat === undefined && (
                  <p className="text-[11px] text-warn px-1 -mt-2">اختار مكان الركوب من الاقتراحات أو دوس "موقعي" — علشان نوريك أقرب كابتن</p>
                )}
                <PlaceField label="إلى" icon={<Flag />} value={to} onChange={setTo} placeholder="الوجهة — جامعة، شغل، درس…" near={from.lat !== undefined ? { lat: from.lat, lng: from.lng! } : undefined} />
                {mapsEnabled() && (from.lat !== undefined || to.lat !== undefined) && (
                  <MapView
                    className="h-48"
                    points={[
                      ...(from.lat !== undefined ? [{ id: 'from', kind: 'pickup' as const, lat: from.lat, lng: from.lng! }] : []),
                      ...(to.lat !== undefined ? [{ id: 'to', kind: 'drop' as const, lat: to.lat, lng: to.lng! }] : []),
                    ]}
                  />
                )}
                {to.label.trim().length > 1 && to.lat === undefined && (
                  <p className="text-[11px] text-warn px-1 -mt-2">اختار الوجهة من الاقتراحات علشان نحسب المسافة والسعر</p>
                )}
                {(measuring || route) && (
                  <div className="flex items-center justify-between rounded-2xl bg-acc/[.07] border border-acc/25 px-4 h-14">
                    <span className="text-sm text-muted">{measuring ? 'بنحسب المسافة…' : `${route!.km.toFixed(1)} كم${route!.minutes ? ` · حوالي ${route!.minutes} دقيقة` : ''}`}</span>
                    {route && <span className="text-lg font-bold text-grad tabular-nums">{egp(tripPrice(route.km, 'once', []))}</span>}
                  </div>
                )}
                <Field label={type === 'monthly' ? 'معاد التحرك كل يوم' : 'معاد التحرك'} icon={<Clock3 />} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                {type === 'monthly' && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-muted px-1">أيام الاشتراك</span>
                    <div className="grid grid-cols-7 gap-1.5">
                      {DAYS.map((d, i) => (
                        <button key={d} type="button" onClick={() => setDays((x) => (x.includes(i) ? x.filter((y) => y !== i) : [...x, i].sort()))} className={cx('h-11 rounded-xl text-[11px] font-medium transition', days.includes(i) ? 'bg-grad text-acc-ink' : 'glass text-muted')}>
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {line && <Pill tone="acc">خط ثابت: {line.name}</Pill>}
              </>
            )}


            {step === 1 &&
              (captains.length ? (
                <>
                  <p className="text-xs text-muted px-1">
                    {pickup ? `الأقرب ليك الأول — في حدود ${NEARBY_KM} كم` : mode === 'girls' ? 'كابتنات بنات موثّقات — اختاري واحدة' : 'كباتن موثّقين — اختار واحد'}
                  </p>
                  {captains.map(({ c, dist }) => {
                    const u = userById(c.userId)!;
                    return (
                      <CaptainRow
                        key={c.userId}
                        user={u}
                        cap={c}
                        selected={captainId === c.userId}
                        onClick={() => setCaptainId(c.userId)}
                        right={
                          <div className="flex flex-col items-end gap-1.5">
                            <span className={cx('size-6 rounded-full border-2 grid place-items-center', captainId === c.userId ? 'border-acc bg-acc text-acc-ink' : 'border-white/20')}>{captainId === c.userId && <Check className="size-3.5" />}</span>
                            {dist !== null && (
                              <span className="text-[11px] text-acc whitespace-nowrap tabular-nums">
                                {dist < 1 ? `${Math.round(dist * 1000)} م` : `${dist.toFixed(1)} كم`} · {Math.max(1, Math.round((dist / 25) * 60))} د
                              </span>
                            )}
                          </div>
                        }
                      />
                    );
                  })}
                </>
              ) : (
                <Empty
                  icon={<UserX />}
                  title={pickup ? 'مفيش كباتن قريبين منك دلوقتي' : 'مفيش كباتن متاحين دلوقتي'}
                  sub={pickup ? `مفيش كابتن أونلاين في حدود ${NEARBY_KM} كم من مكان الركوب — جرّب كمان شوية` : 'جرّب كمان شوية'}
                  action={<Button variant="soft" size="sm" onClick={() => setStep(0)}>رجوع</Button>}
                />
              ))}

            {step === 2 && (
              <>
                <div className="glass rounded-3xl p-5 text-center">
                  <p className="text-xs text-muted">سعر {type === 'monthly' ? 'الاشتراك الشهري' : 'المشوار'}</p>
                  <div className="mt-2 text-5xl font-bold text-grad tabular-nums">
                    {price}
                    <span className="text-lg text-muted font-normal"> ج</span>
                  </div>
                  {route && (
                    <p className="mt-3 text-sm text-muted tabular-nums">
                      {route.km.toFixed(1)} كم × {PRICE_PER_KM} ج للكيلو
                      {type === 'monthly' && ` × ${days.length} يوم × ${WEEKS_PER_MONTH} أسابيع`}
                    </p>
                  )}
                  <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-ok">
                    <Lock className="size-3.5" /> سعر ثابت — من غير فصال
                  </p>
                </div>
                <div className="glass rounded-3xl p-4 space-y-3">
                  <RouteLine from={from.label} to={to.label} compact />
                  <div className="h-px bg-line" />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">الكابتن</span>
                    <span>{captainId && getState().users.find((u) => u.id === captainId)?.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">الموتوسيكل</span>
                    <span>{MOTO.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">المعاد</span>
                    <span>
                      {time}
                      {type === 'monthly' && ` · ${days.map((d) => DAYS[d]).join('، ')}`}
                    </span>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="sticky bottom-0 px-5 pt-3 pb-[max(env(safe-area-inset-bottom),18px)] bg-gradient-to-t from-bg via-bg to-transparent">
        <Button size="lg" className="w-full" disabled={!canNext} loading={sending} onClick={next} icon={step === 2 ? <Send className="size-5 -scale-x-100" /> : undefined}>
          {step === 2 ? `اطلب الكابتن · ${egp(price)}` : 'التالي'}
        </Button>
      </div>
    </Page>
  );
}
