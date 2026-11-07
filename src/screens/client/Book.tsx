import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { MapPin, Flag, Clock3, Minus, Plus, Check, UserX, Send } from 'lucide-react';
import { Button, Field, Page, Segmented, TopBar, Empty, Pill, cx } from '@/components/ui';
import { BikeArt } from '@/components/art';
import { CaptainRow, RouteLine } from '@/components/shared';
import { back, go, useRoute } from '@/lib/router';
import { getState, useStore } from '@/lib/store';
import { BIKE_CLASSES, DAYS, bikeClass } from '@/lib/config';
import { egp } from '@/lib/format';
import { createBooking, eligibleCaptains, modeOf, userById } from '@/lib/actions';
import { toast } from '@/lib/toast';
import type { BikeClassId, BookingType, User } from '@/lib/types';

const STEPS = ['المشوار', 'الموتوسيكل', 'الكابتن', 'السعر'];

export function Book({ user }: { user: User }) {
  const { query } = useRoute();
  const line = useStore((s) => s.lines.find((l) => l.id === query.get('line')));
  const mode = modeOf(user.gender);

  const [step, setStep] = useState(0);
  const [type, setType] = useState<BookingType>(line ? 'monthly' : 'once');
  const [from, setFrom] = useState(line?.from ?? '');
  const [to, setTo] = useState(line?.to ?? '');
  const [time, setTime] = useState(line?.time ?? '08:00');
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [bike, setBike] = useState<BikeClassId>((query.get('bike') as BikeClassId) || 'scooter');
  const [captainId, setCaptainId] = useState<string | null>(null);

  const base = line && type === 'monthly' ? line.price : type === 'monthly' ? bikeClass(bike).monthly : bikeClass(bike).once;
  const stepSize = type === 'monthly' ? 50 : 5;
  const [offer, setOffer] = useState<number | null>(null);
  const price = offer ?? base;
  const min = Math.round((base * 0.6) / stepSize) * stepSize;
  const max = Math.round((base * 1.4) / stepSize) * stepSize;

  // re-evaluated whenever captains change
  const captainsVersion = useStore((s) => s.captains);
  const captains = useMemo(() => eligibleCaptains(mode, bike), [mode, bike, captainsVersion]);

  const canNext = [from.trim().length > 1 && to.trim().length > 1 && (type === 'once' || days.length > 0), true, !!captainId, true][step];

  const [sending, setSending] = useState(false);
  const next = async () => {
    if (step < 3) {
      if (step === 1) setCaptainId(null);
      if (step === 2) setOffer(null);
      setStep(step + 1);
      return;
    }
    setSending(true);
    const id = await createBooking({ captainId: captainId!, type, from: from.trim(), to: to.trim(), time, days: type === 'monthly' ? days : [], bikeClass: bike, offer: price });
    setSending(false);
    if (!id) return;
    toast('اتبعت طلبك للكابتن ⚡');
    go(`/ride/${id}`, true);
  };

  const hint = price >= base ? 'سعر عادل — فرصة قبول عالية' : price >= base * 0.85 ? 'ممكن الكابتن يقبل أو يقترح سعر' : 'سعر قليل — غالباً هيقترح سعر تاني';

  return (
    <Page className="flex flex-col min-h-dvh md:min-h-[calc(100dvh-48px)]">
      <TopBar title={type === 'monthly' ? 'اشتراك شهري' : 'مشوار جديد'} sub={`خطوة ${step + 1} من 4 · ${STEPS[step]}`} onBack={() => (step ? setStep(step - 1) : back('/home'))} />
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
                <Segmented value={type} onChange={(v) => { setType(v); setOffer(null); }} options={[{ value: 'once', label: 'مشوار واحد' }, { value: 'monthly', label: 'اشتراك شهري' }]} />
                <Field label="من" icon={<MapPin />} value={from} onChange={(e) => setFrom(e.target.value)} placeholder="نقطة التحرك — الحي / الشارع" />
                <Field label="إلى" icon={<Flag />} value={to} onChange={(e) => setTo(e.target.value)} placeholder="الوجهة — جامعة، شغل، درس…" />
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
              BIKE_CLASSES.map((b) => {
                const n = eligibleCaptains(mode, b.id).length;
                return (
                  <button key={b.id} onClick={() => { setBike(b.id); setOffer(null); }} className={cx('w-full text-right glass rounded-3xl p-4 flex items-center gap-4 transition', bike === b.id && 'border-acc! bg-acc/8')}>
                    <BikeArt kind={b.id} className="w-28 h-16 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{b.name}</span>
                        {bike === b.id && <Check className="size-4 text-acc" />}
                      </div>
                      <p className="text-xs text-muted mt-0.5">{b.tagline}</p>
                      <p className="text-[11px] text-muted mt-1.5">{n ? `${n} كابتن متاح` : 'مفيش كباتن متاحين دلوقتي'}</p>
                    </div>
                    <div className="text-left">
                      <div className="font-semibold">{egp(type === 'monthly' ? b.monthly : b.once)}</div>
                      <div className="text-[10px] text-muted">{type === 'monthly' ? '/شهر' : '/مشوار'}</div>
                    </div>
                  </button>
                );
              })}

            {step === 2 &&
              (captains.length ? (
                <>
                  <p className="text-xs text-muted px-1">{mode === 'girls' ? 'كابتنات بنات موثّقات — اختاري واحدة' : 'كباتن موثّقين — اختار واحد'}</p>
                  {captains.map((c) => {
                    const u = userById(c.userId)!;
                    return (
                      <CaptainRow
                        key={c.userId}
                        user={u}
                        cap={c}
                        selected={captainId === c.userId}
                        onClick={() => setCaptainId(c.userId)}
                        right={<span className={cx('size-6 rounded-full border-2 grid place-items-center', captainId === c.userId ? 'border-acc bg-acc text-acc-ink' : 'border-white/20')}>{captainId === c.userId && <Check className="size-3.5" />}</span>}
                      />
                    );
                  })}
                </>
              ) : (
                <Empty icon={<UserX />} title="مفيش كباتن متاحين للفئة دي" sub="جرّب فئة موتوسيكل تانية" action={<Button variant="soft" size="sm" onClick={() => setStep(1)}>غيّر الفئة</Button>} />
              ))}

            {step === 3 && (
              <>
                <div className="glass rounded-3xl p-5 text-center">
                  <p className="text-xs text-muted">عرضك {type === 'monthly' ? 'للشهر' : 'للمشوار'}</p>
                  <div className="mt-3 flex items-center justify-center gap-4">
                    <button onClick={() => setOffer(Math.min(max, price + stepSize))} className="size-12 rounded-2xl glass grid place-items-center active:scale-95" aria-label="زوّد">
                      <Plus className="size-5" />
                    </button>
                    <motion.div key={price} initial={{ scale: 0.9, opacity: 0.5 }} animate={{ scale: 1, opacity: 1 }} className="min-w-[150px] text-5xl font-bold text-grad tabular-nums">
                      {price}
                      <span className="text-lg text-muted font-normal"> ج</span>
                    </motion.div>
                    <button onClick={() => setOffer(Math.max(min, price - stepSize))} className="size-12 rounded-2xl glass grid place-items-center active:scale-95" aria-label="قلّل">
                      <Minus className="size-5" />
                    </button>
                  </div>
                  <input type="range" min={min} max={max} step={stepSize} value={price} onChange={(e) => setOffer(+e.target.value)} className="mt-5 w-full accent-[var(--acc)]" dir="ltr" />
                  <div className="flex justify-between text-[10px] text-muted" dir="ltr">
                    <span>{min}</span>
                    <span>السعر المقترح {base}</span>
                    <span>{max}</span>
                  </div>
                  <p className={cx('mt-4 text-xs', price >= base ? 'text-ok' : price >= base * 0.85 ? 'text-warn' : 'text-danger')}>{hint}</p>
                </div>
                <div className="glass rounded-3xl p-4 space-y-3">
                  <RouteLine from={from} to={to} compact />
                  <div className="h-px bg-line" />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">الكابتن</span>
                    <span>{captainId && getState().users.find((u) => u.id === captainId)?.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">الموتوسيكل</span>
                    <span>{bikeClass(bike).name}</span>
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
        <Button size="lg" className="w-full" disabled={!canNext} loading={sending} onClick={next} icon={step === 3 ? <Send className="size-5 -scale-x-100" /> : undefined}>
          {step === 3 ? `ابعت العرض · ${egp(price)}` : 'التالي'}
        </Button>
      </div>
    </Page>
  );
}
