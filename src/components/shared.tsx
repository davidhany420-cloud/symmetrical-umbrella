import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { Send, ShieldCheck, Star } from 'lucide-react';
import { Avatar, Pill, cx } from './ui';
import { go } from '@/lib/router';
import { bikeClass } from '@/lib/config';
import { clock, num } from '@/lib/format';
import { useStore } from '@/lib/store';
import type { Booking, BookingStatus, CaptainProfile, User } from '@/lib/types';

/* ---------- Bottom navigation (sticky, inside the app frame) ---------- */
export interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  badge?: number;
  primary?: boolean;
}
export function BottomNav({ items, active }: { items: NavItem[]; active: string }) {
  return (
    <nav className="sticky bottom-0 z-40 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-2 bg-gradient-to-t from-bg via-bg/90 to-transparent">
      <div className="glass rounded-[26px] h-[68px] px-2 flex items-center justify-around">
        {items.map((it) =>
          it.primary ? (
            <button key={it.to} onClick={() => go(it.to)} aria-label={it.label} className="-mt-8 size-16 rounded-[22px] bg-grad text-acc-ink grid place-items-center glow active:scale-95 transition [&>svg]:size-7">
              {it.icon}
            </button>
          ) : (
            <button key={it.to} onClick={() => go(it.to)} className={cx('relative flex flex-col items-center gap-1 w-14 py-1 transition', active === it.to ? 'text-acc' : 'text-muted hover:text-text')}>
              <span className="[&>svg]:size-[22px]">{it.icon}</span>
              <span className="text-[10px] font-medium">{it.label}</span>
              {active === it.to && <motion.span layoutId="nav-dot" className="absolute -bottom-1.5 size-1 rounded-full bg-acc" />}
              {!!it.badge && <span className="absolute top-0 right-2.5 min-w-4 h-4 px-1 rounded-full bg-danger text-[9px] text-white grid place-items-center">{it.badge}</span>}
            </button>
          ),
        )}
      </div>
    </nav>
  );
}

/* ---------- Booking status ---------- */
export const STATUS: Record<BookingStatus, { label: string; tone: 'acc' | 'ok' | 'warn' | 'danger' | 'muted' }> = {
  pending: { label: 'مستني رد الكابتن', tone: 'warn' },
  countered: { label: 'الكابتن اقترح سعر', tone: 'acc' },
  accepted: { label: 'متأكد', tone: 'ok' },
  rejected: { label: 'اتعتذر', tone: 'danger' },
  cancelled: { label: 'ملغي', tone: 'muted' },
  done: { label: 'خلص', tone: 'muted' },
};
export const StatusPill = ({ s }: { s: BookingStatus }) => <Pill tone={STATUS[s].tone}>{STATUS[s].label}</Pill>;

/* ---------- Captain card ---------- */
export function CaptainRow({ user, cap, right, onClick, selected }: { user: User; cap: CaptainProfile; right?: ReactNode; onClick?: () => void; selected?: boolean }) {
  return (
    <div
      onClick={onClick}
      className={cx('flex items-center gap-3 p-3 rounded-2xl glass transition', onClick && 'cursor-pointer hover:bg-surface-2', selected && 'border-acc! bg-acc/8')}
    >
      <div className="relative">
        <Avatar name={user.name} src={cap.photo} size={52} />
        {cap.online && <span className="absolute -bottom-0.5 -left-0.5 size-3.5 rounded-full bg-ok border-2 border-bg" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold truncate">{user.name}</span>
          <ShieldCheck className="size-4 text-acc shrink-0" />
        </div>
        <div className="text-xs text-muted truncate mt-0.5">
          {cap.bikeModel} · {bikeClass(cap.bikeClass).name}
        </div>
        <div className="flex items-center gap-2 mt-1 text-[11px] text-muted">
          <span className="inline-flex items-center gap-0.5 text-warn">
            <Star className="size-3 fill-warn" /> {cap.rating.toFixed(1)}
          </span>
          <span>·</span>
          <span>{num(cap.trips)} مشوار</span>
        </div>
      </div>
      {right}
    </div>
  );
}

/* ---------- Route summary ---------- */
export function RouteLine({ from, to, compact }: { from: string; to: string; compact?: boolean }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center pt-1.5">
        <span className="size-2.5 rounded-full border-2 border-acc-2" />
        <span className={cx('w-px flex-1 bg-gradient-to-b from-acc-2 to-acc my-1', compact ? 'min-h-3' : 'min-h-6')} />
        <span className="size-2.5 rounded-full bg-acc" />
      </div>
      <div className={cx('flex-1 min-w-0 flex flex-col', compact ? 'gap-1.5' : 'gap-4')}>
        <p className="text-sm truncate">{from}</p>
        <p className="text-sm truncate">{to}</p>
      </div>
    </div>
  );
}

/* ---------- Chat (shared by rider and captain) ---------- */
export function Chat({ booking, me, onSend }: { booking: Booking; me: 'client' | 'captain'; onSend: (t: string) => void }) {
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [booking.messages.length]);
  const quick = me === 'client' ? ['أنا نازل', 'استناني 5 دقايق', 'أنا عند البوابة'] : ['أنا وصلت', 'في الطريق', 'معايا الخوذة'];

  return (
    <div className="flex flex-col h-[calc(100dvh-92px)] md:h-[calc(100dvh-140px)]">
      <div ref={listRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5">
        {booking.messages.map((m) =>
          m.from === 'system' ? (
            <div key={m.id} className="text-center">
              <span className="inline-block text-[11px] text-muted bg-surface rounded-full px-3 py-1">{m.text}</span>
            </div>
          ) : (
            <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cx('flex', m.from === me ? 'justify-start' : 'justify-end')}>
              <div className={cx('max-w-[78%] px-4 py-2.5 rounded-3xl text-sm', m.from === me ? 'bg-grad text-acc-ink rounded-br-md' : 'glass rounded-bl-md')}>
                <p>{m.text}</p>
                <p className={cx('text-[10px] mt-1', m.from === me ? 'text-acc-ink/60' : 'text-muted')}>{clock(m.at)}</p>
              </div>
            </motion.div>
          ),
        )}
      </div>
      <div className="px-4 pb-[max(env(safe-area-inset-bottom),14px)] pt-2 space-y-2">
        <div className="flex gap-2 overflow-x-auto">
          {quick.map((q) => (
            <button key={q} onClick={() => onSend(q)} className="shrink-0 h-8 px-3 rounded-full glass text-xs text-muted hover:text-text">
              {q}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSend(text);
            setText('');
          }}
          className="flex gap-2"
        >
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="اكتب رسالة…" className="flex-1 h-12 px-4 rounded-2xl glass outline-none focus:border-acc/50 text-sm" />
          <button disabled={!text.trim()} className="size-12 rounded-2xl bg-grad text-acc-ink grid place-items-center disabled:opacity-40" aria-label="إرسال">
            <Send className="size-5 -scale-x-100" />
          </button>
        </form>
      </div>
    </div>
  );
}

export function useUnread(to: string) {
  return useStore((s) => s.notices.filter((n) => n.to === to && !n.read).length);
}
