import { useEffect } from 'react';
import { LogOut, ShieldCheck, Bell, Headphones, Route, Star } from 'lucide-react';
import { Avatar, Button, Card, Empty, Page, Pill, TopBar } from '@/components/ui';
import { DeleteAccount } from '@/components/shared';
import { useStore } from '@/lib/store';
import { logout, markNoticesRead, modeOf } from '@/lib/actions';
import { num, timeAgo } from '@/lib/format';
import { SUPPORT_WHATSAPP } from '@/lib/config';
import { go } from '@/lib/router';
import type { User } from '@/lib/types';

export function Profile({ user }: { user: User }) {
  const stats = useStore((s) => {
    const mine = s.bookings.filter((b) => b.clientId === user.id);
    return { total: mine.length, done: mine.filter((b) => b.status === 'done').length, active: mine.filter((b) => b.status === 'accepted').length };
  });
  const girls = modeOf(user.gender) === 'girls';

  return (
    <Page>
      <TopBar title="حسابي" onBack={() => go('/home')} />
      <div className="px-5 pb-6 space-y-4">
        <Card className="!p-5 flex items-center gap-4">
          <Avatar name={user.name} size={64} ring />
          <div className="flex-1 min-w-0">
            <p className="text-lg font-semibold">{user.name}</p>
            <p className="text-sm text-muted" dir="ltr" style={{ textAlign: 'right' }}>{user.phone}</p>
            <Pill className="mt-2">{girls ? 'سكة البنات 💜' : 'سكة الشباب'}</Pill>
          </div>
        </Card>
        <div className="grid grid-cols-3 gap-3">
          {[
            ['كل المشاوير', stats.total, Route],
            ['نشطة', stats.active, ShieldCheck],
            ['خلصت', stats.done, Star],
          ].map(([l, v, I]) => {
            const Icon = I as typeof Route;
            return (
              <Card key={l as string} className="!p-3 text-center">
                <Icon className="size-5 text-acc mx-auto" />
                <p className="text-xl font-bold mt-1">{num(v as number)}</p>
                <p className="text-[10px] text-muted">{l as string}</p>
              </Card>
            );
          })}
        </div>
        <Card className="!p-0 divide-y divide-line">
          <a href={`https://wa.me/${SUPPORT_WHATSAPP}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-4">
            <Headphones className="size-5 text-acc" /> <span className="flex-1 text-sm">الدعم الفني (واتساب)</span>
          </a>
          <button onClick={() => go('/alerts')} className="w-full flex items-center gap-3 p-4 text-right">
            <Bell className="size-5 text-acc" /> <span className="flex-1 text-sm">التنبيهات</span>
          </button>
          <div className="flex items-center gap-3 p-4">
            <ShieldCheck className="size-5 text-acc" />
            <span className="flex-1 text-sm text-muted">{girls ? 'بتركبي مع كابتنات بنات موثّقات بس' : 'كل الكباتن موثّقين بالبطاقة والرخصة'}</span>
          </div>
        </Card>
        <Button variant="danger" className="w-full" icon={<LogOut className="size-4" />} onClick={logout}>
          تسجيل الخروج
        </Button>
        <DeleteAccount />
      </div>
    </Page>
  );
}

export function Alerts({ user }: { user: User }) {
  const list = useStore((s) => s.notices.filter((n) => n.to === user.id));
  useEffect(() => () => void markNoticesRead(user.id), [user.id]);
  return (
    <Page>
      <TopBar title="التنبيهات" onBack={() => go('/home')} />
      <div className="px-5 pb-6 space-y-2.5">
        {list.length === 0 ? (
          <Empty icon={<Bell />} title="مفيش تنبيهات" sub="هنبلغك هنا بكل جديد في مشاويرك" />
        ) : (
          list.map((n) => (
            <Card key={n.id} className="!p-3.5 flex items-start gap-3">
              <span className={`mt-1.5 size-2 rounded-full shrink-0 ${n.read ? 'bg-white/15' : 'bg-acc'}`} />
              <div className="flex-1">
                <p className="text-sm">{n.text}</p>
                <p className="text-[11px] text-muted mt-1">{timeAgo(n.at)}</p>
              </div>
            </Card>
          ))
        )}
      </div>
    </Page>
  );
}
