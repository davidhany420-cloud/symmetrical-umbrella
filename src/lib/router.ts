import { useSyncExternalStore } from 'react';

/** Tiny hash router: refresh-safe, back button works, links are shareable. */
const sub = (l: () => void) => {
  window.addEventListener('hashchange', l);
  return () => window.removeEventListener('hashchange', l);
};
const snap = () => window.location.hash.slice(1) || '/';

export function useRoute() {
  const full = useSyncExternalStore(sub, snap);
  const [path, query = ''] = full.split('?');
  return { path, parts: path.split('/').filter(Boolean), query: new URLSearchParams(query) };
}

export function go(to: string, replace = false) {
  const url = '#' + to;
  if (replace) window.location.replace(url);
  else window.location.hash = to;
  window.scrollTo({ top: 0 });
}

export const back = (fallback = '/') => {
  if (window.history.length > 1) window.history.back();
  else go(fallback, true);
};
