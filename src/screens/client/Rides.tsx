import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTick } from '@/lib/useTick';
import { motion } from 'motion/react';
import { MessageCircle, Phone, Navigation, Route, RotateCcw, CheckCheck, X } from 'lucide-react';
import { Button, Card, ConfirmButton, Empty, Page, Segmented, Sheet, Stars, TopBar } from '@/components/ui';
import { CaptainRow, Chat, RouteLine, StatusPill } from '@/components/shared';
import { back, go } from '@/lib/router';
import { useStore } from '@/lib/store';
import { bikeClass } from '@/lib/config';
import { dateStr, egp, timeAgo } from '@/lib/format';
import { cancelBooking, clientAnswerCounter, completeBooking, expireRequest, rateCaptain, requestAgeLeft, sendMessage } from '@/lib/actions';
import { toast } from '@/lib/toast';
import type { User } from '@/lib/types';

export function Rides({ user }: { user: User }) {
  const [tab, setTab] = useState<'now' | 'past'>('now');
  const all = useStore((s) => s.bookings.filter((b) => b.clientId === user.id));
  const list = all.filter((b) => (tab === 'now' ? ['pending', 'countered', 'accepted'].includes(b.status) : ['done', 'cancelled', 'rejected', 'expired'].includes(b.status)));
  const users = useStore((s) => s.users);

  return (
    <Page>
      <TopBar title="مشاويري" onBack={() => go('/home')} />
      <div className="px-5 space-y-4 pb-6">
        <Segmented value={tab} onChange={setTab} options={[{ value: 'now', label: 'الحالية' }, { value: 'past', label: 'السابقة' }]} />
        {list.length === 0 ? (
          <Empty icon={<Route />} title={tab === 'now' ? 'مفيش مشاوير حالية' : 'لسه مفيش مشاوير سابقة'} sub="اطلب أول مشوار وخلّي الكابتن يوصّلك" action={<Button size="sm" onClick={() => go('/book')}>مشوار جديد</Button>} />
        ) : (
          list.map((b, i) => (
            <motion.div key={b.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card onClick={() => go(`/ride/${b.id}`)}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-muted">
                    {b.type === 'monthly' ? 'اشتراك شهري' : 'مشوار'} · {users.find((u) => u.id === b.captainId)?.name}
                  </span>
                  <StatusPill s={b.status} stage={b.stage} />
                </div>
                <RouteLine from={b.from} to={b.to} compact />
                <div className="mt-3 flex items-center justify-between text-xs text-muted">
                  <span>{timeAgo(b.createdAt)}</span>
                  <span className="text-text font-semibold text-sm">{egp(b.price ?? b.counter ?? b.offer)}</span>
                </div>
              </Card>
            </motion.div>
          ))
        )}
      </div>
    </Page>
  );
}

export function RideDetail({ id }: { id: string }) {
  const b = useStore((s) => s.bookings.find((x) => x.id === id));
  const cap = useStore((s) => s.captains.find((c) => c.userId === b?.captainId));
  const capUser = useStore((s) => s.users.find((u) => u.id === b?.captainId));
  const [rateOpen, setRateOpen] = useState(false);
  const [stars, setStars] = useState(5);
  const now = useTick(b?.status === 'pending' ? 1000 : 0);
  const left = b?.status === 'pending' ? requestAgeLeft(b, now) : null;
  // the captain didn't answer in time → close the request
  useEffect(() => {
    if (b?.status === 'pending' && left === 0) void expireRequest(b.id);
  }, [b?.status, b?.id, left]);
  // the captain finished the ride → ask for a rating right away
  const askedRef = useRef(false);
  useEffect(() => {
    if (b?.status === 'done' && !b.rating && b.finishedAt && Date.now() - b.finishedAt < 30 * 60_000 && !askedRef.current) {
      askedRef.current = true;
      setRateOpen(true);
    }
  }, [b?.status, b?.rating, b?.finishedAt]);

  if (!b || !cap || !capUser) return <Empty icon={<Route />} title="المشوار ده مش موجود" action={<Button size="sm" onClick={() => go('/rides')}>مشاويري</Button>} />;
  const cls = bikeClass(b.bikeClass);

  return (
    <Page>
      <TopBar title={b.type === 'monthly' ? 'اشتراك شهري' : 'تفاصيل المشوار'} sub={dateStr(b.createdAt)} onBack={() => back('/rides')} right={<StatusPill s={b.status} stage={b.stage} />} />
      <div className="px-5 pb-8 space-y-4">
        {b.status === 'pending' && (
          <Card className="text-center !py-8">
            <div className="relative mx-auto size-24 grid place-items-center">
              <span className="absolute inset-0 rounded-full bg-acc/20 ping-soft" />
              <span className="absolute inset-3 rounded-full bg-acc/20 ping-soft" style={{ animationDelay: '.6s' }} />
              <span className="relative size-14 rounded-full bg-grad grid place-items-center text-acc-ink font-bold">{b.offer}</span>
            </div>
            <p className="mt-5 font-semibold">مستنيين رد {capUser.name}…</p>
            <p className="text-xs text-muted mt-1">لو ما ردّش خلال الوقت ده، هنقترح عليك كابتن تاني</p>
            <p className="mt-3 text-2xl font-bold tabular-nums text-grad" dir="ltr">
              {Math.floor((left ?? 0) / 60000)}:{String(Math.floor(((left ?? 0) % 60000) / 1000)).padStart(2, '0')}
            </p>
            <Button variant="danger" size="sm" className="mt-5" onClick={() => { cancelBooking(b.id); toast('اتلغى الطلب', 'info'); }}>
              إلغاء الطلب
            </Button>
          </Card>
        )}

        {b.status === 'countered' && (
          <Card className="!p-5 border-acc/40!">
            <p className="text-xs text-muted">{capUser.name} اقترح سعر تاني</p>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="text-4xl font-bold text-grad">{egp(b.counter!)}</span>
              <span className="text-sm text-muted line-through">{egp(b.offer)}</span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Button onClick={() => { clientAnswerCounter(b.id, true); toast('اتفقتوا! 🎉'); }} icon={<CheckCheck className="size-4" />}>موافق</Button>
              <Button variant="ghost" onClick={() => clientAnswerCounter(b.id, false)} icon={<X className="size-4" />}>لأ شكراً</Button>
            </div>
          </Card>
        )}

        {b.status === 'accepted' && (
          <motion.div initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="rounded-3xl p-5 bg-grad text-acc-ink">
            <p className="text-sm opacity-75">
              {b.stage === 'arrived' ? '📍 الكابتن وصل لمكانك — انزله' : b.stage === 'started' ? '🏍️ في الطريق للوجهة' : 'الكابتن في الطريق ليك'}
            </p>
            <p className="text-4xl font-bold mt-1 whitespace-nowrap">{egp(b.price!)}</p>
            <p className="text-sm mt-1 opacity-75">سعر ثابت · {b.distanceKm !== undefined ? `${b.distanceKm.toFixed(1)} كم` : b.to}</p>
            <button onClick={() => go(`/ride/${b.id}/track`)} className="mt-4 w-full h-12 rounded-2xl bg-black/20 font-medium flex items-center justify-center gap-2">
              <Navigation className="size-5" /> تتبع الكابتن مباشر
            </button>
          </motion.div>
        )}

        <CaptainRow
          user={capUser}
          cap={cap}
          right={
            b.status === 'accepted' ? (
              <div className="flex gap-2">
                <a href={`tel:${capUser.phone}`} className="size-11 rounded-2xl glass grid place-items-center" aria-label="اتصال">
                  <Phone className="size-5" />
                </a>
                <button onClick={() => go(`/ride/${b.id}/chat`)} className="size-11 rounded-2xl bg-acc/15 text-acc grid place-items-center" aria-label="شات">
                  <MessageCircle className="size-5" />
                </button>
              </div>
            ) : undefined
          }
        />

        <Card className="space-y-3">
          <RouteLine from={b.from} to={b.to} />
          <div className="h-px bg-line" />
          <Row k="النوع" v={b.type === 'monthly' ? 'اشتراك شهري' : 'مشوار واحد'} />
          <Row k="الموتوسيكل" v={`${cls.name} · ${cap.bikeModel}`} />
          <Row k="النمرة" v={cap.plate} />
          {b.distanceKm !== undefined && <Row k="المسافة" v={`${b.distanceKm.toFixed(1)} كم`} />}
          <Row k="السعر" v={`${egp(b.price ?? b.offer)} · ثابت`} />
          {b.rating && <Row k="تقييمك" v={<Stars value={b.rating} size={14} />} />}
        </Card>

        {b.status === 'done' && !b.rating && (
          <Button className="w-full" onClick={() => setRateOpen(true)}>
            قيّم {capUser.name}
          </Button>
        )}
        {b.status === 'accepted' && b.stage === 'started' && (
          <Button variant="ghost" className="w-full" onClick={() => setRateOpen(true)}>
            وصلت — إنهاء وتقييم الكابتن
          </Button>
        )}
        {b.status === 'accepted' && (
          <ConfirmButton variant="danger" className="w-full" confirmLabel="دوس تاني لإلغاء المشوار" onConfirm={() => void cancelBooking(b.id).then((ok) => ok && toast('اتلغى المشوار', 'info'))}>
            إلغاء المشوار
          </ConfirmButton>
        )}
        {['rejected', 'cancelled', 'expired'].includes(b.status) && (
          <>
            {b.status === 'expired' && <p className="text-center text-sm text-muted">{capUser.name} ما ردّش في الوقت</p>}
            <Button className="w-full" icon={<RotateCcw className="size-4" />} onClick={() => go(`/book?rebook=${b.id}`)}>
              اطلب من كابتن تاني
            </Button>
          </>
        )}
        {b.status !== 'pending' && b.messages.length > 1 && b.status !== 'accepted' && (
          <Button variant="ghost" className="w-full" onClick={() => go(`/ride/${b.id}/chat`)}>عرض المحادثة</Button>
        )}
      </div>

      <Sheet open={rateOpen} onClose={() => setRateOpen(false)} title="المشوار كان عامل إيه؟">
        <div className="text-center py-4">
          <p className="text-sm text-muted mb-5">قيّم {capUser.name}</p>
          <div className="flex justify-center">
            <Stars value={stars} onChange={setStars} size={40} />
          </div>
          <Button
            size="lg"
            className="w-full mt-8"
            onClick={async () => {
              const ok = b.status === 'done' ? await rateCaptain(b.id, stars) : await completeBooking(b.id, stars);
              setRateOpen(false);
              if (ok) toast('شكراً على تقييمك 💫');
            }}
          >
            إرسال التقييم
          </Button>
        </div>
      </Sheet>
    </Page>
  );
}

const Row = ({ k, v }: { k: string; v: ReactNode }) => (
  <div className="flex items-center justify-between text-sm">
    <span className="text-muted">{k}</span>
    <span>{v}</span>
  </div>
);

export function RideChat({ id }: { id: string }) {
  const b = useStore((s) => s.bookings.find((x) => x.id === id));
  const capName = useStore((s) => s.users.find((u) => u.id === b?.captainId)?.name);
  if (!b) return null;
  return (
    <Page>
      <TopBar title={capName} sub={b.status === 'accepted' ? 'متصل' : 'المحادثة'} onBack={() => back(`/ride/${id}`)} />
      <Chat booking={b} me="client" onSend={(t) => sendMessage(b.id, 'client', t)} />
    </Page>
  );
}

