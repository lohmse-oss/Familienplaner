import { describe, expect, it } from 'vitest';
import hd from '../data/holidays.json';
import { findBridges } from './bridges';
import { buildCalendar } from './calendar';
import { addDays, dow, isoWeek, planningYear, weekStart } from './dates';
import { buildNotices } from './notify';
import { reportText, vacationReport } from './report';
import type { HolidayData, Item, PersonId } from './types';

const data = hd as HolidayData;
let n = 0;
const item = (p: Partial<Item> & Pick<Item, 'kind' | 'start'>): Item => ({
  id: `t${n++}`,
  updated: 1,
  end: p.start,
  persons: [],
  ...p,
});
const vac = (person: PersonId, start: string, end: string, extra: Partial<Item> = {}) =>
  item({ kind: 'presence', mode: 'vacation', persons: [person], start, end, ...extra });

describe('Datum', () => {
  it('Wochentag, Wochenanfang, Kalenderwoche', () => {
    expect(dow('2027-05-06')).toBe(3); // Do
    expect(weekStart('2027-05-06')).toBe('2027-05-03');
    expect(isoWeek('2027-01-04')).toBe(1);
    expect(isoWeek('2026-12-31')).toBe(53);
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
  });
  it('Planungsjahr ist das Folgejahr', () => expect(planningYear('2026-11-14')).toBe(2027));
});

describe('Feiertage & Ferien Sachsen 2027', () => {
  const cal = buildCalendar([], data);
  it('kennt Reformationstag und Buß- und Bettag', () => {
    expect(cal.holiday('2027-10-31')).toBe('Reformationstag');
    expect(cal.holiday('2027-11-17')).toBe('Buß- und Bettag');
  });
  it('Ida hat in den Sommerferien Betreuungsbedarf, Irma nicht', () => {
    const d = cal.day('2027-07-14');
    expect(d.needs.map((x) => x.child)).toEqual(['ida']);
    expect(d.coverage).toBe('gap'); // beide im Büro
  });
  it('am Wochenende und Feiertag kein Betreuungsbedarf', () => {
    expect(cal.day('2027-07-17').needs).toHaveLength(0); // Samstag
    expect(cal.day('2027-03-29').needs).toHaveLength(0); // Ostermontag in den Osterferien
  });
});

describe('Betreuungs-Ampel', () => {
  const day = '2027-07-14';
  it('Homeoffice → gelb', () => {
    const cal = buildCalendar([item({ kind: 'presence', mode: 'homeoffice', persons: ['betty'], start: day })], data);
    expect(cal.day(day).coverage).toBe('maybe');
  });
  it('Urlaub zu Hause → grün, verreist ohne Kind → rot', () => {
    expect(buildCalendar([vac('betty', day, day)], data).day(day).coverage).toBe('ok');
    expect(buildCalendar([vac('betty', day, day, { away: true })], data).day(day).coverage).toBe('gap');
  });
  it('Dienstreise zählt nicht als verfügbar', () => {
    const cal = buildCalendar([item({ kind: 'presence', mode: 'trip', persons: ['sebastian'], start: day })], data);
    expect(cal.day(day).coverage).toBe('gap');
  });
  it('Familienurlaub (Kind dabei) → kein Betreuungsbedarf', () => {
    const cal = buildCalendar([vac('betty', day, day, { persons: ['betty', 'sebastian', 'ida', 'irma'], away: true })], data);
    expect(cal.day(day).needs).toHaveLength(0);
    expect(cal.day(day).coverage).toBe('none');
  });
  it('Betreuung durch Oma löst rote Tage', () => {
    const cal = buildCalendar([item({ kind: 'cover', title: 'Oma', persons: ['ida'], start: day })], data);
    expect(cal.day(day).coverage).toBe('ok');
  });
  it('Schließtage kommen aus manuellen Einträgen (Kita/Schule gleichartig)', () => {
    const cal = buildCalendar([item({ kind: 'care', title: 'Schließtag Kita', persons: ['irma'], start: '2027-03-10' })], data);
    const d = cal.day('2027-03-10');
    expect(d.needs).toEqual([{ child: 'irma', reason: 'Schließtag Kita' }]);
    expect(d.coverage).toBe('gap');
  });
  it('Termin ohne Zuständigen / Zuständiger nicht vor Ort', () => {
    const cal = buildCalendar(
      [
        item({ kind: 'event', sub: 'arzt', title: 'Kinderarzt', persons: ['irma'], start: '2027-03-10', owner: 'betty' }),
        item({ kind: 'presence', mode: 'trip', persons: ['betty'], start: '2027-03-10' }),
      ],
      data,
    );
    expect(cal.day('2027-03-10').warnings[0]).toContain('Betty ist nicht vor Ort');
  });
  it('gelöschte Einträge zählen nicht', () => {
    const cal = buildCalendar([{ ...vac('betty', day, day), deleted: true }], data);
    expect(cal.day(day).coverage).toBe('gap');
  });
});

describe('Brückentage 2027', () => {
  const cal = buildCalendar([], data);
  const bridges = findBridges(cal, 2027);
  it('Christi Himmelfahrt (Do 6.5.) → Fr 7.5. = 4 Tage für 1 Urlaubstag; Ida ohnehin frei', () => {
    const b = bridges.find((x) => x.gapStart === '2027-05-07' && x.gapEnd === '2027-05-07')!;
    expect(b).toBeTruthy();
    expect(b.total).toBe(4);
    expect(b.idaFree).toBe(1);
  });
  it('liefert keine reinen Wochenend-Lücken', () => {
    expect(bridges.every((b) => b.days >= 1 && b.days <= 4)).toBe(true);
    expect(bridges.every((b) => b.holidays.length > 0)).toBe(true);
  });
});

describe('Urlaubsübersicht', () => {
  it('fasst Urlaub über Wochenende zusammen und zählt nur Arbeitstage', () => {
    const cal = buildCalendar(
      [
        vac('betty', '2027-03-01', '2027-03-05', { title: 'Skifahren' }),
        vac('betty', '2027-03-08', '2027-03-09'), // direkt anschließend (Wochenende dazwischen)
        vac('betty', '2027-04-14', '2027-04-14'),
        item({ kind: 'config', id: 'config:betty:2027', start: '2027-01-01', entitlement: 30 }),
      ],
      data,
    );
    const r = vacationReport(cal, 'betty', 2027);
    expect(r.periods.map((p) => [p.start, p.end, p.workdays])).toEqual([
      ['2027-03-01', '2027-03-09', 7],
      ['2027-04-14', '2027-04-14', 1],
    ]);
    expect(r.used).toBe(8);
    expect(r.rest).toBe(22);
    expect(reportText(r)).toContain('01.–09.03.2027: 7 Arbeitstage (Skifahren)');
  });
  it('Feiertag mitten im Urlaub wird nicht als Urlaubstag gezählt', () => {
    const cal = buildCalendar([vac('sebastian', '2027-05-03', '2027-05-07')], data); // 6.5. Himmelfahrt
    expect(vacationReport(cal, 'sebastian', 2027).used).toBe(4);
  });
});

describe('Benachrichtigungen', () => {
  const day = (iso: string, hhmm = '00:00') => new Date(`${iso}T${hhmm}:00`);
  it('warnt 14 und 3 Tage vor ungeklärter Betreuung, Wochenvorschau am Sonntag', () => {
    const cal = buildCalendar([item({ kind: 'event', sub: 'arzt', title: 'Kinderarzt', persons: ['irma'], start: '2027-07-14', time: '15:30' })], data);
    const notices = buildNotices(cal, day('2027-06-20'), '2027-06-20');
    const at = (n: { at: Date }) => `${n.at.getFullYear()}-${String(n.at.getMonth() + 1).padStart(2, '0')}-${String(n.at.getDate()).padStart(2, '0')} ${String(n.at.getHours()).padStart(2, '0')}:${String(n.at.getMinutes()).padStart(2, '0')}`;
    const gap = notices.filter((n) => n.title.startsWith('Betreuung'));
    expect(gap.map(at)).toEqual(['2027-06-28 09:00', '2027-07-09 09:00']);
    expect(gap[0].body).toContain('Ida');
    expect(notices.some((n) => n.title.startsWith('Wochenvorschau') && at(n) === '2027-06-27 18:00')).toBe(true);
    const arzt = notices.filter((n) => n.body.includes('Kinderarzt'));
    expect(arzt.some((n) => at(n) === '2027-07-14 14:30' && n.body.includes('niemand zuständig'))).toBe(true);
  });
  it('plant nichts in der Vergangenheit', () => {
    const cal = buildCalendar([], data);
    const notices = buildNotices(cal, day('2027-07-10'), '2027-07-10');
    expect(notices.every((n) => n.at.getTime() > day('2027-07-10').getTime())).toBe(true);
  });
});
