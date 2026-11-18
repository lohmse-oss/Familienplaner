import { addDays, diff, dow, isWeekend, range } from './dates';
import { CHILDREN, PARENTS, type HolidayData, type Item, type Mode, type PersonId } from './types';

export type ParentStatus = 'free' | 'office' | 'homeoffice' | 'vacation' | 'trip';
export type Coverage = 'none' | 'ok' | 'maybe' | 'gap';

export interface ParentState {
  status: ParentStatus;
  away: boolean; // verreist → nicht vor Ort
  item?: Item;
}

export interface CareNeed {
  child: PersonId;
  reason: string;
}

export interface DayInfo {
  date: string;
  weekend: boolean;
  holiday?: string;
  school: string[]; // Namen der Schulferien / unterrichtsfreien Tage
  workday: boolean; // Mo–Fr und kein Feiertag
  parents: Record<string, ParentState>;
  needs: CareNeed[]; // Kinder, die betreut werden müssen
  cover: Item[]; // Betreuung durch Dritte
  family: PersonId[]; // Kinder, die mit im (Familien-)Urlaub sind
  coverage: Coverage;
  events: Item[];
  info: Item[];
  tasks: Item[];
  birthdays: Item[];
  warnings: string[];
}

/** 24.12. und 31.12. zählen als halber Urlaubstag (wenn sie Arbeitstage sind). */
export const HALF_DAYS = ['12-24', '12-31'];

const RANK: Record<Mode, number> = { homeoffice: 1, vacation: 2, trip: 3 };

/** Termine, bei denen jemand verbindlich zuständig sein muss (Klassenarbeit ist nur informativ). */
export const needsOwner = (it: Item) => it.kind === 'event' && it.sub !== 'schule';

/** Mehrtägiger Termin (z. B. Festival): Ende nach dem Start und keine Wiederholung (dort ist end das Serienende). */
export const isMultiDay = (it: Item) => it.kind === 'event' && !it.recur && it.end > it.start;
/** Uhrzeit eines Termins an diesem Tag – bei mehrtägigen nur am ersten Tag. */
export const timeOn = (it: Item, date: string) => (isMultiDay(it) && date !== it.start ? undefined : it.time);
/** „Tag 2/3“ bei mehrtägigen Terminen, sonst leer. */
export const dayTag = (it: Item, date: string) => (isMultiDay(it) ? `Tag ${diff(it.start, date) + 1}/${diff(it.start, it.end) + 1}` : '');
/** Kurztext für Listen: „18:00 Titel“ bzw. „Titel (Tag 2/3)“. */
export const evText = (it: Item, date: string) => {
  const t = timeOn(it, date);
  const tag = dayTag(it, date);
  return `${t ? t + ' ' : ''}${it.title ?? 'Termin'}${tag ? ` (${tag})` : ''}`;
};

export interface Calendar {
  day(date: string): DayInfo;
  holiday(date: string): string | undefined;
  isFree(date: string): boolean; // Wochenende oder Feiertag
  weight(date: string): number; // Urlaubswert: 0 frei, 0,5 am 24.12./31.12., sonst 1
  items: Item[]; // aktive (nicht gelöschte) Einträge
}

export function buildCalendar(allItems: Item[], hd: HolidayData): Calendar {
  const items = allItems.filter((i) => !i.deleted);

  const holidays = new Map<string, string>();
  for (const h of hd.holidays) for (const d of range(h.start, h.end)) holidays.set(d, h.name);
  const school = new Map<string, string[]>();
  for (const s of hd.school) {
    for (const d of range(s.start, s.end)) school.set(d, [...(school.get(d) ?? []), s.name]);
  }

  // Index: Datum → Einträge (Zeiträume werden auf Tage ausgerollt, max. 400 Tage als Schutz vor Fehleingaben).
  // Wiederkehrende Einträge (recur) ohne Serienende laufen bis zum Cap; start ist das erste Vorkommen.
  const CAP = 400;
  const matchesRecur = (it: Item, d: string) =>
    !it.recur || (it.recur === 'weekly' ? dow(d) === dow(it.start) : d.slice(8) === it.start.slice(8));
  const byDay = new Map<string, Item[]>();
  const birthdays: Item[] = [];
  for (const it of items) {
    if (it.kind === 'config' || it.kind === 'shop') continue;
    if (it.kind === 'birthday') {
      birthdays.push(it);
      continue;
    }
    const span = diff(it.start, it.end);
    const end = span > CAP ? addDays(it.start, CAP) : it.recur && span <= 0 ? addDays(it.start, CAP) : it.end;
    for (const d of range(it.start, end)) {
      if (!matchesRecur(it, d)) continue;
      const l = byDay.get(d);
      if (l) l.push(it);
      else byDay.set(d, [it]);
    }
  }

  const cache = new Map<string, DayInfo>();

  function compute(date: string): DayInfo {
    const weekend = isWeekend(date);
    const holiday = holidays.get(date);
    const workday = !weekend && !holiday;
    const here = byDay.get(date) ?? [];
    const of = (k: Item['kind']) => here.filter((i) => i.kind === k);

    // Eltern: höchster Rang gewinnt (Dienstreise > Urlaub > Homeoffice)
    const parents: Record<string, ParentState> = {};
    for (const p of PARENTS) {
      let best: Item | undefined;
      for (const it of of('presence')) {
        if (!it.persons.includes(p) || !it.mode) continue;
        if (!best || RANK[it.mode] > RANK[best.mode!]) best = it;
      }
      if (!workday) parents[p] = { status: 'free', away: false };
      else if (!best) parents[p] = { status: 'office', away: false };
      else
        parents[p] = {
          status: best.mode!,
          away: best.mode === 'trip' || (best.mode === 'vacation' && !!best.away),
          item: best,
        };
    }

    // Kinder, die mit der Familie verreist/frei sind (Urlaub inkl. Kind) brauchen keine Betreuung
    const withFamily = new Set<PersonId>();
    for (const it of of('presence')) for (const c of CHILDREN) if (it.persons.includes(c)) withFamily.add(c);

    const needs: CareNeed[] = [];
    if (workday) {
      const sch = school.get(date);
      if (sch && !withFamily.has('ida')) needs.push({ child: 'ida', reason: sch.join(', ') });
      for (const it of of('care'))
        for (const c of it.persons)
          if (CHILDREN.includes(c) && !withFamily.has(c)) needs.push({ child: c, reason: it.title || 'Betreuungsbedarf' });
    }

    const needing = new Set(needs.map((n) => n.child));
    const cover = of('cover').filter((c) => !c.persons.length || c.persons.some((p) => needing.has(p)));

    let coverage: Coverage = 'none';
    if (needing.size) {
      const avail = PARENTS.map((p) => parents[p]);
      if (cover.length || avail.some((s) => s.status === 'vacation' && !s.away)) coverage = 'ok';
      else if (avail.some((s) => s.status === 'homeoffice')) coverage = 'maybe';
      else coverage = 'gap';
    }

    const events = of('event').sort((a, b) => (timeOn(a, date) ?? '').localeCompare(timeOn(b, date) ?? ''));
    const warnings: string[] = [];
    for (const e of events) {
      if (e.owner && parents[e.owner]?.away) warnings.push(`${e.title || 'Termin'}: ${nameOf(e.owner)} ist nicht vor Ort`);
    }

    const md = date.slice(5);
    return {
      date,
      weekend,
      holiday,
      school: school.get(date) ?? [],
      workday,
      parents,
      needs,
      cover,
      family: [...withFamily],
      coverage,
      events,
      info: of('info'),
      tasks: of('task'),
      birthdays: birthdays.filter((b) => b.start.slice(5) === md),
      warnings,
    };
  }

  return {
    items,
    holiday: (d) => holidays.get(d),
    isFree: (d) => isWeekend(d) || holidays.has(d),
    weight: (d) => (isWeekend(d) || holidays.has(d) ? 0 : HALF_DAYS.includes(d.slice(5)) ? 0.5 : 1),
    day(date) {
      let d = cache.get(date);
      if (!d) cache.set(date, (d = compute(date)));
      return d;
    },
  };
}

const NAMES: Record<string, string> = { sebastian: 'Sebastian', betty: 'Betty', ida: 'Ida', irma: 'Irma' };
const nameOf = (p: string) => NAMES[p] ?? p;
