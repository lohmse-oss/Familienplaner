import { addDays } from './dates';
import type { Every } from './types';

/** Monate addieren; gibt es den Tag im Zielmonat nicht (31.), gilt der letzte Tag des Monats. */
export function addMonths(s: string, n: number): string {
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7)) - 1 + n;
  const ty = y + Math.floor(m / 12);
  const tm = ((m % 12) + 12) % 12;
  const last = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  const d = Math.min(Number(s.slice(8, 10)), last);
  return `${ty}-${String(tm + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Nächste Fälligkeit einer wiederkehrenden Aufgabe – gerechnet ab der bisherigen Fälligkeit (nicht ab dem Erledigt-Tag). */
export function nextDue(due: string, every: Every): string {
  switch (every) {
    case 'week':
      return addDays(due, 7);
    case '2weeks':
      return addDays(due, 14);
    case 'month':
      return addMonths(due, 1);
    case 'quarter':
      return addMonths(due, 3);
    case 'year':
      return addMonths(due, 12);
  }
}
