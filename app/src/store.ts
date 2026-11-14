import { useEffect, useState } from 'preact/hooks';
import bundled from './data/holidays.json';
import { buildCalendar, type Calendar } from './core/calendar';
import { addDays } from './core/dates';
import { scheduleNotifications } from './notifications';
import type { HolidayData, Item, Mode, PersonId } from './core/types';

export interface Settings {
  me: PersonId; // wer nutzt dieses Handy
  server: string; // z. B. https://familienplaner.<konto>.workers.dev
  code: string; // Familiencode
  notify: boolean;
}
export type SyncState = { status: 'off' | 'idle' | 'syncing' | 'error'; last?: number; msg?: string };

const LS = {
  items: 'fp.items',
  dirty: 'fp.dirty',
  rev: 'fp.rev',
  settings: 'fp.settings',
  hd: 'fp.hd',
};
const read = <T,>(k: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* Speicher voll oder gesperrt – App läuft weiter */
  }
};

let items: Item[] = read(LS.items, []);
let dirty = new Set<string>(read<string[]>(LS.dirty, []));
let rev = read<number>(LS.rev, 0);
let hd: HolidayData = read<HolidayData>(LS.hd, bundled as HolidayData);
if ((bundled as HolidayData).fetchedAt > hd.fetchedAt) hd = bundled as HolidayData; // neuere App-Version bringt neueren Stand mit
let settings: Settings = { me: 'sebastian', server: '', code: '', notify: true, ...read<Partial<Settings>>(LS.settings, {}) };
let syncState: SyncState = { status: settings.server ? 'idle' : 'off' };

let calendar: Calendar | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function useStore() {
  const [, set] = useState(0);
  useEffect(() => {
    const f = () => set((n) => n + 1);
    listeners.add(f);
    f(); // Änderungen nachholen, die zwischen erstem Rendern und Abonnieren eintrafen
    return () => void listeners.delete(f);
  }, []);
  return { items, settings, hd, sync: syncState, cal: getCalendar() };
}

export function getCalendar(): Calendar {
  return (calendar ??= buildCalendar(items, hd));
}

function persist() {
  write(LS.items, items);
  write(LS.dirty, [...dirty]);
  calendar = null;
  emit();
  scheduleSoon();
}

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function saveItem(it: Omit<Item, 'updated' | 'by'> & Partial<Pick<Item, 'updated' | 'by'>>): Item {
  const full: Item = { ...it, updated: Date.now(), by: settings.me };
  items = [...items.filter((i) => i.id !== full.id), full];
  dirty.add(full.id);
  persist();
  syncSoon();
  return full;
}

export function deleteItem(id: string) {
  const cur = items.find((i) => i.id === id);
  if (!cur) return;
  saveItem({ ...cur, deleted: true });
}

export function setEntitlement(person: PersonId, year: number, days: number | undefined) {
  const id = `config:${person}:${year}`;
  const cur = items.find((i) => i.id === id);
  saveItem({ ...(cur ?? { id, kind: 'config', start: `${year}-01-01`, end: `${year}-12-31`, persons: [person] }), entitlement: days, deleted: days === undefined });
}

/**
 * Tag für eine Person auf einen Status setzen (Büro = Eintrag entfernen).
 * Mehrtägige Einträge werden an dem Tag geteilt, der Rest bleibt erhalten.
 */
export function setPresence(person: PersonId, date: string, mode: Mode | 'office') {
  for (const it of items.filter((i) => !i.deleted && i.kind === 'presence' && i.persons.includes(person) && i.start <= date && i.end >= date)) {
    const others = it.persons.filter((p) => p !== person);
    // Person aus dem Eintrag herauslösen: Reste vor/nach dem Tag bleiben für die Person bestehen
    if (others.length) saveItem({ ...it, persons: others });
    else deleteItem(it.id);
    const keep = (start: string, end: string) => saveItem({ ...it, id: newId(), persons: [person], start, end });
    if (it.start < date) keep(it.start, addDays(date, -1));
    if (it.end > date) keep(addDays(date, 1), it.end);
  }
  if (mode !== 'office') saveItem({ id: newId(), kind: 'presence', mode, persons: [person], start: date, end: date });
}

export function updateSettings(patch: Partial<Settings>) {
  settings = { ...settings, ...patch };
  write(LS.settings, settings);
  if ('server' in patch || 'code' in patch) syncState = { status: settings.server ? 'idle' : 'off' };
  emit();
  scheduleSoon();
  if (settings.server) void sync();
}

/* ---------- Benachrichtigungen (gebündelt) ---------- */
let schedTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleSoon() {
  clearTimeout(schedTimer);
  schedTimer = setTimeout(() => void scheduleNotifications(getCalendar(), settings.notify).catch(() => {}), 1500);
}

/* ---------- Synchronisierung (Cloudflare Worker + D1) ---------- */
let syncTimer: ReturnType<typeof setTimeout> | undefined;
let running = false;
function syncSoon() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => void sync(), 800);
}

export async function sync(): Promise<void> {
  if (!settings.server || !settings.code) return;
  if (running) return void syncSoon();
  running = true;
  syncState = { ...syncState, status: 'syncing' };
  emit();
  try {
    const base = settings.server.replace(/\/+$/, '');
    const headers = { 'content-type': 'application/json', 'x-family-code': settings.code };
    const push = items.filter((i) => dirty.has(i.id));
    const res = await fetch(`${base}/api/sync`, { method: 'POST', headers, body: JSON.stringify({ since: rev, items: push }) });
    if (res.status === 401) throw new Error('Familiencode falsch');
    if (!res.ok) throw new Error(`Server ${res.status}`);
    const data = (await res.json()) as { rev: number; items: Item[] };

    const sent = new Set(push.map((i) => i.id));
    const sentVersions = new Map(push.map((i) => [i.id, i.updated]));
    const map = new Map(items.map((i) => [i.id, i]));
    for (const remote of data.items) {
      const local = map.get(remote.id);
      if (!local || remote.updated > local.updated) map.set(remote.id, remote);
    }
    items = [...map.values()];
    // nur als erledigt markieren, was zwischenzeitlich nicht erneut geändert wurde
    for (const id of sent) if (map.get(id)?.updated === sentVersions.get(id)) dirty.delete(id);
    for (const remote of data.items) if (map.get(remote.id) === remote) dirty.delete(remote.id);
    rev = data.rev;
    write(LS.rev, rev);

    // Feiertage/Ferien (serverseitig aktuell gehalten)
    try {
      const h = await fetch(`${base}/api/holidays`, { headers });
      if (h.ok) {
        const fresh = (await h.json()) as HolidayData;
        if (fresh.holidays?.length) {
          hd = fresh;
          write(LS.hd, hd);
        }
      }
    } catch {
      /* Offline-Stand bleibt */
    }
    syncState = { status: 'idle', last: Date.now() };
  } catch (e) {
    syncState = { status: 'error', last: syncState.last, msg: e instanceof Error ? e.message : String(e) };
  } finally {
    running = false;
    persist();
  }
}

export function startBackgroundSync() {
  void sync();
  setInterval(() => document.visibilityState === 'visible' && void sync(), 60_000);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void sync());
  scheduleSoon();
}
