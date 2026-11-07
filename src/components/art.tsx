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

/* ---------- Motorcycle illustration ---------- */
/**
 * The app's one vehicle: a modern naked bike in neon line art.
 * Drawn facing right, mirrored so it rides toward the reading direction (RTL).
 */
export function MotoArt({ className, beam = true }: { className?: string; beam?: boolean }) {
  const id = useId().replace(/:/g, '');
  const neon = `url(#n${id})`;
  const Wheel = ({ cx }: { cx: number }) => (
    <g>
      <circle cx={cx} cy={136} r={35} fill="#0a0d15" stroke="#1a1f2e" strokeWidth="8" />
      <circle cx={cx} cy={136} r={35} fill="none" stroke={neon} strokeWidth="2.5" filter={`url(#g${id})`} />
      <circle cx={cx} cy={136} r={24} fill="none" stroke="var(--acc)" strokeOpacity=".55" strokeWidth="1.5" />
      {[0, 60, 120].map((r) => (
        <line key={r} x1={cx - 22} y1={136} x2={cx + 22} y2={136} stroke="var(--acc)" strokeOpacity=".35" strokeWidth="2" transform={`rotate(${r} ${cx} 136)`} />
      ))}
      <circle cx={cx} cy={136} r={11} fill="none" stroke="var(--acc-2)" strokeWidth="2" />
      <circle cx={cx} cy={136} r={3.5} fill="var(--acc)" />
    </g>
  );
  return (
    <svg viewBox="0 0 330 190" className={className} style={{ transform: 'scaleX(-1)' }} aria-hidden>
      <defs>
        <linearGradient id={`n${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="var(--acc-2)" />
          <stop offset="1" stopColor="var(--acc)" />
        </linearGradient>
        <linearGradient id={`b${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--acc-2)" stopOpacity=".95" />
          <stop offset="1" stopColor="var(--acc)" stopOpacity=".95" />
        </linearGradient>
        <linearGradient id={`d${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1c2232" />
          <stop offset="1" stopColor="#0c0f17" />
        </linearGradient>
        <linearGradient id={`l${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".55" />
          <stop offset="1" stopColor="var(--acc)" stopOpacity="0" />
        </linearGradient>
        <filter id={`g${id}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ground glow + speed lines */}
      <ellipse cx="165" cy="176" rx="130" ry="7" fill="var(--acc)" opacity=".16" />
      <g stroke={neon} strokeLinecap="round" opacity=".55">
        <line x1="4" y1="96" x2="46" y2="96" strokeWidth="2.5" />
        <line x1="14" y1="112" x2="40" y2="112" strokeWidth="2" />
        <line x1="0" y1="128" x2="30" y2="128" strokeWidth="1.5" />
      </g>

      {/* headlight beam */}
      {beam && <path d="M252 78 L330 56 L330 112 L252 90 Z" fill={`url(#l${id})`} opacity=".45" />}

      <Wheel cx={80} />
      <Wheel cx={252} />

      {/* swingarm + exhaust */}
      <path d="M80 136 L150 120" stroke="#1a1f2e" strokeWidth="9" strokeLinecap="round" />
      <path d="M80 136 L150 120" stroke={neon} strokeWidth="2" strokeLinecap="round" />
      <path d="M142 128 C162 144 196 146 222 134" fill="none" stroke="#1a1f2e" strokeWidth="8" strokeLinecap="round" />
      <path d="M200 140 L224 132" stroke="var(--acc)" strokeWidth="3" strokeLinecap="round" filter={`url(#g${id})`} />

      {/* engine */}
      <path d="M132 98 L182 98 L194 126 L140 130 Z" fill={`url(#d${id})`} stroke="#2a3145" strokeWidth="1.5" />
      <g stroke="var(--acc)" strokeOpacity=".4" strokeWidth="1.5">
        <line x1="146" y1="106" x2="180" y2="106" />
        <line x1="146" y1="113" x2="184" y2="113" />
        <line x1="146" y1="120" x2="188" y2="120" />
      </g>

      {/* front fork + fender */}
      <path d="M252 136 L226 70" stroke="#1a1f2e" strokeWidth="8" strokeLinecap="round" />
      <path d="M252 136 L226 70" stroke={neon} strokeWidth="2" strokeLinecap="round" />
      <path d="M226 110 C236 98 266 98 276 110" fill="none" stroke={neon} strokeWidth="3" strokeLinecap="round" />

      {/* frame */}
      <path d="M150 100 L218 72" stroke="var(--acc)" strokeWidth="2" strokeOpacity=".7" />

      {/* tail + seat */}
      <path d="M92 86 L56 74 L50 82 L96 102 Z" fill={`url(#b${id})`} />
      <rect x="48" y="76" width="7" height="5" rx="2" fill="#ff5c7a" filter={`url(#g${id})`} />
      <path d="M92 86 C108 77 132 76 146 82 L144 96 L98 100 Z" fill="#141927" stroke="#2a3145" strokeWidth="1.5" />

      {/* tank */}
      <path d="M140 84 C152 60 200 56 218 70 L212 98 L150 102 Z" fill={`url(#b${id})`} />
      <path d="M156 74 C170 64 196 62 208 70" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="2.5" strokeLinecap="round" />

      {/* front fairing + headlight */}
      <path d="M214 70 L238 58 L250 86 L220 100 Z" fill={`url(#b${id})`} />
      <circle cx="244" cy="80" r="7" fill="#fff" filter={`url(#g${id})`} />
      <circle cx="244" cy="80" r="3" fill="var(--acc)" />

      {/* handlebar + mirror */}
      <path d="M222 58 L242 50" stroke="#e6e9f2" strokeWidth="4" strokeLinecap="round" />
      <path d="M232 54 L236 40" stroke="#8b90a5" strokeWidth="2" />
      <ellipse cx="237" cy="37" rx="6" ry="3.5" fill="#1a1f2e" stroke={neon} strokeWidth="1.5" />
    </svg>
  );
}

/** Kept for existing screens — every vehicle is the one motorcycle now. */
export function BikeArt({ className }: { kind?: BikeClassId; className?: string }) {
  return <MotoArt className={className} beam={false} />;
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
