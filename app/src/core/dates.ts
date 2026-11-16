// Datumsrechnung auf ISO-Strings (YYYY-MM-DD) in UTC – unabhängig von Zeitzone/Sommerzeit.
const pad = (n: number) => String(n).padStart(2, '0');

export const parse = (s: string) => new Date(s + 'T00:00:00Z');
export const iso = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => {
  const d = parse(s);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
/** Mo = 0 … So = 6 */
export const dow = (s: string) => (parse(s).getUTCDay() + 6) % 7;
export const diff = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 864e5);
export const isWeekend = (s: string) => dow(s) >= 5;
export const weekStart = (s: string) => addDays(s, -dow(s));

export function* range(a: string, b: string): Generator<string> {
  for (let d = a; d <= b; d = addDays(d, 1)) yield d;
}

export function today(): string {
  const n = new Date();
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
}

export function isoWeek(s: string): number {
  const d = parse(s);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3); // Donnerstag der Woche
  const first = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d.getTime() - first.getTime()) / 864e5 - 3 + ((first.getUTCDay() + 6) % 7)) / 7);
}

export const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
export const WD_LONG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
export const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

/** 05.03.2027 */
export const fmt = (s: string) => `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}`;
/** 05.03. */
export const fmtShort = (s: string) => `${s.slice(8, 10)}.${s.slice(5, 7)}.`;
/** 05.–09.03.2027 bzw. 28.02.–03.03.2027 */
export function fmtRange(a: string, b: string): string {
  if (a === b) return fmt(a);
  if (a.slice(0, 7) === b.slice(0, 7)) return `${a.slice(8, 10)}.–${fmt(b)}`;
  return `${fmtShort(a)}–${fmt(b)}`;
}
export const fmtDay = (s: string) => `${WD[dow(s)]}, ${fmtShort(s)}`;

/** Standard-Planungsjahr: immer das Folgejahr. */
export const planningYear = (t = today()) => Number(t.slice(0, 4)) + 1;

/** Aufeinanderfolgende Tage zu Zeiträumen zusammenfassen: ['05-03','05-04','05-07'] → 03.–04. und 07. */
export function contiguousRuns(dates: string[]): { start: string; end: string }[] {
  const out: { start: string; end: string }[] = [];
  for (const d of [...new Set(dates)].sort()) {
    const last = out[out.length - 1];
    if (last && addDays(last.end, 1) === d) last.end = d;
    else out.push({ start: d, end: d });
  }
  return out;
}

export const dayOfYear = (s: string) => diff(`${s.slice(0, 4)}-01-01`, s) + 1;
export const daysInYear = (y: number) => (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 366 : 365);

/** 12 → "12", 12.5 → "12,5" */
export const fmtDays = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

const mkDate = (y: number, m: number, d: number): string | null => {
  if (y < 1000 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? iso(dt) : null; // z. B. 31.02. → null
};

/** Parst Nutzereingaben fürs Datum: "7.5.1955", "07.05.1955", "1955-05-07" → ISO "YYYY-MM-DD"; sonst null. */
export function parseUserDate(s: string): string | null {
  const t = s.trim();
  let m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return mkDate(+m[3], +m[2], +m[1]);
  m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return mkDate(+m[1], +m[2], +m[3]);
  return null;
}

/**
 * Alter am Tag `on` zum Geburtsdatum `birth`. Das Jahr des Geburtsdatums wird NUR fürs Alter genutzt –
 * im Kalender zählt bei Geburtstagen weiterhin nur Tag/Monat. Ohne sinnvolles Geburtsjahr (< 1900) → -1.
 */
export function ageOn(birth: string, on: string): number {
  const by = Number(birth.slice(0, 4));
  if (!Number.isFinite(by) || by < 1900) return -1;
  let age = Number(on.slice(0, 4)) - by;
  if (on.slice(5) < birth.slice(5)) age--;
  return age;
}
