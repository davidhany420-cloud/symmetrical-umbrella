import { Home as HomeIcon, Route, Plus, Bell, UserRound } from 'lucide-react';
import { useExitGuard, useRoute } from '@/lib/router';
import { toast } from '@/lib/toast';

const exitHint = () => toast('دوس رجوع تاني علشان تخرج من التطبيق', 'info');
import { BottomNav, useUnread } from '@/components/shared';
import type { User } from '@/lib/types';
import { Home } from './Home';
import { Book } from './Book';
import { Rides, RideDetail, RideChat } from './Rides';
import { Track } from './Track';
import { Profile, Alerts } from './Profile';

export function ClientApp({ user }: { user: User }) {
  const { parts } = useRoute();
  const unread = useUnread(user.id);
  const [section, id, sub] = parts;
  useExitGuard(!section || section === 'home', exitHint);

  let screen;
  let nav = true;
  if (section === 'book') {
    screen = <Book user={user} />;
    nav = false;
  } else if (section === 'rides') screen = <Rides user={user} />;
  else if (section === 'ride' && id && sub === 'chat') {
    screen = <RideChat id={id} />;
    nav = false;
  } else if (section === 'ride' && id && sub === 'track') {
    screen = <Track id={id} />;
    nav = false;
  } else if (section === 'ride' && id) screen = <RideDetail id={id} />;
  else if (section === 'alerts') screen = <Alerts user={user} />;
  else if (section === 'profile') screen = <Profile user={user} />;
  else screen = <Home user={user} />;

  const active = '/' + (section ?? 'home');
  return (
    <div className="min-h-dvh md:min-h-[calc(100dvh-48px)] flex flex-col">
      <div className="flex-1" key={parts.join('/')}>{screen}</div>
      {nav && (
        <BottomNav
          active={active}
          items={[
            { to: '/home', label: 'الرئيسية', icon: <HomeIcon /> },
            { to: '/rides', label: 'مشاويري', icon: <Route /> },
            { to: '/book', label: 'مشوار جديد', icon: <Plus />, primary: true },
            { to: '/alerts', label: 'التنبيهات', icon: <Bell />, badge: unread },
            { to: '/profile', label: 'حسابي', icon: <UserRound /> },
          ]}
        />
      )}
    </div>
  );
}
