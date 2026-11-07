import { useEffect, useState } from 'react';
import { Check, X, Copy, Receipt, Plus, Pencil, Trash2, MapPin, Flag, Clock3, Lock, Wallet, Eye, EyeOff } from 'lucide-react';
import { Avatar, Button, Field, Pill, cx } from '@/components/ui';
import { RouteLine, STATUS } from '@/components/shared';
import { useStore } from '@/lib/store';
import { DAYS, GOVERNORATES, INSTAPAY_HANDLE, SUBSCRIPTION_PRICE, bikeClass } from '@/lib/config';
import { clock, dateStr, egp, num, timeAgo } from '@/lib/format';
import { changeAdminPassword, deleteLine, reviewPayment, saveLine } from '@/lib/actions';
import { uid } from '@/lib/crypto';
import { toast } from '@/lib/toast';
import type { BookingStatus, Line } from '@/lib/types';
import { Chips, Drawer, Lightbox, PageHead, SearchBox, Table, SERIES } from './kit';

/* ================= Payments ================= */
export function Payments() {
  const s = useStore((x) => x);
  const pending = s.captains.filter((c) => c.pendingPayment).sort((a, b) => a.pendingPayment!.at - b.pendingPayment!.at);
  const nameOf = (id: string) => s.users.find((u) => u.id === id)?.name ?? '—';
  const [img, setImg] = useState<string | null>(null);
  const total = s.payments.filter((p) => p.status === 'approved').reduce((a, p) => a + p.amount, 0);

  const copy = async (t: string) => {
    try {
      await navigator.clipboard.writeText(t);
      toast('اتنسخ رقم المرجع');
    } catch {
      toast(t, 'info');
    }
  };

  return (
    <>
      <PageHead title="المدفوعات" sub={`اشتراك الكابتن ${egp(SUBSCRIPTION_PRICE)} في السنة على InstaPay · ${INSTAPAY_HANDLE}`} actions={<div className="glass rounded-2xl px-5 py-3 text-left"><div className="text-[11px] text-muted">إجمالي المؤكد</div><div className="text-xl font-bold tabular-nums">{egp(total)}</div></div>} />

      <h2 className="text-sm text-muted mb-3">مستنية تأكيد ({num(pending.length)})</h2>
      {pending.length === 0 ? (
        <div className="glass rounded-3xl py-12 text-center text-sm text-muted mb-8">
          <Wallet className="size-7 mx-auto mb-3" /> مفيش تحويلات مستنية
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
          {pending.map((c) => (
            <div key={c.userId} className="glass rounded-3xl p-5 space-y-4">
              <div className="flex items-center gap-3">
                <Avatar name={nameOf(c.userId)} src={c.photo} size={44} />
                <div className="flex-1">
                  <p className="font-medium">{nameOf(c.userId)}</p>
                  <p className="text-xs text-muted">{timeAgo(c.pendingPayment!.at)}</p>
                </div>
                <span className="text-xl font-bold text-grad">{egp(SUBSCRIPTION_PRICE)}</span>
              </div>
              <button onClick={() => copy(c.pendingPayment!.ref)} className="w-full flex items-center justify-between rounded-xl bg-white/[.04] border border-line px-4 h-12 hover:bg-white/[.06]">
                <span className="text-xs text-muted">رقم المرجع</span>
                <span className="flex items-center gap-2 font-mono tabular-nums" dir="ltr">
                  {c.pendingPayment!.ref} <Copy className="size-3.5 text-muted" />
                </span>
              </button>
              {c.pendingPayment!.receipt ? (
                <button onClick={() => setImg(c.pendingPayment!.receipt!)} className="text-xs text-acc inline-flex items-center gap-1.5">
                  <Receipt className="size-4" /> عرض الإيصال
                </button>
              ) : (
                <p className="text-xs text-muted">من غير صورة إيصال — طابق رقم المرجع في InstaPay</p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" icon={<Check className="size-4" />} onClick={() => { reviewPayment(c.userId, true); toast(`اتفعّل اشتراك ${nameOf(c.userId)} لمدة سنة`); }}>
                  تأكيد
                </Button>
                <Button size="sm" variant="danger" icon={<X className="size-4" />} onClick={() => { reviewPayment(c.userId, false); toast('اترفض التحويل واتبلّغ الكابتن', 'info'); }}>
                  مش موجود
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="text-sm text-muted mb-3">السجل</h2>
      <Table
        rows={s.payments}
        rowKey={(p) => p.id}
        empty="لسه مفيش مدفوعات"
        cols={[
          { key: 'n', label: 'الكابتن', render: (p) => nameOf(p.captainId) },
          { key: 'r', label: 'المرجع', hideSm: true, render: (p) => <span className="font-mono text-muted" dir="ltr">{p.ref}</span> },
          { key: 'a', label: 'المبلغ', render: (p) => <span className="tabular-nums">{egp(p.amount)}</span> },
          { key: 'd', label: 'التاريخ', hideSm: true, render: (p) => <span className="text-muted">{dateStr(p.reviewedAt)}</span> },
          { key: 's', label: 'الحالة', render: (p) => (p.status === 'approved' ? <Pill tone="ok">مؤكد</Pill> : <Pill tone="danger">مرفوض</Pill>) },
        ]}
      />
      <Lightbox items={img ? [{ src: img, label: 'إيصال InstaPay' }] : []} index={img ? 0 : null} onClose={() => setImg(null)} onIndex={() => {}} />
    </>
  );
}

/* ================= Riders ================= */
export function Riders() {
  const s = useStore((x) => x);
  const [q, setQ] = useState('');
  const [g, setG] = useState<'all' | 'male' | 'female'>('all');
  const riders = s.users.filter((u) => u.role === 'client');
  const rows = riders
    .filter((u) => g === 'all' || u.gender === g)
    .filter((u) => !q || `${u.name} ${u.phone}`.includes(q.trim()))
    .map((u) => {
      const mine = s.bookings.filter((b) => b.clientId === u.id);
      return { u, rides: mine.filter((b) => b.status === 'done' || b.status === 'accepted').length, spent: mine.reduce((a, b) => a + (b.status === 'done' || b.status === 'accepted' ? b.price ?? 0 : 0), 0), last: mine[0]?.createdAt };
    })
    .sort((a, b) => b.rides - a.rides);
  return (
    <>
      <PageHead title="الركاب" sub={`${num(riders.length)} راكب مسجل`} actions={<SearchBox value={q} onChange={setQ} placeholder="اسم أو موبايل…" />} />
      <div className="mb-4">
        <Chips value={g} onChange={setG} options={[{ value: 'all', label: 'الكل', count: riders.length }, { value: 'male', label: 'شباب', count: riders.filter((r) => r.gender === 'male').length }, { value: 'female', label: 'بنات', count: riders.filter((r) => r.gender === 'female').length }]} />
      </div>
      <Table
        rows={rows}
        rowKey={(r) => r.u.id}
        empty="مفيش ركاب بالبحث ده"
        cols={[
          {
            key: 'n',
            label: 'الراكب',
            render: ({ u }) => (
              <div className="flex items-center gap-3">
                <Avatar name={u.name} size={36} />
                <span className="font-medium flex items-center gap-1.5">
                  {u.name}
                  <span className="size-1.5 rounded-full" style={{ background: u.gender === 'female' ? SERIES.girls : SERIES.boys }} />
                </span>
              </div>
            ),
          },
          { key: 'p', label: 'الموبايل', render: ({ u }) => <span dir="ltr" className="text-muted">{u.phone}</span> },
          { key: 'r', label: 'المشاوير', render: (r) => <span className="tabular-nums">{num(r.rides)}</span> },
          { key: 's', label: 'إجمالي الصرف', hideSm: true, render: (r) => <span className="tabular-nums">{egp(r.spent)}</span> },
          { key: 'l', label: 'آخر مشوار', hideSm: true, render: (r) => <span className="text-muted">{r.last ? timeAgo(r.last) : '—'}</span> },
          { key: 'j', label: 'انضم', hideSm: true, render: ({ u }) => <span className="text-muted">{dateStr(u.createdAt)}</span> },
        ]}
      />
    </>
  );
}

/* ================= Rides ================= */
const TONES: Record<BookingStatus, 'acc' | 'ok' | 'warn' | 'danger' | 'muted'> = { pending: 'warn', countered: 'acc', accepted: 'ok', rejected: 'danger', cancelled: 'muted', done: 'muted' };

export function Rides() {
  const s = useStore((x) => x);
  const [f, setF] = useState<'all' | 'live' | 'done' | 'cancelled'>('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const nameOf = (id: string) => s.users.find((u) => u.id === id)?.name ?? '—';
  const groups = { live: ['pending', 'countered', 'accepted'], done: ['done'], cancelled: ['cancelled', 'rejected'] } as Record<string, string[]>;
  const rows = s.bookings.filter((b) => f === 'all' || groups[f].includes(b.status)).filter((b) => !q || `${b.from} ${b.to} ${nameOf(b.clientId)} ${nameOf(b.captainId)}`.includes(q.trim()));
  const sel = s.bookings.find((b) => b.id === open);
  return (
    <>
      <PageHead title="المشاوير" sub={`${num(s.bookings.length)} طلب على المنصة`} actions={<SearchBox value={q} onChange={setQ} placeholder="مكان، راكب، كابتن…" />} />
      <div className="mb-4">
        <Chips
          value={f}
          onChange={setF}
          options={[
            { value: 'all', label: 'الكل', count: s.bookings.length },
            { value: 'live', label: 'جارية', count: s.bookings.filter((b) => groups.live.includes(b.status)).length },
            { value: 'done', label: 'خلصت', count: s.bookings.filter((b) => b.status === 'done').length },
            { value: 'cancelled', label: 'ملغية', count: s.bookings.filter((b) => groups.cancelled.includes(b.status)).length },
          ]}
        />
      </div>
      <Table
        rows={rows.slice(0, 150)}
        rowKey={(b) => b.id}
        onRow={(b) => setOpen(b.id)}
        empty="مفيش مشاوير بالفلتر ده"
        cols={[
          {
            key: 'r',
            label: 'المسار',
            render: (b) => (
              <div className="flex items-center gap-2 max-w-[280px]">
                <span className="size-2 rounded-full shrink-0" style={{ background: b.mode === 'girls' ? SERIES.girls : SERIES.boys }} />
                <span className="truncate">
                  {b.from} ← {b.to}
                </span>
              </div>
            ),
          },
          { key: 'c', label: 'الراكب', hideSm: true, render: (b) => nameOf(b.clientId) },
          { key: 'k', label: 'الكابتن', hideSm: true, render: (b) => nameOf(b.captainId) },
          { key: 't', label: 'النوع', hideSm: true, render: (b) => <span className="text-muted">{b.type === 'monthly' ? 'شهري' : 'مشوار'} · {bikeClass(b.bikeClass).name}</span> },
          { key: 'p', label: 'السعر', render: (b) => <span className="tabular-nums">{egp(b.price ?? b.counter ?? b.offer)}</span> },
          { key: 's', label: 'الحالة', render: (b) => <Pill tone={TONES[b.status]}>{STATUS[b.status].label}</Pill> },
          { key: 'd', label: 'الوقت', hideSm: true, render: (b) => <span className="text-muted">{timeAgo(b.createdAt)}</span> },
        ]}
      />
      <Drawer open={!!sel} onClose={() => setOpen(null)} title="تفاصيل المشوار" sub={sel && `${dateStr(sel.createdAt)} · ${clock(sel.createdAt)}`}>
        {sel && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-line p-4">
              <RouteLine from={sel.from} to={sel.to} />
            </div>
            <dl className="rounded-2xl border border-line divide-y divide-line text-sm">
              {[
                ['الراكب', nameOf(sel.clientId)],
                ['الكابتن', nameOf(sel.captainId)],
                ['السكة', sel.mode === 'girls' ? 'سكة البنات' : 'سكة الشباب'],
                ['النوع', sel.type === 'monthly' ? `اشتراك شهري · ${sel.days.map((d) => DAYS[d]).join('، ')}` : 'مشوار واحد'],
                ['المعاد', sel.time],
                ['عرض الراكب', egp(sel.offer)],
                ['السعر النهائي', sel.price ? egp(sel.price) : '—'],
                ['التقييم', sel.rating ? `${sel.rating} / 5` : '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-4 py-3">
                  <dt className="text-muted shrink-0">{k}</dt>
                  <dd className="text-left">{v}</dd>
                </div>
              ))}
            </dl>
            {sel.messages.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">سجل المحادثة</p>
                <div className="space-y-1.5 max-h-[300px] overflow-y-auto rounded-2xl border border-line p-3">
                  {sel.messages.map((m) => (
                    <p key={m.id} className="text-xs">
                      <span className="text-muted">{m.from === 'system' ? 'النظام' : m.from === 'client' ? 'الراكب' : 'الكابتن'}:</span> {m.text}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </>
  );
}

/* ================= Lines ================= */
const emptyLine = (): Line => ({ id: uid('l'), name: '', governorate: GOVERNORATES[0], from: '', to: '', time: '08:00', price: 1000, active: true });

export function Lines() {
  const lines = useStore((s) => s.lines);
  const [edit, setEdit] = useState<Line | null>(null);
  return (
    <>
      <PageHead title="الخطوط الثابتة" sub="خطوط الاشتراك الشهري اللي بتظهر للركاب في الصفحة الرئيسية" actions={<Button icon={<Plus className="size-4" />} onClick={() => setEdit(emptyLine())}>خط جديد</Button>} />
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {lines.map((l) => (
          <div key={l.id} className={cx('glass rounded-3xl p-5', !l.active && 'opacity-50')}>
            <div className="flex items-start justify-between gap-2 mb-4">
              <div>
                <p className="font-semibold">{l.name}</p>
                <p className="text-xs text-muted mt-1 inline-flex items-center gap-1">
                  {l.governorate} · <Clock3 className="size-3" /> {l.time} {!l.active && '· مخفي'}
                </p>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => setEdit(l)} className="size-9 rounded-xl glass grid place-items-center hover:bg-surface-2" aria-label="تعديل">
                  <Pencil className="size-4" />
                </button>
                <DeleteBtn id={l.id} />
              </div>
            </div>
            <RouteLine from={l.from} to={l.to} compact />
            <div className="mt-4 pt-4 border-t border-line flex justify-between items-baseline">
              <span className="text-xs text-muted">الاشتراك الشهري</span>
              <span className="text-xl font-bold tabular-nums">{egp(l.price)}</span>
            </div>
          </div>
        ))}
      </div>
      <Drawer open={!!edit} onClose={() => setEdit(null)} title={edit && lines.some((l) => l.id === edit.id) ? 'تعديل الخط' : 'خط جديد'} width={480}>
        {edit && (
          <LineForm
            line={edit}
            onSave={(l) => {
              saveLine(l);
              setEdit(null);
              toast('اتحفظ الخط وظهر للركاب');
            }}
          />
        )}
      </Drawer>
    </>
  );
}

function DeleteBtn({ id }: { id: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button onClick={() => (armed ? (deleteLine(id), toast('اتمسح الخط', 'info')) : setArmed(true))} className={cx('h-9 rounded-xl grid place-items-center text-danger transition-all', armed ? 'px-3 bg-danger/15 text-xs' : 'w-9 glass')} aria-label="مسح">
      {armed ? 'تأكيد المسح' : <Trash2 className="size-4" />}
    </button>
  );
}

function LineForm({ line, onSave }: { line: Line; onSave: (l: Line) => void }) {
  const [l, setL] = useState(line);
  const ok = l.name.trim() && l.from.trim() && l.to.trim() && l.price > 0;
  return (
    <div className="space-y-4">
      <Field id="line-name" label="اسم الخط" value={l.name} onChange={(e) => setL({ ...l, name: e.target.value })} placeholder="المعادي ⟵ التجمع" />
      <Field id="line-from" label="من" icon={<MapPin />} value={l.from} onChange={(e) => setL({ ...l, from: e.target.value })} />
      <Field id="line-to" label="إلى" icon={<Flag />} value={l.to} onChange={(e) => setL({ ...l, to: e.target.value })} />
      <div className="grid grid-cols-2 gap-3">
        <Field id="line-time" label="المعاد" icon={<Clock3 />} type="time" value={l.time} onChange={(e) => setL({ ...l, time: e.target.value })} />
        <Field id="line-price" label="السعر / شهر" value={String(l.price)} onChange={(e) => setL({ ...l, price: +e.target.value.replace(/\D/g, '') })} inputMode="numeric" />
      </div>
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-muted px-1">المحافظة</span>
        <select id="line-gov" value={l.governorate} onChange={(e) => setL({ ...l, governorate: e.target.value })} className="w-full h-14 px-4 rounded-2xl glass outline-none [&>option]:bg-[#0b0d14]">
          {GOVERNORATES.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
      </label>
      <label className="flex items-center justify-between glass rounded-2xl px-4 h-14 cursor-pointer">
        <span className="text-sm">ظاهر للركاب</span>
        <input id="line-active" type="checkbox" checked={l.active} onChange={(e) => setL({ ...l, active: e.target.checked })} className="size-5 accent-[var(--acc)]" />
      </label>
      <Button size="lg" className="w-full" disabled={!ok} onClick={() => onSave({ ...l, name: l.name.trim(), from: l.from.trim(), to: l.to.trim() })}>
        حفظ
      </Button>
    </div>
  );
}

/* ================= Settings ================= */
export function Settings() {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (next.length < 8) return toast('كلمة السر الجديدة لازم 8 حروف على الأقل', 'err');
    setBusy(true);
    try {
      await changeAdminPassword(cur, next);
      setCur('');
      setNext('');
      toast('اتغيرت كلمة السر');
    } catch {
      toast('كلمة السر الحالية غلط', 'err');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHead title="الإعدادات" />
      <div className="grid xl:grid-cols-2 gap-4 max-w-[1000px]">
        <section className="glass rounded-3xl p-6 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Lock className="size-5 text-acc" /> كلمة سر الأدمن
          </h2>
          <Field id="cur-pass" type={show ? 'text' : 'password'} label="الحالية" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" />
          <Field id="new-pass" type={show ? 'text' : 'password'} label="الجديدة" value={next} onChange={(e) => setNext(e.target.value)} hint="8 حروف على الأقل" autoComplete="new-password" />
          <div className="flex items-center gap-3">
            <Button loading={busy} disabled={!cur || !next} onClick={save}>
              حفظ
            </Button>
            <button onClick={() => setShow((x) => !x)} className="text-xs text-muted inline-flex items-center gap-1.5">
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />} {show ? 'إخفاء' : 'إظهار'}
            </button>
          </div>
        </section>
        <section className="glass rounded-3xl p-6 space-y-3">
          <h2 className="font-semibold">بيانات الدفع</h2>
          <dl className="rounded-2xl border border-line divide-y divide-line text-sm">
            <div className="flex justify-between px-4 py-3">
              <dt className="text-muted">InstaPay</dt>
              <dd dir="ltr">{INSTAPAY_HANDLE}</dd>
            </div>
            <div className="flex justify-between px-4 py-3">
              <dt className="text-muted">اشتراك الكابتن</dt>
              <dd>{egp(SUBSCRIPTION_PRICE)} / سنة</dd>
            </div>
          </dl>
          <p className="text-xs text-muted">بتتغير من ملف src/lib/config.ts</p>
        </section>
      </div>
    </>
  );
}
