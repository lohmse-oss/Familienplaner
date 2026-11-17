import type { Calendar, Coverage, DayInfo } from './calendar';
import { addDays, ageOn } from './dates';
import { MODE_LABEL, PARENTS, PERSONS, type Kind, type PersonId } from './types';

export type WidgetStyle = 'dark' | 'light' | 'glass' | 'transparent';

export interface WidgetDay {
  date: string;
  n: number; // wie viele Einträge stehen an diesem Tag an (Termine, Aufgaben, Geburtstage, Infos, Betreuungsbedarf, Urlaub/Dienstreise)
  cov: Coverage; // Betreuungs-Ampel (rot = ungeklärt)
}
export interface WidgetEntry {
  date: string; // YYYY-MM-DD
  time: string; // "HH:MM" bzw. "HH:MM–HH:MM", leer = ganztägig
  title: string; // z. B. "Kinderarzt", "Urlaub Sebastian", "Betreuung: Ida"
  detail: string; // Personen, Ort, Grund, Alter ... (kann leer sein)
  kind: Kind; // event | info | task | birthday | presence | care | cover
}
export interface WidgetData {
  style: WidgetStyle;
  scaleNothing: number; // Schriftgröße Nothing-Widget Label/Fuß (1 = normal, Default 1.75)
  scaleStandard: number; // Schriftgröße Standard-Widget (1 = normal)
  scaleCircle: number; // Zahlen in den Kreisen des Nothing-Widgets (Default 1.75)
  updated: string; // "Stand 14:05"
  days: WidgetDay[]; // heute + nächste Tage – das Widget zeigt ab dem heutigen Eintrag drei Tage (rollierend)
  entries: WidgetEntry[]; // alle Einträge der nächsten Tage, chronologisch (für Android Auto); ganztägige zuerst
  shopN: number; // offene Artikel der Einkaufsliste
  taskN: number; // aktive (offene) Aufgaben
  taskToday: number; // davon heute fällig
  taskOverdue: number; // davon überfällig (vor heute)
}
export interface WidgetScales {
  nothing: number;
  standard: number;
  circle: number;
}
export const DEFAULT_WIDGET_SCALES: WidgetScales = { nothing: 1.75, standard: 1, circle: 1.75 };

const HORIZON = 14;
const MAX_ENTRIES = 100; // Schutz fürs SharedPreferences-Payload

const names = (ps: PersonId[]) => (ps.length >= 4 ? 'Familie' : ps.map((p) => PERSONS[p].name).join(', '));
const spanTime = (it: { time?: string; endTime?: string }) => (it.time ? (it.endTime ? `${it.time}–${it.endTime}` : it.time) : '');

/** Einträge eines Tages als flache, chronologisch sortierte Liste (ganztägige zuerst) – Basis für Android Auto. */
function dayEntries(d: DayInfo): WidgetEntry[] {
  const out: WidgetEntry[] = [];
  for (const e of d.events)
    out.push({ date: d.date, time: spanTime(e), title: e.title || 'Termin', detail: [names(e.persons), e.place].filter(Boolean).join(' · '), kind: 'event' });
  for (const n of d.info)
    out.push({ date: d.date, time: spanTime(n), title: n.title || 'Info', detail: n.place || '', kind: 'info' });
  for (const t of d.tasks.filter((t) => !t.done))
    out.push({ date: d.date, time: '', title: t.title || 'Aufgabe', detail: t.owner ? PERSONS[t.owner].name : '', kind: 'task' });
  for (const b of d.birthdays) {
    const age = ageOn(b.start, d.date);
    out.push({ date: d.date, time: '', title: b.title || 'Geburtstag', detail: age >= 0 ? `${age} Jahre` : '', kind: 'birthday' });
  }
  for (const p of PARENTS) {
    const s = d.parents[p];
    if ((s.status === 'homeoffice' || s.status === 'vacation' || s.status === 'trip') && s.item)
      out.push({ date: d.date, time: '', title: `${MODE_LABEL[s.status]} ${PERSONS[p].name}`, detail: [s.item.title, s.away ? 'verreist' : ''].filter(Boolean).join(' · '), kind: 'presence' });
  }
  for (const nd of d.needs) out.push({ date: d.date, time: '', title: `Betreuung: ${PERSONS[nd.child].name}`, detail: nd.reason, kind: 'care' });
  for (const c of d.cover) out.push({ date: d.date, time: '', title: c.title ? `Betreuung durch ${c.title}` : 'Betreuung', detail: names(c.persons), kind: 'cover' });
  out.sort((a, b) => a.time.localeCompare(b.time));
  return out;
}

/** Daten für das Homescreen-Widget (und Android Auto). Reine Funktion, damit sie testbar bleibt. */
export function buildWidgetData(cal: Calendar, today: string, now: Date, style: WidgetStyle = 'dark', scales: WidgetScales = DEFAULT_WIDGET_SCALES): WidgetData {
  const days: WidgetDay[] = [];
  const entries: WidgetEntry[] = [];
  for (let i = 0; i < HORIZON; i++) {
    const date = addDays(today, i);
    const d = cal.day(date);
    const absent = PARENTS.filter((p) => d.workday && (d.parents[p].status === 'trip' || d.parents[p].status === 'vacation')).length;
    const n = d.events.length + d.tasks.filter((t) => !t.done).length + d.birthdays.length + d.info.length + (d.needs.length ? 1 : 0) + absent;
    days.push({ date, n, cov: d.coverage });
    entries.push(...dayEntries(d));
  }
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
  const shopN = cal.items.filter((i) => i.kind === 'shop' && !i.done).length;
  const tasks = cal.items.filter((i) => i.kind === 'task' && !i.done);
  const taskOverdue = tasks.filter((i) => i.start < today).length;
  const taskToday = tasks.filter((i) => i.start === today).length;
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return { style, scaleNothing: scales.nothing, scaleStandard: scales.standard, scaleCircle: scales.circle, updated: `Stand ${hh}:${mm}`, days, entries, shopN, taskN: tasks.length, taskToday, taskOverdue };
}
