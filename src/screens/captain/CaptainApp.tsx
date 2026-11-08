import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { Home as HomeIcon, Inbox, Wallet, UserRound, Power, Hourglass, Check, X, MessageCircle, Phone, Copy, Receipt, Star, Bell, LogOut, Zap, TrendingUp, ShieldAlert, Radio, Navigation, Flag } from 'lucide-react';
import { Avatar, Button, Card, Empty, Field, Page, Pill, SectionTitle, TopBar, cx } from '@/components/ui';
import { BikeArt, Logo } from '@/components/art';
import { BottomNav, Chat, RouteLine, StatusPill, useUnread } from '@/components/shared';
import { Apply, Upload } from './Apply';
import { MapView } from '@/components/maps';
import { mapsEnabled } from '@/lib/maps';
import { startSharing, stopSharing, useSharing } from '@/lib/sharing';
import { back, go, useExitGuard, useRoute } from '@/lib/router';
import { useStore } from '@/lib/store';
import { DAYS, INSTAPAY_HANDLE, INSTAPAY_LINK, SUBSCRIPTION_PRICE } from '@/lib/config';
import { dateStr, egp, num, timeAgo } from '@/lib/format';
import { canTakeRides, captainRespond, directionsUrl, isSubscribed, km, logout, markNoticesRead, sendMessage, setOnline, submitPayment } from '@/lib/actions';
import { toast } from '@/lib/toast';
import type { Booking, CaptainProfile, User } from '@/lib/types';

const exitHint = () => toast('دوس رجوع تاني علشان تخرج من التطبيق', 'info');

export function CaptainApp({ user }: { user: User }) {
  const { parts } = useRoute();
  const cap = useStore((s) => s.captains.find((c) => c.userId === user.id));
  const pendingCount = useStore((s) => s.bookings.filter((b) => b.captainId === user.id && b.status === 'pending').length);
  const unread = useUnread(user.id);
  const [, section, id] = parts;
  const sharing = useSharing();
  useExitGuard(!section, exitHint);
  const working = !!cap && cap.online && canTakeRides(cap);

  // while online, the captain's position is shared so nearby riders can find them
  useEffect(() => {
    if (working && !sharing.on) startSharing();
  }, [working, sharing.on]);

  if (!cap || cap.status === 'rejected') return <Apply user={user} prev={cap} />;
  if (cap.status === 'pending') return <Pending user={user} />;
  if (cap.status === 'suspended') return <Pending user={user} suspended reason={cap.rejectReason} />;

  let screen;
  let nav = true;
  if (section === 'chat' && id) {
    screen = <CaptainChat id={id} />;
    nav = false;
  } else if (section === 'requests') screen = <Requests user={user} />;
  else if (section === 'wallet') screen = <WalletScreen user={user} cap={cap} />;
  else if (section === 'me') screen = <Me user={user} cap={cap} />;
  else screen = <Dashboard user={user} cap={cap} unread={unread} />;

  return (
    <div className="min-h-dvh md:min-h-[calc(100dvh-48px)] flex flex-col">
      <div className="flex-1" key={parts.join('/')}>{screen}</div>
      {nav && (
        <BottomNav
          active={'/captain' + (section ? '/' + section : '')}
          items={[
            { to: '/captain', label: 'الرئيسية', icon: <HomeIcon /> },
            { to: '/captain/requests', label: 'الطلبات', icon: <Inbox />, badge: pendingCount },
            { to: '/captain/wallet', label: 'الاشتراك', icon: <Wallet />, badge: isSubscribed(cap) ? 0 : 1 },
            { to: '/captain/me', label: 'حسابي', icon: <UserRound />, badge: unread },
          ]}
        />
      )}
    </div>
  );
}

function Pending({ user, suspended, reason }: { user: User; suspended?: boolean; reason?: string }) {
  return (
    <Page className="min-h-dvh md:min-h-[calc(100dvh-48px)] flex flex-col items-center justify-center text-center px-8">
      <div className="relative size-28 grid place-items-center">
        <span className="absolute inset-0 rounded-full bg-acc/15 ping-soft" />
        <span className="relative size-20 rounded-3xl glass grid place-items-center text-acc">
          {suspended ? <ShieldAlert className="size-9 text-danger" /> : <Hourglass className="size-9" />}
        </span>
      </div>
      <h1 className="mt-8 text-2xl font-bold">{suspended ? 'حسابك متوقف مؤقتاً' : 'طلبك بيتراجع'}</h1>
      <p className="mt-2 text-sm text-muted leading-relaxed">
        {suspended
          ? `السبب: ${reason || 'تواصل مع الدعم'}. كلّمنا على الواتساب علشان نحل المشكلة.`
          : `يا ${user.name}، فريقنا بيراجع بياناتك ومستنداتك. عادةً بناخد أقل من 24 ساعة، وهيوصلك تنبيه أول ما نخلص.`}
      </p>
      <Button variant="ghost" className="mt-8" icon={<LogOut className="size-4" />} onClick={logout}>
        خروج
      </Button>
    </Page>
  );
}

function SubscriptionCard({ cap, compact }: { cap: CaptainProfile; compact?: boolean }) {
  const active = isSubscribed(cap);
  const daysLeft = active ? Math.ceil((cap.activeUntil! - Date.now()) / 86_400_000) : 0;
  const pct = Math.min(100, (daysLeft / 365) * 100);
  return (
    <Card className={cx('!p-5 relative overflow-hidden', !active && 'border-warn/40!')}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted">الاشتراك السنوي</p>
          <p className="text-xl font-bold mt-1">{active ? <span className="text-grad">{num(daysLeft)} يوم فاضلين</span> : cap.pendingPayment ? 'الدفع بيتراجع' : cap.activeUntil ? 'الاشتراك منتهي' : 'فعّل اشتراكك'}</p>
        </div>
        {active ? <Pill tone="ok">شغّال</Pill> : cap.pendingPayment ? <Pill tone="warn">قيد المراجعة</Pill> : <Pill tone={cap.activeUntil ? 'danger' : 'warn'}>{cap.activeUntil ? 'منتهي' : 'مش مفعّل'}</Pill>}
      </div>
      {active && (
        <>
          <div className="mt-4 h-2 rounded-full bg-white/8 overflow-hidden" dir="ltr">
            <div className="h-full bg-grad" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[11px] text-muted mt-2">ينتهي {dateStr(cap.activeUntil!)}</p>
        </>
      )}
      {!active && !compact && !cap.pendingPayment && <p className="text-xs text-muted mt-2">جدد الاشتراك علشان تظهر للركاب وتستقبل طلبات.</p>}
      {compact && !active && !cap.pendingPayment && (
        <Button size="sm" className="mt-4" onClick={() => go('/captain/wallet')}>
          جدد بـ {egp(SUBSCRIPTION_PRICE)}
        </Button>
      )}
    </Card>
  );
}

function Dashboard({ user, cap, unread }: { user: User; cap: CaptainProfile; unread: number }) {
  const mine = useStore((s) => s.bookings.filter((b) => b.captainId === user.id));
  const pending = mine.filter((b) => b.status === 'pending');
  const active = mine.filter((b) => b.status === 'accepted');
  const earned = mine.filter((b) => b.status === 'accepted' || b.status === 'done').reduce((a, b) => a + (b.price ?? 0), 0);
  const canWork = isSubscribed(cap);

  return (
    <Page className="px-5 pt-[max(env(safe-area-inset-top),18px)] pb-6 space-y-5">
      <header className="flex items-center gap-3">
        <Logo size={44} />
        <div className="flex-1">
          <p className="text-xs text-muted">لوحة الكابتن</p>
          <p className="text-lg font-semibold">{user.name}</p>
        </div>
        <button onClick={() => go('/captain/me')} className="relative">
          <Avatar name={user.name} src={cap.photo} size={44} />
          {!!unread && <span className="absolute -top-1 -right-1 size-3 rounded-full bg-danger border-2 border-bg" />}
        </button>
      </header>

      {/* online switch */}
      <button
        disabled={!canWork}
        onClick={async () => {
          const goingOnline = !cap.online;
          if (goingOnline) startSharing();
          await setOnline(user.id, goingOnline);
          if (!goingOnline && !active.length) await stopSharing();
          toast(goingOnline ? 'إنت أونلاين — الركاب القريبين هيشوفوك ⚡' : 'إنت دلوقتي أوفلاين', 'info');
        }}
        className={cx('w-full relative overflow-hidden rounded-[30px] p-5 flex items-center gap-4 text-right transition', cap.online && canWork ? 'bg-grad text-acc-ink glow' : 'glass', !canWork && 'opacity-60')}
      >
        <span className={cx('size-14 rounded-2xl grid place-items-center', cap.online && canWork ? 'bg-black/20' : 'bg-white/5 text-muted')}>
          <Power className="size-7" />
        </span>
        <span className="flex-1">
          <span className="block text-xl font-bold">{cap.online && canWork ? 'أونلاين' : 'أوفلاين'}</span>
          <span className={cx('block text-xs', cap.online && canWork ? 'opacity-70' : 'text-muted')}>{!canWork ? 'جدد الاشتراك الأول' : cap.online ? 'بتستقبل طلبات دلوقتي' : 'دوس علشان تبدأ تستقبل طلبات'}</span>
        </span>
        <BikeArt kind={cap.bikeClass} className="w-24 h-14 shrink-0" />
      </button>

      {!canWork && <SubscriptionCard cap={cap} compact />}

      <div className="grid grid-cols-3 gap-3">
        <Stat icon={<TrendingUp />} v={egp(earned)} l="الدخل" />
        <Stat icon={<Star />} v={cap.rating.toFixed(1)} l="التقييم" />
        <Stat icon={<Zap />} v={num(cap.trips)} l="مشوار" />
      </div>

      <section>
        <SectionTitle action={pending.length > 0 && <button onClick={() => go('/captain/requests')} className="text-xs text-acc">الكل</button>}>طلبات جديدة</SectionTitle>
        {pending.length ? pending.slice(0, 2).map((b) => <RequestCard key={b.id} b={b} />) : <Card className="text-center text-sm text-muted !py-6">مفيش طلبات جديدة دلوقتي</Card>}
      </section>

      {active.length > 0 && <ShareCard />}

      {active.length > 0 && (
        <section>
          <SectionTitle>مشاوير متأكدة</SectionTitle>
          <div className="space-y-3">
            {active.map((b) => (
              <ActiveRide key={b.id} b={b} />
            ))}
          </div>
        </section>
      )}
    </Page>
  );
}

const Stat = ({ icon, v, l }: { icon: ReactNode; v: string; l: string }) => (
  <Card className="!p-3">
    <span className="text-acc [&>svg]:size-5">{icon}</span>
    <p className="text-lg font-bold mt-1.5 truncate">{v}</p>
    <p className="text-[10px] text-muted">{l}</p>
  </Card>
);

function RequestCard({ b }: { b: Booking }) {
  const client = useStore((s) => s.users.find((u) => u.id === b.clientId));
  const me = useStore((s) => s.live.find((l) => l.captainId === b.captainId));

  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-3">
      <Card className="!p-4">
        <div className="flex items-center gap-3 mb-3">
          <Avatar name={client?.name ?? '؟'} size={40} />
          <div className="flex-1">
            <p className="font-medium text-sm">{client?.name}</p>
            <p className="text-[11px] text-muted">
              {b.type === 'monthly' ? 'اشتراك شهري' : 'مشوار واحد'} · {timeAgo(b.createdAt)}
            </p>
          </div>
          <div className="text-left">
            <p className="text-xl font-bold text-grad">{egp(b.offer)}</p>
            {b.distanceKm !== undefined && <p className="text-[10px] text-muted tabular-nums">{b.distanceKm.toFixed(1)} كم · سعر ثابت</p>}
          </div>
        </div>
        <RouteLine from={b.from} to={b.to} compact />
        <p className="text-[11px] text-muted mt-2">
          {b.time}
          {b.type === 'monthly' && ` · ${b.days.map((d) => DAYS[d]).join('، ')}`}
        </p>
        <RideMap b={b} me={me} />
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button onClick={() => void captainRespond(b.id, 'accept').then((ok) => ok && toast('قبلت الطلب ✅'))} icon={<Check className="size-4" />}>قبول</Button>
          <Button variant="ghost" onClick={() => void captainRespond(b.id, 'reject')} icon={<X className="size-4" />}>اعتذار</Button>
        </div>
      </Card>
    </motion.div>
  );
}

/** Where the rider is, where they're going, and how far the captain is from the pickup. */
function RideMap({ b, me }: { b: Booking; me?: { lat: number; lng: number; heading?: number } }) {
  if (b.fromLat === undefined && b.toLat === undefined) {
    return <p className="mt-3 text-[11px] text-muted">الراكب ما حددش مكانه على الخريطة — كلّمه تتأكد من العنوان</p>;
  }
  const pickup = b.fromLat !== undefined ? { lat: b.fromLat, lng: b.fromLng! } : null;
  const dist = pickup && me ? km(me, pickup) : null;
  return (
    <>
      {dist !== null && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-acc/12 text-acc border border-acc/25">
            <Navigation className="size-3.5" /> الراكب على بعد {dist < 1 ? `${Math.round(dist * 1000)} متر` : `${dist.toFixed(1)} كم`} منك
          </span>
          <span className="text-muted">~{Math.max(1, Math.round((dist / 25) * 60))} دقيقة</span>
        </div>
      )}
      {mapsEnabled() && (
        <MapView
          className="h-44 mt-3"
          points={[
            ...(pickup ? [{ id: 'p', kind: 'pickup' as const, ...pickup, title: b.from }] : []),
            ...(b.toLat !== undefined ? [{ id: 'd', kind: 'drop' as const, lat: b.toLat, lng: b.toLng!, title: b.to }] : []),
            ...(me ? [{ id: 'me', kind: 'captain' as const, lat: me.lat, lng: me.lng, heading: me.heading, title: 'إنت' }] : []),
          ]}
        />
      )}
    </>
  );
}

function ShareCard() {
  const sh = useSharing();
  return (
    <button
      onClick={() => (sh.on ? void stopSharing().then(() => toast('وقّفت مشاركة موقعك', 'info')) : startSharing())}
      className={cx('w-full text-right rounded-3xl p-4 flex items-center gap-4 border transition', sh.on ? 'border-ok/40 bg-ok/[.07]' : 'glass')}
    >
      <span className={cx('relative size-12 rounded-2xl grid place-items-center shrink-0', sh.on ? 'bg-ok/15 text-ok' : 'bg-white/5 text-muted')}>
        {sh.on && <span className="absolute inset-0 rounded-2xl bg-ok/20 ping-soft" />}
        <Radio className="size-6 relative" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-semibold">{sh.on ? 'موقعك ظاهر للراكب' : 'ابدأ مشاركة موقعك'}</span>
        <span className={cx('block text-xs mt-0.5', sh.error ? 'text-danger' : 'text-muted')}>
          {sh.error ?? (sh.on ? (sh.lastSent ? `آخر تحديث ${timeAgo(sh.lastSent)} — سيب التطبيق مفتوح وإنت سايق` : 'بنحدد مكانك…') : 'الراكب هيشوفك على الخريطة لحد ما توصله')}
        </span>
      </span>
      <span className={cx('h-7 w-12 rounded-full p-1 transition shrink-0', sh.on ? 'bg-ok' : 'bg-white/15')}>
        <span className={cx('block size-5 rounded-full bg-white transition', sh.on ? '-translate-x-5' : '')} />
      </span>
    </button>
  );
}

function ActiveRide({ b }: { b: Booking }) {
  const client = useStore((s) => s.users.find((u) => u.id === b.clientId));
  const me = useStore((s) => s.live.find((l) => l.captainId === b.captainId));
  return (
    <Card className="!p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium">{client?.name}</span>
        <span className="text-sm font-semibold text-acc">{egp(b.price!)}</span>
      </div>
      <RouteLine from={b.from} to={b.to} compact />
      <RideMap b={b} me={me} />
      {(b.fromLat !== undefined || b.toLat !== undefined) && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {b.fromLat !== undefined && (
            <a href={directionsUrl(b.fromLat, b.fromLng!)} target="_blank" rel="noreferrer" className="h-10 rounded-xl bg-white/[.06] border border-line text-xs flex items-center justify-center gap-1.5">
              <Navigation className="size-4 text-acc" /> الطريق للراكب
            </a>
          )}
          {b.toLat !== undefined && (
            <a href={directionsUrl(b.toLat, b.toLng!)} target="_blank" rel="noreferrer" className="h-10 rounded-xl bg-white/[.06] border border-line text-xs flex items-center justify-center gap-1.5">
              <Flag className="size-4 text-acc" /> الطريق للوجهة
            </a>
          )}
        </div>
      )}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <a href={`tel:${client?.phone}`} className="h-10 rounded-xl glass text-sm flex items-center justify-center gap-2">
          <Phone className="size-4" /> اتصال
        </a>
        <button onClick={() => go(`/captain/chat/${b.id}`)} className="h-10 rounded-xl bg-acc/12 text-acc border border-acc/25 text-sm flex items-center justify-center gap-2">
          <MessageCircle className="size-4" /> شات
        </button>
      </div>
    </Card>
  );
}

function Requests({ user }: { user: User }) {
  const mine = useStore((s) => s.bookings.filter((b) => b.captainId === user.id));
  const pending = mine.filter((b) => b.status === 'pending');
  const rest = mine.filter((b) => b.status !== 'pending');
  return (
    <Page>
      <TopBar title="الطلبات" sub={`${num(pending.length)} طلب جديد`} onBack={() => go('/captain')} />
      <div className="px-5 pb-6">
        {pending.map((b) => (
          <RequestCard key={b.id} b={b} />
        ))}
        {pending.length === 0 && <Empty icon={<Inbox />} title="مفيش طلبات جديدة" sub="خلّيك أونلاين علشان الطلبات توصلك" />}
        {rest.length > 0 && (
          <>
            <SectionTitle>السجل</SectionTitle>
            <div className="space-y-2.5">
              {rest.map((b) => (
                <Card key={b.id} className="!p-3.5" onClick={b.status === 'accepted' ? () => go(`/captain/chat/${b.id}`) : undefined}>
                  <div className="flex items-center justify-between mb-2">
                    <StatusPill s={b.status} />
                    <span className="text-sm font-semibold">{egp(b.price ?? b.counter ?? b.offer)}</span>
                  </div>
                  <RouteLine from={b.from} to={b.to} compact />
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </Page>
  );
}

function WalletScreen({ user, cap }: { user: User; cap: CaptainProfile }) {
  const [ref, setRef] = useState('');
  const [receipt, setReceipt] = useState<string>();
  const [paying, setPaying] = useState(false);
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`اتنسخ ${what}`);
    } catch {
      toast(text, 'info');
    }
  };
  return (
    <Page>
      <TopBar title="الاشتراك" sub="ادفع بـ InstaPay في دقيقة" onBack={() => go('/captain')} />
      <div className="px-5 pb-6 space-y-4">
        <SubscriptionCard cap={cap} />
        {!cap.pendingPayment ? (
          <>
            <Card className="!p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">المبلغ المطلوب</span>
                <button onClick={() => void copy(String(SUBSCRIPTION_PRICE), 'المبلغ')} className="flex items-center gap-2 text-2xl font-bold text-grad" aria-label="نسخ المبلغ">
                  {egp(SUBSCRIPTION_PRICE)} <Copy className="size-4 text-muted" />
                </button>
              </div>
              <ol className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <Num n={1} /> دوس الزرار — هيفتحلك تطبيق InstaPay على صفحة الدفع
                </li>
              </ol>
              <a
                href={INSTAPAY_LINK}
                target="_blank"
                rel="noreferrer"
                className="w-full h-14 rounded-2xl bg-[#5b2a86] hover:bg-[#6a3299] text-white font-bold flex items-center justify-center gap-2.5 shadow-lg shadow-[#5b2a86]/40 transition active:scale-[0.98]"
              >
                <span className="h-7 px-2 rounded-lg bg-white text-[#5b2a86] text-xs font-black grid place-items-center" dir="ltr">IPN</span>
                ادفع {egp(SUBSCRIPTION_PRICE)} بـ InstaPay
              </a>
              <button onClick={() => void copy(INSTAPAY_HANDLE, 'عنوان InstaPay')} className="w-full h-10 rounded-xl bg-white/[.04] border border-line text-xs text-muted flex items-center justify-center gap-2" dir="ltr">
                {INSTAPAY_HANDLE} <Copy className="size-3.5" />
              </button>
              <ol className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <Num n={2} /> حوّل {egp(SUBSCRIPTION_PRICE)} بالظبط وارجع هنا
                </li>
                <li className="flex gap-3">
                  <Num n={3} /> اكتب رقم العملية (المرجع) وارفع صورة الإيصال
                </li>
              </ol>
              <Field label="رقم المرجع" icon={<Receipt />} value={ref} onChange={(e) => setRef(e.target.value.trim())} placeholder="مثلاً 123456789012" dir="ltr" className="text-right" />
              <Upload label="صورة الإيصال (اختياري)" icon={<Receipt />} value={receipt} onChange={setReceipt} />
            </Card>
            <Button
              size="lg"
              className="w-full"
              disabled={ref.length < 6}
              loading={paying}
              onClick={async () => {
                setPaying(true);
                const ok = await submitPayment(user.id, ref, receipt);
                setPaying(false);
                if (!ok) return;
                setRef('');
                setReceipt(undefined);
                toast('اتبعت الدفع للمراجعة — هيتفعّل خلال ساعات');
              }}
            >
              أكّد الدفع
            </Button>
          </>
        ) : (
          <Card className="text-center !py-8">
            <Hourglass className="size-8 text-warn mx-auto" />
            <p className="mt-3 font-semibold">بنراجع التحويل</p>
            <p className="text-xs text-muted mt-1" dir="ltr">REF {cap.pendingPayment.ref}</p>
          </Card>
        )}
      </div>
    </Page>
  );
}
const Num = ({ n }: { n: number }) => <span className="size-6 shrink-0 rounded-full bg-grad text-acc-ink text-xs font-bold grid place-items-center">{n}</span>;

function Me({ user, cap }: { user: User; cap: CaptainProfile }) {
  const notices = useStore((s) => s.notices.filter((n) => n.to === user.id));
  useEffect(() => () => void markNoticesRead(user.id), [user.id]);
  return (
    <Page>
      <TopBar title="حسابي" onBack={() => go('/captain')} />
      <div className="px-5 pb-6 space-y-4">
        <Card className="!p-5 flex items-center gap-4">
          <Avatar name={user.name} src={cap.photo} size={64} ring />
          <div className="flex-1 min-w-0">
            <p className="text-lg font-semibold">{user.name}</p>
            <p className="text-sm text-muted">{cap.bikeModel} · <span dir="ltr">{cap.plate}</span></p>
            <Pill className="mt-2" tone="ok">كابتن موثّق</Pill>
          </div>
        </Card>
        <SectionTitle>التنبيهات</SectionTitle>
        {notices.length === 0 ? (
          <Card className="text-center text-sm text-muted !py-6 flex flex-col items-center gap-2"><Bell className="size-5" /> مفيش تنبيهات</Card>
        ) : (
          notices.slice(0, 20).map((n) => (
            <Card key={n.id} className="!p-3.5 flex gap-3">
              <span className={`mt-1.5 size-2 rounded-full shrink-0 ${n.read ? 'bg-white/15' : 'bg-acc'}`} />
              <div>
                <p className="text-sm">{n.text}</p>
                <p className="text-[11px] text-muted mt-1">{timeAgo(n.at)}</p>
              </div>
            </Card>
          ))
        )}
        <div className="rounded-2xl border border-line p-3 text-[11px] text-muted flex gap-2">
          <ShieldAlert className="size-4 shrink-0" /> بياناتك ومستنداتك محفوظة ومش بتظهر للركاب.
        </div>
        <Button variant="danger" className="w-full" icon={<LogOut className="size-4" />} onClick={() => void stopSharing().finally(logout)}>
          تسجيل الخروج
        </Button>
      </div>
    </Page>
  );
}

function CaptainChat({ id }: { id: string }) {
  const b = useStore((s) => s.bookings.find((x) => x.id === id));
  const name = useStore((s) => s.users.find((u) => u.id === b?.clientId)?.name);
  if (!b) return null;
  return (
    <Page>
      <TopBar title={name} sub={`${b.from} ← ${b.to}`} onBack={() => back('/captain')} />
      <Chat booking={b} me="captain" onSend={(t) => sendMessage(b.id, 'captain', t)} />
    </Page>
  );
}
