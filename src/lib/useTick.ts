import { useEffect, useState } from 'react';

/** Re-render every `ms` milliseconds (0 = off) and return the current time. */
export function useTick(ms: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!ms) return;
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
