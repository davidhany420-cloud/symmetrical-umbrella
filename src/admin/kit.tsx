import { useEffect, useId, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { cx } from '@/components/ui';
import { num } from '@/lib/format';

/* Chart colors — validated for dark surface (lightness band, CVD ΔE ≥ 8). */
export const SERIES = { boys: '#2a9fd6', girls: '#d9439b' };

/* ---------- Side drawer (desktop) / full sheet (phone) ---------- */
export function Drawer({ open, onClose, title, sub, children, width = 560 }: { open: boolean; onClose: () => void; title?: ReactNode; sub?: ReactNode; children: ReactNode; width?: number }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            style={{ maxWidth: width }}
            className="absolute inset-y-0 left-0 w-full bg-[#0a0c13] border-r border-line flex flex-col"
          >
            <header className="flex items-start gap-3 px-6 pt-6 pb-4 border-b border-line">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold truncate">{title}</h3>
                {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
              </div>
              <button onClick={onClose} className="size-10 rounded-xl glass grid place-items-center hover:bg-surface-2" aria-label="إغلاق">
                <X className="size-4" />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ---------- Document lightbox with zoom ---------- */
export function Lightbox({ items, index, onClose, onIndex }: { items: { src: string; label: string }[]; index: number | null; onClose: () => void; onIndex: (i: number) => void }) {
  const [zoom, setZoom] = useState(false);
  useEffect(() => setZoom(false), [index]);
  useEffect(() => {
    if (index === null) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onIndex((index + 1) % items.length);
      if (e.key === 'ArrowRight') onIndex((index - 1 + items.length) % items.length);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [index, items.length, onClose, onIndex]);
  const it = index !== null ? items[index] : null;
  return (
    <AnimatePresence>
      {it && index !== null && (
        <motion.div className="fixed inset-0 z-[70] bg-black/90 backdrop-blur flex flex-col" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="flex items-center gap-2 p-4">
            <span className="flex-1 text-sm">
              {it.label} <span className="text-muted">· {index + 1}/{items.length}</span>
            </span>
            <button onClick={() => setZoom((z) => !z)} className="size-10 rounded-xl glass grid place-items-center" aria-label="تكبير">
              {zoom ? <ZoomOut className="size-4" /> : <ZoomIn className="size-4" />}
            </button>
            <button onClick={onClose} className="size-10 rounded-xl glass grid place-items-center" aria-label="إغلاق">
              <X className="size-4" />
            </button>
          </div>
          <div className={cx('flex-1 min-h-0 p-4', zoom ? 'overflow-auto' : 'grid place-items-center')}>
            <img src={it.src} alt={it.label} onClick={() => setZoom((z) => !z)} className={cx('rounded-2xl', zoom ? 'max-w-none w-[200%] cursor-zoom-out' : 'max-h-full max-w-full object-contain cursor-zoom-in')} />
          </div>
          {items.length > 1 && (
            <div className="flex justify-center gap-3 pb-6">
              <button onClick={() => onIndex((index - 1 + items.length) % items.length)} className="size-11 rounded-xl glass grid place-items-center" aria-label="السابق">
                <ChevronRight className="size-5" />
              </button>
              <button onClick={() => onIndex((index + 1) % items.length)} className="size-11 rounded-xl glass grid place-items-center" aria-label="التالي">
                <ChevronLeft className="size-5" />
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- Page header ---------- */
export function PageHead({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-4 mb-6">
      <div className="flex-1 min-w-[200px]">
        <h1 className="text-[26px] font-bold tracking-tight">{title}</h1>
        {sub && <p className="text-sm text-muted mt-1">{sub}</p>}
      </div>
      {actions}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder = 'بحث…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex items-center gap-2 h-11 px-3.5 rounded-xl glass focus-within:border-acc/50 min-w-[220px]">
      <Search className="size-4 text-muted" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted/60" />
    </label>
  );
}

export function Chips<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx('h-9 px-3.5 rounded-xl text-[13px] font-medium inline-flex items-center gap-2 transition', value === o.value ? 'bg-text text-bg' : 'glass text-muted hover:text-text')}
        >
          {o.label}
          {o.count !== undefined && <span className={cx('text-[11px] tabular-nums', value === o.value ? 'text-bg/60' : 'text-muted/70')}>{num(o.count)}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------- Table ---------- */
export interface Col<T> {
  key: string;
  label: string;
  render: (r: T) => ReactNode;
  className?: string;
  hideSm?: boolean;
}
export function Table<T>({ rows, cols, rowKey, onRow, empty }: { rows: T[]; cols: Col<T>[]; rowKey: (r: T) => string; onRow?: (r: T) => void; empty?: ReactNode }) {
  if (!rows.length) return <div className="glass rounded-3xl py-14 text-center text-sm text-muted">{empty ?? 'مفيش بيانات'}</div>;
  return (
    <div className="glass rounded-3xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] text-muted tracking-wide border-b border-line">
              {cols.map((c) => (
                <th key={c.key} className={cx('text-right font-medium px-5 h-11 whitespace-nowrap', c.hideSm && 'hidden md:table-cell', c.className)}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={rowKey(r)} onClick={onRow ? () => onRow(r) : undefined} className={cx('border-b border-line/60 last:border-0 transition', onRow && 'cursor-pointer hover:bg-white/[.03]')}>
                {cols.map((c) => (
                  <td key={c.key} className={cx('px-5 py-3.5 whitespace-nowrap', c.hideSm && 'hidden md:table-cell', c.className)}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- KPI tile with optional sparkline ---------- */
export function Kpi({ label, value, hint, icon, spark, tone, onClick }: { label: string; value: ReactNode; hint?: ReactNode; icon: ReactNode; spark?: number[]; tone?: 'warn'; onClick?: () => void }) {
  const id = useId();
  const path = useMemo(() => {
    if (!spark || spark.length < 2) return null;
    const max = Math.max(...spark, 1);
    const pts = spark.map((v, i) => [(i / (spark.length - 1)) * 100, 30 - (v / max) * 26 - 2]);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
    return { line, area: `${line} L100 32 L0 32 Z`, end: pts[pts.length - 1] };
  }, [spark]);
  return (
    <div onClick={onClick} className={cx('glass rounded-3xl p-5 relative overflow-hidden', onClick && 'cursor-pointer hover:bg-surface-2 transition', tone === 'warn' && 'border-warn/30!')}>
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-muted">{label}</span>
        <span className={cx('size-9 rounded-xl grid place-items-center [&>svg]:size-[18px]', tone === 'warn' ? 'bg-warn/10 text-warn' : 'bg-acc/10 text-acc')}>{icon}</span>
      </div>
      <div className="mt-3 text-[30px] leading-none font-bold tabular-nums tracking-tight">{value}</div>
      {hint && <div className="mt-2 text-xs text-muted">{hint}</div>}
      {path && (
        <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="mt-4 w-full h-10" aria-hidden>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--acc)" stopOpacity=".35" />
              <stop offset="1" stopColor="var(--acc)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={path.area} fill={`url(#${id})`} />
          <path d={path.line} fill="none" stroke="var(--acc)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
    </div>
  );
}

/* ---------- Area chart with crosshair tooltip ---------- */
export function AreaChart({ data, height = 240, unit = '' }: { data: { label: string; value: number }[]; height?: number; unit?: string }) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pad = { l: 36, r: 12, t: 16, b: 28 };
  const max = Math.max(...data.map((d) => d.value), 1);
  const nice = Math.ceil(max / 5) * 5 || 5;
  const iw = Math.max(1, w - pad.l - pad.r);
  const ih = height - pad.t - pad.b;
  const x = (i: number) => pad.l + (data.length < 2 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / nice) * ih;
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)} ${y(d.value)}`).join(' ');
  const area = `${line} L${x(data.length - 1)} ${pad.t + ih} L${x(0)} ${pad.t + ih} Z`;
  const ticks = [0, nice / 2, nice];
  const last = data.length - 1;

  const onMove = (e: PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const px = e.clientX - r.left;
    const i = Math.round(((px - pad.l) / iw) * (data.length - 1));
    setHover(Math.max(0, Math.min(last, i)));
  };

  return (
    <div ref={ref} className="relative select-none" dir="ltr" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
      <svg width={w} height={height} className="block">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--acc)" stopOpacity=".28" />
            <stop offset="1" stopColor="var(--acc)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,.06)" strokeDasharray={t ? '3 4' : undefined} />
            <text x={pad.l - 10} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
              {t}
            </text>
          </g>
        ))}
        {data.map((d, i) =>
          (last - i) % Math.ceil(data.length / 7) === 0 ? (
            <text key={i} x={x(i)} y={height - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">
              {d.label}
            </text>
          ) : null,
        )}
        <path d={area} fill={`url(#${id})`} />
        <path d={line} fill="none" stroke="var(--acc)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(last)} cy={y(data[last].value)} r="4.5" fill="var(--acc)" stroke="#0b0d14" strokeWidth="2" />
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke="rgba(255,255,255,.25)" />
            <circle cx={x(hover)} cy={y(data[hover].value)} r="5" fill="var(--acc)" stroke="#0b0d14" strokeWidth="2" />
          </g>
        )}
      </svg>
      {hover !== null && (
        <div className="absolute pointer-events-none -translate-x-1/2 px-3 py-2 rounded-xl bg-[#151925] border border-line text-xs shadow-xl" style={{ left: x(hover), top: Math.max(0, y(data[hover].value) - 58) }} dir="rtl">
          <div className="text-muted">{data[hover].label}</div>
          <div className="font-semibold tabular-nums">
            {num(data[hover].value)} {unit}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Horizontal bars (single series) with hover ---------- */
export function BarList({ rows, format }: { rows: { label: string; value: number; sub?: string }[]; format: (v: number) => string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="space-y-3.5">
      {rows.map((r, i) => (
        <div key={r.label} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} className="group">
          <div className="flex justify-between text-[13px] mb-1.5">
            <span>
              {r.label} {r.sub && <span className="text-muted text-[11px]">· {r.sub}</span>}
            </span>
            <span className={cx('tabular-nums', hover === i ? 'text-text' : 'text-muted')}>{format(r.value)}</span>
          </div>
          <div className="h-2.5 rounded-full bg-white/[.05]" dir="ltr">
            <div className={cx('h-full rounded-full transition-[filter]', hover === i && 'brightness-125')} style={{ width: `${(r.value / max) * 100}%`, background: 'var(--acc)', minWidth: r.value ? 6 : 0 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Two-part split bar (boys / girls) ---------- */
export function SplitBar({ a, b, aLabel, bLabel }: { a: number; b: number; aLabel: string; bLabel: string }) {
  const t = Math.max(1, a + b);
  const [hover, setHover] = useState<'a' | 'b' | null>(null);
  return (
    <div>
      <div className="flex h-3.5 gap-[2px] rounded-full overflow-hidden" dir="ltr">
        <div onPointerEnter={() => setHover('a')} onPointerLeave={() => setHover(null)} style={{ width: `${(a / t) * 100}%`, background: SERIES.boys }} className={cx('transition', hover === 'b' && 'opacity-50')} />
        <div onPointerEnter={() => setHover('b')} onPointerLeave={() => setHover(null)} style={{ width: `${(b / t) * 100}%`, background: SERIES.girls }} className={cx('transition', hover === 'a' && 'opacity-50')} />
      </div>
      <div className="mt-3 flex justify-between text-[13px]">
        <span className="flex items-center gap-2">
          <span className="size-2.5 rounded-sm" style={{ background: SERIES.boys }} />
          {aLabel} <b className="tabular-nums font-semibold">{num(a)}</b> <span className="text-muted tabular-nums">({Math.round((a / t) * 100)}%)</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="size-2.5 rounded-sm" style={{ background: SERIES.girls }} />
          {bLabel} <b className="tabular-nums font-semibold">{num(b)}</b> <span className="text-muted tabular-nums">({Math.round((b / t) * 100)}%)</span>
        </span>
      </div>
    </div>
  );
}
