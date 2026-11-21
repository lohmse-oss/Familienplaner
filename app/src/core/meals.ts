import type { Calendar } from './calendar';
import { addDays } from './dates';
import type { Item } from './types';

export const isMeal = (i: Item) => i.kind === 'meal' && !i.deleted;

/** Geplante Mahlzeiten (auf einem Tag, noch nicht bestätigt): chronologisch aufsteigend. */
export const plannedMeals = (items: Item[]) =>
  items.filter((i) => isMeal(i) && !i.pool && !i.done).sort((a, b) => a.start.localeCompare(b.start) || (a.ts ?? 0) - (b.ts ?? 0));

/** Bestätigte („gegessene“) Mahlzeiten: neueste zuerst. */
export const doneMeals = (items: Item[]) =>
  items.filter((i) => isMeal(i) && i.done).sort((a, b) => b.start.localeCompare(a.start) || (b.ts ?? 0) - (a.ts ?? 0));

/** Pool: zeitlich absteigend sortiert – neueste zuerst, alte Einträge rutschen nach hinten. */
export const poolMeals = (items: Item[]) =>
  items.filter((i) => isMeal(i) && i.pool).sort((a, b) => b.start.localeCompare(a.start) || (b.ts ?? 0) - (a.ts ?? 0));

/** Nicht bestätigte Mahlzeiten vergangener Tage – wandern automatisch in den Pool. */
export const overdueMeals = (items: Item[], t0: string) => items.filter((i) => isMeal(i) && !i.pool && !i.done && i.start < t0);

/** Mahlzeit, die an einem Tag geplant ist (falls vorhanden). */
export const mealOn = (items: Item[], date: string) => items.find((i) => isMeal(i) && !i.pool && i.start === date);

/** Nächster Schulferien-Tag nach t0 (Pool-Eintrag legt sich default darauf); ohne Ferien innerhalb 400 Tagen: t0. */
export function nextHolidayAfter(cal: Calendar, t0: string): string {
  const end = addDays(t0, 400);
  for (let d = addDays(t0, 1); d <= end; d = addDays(d, 1)) if (cal.day(d).school.length) return d;
  return t0;
}

/**
 * Zwei Mahlzeiten tauschen – in derselben Reihenfolge wie übergeben zurückgegeben.
 * Tag ↔ Tag: die Tage tauschen. Tag ↔ Pool: der Pool-Eintrag übernimmt den Tag, der Tag-Eintrag wandert in den Pool.
 * Pool ↔ Pool: nichts zu tauschen (die Reihenfolge im Pool ergibt sich aus dem Datum).
 */
export function swapMeals(a: Item, b: Item): [Item, Item] {
  if (!a.pool && !b.pool) return [{ ...a, start: b.start, end: b.end }, { ...b, start: a.start, end: a.end }];
  if (a.pool && b.pool) return [a, b];
  const planned = a.pool ? b : a;
  const pooled = a.pool ? a : b;
  const plannedToPool = { ...planned, pool: true };
  const poolToDay = { ...pooled, pool: false, start: planned.start, end: planned.end };
  return a.pool ? [poolToDay, plannedToPool] : [plannedToPool, poolToDay];
}
