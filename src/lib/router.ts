import { useEffect, useSyncExternalStore } from 'react';

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

/**
 * On the app's main screen, the phone's Back button doesn't leave the app right away:
 * the first press shows a hint, a second press within 2 seconds exits.
 */
export function useExitGuard(enabled: boolean, onFirstPress: () => void) {
  useEffect(() => {
    if (!enabled) return;
    const mark = { felsekkaGuard: true };
    if (!(history.state && history.state.felsekkaGuard)) history.pushState(mark, '', location.href);
    let armedAt = 0;
    const onPop = () => {
      if (history.state && history.state.felsekkaGuard) return; // moving forward onto the guard
      if (Date.now() - armedAt < 2000) {
        window.removeEventListener('popstate', onPop);
        history.back(); // second press — really leave
        return;
      }
      armedAt = Date.now();
      history.pushState(mark, '', location.href);
      onFirstPress();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [enabled, onFirstPress]);
}
