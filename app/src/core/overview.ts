import { timeOn, type Calendar, type Coverage } from './calendar';
import { addDays, diff, dow, fmtShort, range, WD } from './dates';
import { CHILDREN, PERSONS, type Item } from './types';
import { countDay } from './widget';

/**
 * „Was ist zu der Zeit sonst los?“ – Übersicht beim Eintragen (wie das 4×1-Widget: ein Kreis je Tag mit Anzahl und Ampel)
 * plus eine kurze Liste der Einträge, Feiertage und Ferien im gewählten Zeitraum. Der gerade bearbeitete Eintrag zählt nicht mit.
 */
export interface OvDay {
  date: string;
  n: number;
  cov: Coverage;
  inRange: boolean; // Teil des gewählten Zeitraums (bei einem Tag: Nachbartage zur Orientierung)
}
export type OvIcon = 'flag' | 'school' | 'palm' | 'plane' | 'baby' | 'hand' | 'addcal' | 'ticket' | 'tasks' | 'cake';
export interface OvEntry {
  key: string;
  icon: OvIcon;
  text: string;
  when: string; // „Fr 04.12.“ bzw. „04.12.–06.12.“
}

const MAX_STRIP = 21;

export function overview(cal: Calendar, start: string, end: string, excludeId?: string): { days: OvDay[]; entries: OvEntry[] } {
  if (!start || end < start) return { days: [], entries: [] };
  const span = diff(start, end);
  const last = span > 92 ? addDays(start, 92) : end; // Schutz vor Riesenzeiträumen
  const [a, b] = span === 0 ? [addDays(start, -2), addDays(start, 2)] : [start, span < MAX_STRIP ? end : addDays(start, MAX_STRIP - 1)];
  const days = [...range(a, b)].map((date) => {
    const d = cal.day(date);
    return { date, n: countDay(d, excludeId), cov: d.coverage, inRange: date >= start && date <= end };
  });

  const seen = new Map<string, { icon: OvIcon; text: string; from: string; to: string; order: number }>();
  let order = 0;
  const add = (key: string, icon: OvIcon, text: string, date: string) => {
    const cur = seen.get(key);
    if (cur) cur.to = date;
    else seen.set(key, { icon, text, from: date, to: date, order: order++ });
  };
  const other = (i: Item) => i.id !== excludeId;
  for (const date of range(start, last)) {
    const d = cal.day(date);
    if (d.holiday) add(`hol:${d.holiday}`, 'flag', d.holiday, date);
    for (const s of d.school) if (!d.weekend) add(`sch:${s}`, 'school', s, date);
    for (const it of cal.items) {
      if (!other(it) || it.start > date || it.end < date) continue;
      const who = (l: string[]) => l.map((x) => PERSONS[x as keyof typeof PERSONS].name).join(', ');
      if (it.kind === 'presence' && (it.mode === 'vacation' || it.mode === 'trip'))
        add(it.id, it.mode === 'trip' ? 'plane' : 'palm', `${who(it.persons)}: ${it.mode === 'trip' ? 'Dienstreise' : 'Urlaub'}${it.title ? ` (${it.title})` : ''}`, date);
      if (it.kind === 'care') add(it.id, 'baby', `${who(it.persons.filter((c) => CHILDREN.includes(c)))}: ${it.title || 'Betreuung nötig'}`, date);
    }
    for (const c of d.cover.filter(other)) add(c.id, 'hand', `Betreuung durch ${c.title || 'Dritte'}`, date);
    for (const e of d.events.filter(other)) {
      const t = timeOn(e, date);
      add(`${e.id}${e.recur ? `:${date}` : ''}`, 'addcal', `${t ? t + ' ' : ''}${e.title ?? 'Termin'}`, date);
    }
    for (const i of d.info.filter(other)) add(i.id, 'ticket', `${i.title ?? 'Event'}${i.away ? ' (auswärts)' : ''}`, date);
    for (const t of d.tasks.filter((x) => !x.done && other(x))) add(t.id, 'tasks', `Aufgabe: ${t.title}`, date);
    for (const bd of d.birthdays.filter(other)) add(`${bd.id}:${date}`, 'cake', `Geburtstag ${bd.title}`, date);
  }
  const day = (s: string) => `${WD[dow(s)]} ${fmtShort(s)}`;
  const entries = [...seen.entries()]
    .sort((x, y) => x[1].from.localeCompare(y[1].from) || x[1].order - y[1].order)
    .map(([key, v]) => ({ key, icon: v.icon, text: v.text, when: v.from === v.to ? day(v.from) : `${fmtShort(v.from)}–${fmtShort(v.to)}` }));
  return { days, entries };
}
