import type { Calendar, Coverage } from './calendar';
import { addDays } from './dates';
import { PARENTS } from './types';

export type WidgetStyle = 'dark' | 'light' | 'glass' | 'transparent';

export interface WidgetDay {
  date: string;
  n: number; // wie viele Einträge stehen an diesem Tag an (Termine, Aufgaben, Geburtstage, Infos, Betreuungsbedarf, Urlaub/Dienstreise)
  cov: Coverage; // Betreuungs-Ampel (rot = ungeklärt)
}
export interface WidgetData {
  style: WidgetStyle;
  scaleNothing: number; // Schriftgröße Nothing-Widget Label/Fuß (1 = normal, Default 1.75)
  scaleStandard: number; // Schriftgröße Standard-Widget (1 = normal)
  scaleCircle: number; // Zahlen in den Kreisen des Nothing-Widgets (Default 1.75)
  updated: string; // "Stand 14:05"
  days: WidgetDay[]; // heute + nächste Tage – das Widget zeigt ab dem heutigen Eintrag drei Tage (rollierend)
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

/** Daten für das Homescreen-Widget. Reine Funktion, damit sie testbar bleibt. */
export function buildWidgetData(cal: Calendar, today: string, now: Date, style: WidgetStyle = 'dark', scales: WidgetScales = DEFAULT_WIDGET_SCALES): WidgetData {
  const days: WidgetDay[] = [];
  for (let i = 0; i < HORIZON; i++) {
    const date = addDays(today, i);
    const d = cal.day(date);
    const absent = PARENTS.filter((p) => d.workday && (d.parents[p].status === 'trip' || d.parents[p].status === 'vacation')).length;
    const n = d.events.length + d.tasks.filter((t) => !t.done).length + d.birthdays.length + d.info.length + (d.needs.length ? 1 : 0) + absent;
    days.push({ date, n, cov: d.coverage });
  }
  const shopN = cal.items.filter((i) => i.kind === 'shop' && !i.done).length;
  const tasks = cal.items.filter((i) => i.kind === 'task' && !i.done);
  const taskOverdue = tasks.filter((i) => i.start < today).length;
  const taskToday = tasks.filter((i) => i.start === today).length;
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return { style, scaleNothing: scales.nothing, scaleStandard: scales.standard, scaleCircle: scales.circle, updated: `Stand ${hh}:${mm}`, days, shopN, taskN: tasks.length, taskToday, taskOverdue };
}
