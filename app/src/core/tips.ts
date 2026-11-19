import { findBridges, type Bridge } from './bridges';
import type { Calendar } from './calendar';
import { addDays, range } from './dates';
import { PARENTS, type PersonId } from './types';

export interface BridgeTip extends Bridge {
  taken: PersonId[]; // Eltern, die an allen Brückentagen schon Urlaub haben
}

/**
 * Brückentage-Tipps für die Startseite: kommende Brücken der nächsten 12 Monate, die noch nicht beide Eltern verplant haben,
 * die lohnendsten zuerst (freie Tage je Urlaubstag), bei Gleichstand die früheste.
 */
export function bridgeTips(cal: Calendar, today: string, limit = 3): BridgeTip[] {
  const until = addDays(today, 365);
  const y = Number(today.slice(0, 4));
  const all = [...findBridges(cal, y), ...findBridges(cal, y + 1)].filter((b) => b.gapStart > today && b.gapStart <= until);
  const seen = new Set<string>();
  const out: BridgeTip[] = [];
  for (const b of all) {
    if (seen.has(b.gapStart)) continue;
    seen.add(b.gapStart);
    const days = [...range(b.gapStart, b.gapEnd)];
    const taken = PARENTS.filter((p) => days.every((d) => cal.day(d).parents[p].status === 'vacation'));
    if (taken.length === PARENTS.length || b.cost <= 0) continue;
    out.push({ ...b, taken });
  }
  out.sort((a, b) => b.total / b.cost - a.total / a.cost || a.gapStart.localeCompare(b.gapStart));
  return out.slice(0, limit);
}

/** Jahresbilanz aller Brückentage: so viele Urlaubstage → so viele freie Tage am Stück (Summe). */
export function bridgeYear(cal: Calendar, year: number): { cost: number; total: number; count: number } {
  const bs = findBridges(cal, year);
  return { cost: bs.reduce((n, b) => n + b.cost, 0), total: bs.reduce((n, b) => n + b.total, 0), count: bs.length };
}
