import { needsOwner, type Calendar, type Coverage } from './calendar';
import { addDays, dow, fmtShort, range, WD } from './dates';
import { PARENTS, PERSONS } from './types';

export interface WidgetDay {
  date: string;
  label: string; // "Mo, 12.07. · Feiertagsname"
  cov: Coverage;
  covText: string;
  parents: string; // "Sebastian: Büro  ·  Betty: Homeoffice"
  need: string; // "Ida: Sommerferien"
  next: string[]; // nächste Termine ab diesem Tag (max. 3)
}
export interface WidgetData {
  updated: string; // "Stand 14:05"
  days: WidgetDay[]; // heute + nächste Tage – das Widget wählt den heutigen Eintrag
  shop: string; // "Einkauf (3): Milch, Brot, Eier"
}

const COV_TEXT: Record<Coverage, string> = { none: '', ok: 'Betreuung gesichert', maybe: 'nur per Homeoffice', gap: 'Betreuung offen' };
const STATUS_TEXT = { free: 'frei', office: 'Büro', homeoffice: 'Homeoffice', vacation: 'Urlaub', trip: 'Dienstreise' } as const;
const HORIZON = 14;

/** Daten für das Homescreen-Widget. Reine Funktion, damit sie testbar bleibt. */
export function buildWidgetData(cal: Calendar, today: string, now: Date): WidgetData {
  const days: WidgetDay[] = [];
  for (let i = 0; i < HORIZON; i++) {
    const date = addDays(today, i);
    const d = cal.day(date);
    const next: string[] = [];
    for (const x of range(date, addDays(date, 7))) {
      for (const e of cal.day(x).events) {
        if (next.length >= 3) break;
        const owner = e.owner ? ` (${PERSONS[e.owner].name})` : needsOwner(e) ? ' – wer kümmert sich?' : '';
        const when = x === date ? '' : `${WD[dow(x)]} `;
        next.push(`${when}${e.time ? e.time + ' ' : ''}${e.title ?? 'Termin'}${owner}`);
      }
    }
    days.push({
      date,
      label: `${WD[dow(date)]}, ${fmtShort(date)}${d.holiday ? ` · ${d.holiday}` : ''}`,
      cov: d.coverage,
      covText: COV_TEXT[d.coverage],
      parents: PARENTS.map((p) => `${PERSONS[p].name}: ${STATUS_TEXT[d.parents[p].status]}`).join('  ·  '),
      need: d.needs.map((n) => `${PERSONS[n.child].name}: ${n.reason}`).join(', '),
      next,
    });
  }

  const open = cal.items
    .filter((i) => i.kind === 'shop' && !i.done)
    .sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0))
    .map((i) => i.title ?? '');
  const shop = open.length ? `Einkauf (${open.length}): ${open.slice(0, 4).join(', ')}${open.length > 4 ? ' …' : ''}` : '';
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return { updated: `Stand ${hh}:${mm}`, days, shop };
}
