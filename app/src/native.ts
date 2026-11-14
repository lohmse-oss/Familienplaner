import { Capacitor, registerPlugin } from '@capacitor/core';

interface FamilyNative {
  update(o: { json: string }): Promise<void>;
  configure(o: { server: string; code: string; me: string; rev: number; notify: boolean }): Promise<void>;
  markSeen(o: { rev: number }): Promise<void>;
  getSeen(): Promise<{ seen: number }>;
}
const Native = registerPlugin<FamilyNative>('FamilyWidget');
const on = () => Capacitor.isNativePlatform();

/** Daten ans Homescreen-Widget */
export const nativeUpdateWidget = (json: string) => (on() ? Native.update({ json }) : Promise.resolve());

/** Zugangsdaten für den Hintergrund-Abgleich (Hinweise bei Einträgen des Partners) */
export async function nativeConfigure(server: string, code: string, me: string, rev: number, notify: boolean) {
  if (!on()) return;
  try {
    await Native.configure({ server, code, me, rev, notify });
  } catch {
    /* Plugin nicht verfügbar – App läuft weiter */
  }
}

/** Bis zu welcher Server-Revision hat der Hintergrund-Abgleich schon gemeldet? */
export async function nativeSeen(): Promise<number> {
  if (!on()) return 0;
  try {
    return (await Native.getSeen()).seen ?? 0;
  } catch {
    return 0;
  }
}
export async function nativeMarkSeen(rev: number) {
  if (!on()) return;
  try {
    await Native.markSeen({ rev });
  } catch {
    /* egal */
  }
}
