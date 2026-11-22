import { describe, expect, it } from 'vitest';
import hd from '../data/holidays.json';
import { findBridges } from './bridges';
import { buildCalendar } from './calendar';
import { range } from './dates';
import { gapRuns } from './gaps';
import { budget, vacationReport } from './report';
import { buildWidgetData } from './widget';
import type { HolidayData, Item, PersonId } from './types';

/**
 * Performance-Budgets (ISO 25010: Performance-Effizienz) – großzügig, nur Größenordnungen sichern.
 * Realistische Obergrenze für eine Familie: ~1000 Einträge über ein Jahr.
 * Budgets sind ~10x über dem lokalen Messwert, damit CI-Maschinen nicht flaken.
 */
const data = hd as HolidayData;
const Y = 2027;
const A = `${Y}-01-01`;
const B = `${Y}-12-31`;

/** ~1000 Einträge über das Jahr verteilt (LCG für reproduzierbare "Zufälligkeit"). */
function fixture(): Item[] {
  const out: Item[] = [];
  let n = 0;
  let s = 42;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const add = (p: Partial<Item> & Pick<Item, 'kind' | 'start'>) => out.push({ id: `p${n++}`, updated: 1, end: p.start, persons: [], ...p } as Item);
  const days = [...range(A, B)];
  for (const d of days) {
    add({ kind: 'event', title: `Termin ${n}`, start: d, persons: rnd() < 0.5 ? ['sebastian'] : ['betty'], time: '10:00' });
    if (rnd() < 0.7) add({ kind: 'task', title: `Aufgabe ${n}`, start: d, done: rnd() < 0.4 });
    if (rnd() < 0.25) add({ kind: 'info', title: `Event ${n}`, start: d, end: days[days.indexOf(d) + Math.floor(rnd() * 5)] ?? d });
    if (rnd() < 0.15) add({ kind: 'care', title: 'Schließtag', start: d, persons: ['ida'] });
  }
  for (let i = 0; i < 20; i++) { // Urlaubszeiträume beider Eltern
    const start = days[Math.floor(rnd() * 300)];
    const span = 1 + Math.floor(rnd() * 10);
    add({ kind: 'presence', mode: 'vacation', title: 'Urlaub', start, end: days[days.indexOf(start) + span - 1] ?? start, persons: [i % 2 ? 'sebastian' : 'betty'] });
  }
  for (let i = 0; i < 12; i++) add({ kind: 'birthday', title: `Geburtstag ${i}`, start: `${Y}-0${(i % 9) + 1}-15` });
  return out;
}

describe('Performance-Budgets (1 Jahr, ~1000 Einträge)', () => {
  it('Kalender aufbauen + alle 365 Tage + Berichte + Widget bleiben im Budget', () => {
    const items = fixture();
    expect(items.length).toBeGreaterThan(700);

    const t0 = performance.now();
    const cal = buildCalendar(items, data);
    const t1 = performance.now();
    for (const d of range(A, B)) cal.day(d); // jeder Tag einmal (Cache greift danach)
    const t2 = performance.now();
    for (const p of ['sebastian', 'betty'] as PersonId[]) {
      vacationReport(cal, p, Y);
      budget(cal, p, Y, `${Y}-06-01`);
    }
    const t3 = performance.now();
    gapRuns(cal, A, B);
    findBridges(cal, Y);
    buildWidgetData(cal, `${Y}-06-01`, new Date(Y, 5, 1, 8));
    const t4 = performance.now();

    const ms = (x: number) => Math.round(x);
    expect(ms(t1 - t0)).toBeLessThan(500); // buildCalendar
    expect(ms(t2 - t1)).toBeLessThan(500); // 365 × day()
    expect(ms(t3 - t2)).toBeLessThan(300); // Urlaubsberichte je Person
    expect(ms(t4 - t3)).toBeLessThan(500); // Lücken + Brücken + Widget-Daten
  });
});
