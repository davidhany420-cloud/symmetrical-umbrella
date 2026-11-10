import { Capacitor } from '@capacitor/core';

/**
 * Android 15 draws the app under the status bar and the navigation bar, and the
 * phone's WebView often reports 0 for the screen insets. In that case the top
 * buttons (back, sign out) end up under the status bar and can't be tapped.
 * Reserve room for the bars ourselves when the app runs inside the APK.
 */
export function fixInsets() {
  if (!Capacitor.isNativePlatform()) return;
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const top = parseFloat(cs.paddingTop) || 0;
  const bottom = parseFloat(cs.paddingBottom) || 0;
  probe.remove();
  const root = document.documentElement.style;
  if (top < 1) root.setProperty('--sat', '36px');
  if (bottom < 1) root.setProperty('--sab', '28px');
}
