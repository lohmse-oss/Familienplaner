import { Capacitor } from '@capacitor/core';
import { buildNotices } from './core/notify';
import { today } from './core/dates';
import type { Calendar } from './core/calendar';

/**
 * Plant alle anstehenden Erinnerungen als lokale Benachrichtigungen auf dem Gerät
 * (funktionieren auch offline). Wird bei jeder Änderung/Synchronisierung neu berechnet.
 */
export async function scheduleNotifications(cal: Calendar, enabled: boolean): Promise<number> {
  if (!Capacitor.isNativePlatform()) return 0;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications });
  if (!enabled) return 0;

  const perm = await LocalNotifications.checkPermissions();
  if (perm.display !== 'granted') {
    const r = await LocalNotifications.requestPermissions();
    if (r.display !== 'granted') return 0;
  }
  const notices = buildNotices(cal, new Date(), today());
  if (!notices.length) return 0;
  await LocalNotifications.schedule({
    notifications: notices.map((n, i) => ({
      id: i + 1,
      title: n.title,
      body: n.body,
      schedule: { at: n.at, allowWhileIdle: true },
    })),
  });
  return notices.length;
}

/** Sofort eine Meldung anzeigen (z. B. Änderung des Partners, solange die App im Hintergrund läuft). */
export async function showNow(title: string, body: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const perm = await LocalNotifications.checkPermissions();
  if (perm.display !== 'granted') return;
  await LocalNotifications.schedule({ notifications: [{ id: 900000 + Math.floor(Math.random() * 90000), title, body, schedule: { at: new Date(Date.now() + 800) } }] });
}
