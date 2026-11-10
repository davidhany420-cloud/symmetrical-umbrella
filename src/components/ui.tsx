import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronRight, Loader2, Star, X, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { onToast, type ToastKind } from '@/lib/toast';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* ---------- Button ---------- */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'soft' | 'danger';
  size?: 'md' | 'lg' | 'sm';
  loading?: boolean;
  icon?: ReactNode;
};
export function Button({ variant = 'primary', size = 'md', loading, icon, className, children, disabled, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        'relative inline-flex items-center justify-center gap-2 font-semibold rounded-2xl transition-all active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none select-none',
        size === 'lg' && 'h-14 px-6 text-[15px]',
        size === 'md' && 'h-12 px-5 text-sm',
        size === 'sm' && 'h-9 px-3.5 text-xs rounded-xl',
        variant === 'primary' && 'bg-grad text-acc-ink glow hover:brightness-110',
        variant === 'ghost' && 'glass text-text hover:bg-surface-2',
        variant === 'soft' && 'bg-acc/12 text-acc border border-acc/25 hover:bg-acc/20',
        variant === 'danger' && 'bg-danger/12 text-danger border border-danger/30 hover:bg-danger/20',
        className,
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

/** Two-tap confirmation: first tap arms it, second tap runs the action. */
export function ConfirmButton({ onConfirm, confirmLabel = 'متأكد؟ دوس تاني', children, ...rest }: BtnProps & { onConfirm: () => void; confirmLabel?: ReactNode }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <Button {...rest} variant={armed ? 'danger' : rest.variant} onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}>
      {armed ? confirmLabel : children}
    </Button>
  );
}

export function IconBtn({ className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={cx('relative grid place-items-center size-11 rounded-2xl glass text-text hover:bg-surface-2 active:scale-95 transition', className)}
    >
      {children}
    </button>
  );
}

/* ---------- Inputs ---------- */
type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label?: string; icon?: ReactNode; hint?: string; error?: string };
export function Field({ label, icon, hint, error, className, ...rest }: FieldProps) {
  return (
    <label className="block space-y-1.5">
      {label && <span className="text-xs font-medium text-muted px-1">{label}</span>}
      <div
        className={cx(
          'flex items-center gap-3 h-14 px-4 rounded-2xl glass transition focus-within:border-acc/60 focus-within:bg-surface-2',
          error && 'border-danger/60',
        )}
      >
        {icon && <span className="text-muted shrink-0 [&>svg]:size-5">{icon}</span>}
        <input {...rest} className={cx('flex-1 min-w-0 bg-transparent outline-none text-[15px] placeholder:text-muted/60', className)} />
      </div>
      {(error || hint) && <span className={cx('block text-[11px] px-1', error ? 'text-danger' : 'text-muted')}>{error || hint}</span>}
    </label>
  );
}

export function Card({ className, children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={cx('glass rounded-3xl p-4', onClick && 'cursor-pointer active:scale-[0.99] transition', className)}>
      {children}
    </div>
  );
}

export function Pill({ children, tone = 'acc', className }: { children: ReactNode; tone?: 'acc' | 'ok' | 'warn' | 'danger' | 'muted'; className?: string }) {
  const tones = {
    acc: 'bg-acc/12 text-acc border-acc/25',
    ok: 'bg-ok/10 text-ok border-ok/25',
    warn: 'bg-warn/10 text-warn border-warn/25',
    danger: 'bg-danger/10 text-danger border-danger/25',
    muted: 'bg-white/5 text-muted border-white/10',
  };
  return (
    <span className={cx('inline-flex items-center gap-1 h-6 px-2.5 rounded-full border text-[11px] font-medium whitespace-nowrap', tones[tone], className)}>
      {children}
    </span>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[] }) {
  return (
    <div className="glass rounded-2xl p-1 flex gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx('relative flex-1 h-10 rounded-xl text-sm font-medium transition', value === o.value ? 'text-acc-ink' : 'text-muted hover:text-text')}
        >
          {value === o.value && <motion.span layoutId={`seg-${options.map((x) => x.value).join()}`} className="absolute inset-0 rounded-xl bg-grad" transition={{ type: 'spring', bounce: 0.2, duration: 0.45 }} />}
          <span className="relative inline-flex items-center gap-1.5">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------- Layout ---------- */
export function TopBar({ title, sub, onBack, right }: { title: ReactNode; sub?: ReactNode; onBack?: () => void; right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 px-5 pt-[max(var(--sat),16px)] pb-3 bg-bg/70 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        {onBack && (
          <IconBtn onClick={onBack} aria-label="رجوع">
            <ChevronRight className="size-5" />
          </IconBtn>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold truncate">{title}</h1>
          {sub && <p className="text-xs text-muted truncate">{sub}</p>}
        </div>
        {right}
      </div>
    </header>
  );
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
      className={cx('min-h-full', className)}
    >
      {children}
    </motion.div>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="relative w-full max-w-[460px] max-h-[88vh] overflow-y-auto rounded-t-[32px] bg-[#0b0d14] border-t border-line p-5 pb-[max(var(--sab),20px)]"
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/15" />
            {title && (
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">{title}</h3>
                <IconBtn onClick={onClose} className="size-9" aria-label="إغلاق">
                  <X className="size-4" />
                </IconBtn>
              </div>
            )}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

const AVATAR_GRADS = ['from-cyan-400 to-violet-500', 'from-fuchsia-400 to-orange-300', 'from-lime-300 to-emerald-500', 'from-sky-400 to-indigo-500', 'from-pink-400 to-purple-500', 'from-amber-300 to-rose-500'];
export function Avatar({ name, src, size = 44, ring }: { name: string; src?: string; size?: number; ring?: boolean }) {
  const idx = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_GRADS.length;
  const initials = name.replace('كابتن ', '').trim().slice(0, 1);
  return (
    <div
      style={{ width: size, height: size }}
      className={cx('shrink-0 rounded-2xl overflow-hidden grid place-items-center font-semibold text-black/80 bg-gradient-to-br', AVATAR_GRADS[idx], ring && 'ring-2 ring-acc ring-offset-2 ring-offset-bg')}
    >
      {src ? <img src={src} alt={name} className="size-full object-cover" /> : <span style={{ fontSize: size * 0.42 }}>{initials}</span>}
    </div>
  );
}

export function Stars({ value, onChange, size = 16 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <div className="flex gap-1" dir="ltr">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" disabled={!onChange} onClick={() => onChange?.(i)} className="disabled:cursor-default">
          <Star style={{ width: size, height: size }} className={i <= Math.round(value) ? 'fill-warn text-warn' : 'text-white/20'} />
        </button>
      ))}
    </div>
  );
}

export function Empty({ icon, title, sub, action }: { icon: ReactNode; title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center py-14 px-6">
      <div className="size-16 rounded-3xl glass grid place-items-center text-acc mb-4 [&>svg]:size-7">{icon}</div>
      <p className="font-semibold">{title}</p>
      {sub && <p className="text-sm text-muted mt-1 max-w-[260px]">{sub}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3 px-1">
      <h2 className="text-sm font-semibold text-muted tracking-wide">{children}</h2>
      {action}
    </div>
  );
}

/* ---------- Toasts (top of screen, never covers navigation) ---------- */
export function Toaster() {
  const [items, setItems] = useState<{ id: number; text: string; kind: ToastKind }[]>([]);
  useEffect(
    () =>
      onToast((t) => {
        setItems((x) => [...x.slice(-2), t]);
        setTimeout(() => setItems((x) => x.filter((i) => i.id !== t.id)), 3200);
      }),
    [],
  );
  const Icon = { ok: CheckCircle2, err: AlertTriangle, info: Info };
  return (
    <div className="fixed top-0 inset-x-0 z-[60] flex flex-col items-center gap-2 pt-[max(var(--sat),14px)] px-4 pointer-events-none">
      <AnimatePresence>
        {items.map((t) => {
          const I = Icon[t.kind];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="pointer-events-none max-w-[420px] w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#11141d]/95 border border-line backdrop-blur-xl shadow-2xl"
            >
              <I className={cx('size-5 shrink-0', t.kind === 'ok' && 'text-ok', t.kind === 'err' && 'text-danger', t.kind === 'info' && 'text-acc')} />
              <span className="text-sm">{t.text}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
