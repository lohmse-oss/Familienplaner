import { addDays } from './dates';
import type { Every, Item, Lead } from './types';

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
    case '2years':
      return addMonths(due, 24);
  }
}

/** Ab diesem Tag steht eine Frist an (Ablaufdatum minus Vorlauf). */
export function remindFrom(due: string, lead: Lead): string {
  return lead === '2w' ? addDays(due, -14) : addMonths(due, -{ '1m': 1, '3m': 3, '6m': 6, '1y': 12 }[lead]);
}

/** Frist, die noch nicht ansteht: offen, mit Vorlauf, Erinnerung liegt in der Zukunft. Zählt nicht als „offen“. */
export const isDormant = (t: Item, today: string) => t.kind === 'task' && !t.done && !!t.lead && remindFrom(t.start, t.lead) > today;
/** Frist im Vorlauf: jetzt kümmern (z. B. Ausweis neu beantragen), aber noch nicht abgelaufen. */
export const isDueSoon = (t: Item, today: string) => t.kind === 'task' && !t.done && !!t.lead && remindFrom(t.start, t.lead) <= today && t.start >= today;
