import { useEffect } from 'react';
import { AnimatePresence } from 'motion/react';
import { useStore, onStoreError } from './lib/store';
import { useRoute, go } from './lib/router';
import { modeOf } from './lib/actions';
import { toast } from './lib/toast';
import { Toaster } from './components/ui';
import { Logo } from './components/art';
import { Auth } from './screens/Auth';
import { ClientApp } from './screens/client/ClientApp';
import { CaptainApp } from './screens/captain/CaptainApp';

export default function App() {
  const { parts, query } = useRoute();
  const user = useStore((s) => s.users.find((u) => u.id === s.sessionUserId) ?? null);
  const ready = useStore((s) => s.ready);
  const section = parts[0] ?? '';

  // Accent theme follows the rider: neon cyan for boys, neon magenta for girls.
  const previewMode = query.get('mode') === 'girls' ? 'girls' : 'boys';
  const mode = user ? modeOf(user.gender) : previewMode;
  useEffect(() => {
    document.documentElement.dataset.mode = mode;
  }, [mode]);

  useEffect(() => onStoreError((m) => toast(m, 'err')), []);

  // Route guards
  useEffect(() => {
    if (!ready) return;
    if (!user && !['', 'auth'].includes(section)) go('/', true);
    if (user?.role === 'client' && (section === 'captain' || section === '' || section === 'auth')) go('/home', true);
    if (user?.role === 'captain' && section !== 'captain') go('/captain', true);
  }, [user, section, ready]);

  let screen;
  if (!ready) screen = <Splash key="splash" />;
  // anyone opening the link lands on sign-in
  else if (!user) screen = <Auth key="auth" />;
  else if (user.role === 'captain') screen = <CaptainApp user={user} />;
  else screen = <ClientApp user={user} />;

  return (
    <div className="relative min-h-dvh overflow-clip aurora">
      <div className="relative z-10 mx-auto max-w-[460px] min-h-dvh md:my-6 md:min-h-[calc(100dvh-48px)] md:rounded-[40px] md:border md:border-line md:overflow-clip md:shadow-[0_40px_120px_-30px_rgba(0,0,0,.8)] bg-bg/40">
        <AnimatePresence mode="wait">{screen}</AnimatePresence>
      </div>
      <Toaster />
    </div>
  );
}

function Splash() {
  return (
    <div className="min-h-dvh md:min-h-[calc(100dvh-48px)] grid place-items-center">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-pulse">
          <Logo size={64} />
        </div>
        <p className="text-xs text-muted">بنجهّز السكة…</p>
      </div>
    </div>
  );
}
