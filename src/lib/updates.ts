import { useEffect, useState } from 'react';

/**
 * Detects that a newer version of the site was published while this tab was open
 * (the built script file name changes on every deploy), so the user can reload.
 */
const currentScript = () =>
  [...document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]')].map((s) => s.src.split('/').pop() ?? '').find((n) => n.endsWith('.js')) ?? null;

async function latestScript(page: string) {
  try {
    const res = await fetch(`${page}?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const html = await res.text();
    // the page's entry script (not the preloaded shared chunks)
    return html.match(/<script[^>]+type="module"[^>]+src="[^"]*\/([^"/]+\.js)"/)?.[1] ?? null;
  } catch {
    return null;
  }
}

export function useUpdateAvailable(page: 'index.html' | 'admin.html') {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    const mine = currentScript();
    if (!mine || import.meta.env.DEV) return;
    const check = async () => {
      const latest = await latestScript(page);
      if (latest && latest !== mine) setAvailable(true);
    };
    const t = setInterval(check, 5 * 60_000);
    const onVisible = () => document.visibilityState === 'visible' && void check();
    document.addEventListener('visibilitychange', onVisible);
    void check();
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [page]);
  return available;
}
