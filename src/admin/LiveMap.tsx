import { useEffect, useState } from 'react';
import { Radio, MapPinned } from 'lucide-react';
import { Avatar } from '@/components/ui';
import { MapView, type MapPoint } from '@/components/maps';
import { useStore } from '@/lib/store';
import { mapsEnabled } from '@/lib/maps';
import { timeAgo } from '@/lib/format';
import { PageHead, SERIES } from './kit';

export function LiveMapPage() {
  const s = useStore((x) => x);
  const [now, setNow] = useState(Date.now());
  const [focus, setFocus] = useState<string | undefined>();
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);
  const rows = s.live
    .map((l) => ({ l, u: s.users.find((u) => u.id === l.captainId), c: s.captains.find((c) => c.userId === l.captainId), ride: s.bookings.find((b) => b.captainId === l.captainId && b.status === 'accepted') }))
    .filter((r) => r.u)
    .sort((a, b) => b.l.at - a.l.at);
  const points: MapPoint[] = rows.map(({ l, u }) => ({ id: l.captainId, kind: 'captain', lat: l.lat, lng: l.lng, heading: l.heading, title: u!.name }));

  return (
    <>
      <PageHead title="الخريطة المباشرة" sub="الكباتن اللي بيشاركوا موقعهم دلوقتي" />
      {!mapsEnabled() ? (
        <div className="glass rounded-3xl py-16 text-center text-sm text-muted">
          <MapPinned className="size-8 mx-auto mb-3" />
          الخريطة هتشتغل أول ما يتحط مفتاح Google Maps في الإعدادات (src/lib/config.ts)
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_320px] gap-4">
          <MapView points={points} follow={focus} line={false} className="h-[60vh] min-h-[380px]" />
          <div className="glass rounded-3xl p-2 max-h-[60vh] overflow-y-auto">
            {rows.length === 0 && <p className="py-12 text-center text-sm text-muted">مفيش كباتن بيشاركوا موقعهم دلوقتي</p>}
            {rows.map(({ l, u, c, ride }) => {
              const fresh = now - l.at < 2 * 60_000;
              return (
                <button key={l.captainId} onClick={() => setFocus(l.captainId)} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/[.04] text-right">
                  <Avatar name={u!.name} src={c?.photo} size={40} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      {u!.name}
                      <span className="size-1.5 rounded-full" style={{ background: u!.gender === 'female' ? SERIES.girls : SERIES.boys }} />
                    </p>
                    <p className="text-[11px] text-muted truncate">{ride ? `${ride.from} ← ${ride.to}` : 'من غير مشوار'}</p>
                  </div>
                  <span className={`text-[11px] inline-flex items-center gap-1 ${fresh ? 'text-ok' : 'text-muted'}`}>
                    <Radio className="size-3" /> {timeAgo(l.at)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
