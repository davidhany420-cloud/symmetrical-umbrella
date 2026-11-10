import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { getState, subscribe } from './store';
import { go } from './router';
import { toast } from './toast';

/**
 * Phone notifications for new requests, ride updates and chat messages.
 * While the app is on screen: a toast + vibration + a short beep.
 * While it's in the background: a real notification in the phone's notification bar
 * (inside the APK), or a browser notification on the website.
 */
const native = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('LocalNotifications');
const CHANNEL = 'rides';

let me: string | null = null;
const seen = new Set<string>();
let nextId = 1;

export function initNotifications() {
  if (native()) {
    void LocalNotifications.createChannel({
      id: CHANNEL,
      name: 'الطلبات والرسايل',
      description: 'طلبات المشاوير الجديدة ورسايل الشات',
      importance: 5,
      visibility: 1,
      vibration: true,
    }).catch(() => {});
    void LocalNotifications.addListener('localNotificationActionPerformed', (a) => {
      const to = a.notification.extra?.to;
      if (typeof to === 'string') go(to);
    });
  }
  check();
  subscribe(check);
}

/** Ask once per sign-in (Android 13+ shows the "allow notifications" dialog). */
async function askPermission() {
  try {
    if (native()) {
      const p = await LocalNotifications.checkPermissions();
      if (p.display !== 'granted') await LocalNotifications.requestPermissions();
    } else if ('Notification' in window && Notification.permission === 'default') {
      // browsers only allow asking after a tap
      const ask = () => void Notification.requestPermission().catch(() => {});
      window.addEventListener('pointerdown', ask, { once: true });
    }
  } catch {
    /* not supported */
  }
}

function check() {
  const s = getState();
  if (!s.ready) return;
  const uid = s.sessionUserId;
  if (uid !== me) {
    // new sign-in: everything already there counts as old news
    me = uid;
    seen.clear();
    if (!uid) return;
    s.notices.forEach((n) => seen.add('n' + n.id));
    s.bookings.forEach((b) => b.messages.forEach((m) => seen.add('m' + m.id)));
    void askPermission();
    return;
  }
  if (!uid) return;
  const user = s.users.find((u) => u.id === uid);
  const captain = user?.role === 'captain';

  for (const n of s.notices) {
    if (seen.has('n' + n.id)) continue;
    seen.add('n' + n.id);
    if (n.to !== uid || n.read) continue;
    const isRequest = n.text.startsWith('طلب') && n.text.includes('جديد');
    alert(isRequest ? 'طلب مشوار جديد 🏍️' : 'في السكة', n.text, captain ? (isRequest ? '/captain/requests' : '/captain') : '/rides', isRequest);
  }

  for (const b of s.bookings) {
    const mine = b.clientId === uid ? 'client' : b.captainId === uid ? 'captain' : null;
    if (!mine) continue;
    for (const m of b.messages) {
      if (seen.has('m' + m.id)) continue;
      seen.add('m' + m.id);
      // system lines already come as notices; my own messages don't need an alert
      if (m.from === 'system' || m.from === mine) continue;
      const other = s.users.find((u) => u.id === (mine === 'client' ? b.captainId : b.clientId));
      const chat = mine === 'captain' ? `/captain/chat/${b.id}` : `/ride/${b.id}/chat`;
      if (location.hash === '#' + chat && document.visibilityState === 'visible') continue; // already reading it
      alert(`رسالة من ${other?.name ?? (mine === 'client' ? 'الكابتن' : 'الراكب')}`, m.text, chat, false);
    }
  }
}

function alert(title: string, body: string, to: string, urgent: boolean) {
  if (document.visibilityState === 'visible') {
    toast(`${title} — ${body}`, 'info');
    try {
      navigator.vibrate?.(urgent ? [250, 120, 250, 120, 250] : 180);
    } catch {
      /* no vibration */
    }
    beep(urgent);
    return;
  }
  if (native()) {
    void LocalNotifications.schedule({
      notifications: [{ id: nextId++, title, body, channelId: CHANNEL, smallIcon: 'ic_stat_notify', iconColor: '#22e3ff', extra: { to } }],
    }).catch(() => {});
  } else if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const n = new Notification(title, { body, tag: to, icon: document.querySelector<HTMLLinkElement>('link[rel=icon]')?.href });
      n.onclick = () => {
        window.focus();
        go(to);
        n.close();
      };
    } catch {
      /* mobile browsers need a service worker for this — the in-app alert covers it */
    }
  }
}

let ctx: AudioContext | null = null;
function beep(urgent: boolean) {
  try {
    ctx ??= new AudioContext();
    const tones = urgent ? [880, 1175, 880] : [988];
    tones.forEach((f, i) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      const t = ctx!.currentTime + i * 0.18;
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g).connect(ctx!.destination);
      o.start(t);
      o.stop(t + 0.17);
    });
  } catch {
    /* audio blocked until the first tap */
  }
}
