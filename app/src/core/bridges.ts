import type { Calendar } from './calendar';
import { addDays, diff, range } from './dates';

export interface Bridge {
  gapStart: string; // erster Urlaubstag (Brücke)
  gapEnd: string; // letzter Urlaubstag
  days: number; // Arbeitstage in der Lücke
  cost: number; // benötigte Urlaubstage (24.12./31.12. = 0,5)
  start: string; // freier Block gesamt: von …
  end: string; // … bis
  total: number; // freie Tage am Stück
  holidays: string[];
  idaFree: number; // an wie vielen Brückentagen hat Ida ohnehin schulfrei
}

/**
 * Brückentage: Zwischen zwei freien Blöcken (Wochenende/Feiertag) liegen 1–4 Arbeitstage,
 * und mindestens einer der beiden Blöcke enthält einen Feiertag.
 * Beispiel: Do = Feiertag → Fr nehmen → 4 Tage am Stück für 1 Urlaubstag.
 */
export function findBridges(cal: Calendar, year: number): Bridge[] {
  const blocks: { start: string; end: string; holidays: string[] }[] = [];
  for (const d of range(`${year - 1}-12-01`, `${year + 1}-01-31`)) {
    if (!cal.isFree(d)) continue;
    const last = blocks[blocks.length - 1];
    const h = cal.holiday(d);
    if (last && last.end === addDays(d, -1)) {
      last.end = d;
      if (h) last.holidays.push(h);
    } else blocks.push({ start: d, end: d, holidays: h ? [h] : [] });
  }

  const out: Bridge[] = [];
  for (let i = 0; i + 1 < blocks.length; i++) {
    const a = blocks[i];
    const b = blocks[i + 1];
    const gap = diff(a.end, b.start) - 1;
    if (gap < 1 || gap > 4) continue;
    if (!a.holidays.length && !b.holidays.length) continue;
    const gapStart = addDays(a.end, 1);
    const gapEnd = addDays(b.start, -1);
    if (gapEnd < `${year}-01-01` || gapStart > `${year}-12-31`) continue;
    let idaFree = 0;
    let cost = 0;
    for (const d of range(gapStart, gapEnd)) {
      cost += cal.weight(d);
      if (cal.day(d).school.length) idaFree++;
    }
    out.push({
      gapStart,
      gapEnd,
      days: gap,
      cost,
      start: a.start,
      end: b.end,
      total: diff(a.start, b.end) + 1,
      holidays: [...a.holidays, ...b.holidays],
      idaFree,
    });
  }
  return out;
}
