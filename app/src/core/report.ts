import type { Calendar } from './calendar';
import { addDays, range } from './dates';
import type { Item, PersonId } from './types';

export interface VacationPeriod {
  start: string;
  end: string;
  workdays: number; // Urlaubstage (24.12./31.12. = 0,5)
  titles: string[];
}

export interface VacationReport {
  person: PersonId;
  year: number;
  periods: VacationPeriod[];
  used: number;
  entitlement?: number;
  rest?: number;
}

/** Urlaubstage im Zeitraum: ohne Wochenenden und Feiertage, 24.12. und 31.12. je 0,5 */
export function workdaysBetween(cal: Calendar, a: string, b: string): number {
  let n = 0;
  for (const d of range(a, b)) n += cal.weight(d);
  return n;
}

export function entitlementOf(items: Item[], person: PersonId, year: number): number | undefined {
  return items.find((i) => i.kind === 'config' && !i.deleted && i.id === `config:${person}:${year}`)?.entitlement;
}

/** Alle Urlaubstage (nur Arbeitstage, mit Tageswert) einer Person im Jahr */
export function vacationDayList(cal: Calendar, person: PersonId, year: number): { d: string; w: number; title?: string }[] {
  const days: { d: string; w: number; title?: string }[] = [];
  for (const d of range(`${year}-01-01`, `${year}-12-31`)) {
    const day = cal.day(d);
    const s = day.parents[person];
    if (s?.status === 'vacation' && day.workday) days.push({ d, w: cal.weight(d), title: s.item?.title });
  }
  return days;
}

/**
 * Urlaubsübersicht je Person und Jahr. Aufeinanderfolgende Urlaubstage werden zu einem Zeitraum
 * zusammengefasst – auch über Wochenenden und Feiertage hinweg.
 */
export function vacationReport(cal: Calendar, person: PersonId, year: number): VacationReport {
  const periods: VacationPeriod[] = [];
  for (const { d, w, title } of vacationDayList(cal, person, year)) {
    const last = periods[periods.length - 1];
    const bridged = last && [...range(addDays(last.end, 1), addDays(d, -1))].every((x) => cal.isFree(x));
    if (last && bridged) {
      last.end = d;
      last.workdays += w;
      if (title && !last.titles.includes(title)) last.titles.push(title);
    } else periods.push({ start: d, end: d, workdays: w, titles: title ? [title] : [] });
  }

  const used = periods.reduce((s, p) => s + p.workdays, 0);
  const entitlement = entitlementOf(cal.items, person, year);
  return { person, year, periods, used, entitlement, rest: entitlement === undefined ? undefined : entitlement - used };
}

export interface Budget {
  entitlement?: number;
  taken: number; // Urlaubstage vor heute
  planned: number; // ab heute geplant
  free?: number; // noch nicht verplant
}

/** Urlaubskonto: Anspruch = genommen + geplant + noch frei */
export function budget(cal: Calendar, person: PersonId, year: number, today: string): Budget {
  const days = vacationDayList(cal, person, year);
  const sum = (l: { w: number }[]) => l.reduce((n, x) => n + x.w, 0);
  const taken = sum(days.filter((x) => x.d < today));
  const planned = sum(days) - taken;
  const entitlement = entitlementOf(cal.items, person, year);
  return { entitlement, taken, planned, free: entitlement === undefined ? undefined : entitlement - taken - planned };
}
