import { useEffect, useState } from 'preact/hooks';
import bundled from './data/holidays.json';
import { buildCalendar, type Calendar } from './core/calendar';
import { contiguousRuns } from './core/dates';
import { planPresence, type PresenceOptions } from './core/presence';
import type { PersonFilter } from './core/filter';
import type { CalView } from './nav';
import { scheduleNotifications, showNow } from './notifications';
import { nativeConfigure, nativeMarkSeen, nativeSeen } from './native';
import { VERB_TEXT, type Verb } from './core/describe';
import type { WidgetStyle } from './core/widget';
import { pushWidget } from './widget';
import { PERSONS, type HolidayData, type Item, type Mode, type PersonId } from './core/types';

export interface Settings {
  widgetStyle: WidgetStyle;
  notifyPartner: boolean; // Hinweis, wenn der Partner etwas einträgt
  theme: 'system' | 'light' | 'dark';
  filter: PersonFilter; // Personenfilter für Kalender und Aufgaben
  calView: CalView; // zuletzt genutzte Kalenderansicht
  timeLayout: 'rows' | 'cols'; // Verlauf: Tage als Zeilen oder als Spalten
  role: 'write' | 'read'; // vom Server: Vollzugriff oder nur Lesen
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
export const DEFAULT_SERVER = 'https://familienplaner-sync.lohmse.workers.dev';
let settings: Settings = { widgetStyle: 'dark', notifyPartner: true, theme: 'system', filter: 'all', calView: 'week', timeLayout: 'rows', role: 'write', me: 'sebastian', server: DEFAULT_SERVER, code: '', notify: true, ...read<Partial<Settings>>(LS.settings, {}) };

/** Dunkelmodus und Kopfzeilenfarbe (Farbe der Person, der dieses Handy gehört) anwenden */
function applyLook() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (settings.theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = settings.theme;
  root.style.setProperty('--head', PERSONS[settings.me].color);
}
// ältere Version: weekView 'day' → calView 'day'
if ((settings as unknown as { weekView?: string }).weekView === 'day' && settings.calView === 'week') settings.calView = 'day';
applyLook();
const configured = () => !!settings.server && !!settings.code;
let syncState: SyncState = { status: configured() ? 'idle' : 'off' };

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
  return { items, settings, hd, sync: syncState, cal: getCalendar(), undo: undoInfo ? { id: undoInfo.id, label: undoInfo.label } : null, notice, readOnly: settings.role === 'read' };
}

export function getCalendar(): Calendar {
  return (calendar ??= buildCalendar(items, hd));
}

let batchDepth = 0;
let batchPending = false;
/** Mehrere Änderungen zusammenfassen: einmal speichern/neu zeichnen statt pro Eintrag. */
export function batch(fn: () => void) {
  batchDepth++;
  try {
    fn();
  } finally {
    batchDepth--;
    if (!batchDepth && batchPending) {
      batchPending = false;
      persist();
    }
  }
}

/* ---------- Hinweis: Partner hat etwas eingetragen ---------- */
export interface Notice {
  id: number;
  title: string;
  lines: string[];
  date?: string; // Tag, zu dem „Anzeigen“ springt
}
let notice: Notice | null = null;
let noticeTimer: ReturnType<typeof setTimeout> | undefined;
type Remote = Item & { _rev?: number; _text?: string; _verb?: Verb };

function flashReadOnly() {
  notice = { id: Date.now(), title: 'Nur Lesezugriff', lines: ['Mit diesem Zugang kann nichts geändert werden.'] };
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(dismissNotice, 4000);
  emit();
}

export function dismissNotice() {
  notice = null;
  clearTimeout(noticeTimer);
  emit();
}

function announce(fresh: Remote[]) {
  if (!settings.notifyPartner || !fresh.length) return;
  const by = fresh[0].by!;
  const name = PERSONS[by].name;
  const title = fresh.length === 1 ? `${name} ${VERB_TEXT[fresh[0]._verb ?? 'new']}` : `${name}: ${fresh.length} Änderungen`;
  const lines = fresh.slice(0, 3).map((r) => r._text!);
  if (fresh.length > 3) lines.push(`… und ${fresh.length - 3} weitere`);
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    notice = { id: Date.now(), title, lines, date: fresh[0].start };
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(dismissNotice, 12000);
    emit();
  } else {
    void showNow(title, lines.join('\n')).catch(() => {});
  }
}

/* ---------- Rückgängig ---------- */
let undoInfo: { id: number; label: string; restore: () => void } | null = null;
let undoTimer: ReturnType<typeof setTimeout> | undefined;

/** Änderungen ausführen und für ein paar Sekunden „Rückgängig“ anbieten. */
export function withUndo(label: string, fn: () => void) {
  const before = new Map(items.map((i) => [i.id, i]));
  batch(fn);
  const changed = items.filter((i) => before.get(i.id) !== i);
  const restore = () =>
    batch(() => {
      for (const cur of changed) {
        const old = before.get(cur.id);
        saveItem(old ? { ...old } : { ...cur, deleted: true });
      }
    });
  undoInfo = { id: Date.now(), label, restore };
  clearTimeout(undoTimer);
  undoTimer = setTimeout(() => {
    undoInfo = null;
    emit();
  }, 7000);
  emit();
}

export function undoLast() {
  const u = undoInfo;
  if (!u) return;
  undoInfo = null;
  clearTimeout(undoTimer);
  u.restore();
}

function persist() {
  if (batchDepth) {
    batchPending = true;
    return;
  }
  write(LS.items, items);
  write(LS.dirty, [...dirty]);
  calendar = null;
  emit();
  scheduleSoon();
}

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function saveItem(it: Omit<Item, 'updated' | 'by'> & Partial<Pick<Item, 'updated' | 'by'>>): Item {
  if (settings.role === 'read') {
    flashReadOnly();
    return { ...it, updated: 0 } as Item;
  }
  const cur = items.find((i) => i.id === it.id);
  // created: erstes Speichern (neu); ältere Einträge ohne Zeitpunkt gelten als „schon länger vorhanden“
  const full: Item = { ...it, created: it.created ?? cur?.created ?? (cur ? 1 : Date.now()), updated: Date.now(), by: settings.me };
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
 * Anwesenheit für Personen in einem Zeitraum setzen (Büro = Standard, entfernt nur).
 * Bestehende Einträge werden geteilt/gekürzt; Reste bleiben erhalten.
 */
export function setPresenceRange(persons: PersonId[], start: string, end: string, mode: Mode | 'office', opts: PresenceOptions = {}) {
  batch(() => {
    for (const it of planPresence(items, persons, start, end, mode, opts, newId)) saveItem(it);
  });
}

/** Einzelner Tag (Schnellauswahl in der Wochenansicht) */
export function setPresence(person: PersonId, date: string, mode: Mode | 'office') {
  setPresenceRange([person], date, date, mode);
}

/** Mehrfachauswahl von Tagen: je zusammenhängendem Zeitraum ein Eintrag */
export function applyToDays(
  dates: string[],
  action:
    | { type: 'presence'; persons: PersonId[]; mode: Mode | 'office'; title?: string; away?: boolean }
    | { type: 'care' | 'cover'; persons: PersonId[]; title?: string },
) {
  batch(() => {
    for (const r of contiguousRuns(dates)) {
      if (action.type === 'presence') {
        setPresenceRange(action.persons, r.start, r.end, action.mode, { title: action.title, away: action.away });
      } else {
        saveItem({ id: newId(), kind: action.type, persons: action.persons, title: action.title, start: r.start, end: r.end });
      }
    }
  });
}

/* ---------- Einkaufsliste ---------- */
const nowIso = () => new Date().toISOString().slice(0, 10);

export function addShop(title: string): boolean {
  const t = title.trim();
  if (!t) return false;
  if (items.some((i) => i.kind === 'shop' && !i.deleted && !i.done && i.title?.toLowerCase() === t.toLowerCase())) return false;
  saveItem({ id: newId(), kind: 'shop', title: t, persons: [], start: nowIso(), end: nowIso(), ts: Date.now() });
  return true;
}
export function toggleShop(id: string) {
  const cur = items.find((i) => i.id === id);
  if (cur) saveItem({ ...cur, done: !cur.done });
}
export function removeShop(ids: string[]) {
  batch(() => {
    for (const id of ids) deleteItem(id);
  });
}

export function updateSettings(patch: Partial<Settings>) {
  settings = { ...settings, ...patch };
  write(LS.settings, settings);
  applyLook();
  if ('server' in patch || 'code' in patch) syncState = { status: configured() ? 'idle' : 'off' };
  emit();
  scheduleSoon();
  if (configured()) void sync();
}

/* ---------- Benachrichtigungen (gebündelt) ---------- */
let schedTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleSoon() {
  clearTimeout(schedTimer);
  schedTimer = setTimeout(() => {
    void scheduleNotifications(getCalendar(), settings.notify).catch(() => {});
    void pushWidget(getCalendar(), settings.widgetStyle).catch(() => {});
  }, 1500);
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
    const push = settings.role === 'read' ? [] : items.filter((i) => dirty.has(i.id));
    const res = await fetch(`${base}/api/sync`, { method: 'POST', headers, body: JSON.stringify({ since: rev, items: push }) });
    if (res.status === 401) throw new Error('Familiencode falsch');
    if (res.status === 403) {
      // Server kennt uns nur mit Lesezugriff: eigene Änderungen verwerfen
      settings = { ...settings, role: 'read' };
      write(LS.settings, settings);
      dirty = new Set();
      throw new Error('Nur Lesezugriff');
    }
    if (!res.ok) throw new Error(`Server ${res.status}`);
    const data = (await res.json()) as { rev: number; role?: 'write' | 'read'; items: Remote[] };
    if (data.role && data.role !== settings.role) {
      settings = { ...settings, role: data.role, ...(data.role === 'read' ? { notifyPartner: false } : {}) };
      write(LS.settings, settings);
    }
    const since = rev;

    const sent = new Set(push.map((i) => i.id));
    const sentVersions = new Map(push.map((i) => [i.id, i.updated]));
    const map = new Map(items.map((i) => [i.id, i]));
    const adopted = new Set<string>();
    const fresh: Remote[] = [];
    for (const remote of data.items) {
      const { _rev, _text, _verb, ...clean } = remote;
      void _rev;
      void _text;
      void _verb;
      const local = map.get(clean.id);
      if (!local || clean.updated > local.updated) {
        map.set(clean.id, clean as Item);
        adopted.add(clean.id);
        if (since > 0 && clean.by && clean.by !== settings.me && remote._text) fresh.push(remote);
      }
    }
    items = [...map.values()];
    // nur als erledigt markieren, was zwischenzeitlich nicht erneut geändert wurde
    for (const id of sent) if (map.get(id)?.updated === sentVersions.get(id)) dirty.delete(id);
    for (const id of adopted) dirty.delete(id);

    // Hinweise: nur was der Hintergrund-Abgleich (Android) noch nicht gemeldet hat
    const seen = await nativeSeen();
    announce(fresh.filter((r) => (r._rev ?? 0) > seen));
    void nativeMarkSeen(data.rev);
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
    void nativeConfigure(settings.server, settings.code, settings.me, rev, settings.notifyPartner);
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
