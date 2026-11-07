import { useState } from 'react';
import { Star, Ban, RotateCcw, Phone } from 'lucide-react';
import { Avatar, Button, ConfirmButton, Field, Pill } from '@/components/ui';
import { useStore } from '@/lib/store';
import { bikeClass } from '@/lib/config';
import { dateStr, egp, num } from '@/lib/format';
import { isSubscribed, suspendCaptain } from '@/lib/actions';
import { toast } from '@/lib/toast';
import type { CaptainProfile, User } from '@/lib/types';
import { Chips, Drawer, Lightbox, PageHead, SearchBox, Table, SERIES } from './kit';

type F = 'all' | 'active' | 'expired' | 'suspended';
type G = 'all' | 'male' | 'female';

export function Captains() {
  const s = useStore((x) => x);
  const [q, setQ] = useState('');
  const [f, setF] = useState<F>('all');
  const [g, setG] = useState<G>('all');
  const [open, setOpen] = useState<string | null>(null);

  const rows = s.captains
    .filter((c) => c.status === 'approved' || c.status === 'suspended')
    .map((c) => ({ c, u: s.users.find((u) => u.id === c.userId)! }))
    .filter(({ u }) => u);
  const state = (c: CaptainProfile): F => (c.status === 'suspended' ? 'suspended' : isSubscribed(c) ? 'active' : 'expired');
  const shown = rows
    .filter(({ c }) => f === 'all' || state(c) === f)
    .filter(({ u }) => g === 'all' || u.gender === g)
    .filter(({ c, u }) => !q || `${u.name} ${u.phone} ${c.plate} ${c.bikeModel}`.includes(q.trim()))
    .sort((a, b) => b.c.trips - a.c.trips);

  const sel = rows.find((r) => r.c.userId === open);

  return (
    <>
      <PageHead title="الكباتن" sub={`${num(rows.length)} كابتن معتمد على المنصة`} actions={<SearchBox value={q} onChange={setQ} placeholder="اسم، موبايل، نمرة…" />} />
      <div className="flex flex-wrap gap-3 mb-4">
        <Chips
          value={f}
          onChange={setF}
          options={[
            { value: 'all', label: 'الكل', count: rows.length },
            { value: 'active', label: 'مشترك', count: rows.filter((r) => state(r.c) === 'active').length },
            { value: 'expired', label: 'اشتراك منتهي', count: rows.filter((r) => state(r.c) === 'expired').length },
            { value: 'suspended', label: 'موقوف', count: rows.filter((r) => state(r.c) === 'suspended').length },
          ]}
        />
        <Chips value={g} onChange={setG} options={[{ value: 'all', label: 'الكل' }, { value: 'male', label: 'شباب' }, { value: 'female', label: 'بنات' }]} />
      </div>
      <Table
        rows={shown}
        rowKey={(r) => r.c.userId}
        onRow={(r) => setOpen(r.c.userId)}
        empty="مفيش كباتن بالفلتر ده"
        cols={[
          {
            key: 'n',
            label: 'الكابتن',
            render: ({ c, u }) => (
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Avatar name={u.name} src={c.photo} size={38} />
                  {c.online && isSubscribed(c) && <span className="absolute -bottom-0.5 -left-0.5 size-3 rounded-full bg-ok border-2 border-bg" />}
                </div>
                <div>
                  <div className="font-medium flex items-center gap-1.5">
                    {u.name}
                    <span className="size-1.5 rounded-full" style={{ background: u.gender === 'female' ? SERIES.girls : SERIES.boys }} />
                  </div>
                  <div className="text-xs text-muted" dir="ltr" style={{ textAlign: 'right' }}>
                    {u.phone}
                  </div>
                </div>
              </div>
            ),
          },
          { key: 'b', label: 'الموتوسيكل', hideSm: true, render: ({ c }) => <span className="text-muted">{bikeClass(c.bikeClass).name} · {c.bikeModel}</span> },
          { key: 'g', label: 'المحافظة', hideSm: true, render: ({ c }) => c.governorate },
          {
            key: 'r',
            label: 'التقييم',
            render: ({ c }) => (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Star className="size-3.5 fill-warn text-warn" /> {c.rating.toFixed(1)}
              </span>
            ),
          },
          { key: 't', label: 'المشاوير', hideSm: true, render: ({ c }) => <span className="tabular-nums">{num(c.trips)}</span> },
          {
            key: 's',
            label: 'الحالة',
            render: ({ c }) => {
              const st = state(c);
              return st === 'active' ? <Pill tone="ok">مشترك</Pill> : st === 'expired' ? <Pill tone="warn">{c.activeUntil ? 'منتهي' : 'لسه ما دفعش'}</Pill> : <Pill tone="danger">موقوف</Pill>;
            },
          },
        ]}
      />
      <Drawer open={!!sel} onClose={() => setOpen(null)} title={sel?.u.name} sub={sel && `${bikeClass(sel.c.bikeClass).name} · ${sel.c.governorate}`}>
        {sel && <CaptainDetail c={sel.c} u={sel.u} onClose={() => setOpen(null)} />}
      </Drawer>
    </>
  );
}

function CaptainDetail({ c, u, onClose }: { c: CaptainProfile; u: User; onClose: () => void }) {
  const rides = useStore((s) => s.bookings.filter((b) => b.captainId === c.userId));
  const earned = rides.filter((b) => b.status === 'done' || b.status === 'accepted').reduce((a, b) => a + (b.price ?? 0), 0);
  const [reason, setReason] = useState('');
  const [lb, setLb] = useState<number | null>(null);
  const docs = [
    ['الصورة', c.photo],
    ['البطاقة', c.idPhoto],
    ['الرخصة', c.licensePhoto],
    ['الموتوسيكل', c.bikePhoto],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Avatar name={u.name} src={c.photo} size={72} />
        <div className="space-y-1.5">
          <p className="text-sm text-muted inline-flex items-center gap-1.5">
            <Phone className="size-4" /> <span dir="ltr">{u.phone}</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Pill tone={u.gender === 'female' ? 'danger' : 'acc'}>{u.gender === 'female' ? 'سكة البنات' : 'سكة الشباب'}</Pill>
            {c.status === 'suspended' ? <Pill tone="danger">موقوف</Pill> : isSubscribed(c) ? <Pill tone="ok">مشترك</Pill> : <Pill tone="warn">اشتراك منتهي</Pill>}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          ['التقييم', c.rating.toFixed(1)],
          ['المشاوير', num(c.trips)],
          ['الدخل', egp(earned)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-white/[.04] border border-line p-3.5">
            <p className="text-[11px] text-muted">{k}</p>
            <p className="text-lg font-bold mt-1 tabular-nums">{v}</p>
          </div>
        ))}
      </div>
      <dl className="rounded-2xl border border-line divide-y divide-line text-sm">
        {[
          ['الموتوسيكل', c.bikeModel],
          ['النمرة', c.plate],
          ['الاشتراك لحد', c.activeUntil ? dateStr(c.activeUntil) : '—'],
          ['اتقبل يوم', c.reviewedAt ? dateStr(c.reviewedAt) : '—'],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between px-4 py-3">
            <dt className="text-muted">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {docs.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {docs.map(([l, src], i) => (
            <button key={l} onClick={() => setLb(i)} className="aspect-square rounded-xl overflow-hidden border border-line">
              <img src={src} alt={l} className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {c.status === 'suspended' ? (
        <Button
          className="w-full"
          icon={<RotateCcw className="size-4" />}
          onClick={() => {
            suspendCaptain(c.userId, false);
            toast(`اتفعّل ${u.name} تاني`);
            onClose();
          }}
        >
          إعادة تفعيل الكابتن
        </Button>
      ) : (
        <div className="rounded-2xl border border-danger/25 p-4 space-y-3">
          <p className="text-sm font-medium">إيقاف مؤقت</p>
          <Field id="suspend-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="السبب (هيوصل للكابتن)" />
          <ConfirmButton
            variant="danger"
            className="w-full"
            icon={<Ban className="size-4" />}
            confirmLabel="دوس تاني لتأكيد الإيقاف"
            onConfirm={() => {
              suspendCaptain(c.userId, true, reason.trim());
              toast(`اتوقف ${u.name}`, 'info');
              onClose();
            }}
          >
            إيقاف الكابتن
          </ConfirmButton>
        </div>
      )}
      <Lightbox items={docs.map(([label, src]) => ({ label, src }))} index={lb} onClose={() => setLb(null)} onIndex={setLb} />
    </div>
  );
}
