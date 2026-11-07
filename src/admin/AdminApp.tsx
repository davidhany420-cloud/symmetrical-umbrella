import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { LayoutDashboard, UserCheck, Bike, Wallet, Users, Route as RouteIcon, Map, Settings as SettingsIcon, LogOut, Lock, ShieldCheck, Menu, Bell, X, ExternalLink } from 'lucide-react';
import { Button, Field, Toaster, cx } from '@/components/ui';
import { Logo } from '@/components/art';
import { useRoute, go } from '@/lib/router';
import { onStoreError, useStore } from '@/lib/store';
import { adminExists, adminLogin, adminSignOut, markNoticesRead, setupAdmin } from '@/lib/actions';
import { timeAgo } from '@/lib/format';
import { toast } from '@/lib/toast';
import { Overview } from './Overview';
import { Applications } from './Applications';
import { Captains } from './Captains';
import { Payments, Riders, Rides, Lines, Settings } from './Pages';

export default function AdminApp() {
  const signed = useStore((s) => s.isAdmin);
  const ready = useStore((s) => s.ready);
  const [hasAdmin, setHasAdmin] = useState<boolean | null>(null);
  useEffect(() => {
    document.documentElement.dataset.mode = 'boys';
    void adminExists().then(setHasAdmin);
  }, []);
  useEffect(() => onStoreError((m) => toast(m, 'err')), []);

  return (
    <>
      {!ready || hasAdmin === null ? (
        <div className="min-h-dvh grid place-items-center">
          <div className="animate-pulse">
            <Logo size={64} />
          </div>
        </div>
      ) : signed ? (
        <Shell onOut={() => void adminSignOut()} />
      ) : (
        <Gate firstTime={!hasAdmin} onDone={() => setHasAdmin(true)} />
      )}
      <Toaster />
    </>
  );
}

/* ---------------- login / first-time setup ---------------- */
function Gate({ firstTime, onDone }: { firstTime: boolean; onDone: () => void }) {
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    if (firstTime) {
      if (p1.length < 8) return setErr('كلمة السر لازم 8 حروف على الأقل');
      if (p1 !== p2) return setErr('كلمتين السر مش زي بعض');
    }
    setBusy(true);
    try {
      if (firstTime) await setupAdmin(p1);
      else await adminLogin(p1);
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh grid lg:grid-cols-[1.1fr_1fr] aurora relative overflow-clip">
      <div className="relative hidden lg:flex flex-col justify-between p-12 border-l border-line grid-bg">
        <div className="flex items-center gap-3">
          <Logo size={44} />
          <div>
            <div className="font-bold text-lg">في السكة</div>
            <div className="text-[10px] tracking-[0.35em] text-muted" dir="ltr">COMMAND CENTER</div>
          </div>
        </div>
        <div>
          <p className="text-[44px] leading-[1.1] font-bold tracking-tight max-w-[480px]">
            كل كابتن بيعدّي
            <br />
            <span className="text-grad">من هنا الأول.</span>
          </p>
          <p className="mt-4 text-muted max-w-[420px] leading-relaxed">راجع المستندات، أكّد مدفوعات InstaPay، وتابع كل مشوار على المنصة من مكان واحد.</p>
        </div>
        <div className="text-xs text-muted" dir="ltr">
          FEL SEKKA · ADMIN · {new Date().getFullYear()}
        </div>
      </div>
      <form onSubmit={submit} className="relative z-10 flex flex-col justify-center px-6 py-16 sm:px-16 max-w-[480px] w-full mx-auto">
        <div className="relative w-max">
          <Logo size={64} />
          <span className="absolute -bottom-2 -left-2 size-8 rounded-xl bg-grad text-acc-ink grid place-items-center">
            <ShieldCheck className="size-4" />
          </span>
        </div>
        <h1 className="mt-8 text-3xl font-bold">{firstTime ? 'إعداد لوحة الإدارة' : 'دخول الإدارة'}</h1>
        <p className="mt-2 text-sm text-muted">{firstTime ? 'أول مرة — اختار كلمة سر قوية (8 حروف أو أكتر).' : 'ادخل كلمة سر الأدمن علشان تكمل.'}</p>
        <div className="mt-8 space-y-4">
          <Field id="admin-pass" type="password" icon={<Lock />} value={p1} onChange={(e) => setP1(e.target.value)} placeholder="كلمة السر" autoFocus autoComplete={firstTime ? 'new-password' : 'current-password'} />
          {firstTime && <Field id="admin-pass2" type="password" icon={<Lock />} value={p2} onChange={(e) => setP2(e.target.value)} placeholder="أكّد كلمة السر" autoComplete="new-password" />}
          {err && <p className="text-sm text-danger">{err}</p>}
          <Button size="lg" className="w-full" loading={busy} type="submit">
            {firstTime ? 'حفظ ودخول' : 'دخول'}
          </Button>
        </div>
      </form>
    </div>
  );
}

/* ---------------- layout ---------------- */
interface NavDef {
  to: string;
  label: string;
  icon: ReactNode;
  badge?: number;
}

function Shell({ onOut }: { onOut: () => void }) {
  const { parts } = useRoute();
  const section = parts[0] ?? '';
  const [menu, setMenu] = useState(false);
  const [bell, setBell] = useState(false);
  const pendingApps = useStore((s) => s.captains.filter((c) => c.status === 'pending').length);
  const pendingPays = useStore((s) => s.captains.filter((c) => c.pendingPayment).length);
  const unread = useStore((s) => s.notices.filter((n) => n.to === 'admin' && !n.read).length);

  useEffect(() => setMenu(false), [section]);

  const nav: NavDef[] = [
    { to: '/', label: 'لوحة القيادة', icon: <LayoutDashboard /> },
    { to: '/applications', label: 'طلبات الانضمام', icon: <UserCheck />, badge: pendingApps },
    { to: '/captains', label: 'الكباتن', icon: <Bike /> },
    { to: '/payments', label: 'المدفوعات', icon: <Wallet />, badge: pendingPays },
    { to: '/riders', label: 'الركاب', icon: <Users /> },
    { to: '/rides', label: 'المشاوير', icon: <RouteIcon /> },
    { to: '/lines', label: 'الخطوط الثابتة', icon: <Map /> },
    { to: '/settings', label: 'الإعدادات', icon: <SettingsIcon /> },
  ];

  let page;
  switch (section) {
    case 'applications':
      page = <Applications id={parts[1]} />;
      break;
    case 'captains':
      page = <Captains />;
      break;
    case 'payments':
      page = <Payments />;
      break;
    case 'riders':
      page = <Riders />;
      break;
    case 'rides':
      page = <Rides />;
      break;
    case 'lines':
      page = <Lines />;
      break;
    case 'settings':
      page = <Settings />;
      break;
    default:
      page = <Overview />;
  }

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 h-20">
        <Logo size={40} />
        <div className="leading-none">
          <div className="font-bold">في السكة</div>
          <div className="text-[9px] tracking-[0.35em] text-muted mt-1.5" dir="ltr">COMMAND CENTER</div>
        </div>
      </div>
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {nav.map((n) => {
          const active = '/' + section === n.to || (n.to === '/' && section === '');
          return (
            <button
              key={n.to}
              onClick={() => go(n.to)}
              className={cx('relative w-full flex items-center gap-3 h-11 px-3.5 rounded-xl text-sm transition [&>svg]:size-[18px]', active ? 'bg-white/[.07] text-text' : 'text-muted hover:text-text hover:bg-white/[.03]')}
            >
              {active && <motion.span layoutId="side-active" className="absolute right-0 top-2.5 bottom-2.5 w-[3px] rounded-full bg-grad" />}
              {n.icon}
              <span className="flex-1 text-right">{n.label}</span>
              {!!n.badge && <span className="min-w-6 h-6 px-1.5 rounded-lg bg-acc/15 text-acc text-xs grid place-items-center tabular-nums">{n.badge}</span>}
            </button>
          );
        })}
      </nav>
      <div className="p-3 space-y-1 border-t border-line">
        <a href="./" target="_blank" rel="noreferrer" className="w-full flex items-center gap-3 h-11 px-3.5 rounded-xl text-sm text-muted hover:text-text hover:bg-white/[.03]">
          <ExternalLink className="size-[18px]" /> فتح تطبيق الركاب
        </a>
        <button onClick={onOut} className="w-full flex items-center gap-3 h-11 px-3.5 rounded-xl text-sm text-muted hover:text-danger hover:bg-danger/5">
          <LogOut className="size-[18px]" /> تسجيل الخروج
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh relative">
      <div className="fixed inset-0 aurora pointer-events-none opacity-60" />
      {/* desktop sidebar */}
      <aside className="hidden lg:block fixed inset-y-0 right-0 w-[260px] border-l border-line bg-[#07080d]/80 backdrop-blur-xl z-30">{sidebar}</aside>

      {/* phone drawer */}
      <AnimatePresence>
        {menu && (
          <div className="lg:hidden fixed inset-0 z-50">
            <motion.div className="absolute inset-0 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMenu(false)} />
            <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} className="absolute inset-y-0 right-0 w-[280px] bg-[#07080d] border-l border-line">
              <button onClick={() => setMenu(false)} className="absolute left-3 top-5 size-10 rounded-xl glass grid place-items-center" aria-label="إغلاق">
                <X className="size-4" />
              </button>
              {sidebar}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className="relative lg:mr-[260px]">
        <header className="sticky top-0 z-20 h-16 lg:h-20 flex items-center gap-3 px-4 sm:px-8 bg-bg/70 backdrop-blur-xl border-b border-line">
          <button onClick={() => setMenu(true)} className="lg:hidden size-10 rounded-xl glass grid place-items-center" aria-label="القائمة">
            <Menu className="size-5" />
          </button>
          <div className="lg:hidden flex items-center gap-2">
            <Logo size={30} />
            <span className="font-semibold text-sm">الإدارة</span>
          </div>
          <div className="flex-1" />
          <span className="hidden sm:inline-flex items-center gap-2 h-9 px-3 rounded-xl glass text-xs text-muted">
            <span className="relative flex size-2">
              <span className="absolute inset-0 rounded-full bg-ok ping-soft" />
              <span className="relative size-2 rounded-full bg-ok" />
            </span>
            متصل بالتطبيق · تحديث لحظي
          </span>
          <div className="relative">
            <button onClick={() => setBell((b) => !b)} className="relative size-10 rounded-xl glass grid place-items-center hover:bg-surface-2" aria-label="التنبيهات">
              <Bell className="size-[18px]" />
              {!!unread && <span className="absolute -top-1 -left-1 min-w-5 h-5 px-1 rounded-full bg-danger text-[10px] text-white grid place-items-center">{unread}</span>}
            </button>
            {bell && <BellMenu onClose={() => setBell(false)} />}
          </div>
          <div className="hidden sm:flex items-center gap-2.5 pr-2">
            <div className="size-10 rounded-xl bg-grad text-acc-ink grid place-items-center font-bold">A</div>
            <div className="leading-tight">
              <div className="text-sm font-medium">الأدمن</div>
              <div className="text-[11px] text-muted">مدير المنصة</div>
            </div>
          </div>
        </header>
        <main className="px-4 sm:px-8 py-8 max-w-[1320px]">
          <motion.div key={section} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            {page}
          </motion.div>
        </main>
      </div>
    </div>
  );
}

function BellMenu({ onClose }: { onClose: () => void }) {
  const list = useStore((s) => s.notices.filter((n) => n.to === 'admin').slice(0, 12));
  useEffect(() => () => void markNoticesRead('admin'), []);
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="absolute left-0 top-12 z-50 w-[340px] max-w-[calc(100vw-32px)] rounded-2xl bg-[#0f121b] border border-line shadow-2xl overflow-hidden">
        <div className="px-4 h-12 flex items-center border-b border-line text-sm font-medium">التنبيهات</div>
        <div className="max-h-[380px] overflow-y-auto">
          {list.length === 0 && <p className="p-6 text-center text-sm text-muted">مفيش تنبيهات</p>}
          {list.map((n) => (
            <div key={n.id} className="px-4 py-3 flex gap-3 border-b border-line/60 last:border-0">
              <span className={cx('mt-1.5 size-2 rounded-full shrink-0', n.read ? 'bg-white/15' : 'bg-acc')} />
              <div className="min-w-0">
                <p className="text-[13px] leading-relaxed">{n.text}</p>
                <p className="text-[11px] text-muted mt-0.5">{timeAgo(n.at)}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </>
  );
}
