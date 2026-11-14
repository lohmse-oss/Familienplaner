import type { Calendar } from './calendar';
import { addDays, range } from './dates';
import { PERSONS } from './types';

export interface GapRun {
  start: string;
  end: string;
  days: number; // betroffene Arbeitstage
  who: string;
  why: string;
}

/**
 * Zusammenhängende Zeiträume mit ungeklärter Betreuung.
 * Wochenenden und Feiertage unterbrechen einen Zeitraum nicht.
 */
export function gapRuns(cal: Calendar, from: string, to: string): GapRun[] {
  const runs: GapRun[] = [];
  let cur: (GapRun & { kids: Set<string>; reasons: Set<string> }) | null = null;
  const flush = () => {
    if (cur) runs.push({ start: cur.start, end: cur.end, days: cur.days, who: [...cur.kids].join(' & '), why: [...cur.reasons].join(', ') });
    cur = null;
  };
  for (const d of range(from, to)) {
    const day = cal.day(d);
    if (day.coverage === 'gap') {
      cur ??= { start: d, end: d, days: 0, who: '', why: '', kids: new Set(), reasons: new Set() };
      cur.end = d;
      cur.days++;
      for (const n of day.needs) {
        cur.kids.add(PERSONS[n.child].name);
        cur.reasons.add(n.reason);
      }
    } else if (day.workday) flush();
  }
  flush();
  return runs;
}

export const nextGap = (cal: Calendar, today: string, horizonDays = 90): GapRun | undefined =>
  gapRuns(cal, today, addDays(today, horizonDays))[0];
