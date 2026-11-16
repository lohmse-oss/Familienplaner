import { needsOwner, type Calendar, type DayInfo } from './calendar';
import { addDays, fmtDays, fmtRange, isoWeek, range, WD, dow } from './dates';
import { budget } from './report';
import { PARENTS, PERSONS } from './types';

export interface Notice {
  at: Date;
  title: string;
  body: string;
}

const HORIZON_DAYS = 60;

function local(date: string, hhmm: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = hhmm.split(':').map(Number);
  return new Date(y, m - 1, d, h, min);
}
const name = (p: keyof typeof PERSONS) => PERSONS[p].name;
const dayName = (d: string) => WD[dow(d)];

/** Zeilen für Tages-/Wochenvorschau */
export function describeDay(d: DayInfo): string[] {
  const out: string[] = [];
  if (d.holiday) out.push(d.holiday);
  for (const e of d.events) {
    const who = e.persons.map(name).join('/');
    const owner = e.owner ? `, ${name(e.owner)} kümmert sich` : needsOwner(e) ? ', ⚠ noch niemand zuständig' : '';
    out.push(`${e.time ? e.time + ' ' : ''}${e.title ?? 'Termin'}${who ? ` (${who})` : ''}${owner}`);
  }
  for (const n of d.needs) out.push(`${name(n.child)}: ${n.reason}`);
  if (d.coverage === 'gap') out.push('⚠ Betreuung ungeklärt');
  if (d.coverage === 'maybe') out.push('Betreuung nur per Homeoffice möglich');
  for (const t of d.tasks) if (!t.done) out.push(`Aufgabe: ${t.title}`);
  for (const b of d.birthdays) out.push(`🎂 ${b.title}`);
  out.push(...d.warnings.map((w) => `⚠ ${w}`));
  return out;
}

export function buildNotices(cal: Calendar, now: Date, today: string): Notice[] {
  const out: Notice[] = [];
  const push = (at: Date, title: string, body: string) => {
    if (at.getTime() > now.getTime() && body) out.push({ at, title, body });
  };
  const end = addDays(today, HORIZON_DAYS);

  // Tagesvorschau (nächste 14 Tage) und Termin-/Aufgaben-/Geburtstagserinnerungen
  for (const date of range(today, end)) {
    const d = cal.day(date);
    if (date <= addDays(today, 14)) {
      const lines = describeDay(d).filter((l) => l !== d.holiday);
      push(local(date, '07:00'), 'Heute', lines.join('\n'));
    }
    for (const e of d.events) {
      const who = e.persons.map(name).join('/');
      const warn = needsOwner(e) && !e.owner ? ' – ⚠ noch niemand zuständig' : e.owner ? ` – ${name(e.owner)} kümmert sich` : '';
      const label = `${e.title ?? 'Termin'}${who ? ` (${who})` : ''}${warn}`;
      if (e.time) push(new Date(local(date, e.time).getTime() - 3600_000), 'In 1 Stunde', `${e.time} ${label}`);
      push(local(addDays(date, -1), '18:00'), 'Morgen', `${e.time ? e.time + ' ' : ''}${label}`);
    }
    for (const t of d.tasks) if (!t.done) push(local(date, '08:00'), 'Aufgabe fällig', `${t.title}${t.owner ? ` (${name(t.owner)})` : ''}`);
    for (const b of d.birthdays) {
      push(local(addDays(date, -1), '18:00'), 'Morgen Geburtstag', `🎂 ${b.title}`);
      push(local(date, '08:00'), 'Geburtstag', `🎂 ${b.title}`);
    }
  }

  // Wochenvorschau: Sonntag 18:00 für die Folgewoche
  for (const date of range(today, end)) {
    if (dow(date) !== 6) continue;
    const lines: string[] = [];
    for (let i = 1; i <= 7; i++) {
      const d = cal.day(addDays(date, i));
      const l = describeDay(d).filter((x) => x !== d.holiday && !x.startsWith('Aufgabe') && !x.startsWith('🎂'));
      if (l.length || d.holiday) lines.push(`${dayName(d.date)}: ${[d.holiday, ...l].filter(Boolean).join('; ')}`);
    }
    push(local(date, '18:00'), `Wochenvorschau KW ${isoWeek(addDays(date, 1))}`, lines.join('\n') || 'Keine besonderen Termine.');
  }

  // Forecast-Warnungen: zusammenhängende Tage mit ungeklärter Betreuung
  let run: { start: string; end: string; kids: Set<string>; why: Set<string> } | null = null;
  const flush = () => {
    if (!run) return;
    const body = `${fmtRange(run.start, run.end)}: ${[...run.kids].join(' & ')} (${[...run.why].join(', ')}) – Betreuung ungeklärt`;
    push(local(addDays(run.start, -14), '09:00'), 'Betreuung klären', body);
    push(local(addDays(run.start, -3), '09:00'), 'Betreuung noch offen!', body);
    run = null;
  };
  for (const date of range(today, end)) {
    const d = cal.day(date);
    if (d.coverage === 'gap') {
      if (!run) run = { start: date, end: date, kids: new Set(), why: new Set() };
      run.end = date;
      d.needs.forEach((n) => {
        run!.kids.add(name(n.child));
        run!.why.add(n.reason);
      });
    } else if (d.workday || d.coverage !== 'none') flush(); // Wochenende/Feiertag unterbricht nicht
  }
  flush();

  // Urlaubskonto überzogen? (Anspruch < genommen + geplant) – aktuelles und Folgejahr
  const ty = Number(today.slice(0, 4));
  for (const p of PARENTS) {
    for (const y of [ty, ty + 1]) {
      const b = budget(cal, p, y, today);
      if (b.free !== undefined && b.free < 0) {
        push(local(addDays(today, 1), '09:00'), 'Urlaubskonto überzogen', `${PERSONS[p].name} ${y}: ${fmtDays(b.free)} Tage über dem Konto (Anspruch ${fmtDays(b.entitlement!)}).`);
      }
    }
  }

  out.sort((a, b) => a.at.getTime() - b.at.getTime());
  return out.slice(0, 200);
}

