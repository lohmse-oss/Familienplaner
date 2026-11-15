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
  updated: string; // "Stand 14:05"
  days: WidgetDay[]; // heute + nächste Tage – das Widget zeigt ab dem heutigen Eintrag drei Tage (rollierend)
  shopN: number; // offene Artikel der Einkaufsliste
  taskN: number; // aktive (offene) Aufgaben
  taskToday: number; // davon heute fällig
  taskOverdue: number; // davon überfällig (vor heute)
}

const HORIZON = 14;

/** Daten für das Homescreen-Widget (nur Grafik: Kreise mit Zahlen). Reine Funktion, damit sie testbar bleibt. */
export function buildWidgetData(cal: Calendar, today: string, now: Date, style: WidgetStyle = 'dark'): WidgetData {
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
  return { style, updated: `Stand ${hh}:${mm}`, days, shopN, taskN: tasks.length, taskToday, taskOverdue };
}
