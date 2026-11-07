import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Check, X, ChevronRight, Phone, MapPin, IdCard, FileBadge, Bike, UserRound, Clock3, Inbox, ShieldCheck, Maximize2 } from 'lucide-react';
import { Avatar, Button, Pill, cx } from '@/components/ui';
import { BikeArt } from '@/components/art';
import { useStore } from '@/lib/store';
import { go } from '@/lib/router';
import { bikeClass } from '@/lib/config';
import { dateStr, timeAgo, num } from '@/lib/format';
import { reviewCaptain } from '@/lib/actions';
import { toast } from '@/lib/toast';
import type { CaptainProfile, User } from '@/lib/types';
import { Chips, Lightbox, PageHead } from './kit';

const CHECKS = [
  { id: 'face', label: 'الصورة الشخصية واضحة ومطابقة لصورة البطاقة' },
  { id: 'id', label: 'البطاقة سارية والرقم القومي مطابق' },
  { id: 'license', label: 'رخصة القيادة سارية وتشمل الدراجات النارية' },
  { id: 'bike', label: 'الموتوسيكل بحالة كويسة والنمرة مطابقة' },
];

const REASONS = ['صورة البطاقة مش واضحة', 'الرخصة منتهية', 'الصورة الشخصية مش مطابقة', 'النمرة مش ظاهرة في صورة الموتوسيكل', 'بيانات ناقصة'];

type Filter = 'pending' | 'approved' | 'rejected';

export function Applications({ id }: { id?: string }) {
  const s = useStore((x) => x);
  const [filter, setFilter] = useState<Filter>('pending');
  const all = s.captains.filter((c) => c.submittedAt || c.status === 'pending');
  const list = all
    .filter((c) => (filter === 'rejected' ? c.status === 'rejected' : c.status === filter))
    .sort((a, b) => (filter === 'pending' ? (a.submittedAt ?? 0) - (b.submittedAt ?? 0) : (b.reviewedAt ?? 0) - (a.reviewedAt ?? 0)));
  const count = (f: Filter) => all.filter((c) => c.status === f).length;

  const selected = s.captains.find((c) => c.userId === id);
  const selUser = s.users.find((u) => u.id === id);

  // desktop: open the oldest pending application automatically
  useEffect(() => {
    if (!id && filter === 'pending' && list[0] && window.matchMedia('(min-width: 1024px)').matches) go(`/applications/${list[0].userId}`, true);
  }, [id, filter, list]);

  const nextAfter = (uid: string) => {
    const rest = s.captains.filter((c) => c.status === 'pending' && c.userId !== uid).sort((a, b) => (a.submittedAt ?? 0) - (b.submittedAt ?? 0));
    go(rest[0] ? `/applications/${rest[0].userId}` : '/applications', true);
  };

  return (
    <>
      <PageHead title="طلبات الانضمام" sub="راجع بيانات ومستندات كل كابتن قبل ما يظهر للركاب" actions={<Chips value={filter} onChange={(f) => { setFilter(f); go('/applications', true); }} options={[{ value: 'pending', label: 'مستنية مراجعة', count: count('pending') }, { value: 'approved', label: 'اتقبلت', count: count('approved') }, { value: 'rejected', label: 'اترفضت', count: count('rejected') }]} />} />

      <div className="grid lg:grid-cols-[340px_1fr] gap-4 items-start">
        {/* queue */}
        <div className={cx('glass rounded-3xl p-2 lg:sticky lg:top-28', id && 'hidden lg:block')}>
          {list.length === 0 ? (
            <div className="py-16 text-center">
              <Inbox className="size-8 text-muted mx-auto" />
              <p className="mt-3 text-sm text-muted">{filter === 'pending' ? 'مفيش طلبات مستنية — عاش ✓' : 'مفيش حاجة هنا'}</p>
            </div>
          ) : (
            list.map((c) => {
              const u = s.users.find((x) => x.id === c.userId)!;
              const active = c.userId === id;
              return (
                <button key={c.userId} onClick={() => go(`/applications/${c.userId}`)} className={cx('w-full flex items-center gap-3 p-3 rounded-2xl text-right transition', active ? 'bg-white/[.07]' : 'hover:bg-white/[.03]')}>
                  <Avatar name={u.name} src={c.photo} size={44} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      {u.name}
                      <span className="size-1.5 rounded-full" style={{ background: u.gender === 'female' ? '#d9439b' : '#2a9fd6' }} />
                    </p>
                    <p className="text-xs text-muted truncate">
                      {bikeClass(c.bikeClass).name} · {c.governorate}
                    </p>
                  </div>
                  <span className="text-[11px] text-muted">{timeAgo((filter === 'pending' ? c.submittedAt : c.reviewedAt) ?? Date.now())}</span>
                </button>
              );
            })
          )}
        </div>

        {/* detail */}
        <div className={cx(!id && 'hidden lg:block')}>
          {selected && selUser ? (
            <Review key={selected.userId} cap={selected} user={selUser} onDecided={() => nextAfter(selected.userId)} />
          ) : (
            <div className="glass rounded-3xl py-24 text-center text-sm text-muted">اختار طلب من القائمة علشان تراجعه</div>
          )}
        </div>
      </div>
    </>
  );
}

function Review({ cap, user, onDecided }: { cap: CaptainProfile; user: User; onDecided: () => void }) {
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [lb, setLb] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reasons, setReasons] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const allChecked = CHECKS.every((c) => checks[c.id]);
  const docs = [
    { key: 'photo', label: 'الصورة الشخصية', icon: <UserRound />, src: cap.photo },
    { key: 'id', label: 'البطاقة', icon: <IdCard />, src: cap.idPhoto },
    { key: 'license', label: 'رخصة القيادة', icon: <FileBadge />, src: cap.licensePhoto },
    { key: 'bike', label: 'الموتوسيكل', icon: <Bike />, src: cap.bikePhoto },
  ];
  const viewable = docs.filter((d) => d.src).map((d) => ({ src: d.src!, label: d.label }));
  const cls = bikeClass(cap.bikeClass);
  const pending = cap.status === 'pending';

  const [busy, setBusy] = useState(false);
  const approve = async () => {
    setBusy(true);
    const ok = await reviewCaptain(cap.userId, true);
    setBusy(false);
    if (!ok) return;
    toast(`اتقبل ${user.name} — هيوصله تنبيه دلوقتي`);
    onDecided();
  };
  const reject = async () => {
    const reason = [...reasons, note.trim()].filter(Boolean).join('، ');
    setBusy(true);
    const ok = await reviewCaptain(cap.userId, false, reason);
    setBusy(false);
    if (!ok) return;
    toast(`اترفض طلب ${user.name}`, 'info');
    onDecided();
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <button onClick={() => go('/applications')} className="lg:hidden inline-flex items-center gap-1 text-sm text-muted">
        <ChevronRight className="size-4" /> كل الطلبات
      </button>

      {/* identity */}
      <section className="glass rounded-3xl p-6 relative overflow-hidden">
        <div className="absolute -left-10 -top-6 w-72 opacity-[.12] pointer-events-none">
          <BikeArt kind={cap.bikeClass} className="w-full" />
        </div>
        <div className="relative flex flex-wrap items-center gap-5">
          <button onClick={() => cap.photo && setLb(0)} className="relative">
            <Avatar name={user.name} src={cap.photo} size={84} />
          </button>
          <div className="flex-1 min-w-[200px]">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-bold">{user.name}</h2>
              <Pill tone={user.gender === 'female' ? 'danger' : 'acc'} className={user.gender === 'female' ? '!text-[#ff7ac9] !bg-[#d9439b]/15 !border-[#d9439b]/30' : ''}>
                {user.gender === 'female' ? 'كابتن بنت · سكة البنات' : 'كابتن شاب · سكة الشباب'}
              </Pill>
              {cap.status === 'approved' && <Pill tone="ok">مقبول</Pill>}
              {cap.status === 'rejected' && <Pill tone="danger">مرفوض</Pill>}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Phone className="size-4" /> <span dir="ltr">{user.phone}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" /> {cap.governorate}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="size-4" /> اتقدّم {timeAgo(cap.submittedAt ?? user.createdAt)}
              </span>
            </div>
          </div>
        </div>
        <div className="relative mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ['الفئة', `${cls.name} · ${cls.en}`],
            ['الموديل', cap.bikeModel],
            ['النمرة', cap.plate],
            ['الرقم القومي', cap.nationalId || '—'],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-white/[.04] border border-line p-3.5 min-w-0">
              <p className="text-[11px] text-muted">{k}</p>
              <p className="text-sm font-medium mt-1 truncate" dir={k === 'الرقم القومي' ? 'ltr' : undefined} style={k === 'الرقم القومي' ? { textAlign: 'right' } : undefined}>
                {v}
              </p>
            </div>
          ))}
        </div>
        {cap.status === 'rejected' && cap.rejectReason && <p className="relative mt-4 text-sm text-danger">سبب الرفض: {cap.rejectReason}</p>}
      </section>

      {/* documents */}
      <section className="glass rounded-3xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">المستندات</h3>
          <span className="text-xs text-muted">{num(viewable.length)} من 4 · دوس على أي صورة لتكبيرها</span>
        </div>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {docs.map((d) => (
            <button
              key={d.key}
              disabled={!d.src}
              onClick={() => setLb(viewable.findIndex((v) => v.src === d.src))}
              className="group relative aspect-[4/3] rounded-2xl overflow-hidden bg-white/[.04] border border-line text-right disabled:cursor-not-allowed"
            >
              {d.src ? (
                <>
                  <img src={d.src} alt={d.label} className="absolute inset-0 size-full object-cover group-hover:scale-105 transition duration-500" />
                  <span className="absolute top-2 left-2 size-8 rounded-lg bg-black/50 backdrop-blur grid place-items-center opacity-0 group-hover:opacity-100 transition">
                    <Maximize2 className="size-4" />
                  </span>
                </>
              ) : (
                <span className="absolute inset-0 grid place-items-center text-xs text-danger">ناقص</span>
              )}
              <span className="absolute inset-x-0 bottom-0 px-3 py-2 bg-gradient-to-t from-black/85 to-transparent text-xs flex items-center gap-1.5 [&>svg]:size-3.5">
                {d.icon} {d.label}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* decision */}
      {pending && (
        <section className="glass rounded-3xl p-6">
          <h3 className="font-semibold flex items-center gap-2">
            <ShieldCheck className="size-5 text-acc" /> التحقق
          </h3>
          <p className="text-xs text-muted mt-1">علّم على كل بند بعد ما تتأكد منه — القبول بيتفتح لما تخلص الأربعة.</p>
          <div className="mt-4 grid sm:grid-cols-2 gap-2">
            {CHECKS.map((c) => (
              <label key={c.id} className={cx('flex items-center gap-3 p-3.5 rounded-2xl border cursor-pointer transition', checks[c.id] ? 'border-ok/40 bg-ok/[.06]' : 'border-line hover:bg-white/[.03]')}>
                <input id={`chk-${c.id}`} type="checkbox" checked={!!checks[c.id]} onChange={(e) => setChecks((x) => ({ ...x, [c.id]: e.target.checked }))} className="sr-only" />
                <span className={cx('size-6 rounded-lg border-2 grid place-items-center shrink-0 transition', checks[c.id] ? 'bg-ok border-ok text-bg' : 'border-white/20')}>{checks[c.id] && <Check className="size-4" />}</span>
                <span className="text-sm">{c.label}</span>
              </label>
            ))}
          </div>

          {rejecting ? (
            <div className="mt-6 rounded-2xl border border-danger/30 bg-danger/[.05] p-4">
              <p className="text-sm font-medium">سبب الرفض (هيوصل للكابتن)</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {REASONS.map((r) => (
                  <button key={r} onClick={() => setReasons((x) => (x.includes(r) ? x.filter((y) => y !== r) : [...x, r]))} className={cx('h-9 px-3 rounded-xl text-xs border transition', reasons.includes(r) ? 'bg-danger/15 border-danger/40 text-danger' : 'border-line text-muted hover:text-text')}>
                    {r}
                  </button>
                ))}
              </div>
              <textarea id="reject-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="ملاحظة إضافية (اختياري)" className="mt-3 w-full rounded-xl glass p-3 text-sm outline-none focus:border-danger/40 resize-none" />
              <div className="mt-3 flex gap-2">
                <Button variant="danger" loading={busy} disabled={!reasons.length && !note.trim()} onClick={reject} icon={<X className="size-4" />}>
                  تأكيد الرفض
                </Button>
                <Button variant="ghost" onClick={() => setRejecting(false)}>
                  رجوع
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="lg" loading={busy} disabled={!allChecked} onClick={approve} icon={<Check className="size-5" />} className="min-w-[200px]">
                قبول الكابتن
              </Button>
              <Button size="lg" variant="danger" onClick={() => setRejecting(true)} icon={<X className="size-5" />}>
                رفض
              </Button>
              {!allChecked && <span className="self-center text-xs text-muted">فاضل {num(CHECKS.filter((c) => !checks[c.id]).length)} بنود</span>}
            </div>
          )}
        </section>
      )}
      {!pending && cap.reviewedAt && <p className="text-xs text-muted text-center">اتراجع يوم {dateStr(cap.reviewedAt)}</p>}

      <Lightbox items={viewable} index={lb} onClose={() => setLb(null)} onIndex={setLb} />
    </motion.div>
  );
}
