import type { Calendar, Coverage, DayInfo } from './calendar';
import { addDays } from './dates';
import { PARENTS, type Item } from './types';
import { isDormant } from './recur';

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

/** Wie viel steht an einem Tag an? (Widget-Kreise und Übersicht beim Eintragen) – optional ohne einen bestimmten Eintrag. */
export function countDay(d: DayInfo, excludeId?: string): number {
  const keep = (i: Item) => i.id !== excludeId;
  const absent = PARENTS.filter((p) => d.workday && (d.parents[p].status === 'trip' || d.parents[p].status === 'vacation') && d.parents[p].item?.id !== excludeId).length;
  return d.events.filter(keep).length + d.tasks.filter((t) => !t.done && keep(t)).length + d.birthdays.filter(keep).length + d.info.filter(keep).length + (d.needs.length ? 1 : 0) + absent;
}

/** Daten für das Homescreen-Widget. Reine Funktion, damit sie testbar bleibt. */
export function buildWidgetData(cal: Calendar, today: string, now: Date, style: WidgetStyle = 'dark', scales: WidgetScales = DEFAULT_WIDGET_SCALES): WidgetData {
  const days: WidgetDay[] = [];
  for (let i = 0; i < HORIZON; i++) {
    const date = addDays(today, i);
    const d = cal.day(date);
    days.push({ date, n: countDay(d), cov: d.coverage });
  }
  const shopN = cal.items.filter((i) => i.kind === 'shop' && !i.done).length;
  const tasks = cal.items.filter((i) => i.kind === 'task' && !i.done && !isDormant(i, today)); // vorgemerkte Fristen zählen noch nicht
  const taskOverdue = tasks.filter((i) => i.start < today).length;
  const taskToday = tasks.filter((i) => i.start === today).length;
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return { style, scaleNothing: scales.nothing, scaleStandard: scales.standard, scaleCircle: scales.circle, updated: `Stand ${hh}:${mm}`, days, shopN, taskN: tasks.length, taskToday, taskOverdue };
}
