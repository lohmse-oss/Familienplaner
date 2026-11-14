import type { Calendar } from './calendar';
import { addDays, fmtRange, range } from './dates';
import { PERSONS, type Item, type PersonId } from './types';

export interface VacationPeriod {
  start: string;
  end: string;
  workdays: number;
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

/** Arbeitstage (Mo–Fr, ohne Feiertage) im Zeitraum */
export function workdaysBetween(cal: Calendar, a: string, b: string): number {
  let n = 0;
  for (const d of range(a, b)) if (!cal.isFree(d)) n++;
  return n;
}

export function entitlementOf(items: Item[], person: PersonId, year: number): number | undefined {
  return items.find((i) => i.kind === 'config' && !i.deleted && i.id === `config:${person}:${year}`)?.entitlement;
}

/**
 * Urlaubsübersicht je Person und Jahr. Aufeinanderfolgende Urlaubstage werden zu einem Zeitraum
 * zusammengefasst – auch über Wochenenden und Feiertage hinweg.
 */
export function vacationReport(cal: Calendar, person: PersonId, year: number): VacationReport {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const days: { d: string; title?: string }[] = [];
  for (const d of range(from, to)) {
    const s = cal.day(d).parents[person];
    if (s?.status === 'vacation' && cal.day(d).workday) days.push({ d, title: s.item?.title });
  }

  const periods: VacationPeriod[] = [];
  for (const { d, title } of days) {
    const last = periods[periods.length - 1];
    const bridged = last && [...range(addDays(last.end, 1), addDays(d, -1))].every((x) => cal.isFree(x));
    if (last && bridged) {
      last.end = d;
      last.workdays++;
      if (title && !last.titles.includes(title)) last.titles.push(title);
    } else periods.push({ start: d, end: d, workdays: 1, titles: title ? [title] : [] });
  }

  const used = periods.reduce((s, p) => s + p.workdays, 0);
  const entitlement = entitlementOf(cal.items, person, year);
  return { person, year, periods, used, entitlement, rest: entitlement === undefined ? undefined : entitlement - used };
}

/** Text zum Weitergeben an den Arbeitgeber */
export function reportText(r: VacationReport): string {
  const lines = [`Urlaubsplanung ${r.year} – ${PERSONS[r.person].name}`, ''];
  if (!r.periods.length) lines.push('Noch kein Urlaub geplant.');
  for (const p of r.periods) {
    const t = p.titles.length ? ` (${p.titles.join(', ')})` : '';
    lines.push(`${fmtRange(p.start, p.end)}: ${p.workdays} Arbeitstag${p.workdays === 1 ? '' : 'e'}${t}`);
  }
  lines.push('');
  lines.push(`Summe: ${r.used} Arbeitstage` + (r.entitlement !== undefined ? ` von ${r.entitlement} (Rest ${r.rest})` : ''));
  return lines.join('\n');
}

