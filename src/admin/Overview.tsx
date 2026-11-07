import { UserCheck, Wallet, Bike, Users, Route as RouteIcon, BadgeDollarSign, ArrowLeft, Clock3 } from 'lucide-react';
import { Avatar, Pill } from '@/components/ui';
import { BIKE_CLASSES } from '@/lib/config';
import { useStore } from '@/lib/store';
import { go } from '@/lib/router';
import { isSubscribed } from '@/lib/actions';
import { egp, num, timeAgo } from '@/lib/format';
import { AreaChart, BarList, Kpi, PageHead, SplitBar } from './kit';

const DAY = 86_400_000;
const dayStart = (t: number) => new Date(new Date(t).toDateString()).getTime();

export function Overview() {
  const s = useStore((x) => x);
  const now = Date.now();
  const today = dayStart(now);
  const nameOf = (id: string) => s.users.find((u) => u.id === id)?.name ?? '—';

  const approved = s.captains.filter((c) => c.status === 'approved');
  const live = approved.filter((c) => isSubscribed(c));
  const online = live.filter((c) => c.online);
  const pendingApps = s.captains.filter((c) => c.status === 'pending').sort((a, b) => (a.submittedAt ?? 0) - (b.submittedAt ?? 0));
  const pendingPays = s.captains.filter((c) => c.pendingPayment);
  const riders = s.users.filter((u) => u.role === 'client');
  const confirmed = s.bookings.filter((b) => b.status === 'accepted' || b.status === 'done');

  // last 14 days of confirmed rides
  const days = Array.from({ length: 14 }, (_, i) => today - (13 - i) * DAY);
  const perDay = days.map((d) => confirmed.filter((b) => b.createdAt >= d && b.createdAt < d + DAY).length);
  const series = days.map((d, i) => ({ label: new Date(d).toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'short' }), value: perDay[i] }));
  const todayRides = perDay[13];
  const prevWeek = perDay.slice(0, 7).reduce((a, b) => a + b, 0);
  const thisWeek = perDay.slice(7).reduce((a, b) => a + b, 0);
  const trend = prevWeek ? Math.round(((thisWeek - prevWeek) / prevWeek) * 100) : 0;

  const revenue = s.payments.filter((p) => p.status === 'approved').reduce((a, p) => a + p.amount, 0);
  const gmvByClass = BIKE_CLASSES.map((b) => {
    const rows = confirmed.filter((x) => x.bikeClass === b.id);
    return { label: b.name, value: rows.reduce((a, x) => a + (x.price ?? 0), 0), sub: `${num(rows.length)} مشوار` };
  }).sort((a, b) => b.value - a.value);

  const boys = confirmed.filter((b) => b.mode === 'boys').length;
  const girls = confirmed.length - boys;

  return (
    <>
      <PageHead
        title="لوحة القيادة"
        sub={new Date().toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      />

      {/* attention strip */}
      {(pendingApps.length > 0 || pendingPays.length > 0) && (
        <div className="mb-6 grid sm:grid-cols-2 gap-3">
          {pendingApps.length > 0 && (
            <button onClick={() => go('/applications')} className="group flex items-center gap-4 p-4 rounded-2xl border border-warn/25 bg-warn/[.06] text-right hover:bg-warn/10 transition">
              <span className="size-11 rounded-xl bg-warn/15 text-warn grid place-items-center">
                <UserCheck className="size-5" />
              </span>
              <span className="flex-1">
                <span className="block font-semibold">{num(pendingApps.length)} كابتن مستنيين مراجعة</span>
                <span className="block text-xs text-muted mt-0.5">أقدم طلب {timeAgo(pendingApps[0].submittedAt ?? now)}</span>
              </span>
              <ArrowLeft className="size-5 text-warn group-hover:-translate-x-1 transition" />
            </button>
          )}
          {pendingPays.length > 0 && (
            <button onClick={() => go('/payments')} className="group flex items-center gap-4 p-4 rounded-2xl border border-acc/25 bg-acc/[.05] text-right hover:bg-acc/10 transition">
              <span className="size-11 rounded-xl bg-acc/15 text-acc grid place-items-center">
                <Wallet className="size-5" />
              </span>
              <span className="flex-1">
                <span className="block font-semibold">{num(pendingPays.length)} تحويل InstaPay محتاج تأكيد</span>
                <span className="block text-xs text-muted mt-0.5">راجع رقم المرجع وأكّد</span>
              </span>
              <ArrowLeft className="size-5 text-acc group-hover:-translate-x-1 transition" />
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Kpi label="مشاوير النهارده" value={num(todayRides)} icon={<RouteIcon />} spark={perDay} hint={<span className={trend >= 0 ? 'text-ok' : 'text-danger'}>{trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}% عن الأسبوع اللي فات</span>} />
        <Kpi label="كباتن شغّالين" value={num(live.length)} icon={<Bike />} hint={`${num(online.length)} أونلاين دلوقتي`} onClick={() => go('/captains')} />
        <Kpi label="الركاب" value={num(riders.length)} icon={<Users />} hint={`${num(riders.filter((r) => r.gender === 'female').length)} بنات · ${num(riders.filter((r) => r.gender === 'male').length)} شباب`} onClick={() => go('/riders')} />
        <Kpi label="إيراد الاشتراكات" value={egp(revenue)} icon={<BadgeDollarSign />} hint={`${num(s.payments.filter((p) => p.status === 'approved').length)} اشتراك مدفوع`} onClick={() => go('/payments')} />
      </div>

      <div className="mt-4 grid xl:grid-cols-[1.6fr_1fr] gap-4">
        <section className="glass rounded-3xl p-6">
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <h2 className="font-semibold">المشاوير المتأكدة</h2>
              <p className="text-xs text-muted mt-1">آخر 14 يوم</p>
            </div>
            <div className="text-left">
              <div className="text-2xl font-bold tabular-nums">{num(thisWeek)}</div>
              <div className="text-[11px] text-muted">الأسبوع ده</div>
            </div>
          </div>
          <AreaChart data={series} unit="مشوار" />
        </section>

        <section className="glass rounded-3xl p-6 flex flex-col gap-6">
          <div>
            <h2 className="font-semibold">قيمة المشاوير حسب الفئة</h2>
            <p className="text-xs text-muted mt-1">إجمالي الأسعار المتفق عليها</p>
          </div>
          <BarList rows={gmvByClass} format={egp} />
          <div className="mt-auto pt-5 border-t border-line">
            <p className="text-sm font-medium mb-3">سكة الشباب مقابل سكة البنات</p>
            <SplitBar a={boys} b={girls} aLabel="شباب" bLabel="بنات" />
          </div>
        </section>
      </div>

      <div className="mt-4 grid xl:grid-cols-2 gap-4">
        <section className="glass rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">طابور المراجعة</h2>
            <button onClick={() => go('/applications')} className="text-xs text-acc">عرض الكل</button>
          </div>
          {pendingApps.length === 0 ? (
            <p className="text-sm text-muted py-8 text-center">مفيش طلبات مستنية — كله متراجع ✓</p>
          ) : (
            <div className="space-y-2">
              {pendingApps.slice(0, 4).map((c) => (
                <button key={c.userId} onClick={() => go(`/applications/${c.userId}`)} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/[.04] text-right transition">
                  <Avatar name={nameOf(c.userId)} src={c.photo} size={42} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{nameOf(c.userId)}</p>
                    <p className="text-xs text-muted truncate">
                      {c.bikeModel} · {c.governorate}
                    </p>
                  </div>
                  <span className="text-[11px] text-muted inline-flex items-center gap-1">
                    <Clock3 className="size-3" /> {timeAgo(c.submittedAt ?? now)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="glass rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">آخر المشاوير</h2>
            <button onClick={() => go('/rides')} className="text-xs text-acc">عرض الكل</button>
          </div>
          <div className="space-y-1">
            {s.bookings.slice(0, 5).map((b) => (
              <div key={b.id} className="flex items-center gap-3 py-2.5 border-b border-line/60 last:border-0">
                <span className="size-2 rounded-full shrink-0" style={{ background: b.mode === 'girls' ? '#d9439b' : '#2a9fd6' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">
                    {b.from} ← {b.to}
                  </p>
                  <p className="text-[11px] text-muted">
                    {nameOf(b.clientId)} مع {nameOf(b.captainId)} · {timeAgo(b.createdAt)}
                  </p>
                </div>
                <Pill tone={b.status === 'accepted' ? 'ok' : b.status === 'cancelled' || b.status === 'rejected' ? 'muted' : b.status === 'done' ? 'acc' : 'warn'}>{egp(b.price ?? b.offer)}</Pill>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
