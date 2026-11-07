import { useEffect, useId, useRef, useState } from 'react';
import type { BikeClassId } from '@/lib/types';

/* ---------- Logo ---------- */
export function Logo({ size = 40 }: { size?: number }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--acc)" />
          <stop offset="1" stopColor="var(--acc-2)" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="20" fill="#0d1018" stroke="rgba(255,255,255,.08)" />
      <path d="M13 42c7-15 15-22 24-22 6 0 10 3 14 9" stroke={`url(#${id})`} strokeWidth="6" fill="none" strokeLinecap="round" />
      <circle cx="49" cy="42" r="5" fill="var(--acc)" />
      <circle cx="15" cy="42" r="2.5" fill="var(--acc-2)" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <Logo size={36} />
      <div className="leading-none">
        <div className="text-[17px] font-bold tracking-tight">في السكة</div>
        <div className="text-[9px] tracking-[0.35em] text-muted mt-1" dir="ltr">FEL SEKKA</div>
      </div>
    </div>
  );
}

/* ---------- Motorcycle line art ---------- */
const BIKES: Record<BikeClassId, { r: number; body: string[] }> = {
  scooter: {
    r: 17,
    body: [
      'M48 82 C58 82 64 70 78 68 L118 68 C128 68 132 60 128 50 L124 40',
      'M86 68 L94 54 L120 54',
      'M124 40 L140 30 L150 30',
      'M128 50 L156 82',
      'M40 66 C50 56 64 56 74 60',
    ],
  },
  electric: {
    r: 18,
    body: [
      'M46 82 C56 80 62 68 76 66 L120 66 C130 66 134 58 130 48 L126 38',
      'M84 66 L92 52 L118 52',
      'M126 38 L142 28 L152 28',
      'M130 48 L156 82',
      'M98 60 L92 70 L100 70 L94 80',
    ],
  },
  classic: {
    r: 22,
    body: [
      'M44 82 L74 58 L118 56 L156 82',
      'M70 50 C78 40 104 40 112 50 L118 56',
      'M60 52 L92 50',
      'M118 56 L130 32 L146 28',
      'M84 66 C90 76 104 76 110 66',
    ],
  },
  sport: {
    r: 22,
    body: [
      'M44 82 L66 58 L96 56',
      'M64 52 L84 46 L100 50',
      'M96 56 L118 42 C132 34 150 38 160 52 L156 82',
      'M118 42 L134 30',
      'M84 66 C92 78 110 78 118 64',
      'M146 50 L162 50',
    ],
  },
};

export function BikeArt({ kind, className }: { kind: BikeClassId; className?: string }) {
  const id = useId();
  const b = BIKES[kind];
  return (
    <svg viewBox="0 0 200 110" className={className} style={{ transform: 'scaleX(-1)' }} aria-hidden>
      <defs>
        <linearGradient id={`g${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="var(--acc-2)" />
          <stop offset="1" stopColor="var(--acc)" />
        </linearGradient>
        <filter id={`f${id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <ellipse cx="100" cy="102" rx="74" ry="4" fill="var(--acc)" opacity=".18" />
      <g fill="none" stroke={`url(#g${id})`} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" filter={`url(#f${id})`}>
        <circle cx="44" cy="82" r={b.r} />
        <circle cx="156" cy="82" r={b.r} />
        <circle cx="44" cy="82" r="3" />
        <circle cx="156" cy="82" r="3" />
        {b.body.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}

/* ---------- Live map (never blank: works fully offline) ---------- */
const ROUTE = 'M60 360 C 80 300, 150 310, 160 250 S 120 160, 200 140 S 300 120, 300 60';

export function LiveMap({ progress, className }: { progress: number; className?: string }) {
  const id = useId();
  const pathRef = useRef<SVGPathElement>(null);
  const [pt, setPt] = useState({ x: 60, y: 360, a: 0 });

  useEffect(() => {
    const el = pathRef.current;
    if (!el) return;
    const len = el.getTotalLength();
    const a = el.getPointAtLength(progress * len);
    const b = el.getPointAtLength(Math.min(len, progress * len + 1));
    setPt({ x: a.x, y: a.y, a: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI });
  }, [progress]);

  const blocks = [
    [20, 20, 70, 50], [110, 20, 60, 40], [200, 10, 50, 60], [270, 90, 70, 40], [30, 100, 80, 60], [130, 80, 50, 40],
    [220, 170, 110, 50], [20, 190, 90, 60], [200, 240, 60, 70], [280, 250, 60, 90], [110, 380, 90, 40], [230, 340, 40, 70],
    [20, 280, 20, 50],
  ];

  return (
    <div className={`relative overflow-hidden rounded-3xl bg-[#080b12] border border-line ${className ?? ''}`}>
      <svg viewBox="0 0 360 420" className="w-full h-full block" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={`r${id}`} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="var(--acc-2)" />
            <stop offset="1" stopColor="var(--acc)" />
          </linearGradient>
          <radialGradient id={`v${id}`} cx=".5" cy=".5" r=".7">
            <stop offset=".55" stopColor="#080b12" stopOpacity="0" />
            <stop offset="1" stopColor="#080b12" />
          </radialGradient>
          <pattern id={`d${id}`} width="12" height="12" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r=".8" fill="rgba(255,255,255,.07)" />
          </pattern>
        </defs>
        <rect width="360" height="420" fill={`url(#d${id})`} />
        {/* Nile */}
        <path d="M-10 230 C 60 200, 90 260, 170 230 S 300 180, 380 210" stroke="#0f2a3d" strokeWidth="26" fill="none" />
        {/* streets */}
        <g stroke="rgba(255,255,255,.07)" strokeWidth="7" fill="none" strokeLinecap="round">
          <path d="M0 80 H360" /><path d="M0 170 H360" /><path d="M0 330 H360" />
          <path d="M100 0 V420" /><path d="M190 0 V420" /><path d="M265 0 V420" />
          <path d="M0 0 L360 420" opacity=".5" />
        </g>
        {blocks.map(([x, y, w, h], i) => (
          <rect key={i} x={x} y={y} width={w} height={h} rx="6" fill="rgba(255,255,255,.035)" stroke="rgba(255,255,255,.05)" />
        ))}
        {/* route */}
        <path d={ROUTE} stroke="var(--acc)" strokeOpacity=".15" strokeWidth="14" fill="none" strokeLinecap="round" />
        <path ref={pathRef} d={ROUTE} stroke={`url(#r${id})`} strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d={ROUTE} stroke="#fff" strokeOpacity=".55" strokeWidth="1.5" fill="none" className="route-dash" />
        {/* start */}
        <circle cx="60" cy="360" r="9" fill="#080b12" stroke="var(--acc-2)" strokeWidth="3" />
        {/* destination */}
        <g transform="translate(300 60)">
          <circle r="16" fill="var(--acc)" opacity=".15" className="ping-soft" style={{ transformOrigin: 'center', transformBox: 'fill-box' }} />
          <circle r="10" fill="var(--acc)" />
          <circle r="4" fill="#080b12" />
        </g>
        {/* rider */}
        <g transform={`translate(${pt.x} ${pt.y})`}>
          <circle r="22" fill="var(--acc)" opacity=".18" />
          <circle r="13" fill="#0b0e16" stroke="var(--acc)" strokeWidth="2.5" />
          <path d="M-5 0 L5 0 M1 -4 L5 0 L1 4" stroke="var(--acc)" strokeWidth="2.4" fill="none" strokeLinecap="round" transform={`rotate(${pt.a})`} />
        </g>
        <rect width="360" height="420" fill={`url(#v${id})`} pointerEvents="none" />
      </svg>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-acc/5 to-transparent" style={{ animation: 'scan 6s linear infinite' }} />
    </div>
  );
}

export function useLoopProgress(seconds = 40) {
  const [p, setP] = useState(0);
  useEffect(() => {
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      setP(((t - t0) / (seconds * 1000)) % 1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seconds]);
  return p;
}
