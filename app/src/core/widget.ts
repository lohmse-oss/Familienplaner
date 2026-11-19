import type { Calendar, Coverage, DayInfo } from './calendar';
import { addDays, ageOn } from './dates';
import { MODE_LABEL, PARENTS, PERSONS, type Item, type Kind, type PersonId } from './types';
import { isDormant } from './recur';
import { dayTag, timeOn } from './calendar';

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
  color: string; // Farbe der zuständigen/betroffenen Person (#rrggbb, leer = Familie) – für die Grafik in Android Auto
  mode?: string; // presence: homeoffice | vacation | trip
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
  shop: string[]; // offene Artikel (Titel, neueste zuerst) – Einkaufsliste in Android Auto
  taskList: { title: string; due: string; late: boolean; color: string }[]; // aktive Aufgaben nach Fälligkeit – Android Auto
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

/** Wie viel steht an einem Tag an? (Widget-Kreise und Übersicht beim Eintragen) – optional ohne einen bestimmten Eintrag. */
export function countDay(d: DayInfo, excludeId?: string): number {
  const keep = (i: Item) => i.id !== excludeId;
  const absent = PARENTS.filter((p) => d.workday && (d.parents[p].status === 'trip' || d.parents[p].status === 'vacation') && d.parents[p].item?.id !== excludeId).length;
  return d.events.filter(keep).length + d.tasks.filter((t) => !t.done && keep(t)).length + d.birthdays.filter(keep).length + d.info.filter(keep).length + (d.needs.length ? 1 : 0) + absent;
}

const names = (ps: PersonId[]) => (ps.length >= 4 ? 'Familie' : ps.map((p) => PERSONS[p].name).join(', '));

/** Einträge eines Tages als flache, chronologisch sortierte Liste (ganztägige zuerst) – Basis für Android Auto. */
function dayEntries(d: DayInfo): WidgetEntry[] {
  const out: WidgetEntry[] = [];
  const col = (p?: PersonId | null) => (p ? PERSONS[p].color : '');
  for (const e of d.events) {
    const t = timeOn(e, d.date);
    const tag = dayTag(e, d.date);
    out.push({ date: d.date, time: t ? (e.endTime && !tag ? `${t}–${e.endTime}` : t) : '', title: e.title || 'Termin', detail: [names(e.persons), tag, e.place].filter(Boolean).join(' · '), kind: 'event', color: col(e.owner ?? e.persons[0]) });
  }
  for (const n of d.info)
    out.push({ date: d.date, time: timeOn(n, d.date) ?? '', title: n.title || 'Event', detail: [n.away ? 'auswärts' : '', dayTag(n, d.date), n.place].filter(Boolean).join(' · '), kind: 'info', color: col(n.persons[0]) });
  for (const t of d.tasks.filter((t) => !t.done))
    out.push({ date: d.date, time: '', title: t.title || 'Aufgabe', detail: t.owner ? PERSONS[t.owner].name : '', kind: 'task', color: col(t.owner) });
  for (const b of d.birthdays) {
    const age = ageOn(b.start, d.date);
    out.push({ date: d.date, time: '', title: b.title || 'Geburtstag', detail: age >= 0 ? `${age} Jahre` : '', kind: 'birthday', color: '' });
  }
  for (const p of PARENTS) {
    const s = d.parents[p];
    if ((s.status === 'homeoffice' || s.status === 'vacation' || s.status === 'trip') && s.item)
      out.push({ date: d.date, time: '', title: `${MODE_LABEL[s.status]} ${PERSONS[p].name}`, detail: [s.item.title, s.away ? 'verreist' : ''].filter(Boolean).join(' · '), kind: 'presence', mode: s.status, color: col(p) });
  }
  for (const nd of d.needs) out.push({ date: d.date, time: '', title: `Betreuung: ${PERSONS[nd.child].name}`, detail: nd.reason, kind: 'care', color: col(nd.child) });
  for (const c of d.cover) out.push({ date: d.date, time: '', title: c.title ? `Betreuung durch ${c.title}` : 'Betreuung', detail: names(c.persons), kind: 'cover', color: '' });
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
    days.push({ date, n: countDay(d), cov: d.coverage });
    entries.push(...dayEntries(d));
  }
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
  const shopN = cal.items.filter((i) => i.kind === 'shop' && !i.done).length;
  const tasks = cal.items.filter((i) => i.kind === 'task' && !i.done && !isDormant(i, today)); // vorgemerkte Fristen zählen noch nicht
  const taskOverdue = tasks.filter((i) => i.start < today).length;
  const taskToday = tasks.filter((i) => i.start === today).length;
  const shop = cal.items
    .filter((i) => i.kind === 'shop' && !i.done)
    .sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0))
    .slice(0, 40)
    .map((i) => i.title ?? '');
  const taskList = [...tasks]
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 25)
    .map((t) => ({ title: t.title ?? 'Aufgabe', due: t.start, late: t.start < today, color: t.owner ? PERSONS[t.owner].color : '' }));
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return { style, scaleNothing: scales.nothing, scaleStandard: scales.standard, scaleCircle: scales.circle, updated: `Stand ${hh}:${mm}`, days, entries, shopN, shop, taskList, taskN: tasks.length, taskToday, taskOverdue };
}
