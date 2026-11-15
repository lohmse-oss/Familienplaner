import { describe, expect, it } from 'vitest';
import hd from '../data/holidays.json';
import { findBridges } from './bridges';
import { buildCalendar } from './calendar';
import { addDays, contiguousRuns, dayOfYear, dow, isoWeek, planningYear, weekStart } from './dates';
import { annotateChanges, describeChange } from './describe';
import { relevant } from './filter';
import { buildWidgetData } from './widget';
import { gapRuns, nextGap } from './gaps';
import { planPresence } from './presence';
import { buildNotices } from './notify';
import { budget, vacationReport } from './report';
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
    expect(r.periods[0].titles).toEqual(['Skifahren']);
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

describe('Mehrfach-Eintrag (planPresence)', () => {
  let k = 0;
  const nid = () => `n${k++}`;
  const apply = (items: Item[], ops: Item[]) => {
    const m = new Map(items.map((i) => [i.id, i]));
    for (const o of ops) m.set(o.id, o);
    return [...m.values()].filter((i) => !i.deleted);
  };
  const spans = (items: Item[], p: PersonId) =>
    items.filter((i) => i.kind === 'presence' && i.persons.includes(p)).map((i) => [i.mode, i.start, i.end]).sort();

  it('trägt Zeitraum ein und teilt bestehende Einträge', () => {
    const base = [vac('betty', '2027-03-01', '2027-03-12')];
    const out = apply(base, planPresence(base, ['betty'], '2027-03-04', '2027-03-05', 'homeoffice', {}, nid));
    expect(spans(out, 'betty')).toEqual([
      ['homeoffice', '2027-03-04', '2027-03-05'],
      ['vacation', '2027-03-01', '2027-03-03'],
      ['vacation', '2027-03-06', '2027-03-12'],
    ]);
  });
  it('mehrere Personen: gemeinsamer Eintrag, andere Person im alten Eintrag bleibt unberührt', () => {
    const base = [vac('betty', '2027-03-01', '2027-03-05', { persons: ['betty', 'sebastian'] })];
    const out = apply(base, planPresence(base, ['betty', 'ida'], '2027-03-02', '2027-03-03', 'vacation', { title: 'Ski' }, nid));
    expect(spans(out, 'sebastian')).toEqual([['vacation', '2027-03-01', '2027-03-05']]); // Sebastian unverändert
    expect(spans(out, 'betty')).toEqual([
      ['vacation', '2027-03-01', '2027-03-01'],
      ['vacation', '2027-03-02', '2027-03-03'],
      ['vacation', '2027-03-04', '2027-03-05'],
    ]);
    expect(out.find((i) => i.persons.includes('ida'))?.persons).toEqual(['betty', 'ida']);
  });
  it('„Büro“ setzt zurück; onlyMode lässt andere Arten stehen', () => {
    const base = [vac('betty', '2027-03-01', '2027-03-05'), item({ kind: 'presence', mode: 'trip', persons: ['betty'], start: '2027-03-03' })];
    const onlyVac = apply(base, planPresence(base, ['betty'], '2027-03-01', '2027-03-05', 'office', { onlyMode: 'vacation' }, nid));
    expect(spans(onlyVac, 'betty')).toEqual([['trip', '2027-03-03', '2027-03-03']]);
    const all = apply(base, planPresence(base, ['betty'], '2027-03-01', '2027-03-05', 'office', {}, nid));
    expect(spans(all, 'betty')).toEqual([]);
  });
  it('Ergebnis wirkt in der Ampel: Urlaub für beide im Sommer → grün', () => {
    const ops = planPresence([], ['betty'], '2027-07-12', '2027-07-16', 'vacation', {}, nid);
    const cal = buildCalendar(ops, data);
    expect(cal.day('2027-07-14').coverage).toBe('ok');
  });
  it('fasst Tage zu Zeiträumen zusammen', () => {
    expect(contiguousRuns(['2027-05-04', '2027-05-03', '2027-05-07', '2027-05-04'])).toEqual([
      { start: '2027-05-03', end: '2027-05-04' },
      { start: '2027-05-07', end: '2027-05-07' },
    ]);
    expect(dayOfYear('2027-03-01')).toBe(60);
  });
});

describe('Betreuungslücken & Urlaubsbudget', () => {
  it('findet Lücken im Zeitraum und die nächste Lücke', () => {
    const cal = buildCalendar([], data);
    const runs = gapRuns(cal, '2027-07-01', '2027-08-31');
    expect(runs[0]).toMatchObject({ start: '2027-07-12', end: '2027-08-20', who: 'Ida', why: 'Sommerferien' });
    expect(runs[0].days).toBe(30); // 6 Wochen à 5 Arbeitstage
    expect(nextGap(cal, '2027-06-01', 60)?.start).toBe('2027-07-12');
    expect(nextGap(cal, '2027-06-01', 30)).toBeUndefined();
  });
  it('Urlaubskonto: genommen + geplant + frei = Anspruch', () => {
    const cal = buildCalendar(
      [
        vac('betty', '2027-03-01', '2027-03-05'),
        vac('betty', '2027-08-02', '2027-08-06'),
        item({ kind: 'config', id: 'config:betty:2027', start: '2027-01-01', entitlement: 30 }),
      ],
      data,
    );
    expect(budget(cal, 'betty', 2027, '2027-06-01')).toEqual({ entitlement: 30, taken: 5, planned: 5, free: 20 });
    expect(budget(cal, 'sebastian', 2027, '2027-06-01')).toEqual({ entitlement: undefined, taken: 0, planned: 0, free: undefined });
  });
});

describe('Urlaubstage korrekt zählen (Feiertage, 24.12./31.12. halb)', () => {
  const cal0 = buildCalendar([], data);
  it('Tageswerte: Wochenende/Feiertag 0, Heiligabend und Silvester 0,5 (an Arbeitstagen)', () => {
    expect(cal0.weight('2027-12-24')).toBe(0.5); // Freitag
    expect(cal0.weight('2027-12-31')).toBe(0.5); // Freitag
    expect(cal0.weight('2028-12-24')).toBe(0); // Sonntag
    expect(cal0.weight('2027-12-25')).toBe(0); // Feiertag (und Samstag)
    expect(cal0.weight('2026-12-25')).toBe(0); // 1. Weihnachtsfeiertag, Freitag
    expect(cal0.weight('2027-05-06')).toBe(0); // Christi Himmelfahrt
    expect(cal0.weight('2027-05-07')).toBe(1);
  });
  it('Urlaub über Weihnachten/Silvester: 23.–31.12.2027 = 6 Tage in einem Zeitraum', () => {
    const cal = buildCalendar([vac('betty', '2027-12-23', '2027-12-31')], data);
    const r = vacationReport(cal, 'betty', 2027);
    expect(r.periods).toHaveLength(1);
    expect(r.periods[0].workdays).toBe(1 + 0.5 + 4 + 0.5); // Do 23., Fr 24. halb, Mo–Do 27.–30., Fr 31. halb
    expect(r.used).toBe(6);
  });
  it('Urlaub mit Feiertag mitten drin: Weihnachten 2026 (25.12. Feiertag, 24.12. halb)', () => {
    const cal = buildCalendar([vac('sebastian', '2026-12-21', '2026-12-31')], data);
    // 21.–23. = 3, 24. = 0,5, 25./26. Feiertag/Samstag = 0, 28.–30. = 3, 31. = 0,5
    expect(vacationReport(cal, 'sebastian', 2026).used).toBe(7);
  });
  it('Budget mit halben Tagen', () => {
    const cal = buildCalendar(
      [vac('betty', '2027-12-23', '2027-12-24'), item({ kind: 'config', id: 'config:betty:2027', start: '2027-01-01', entitlement: 30 })],
      data,
    );
    expect(budget(cal, 'betty', 2027, '2027-06-01')).toEqual({ entitlement: 30, taken: 0, planned: 1.5, free: 28.5 });
  });
  it('Brückentage rund um Weihnachten 2026 kosten 3,5 statt 4 Urlaubstage', () => {
    const b = findBridges(cal0, 2026);
    const before = b.find((x) => x.gapStart === '2026-12-21')!;
    expect(before).toMatchObject({ gapEnd: '2026-12-24', days: 4, cost: 3.5, total: 9 });
    const after = b.find((x) => x.gapStart === '2026-12-28')!;
    expect(after).toMatchObject({ gapEnd: '2026-12-31', days: 4, cost: 3.5, total: 10 });
  });
});

describe('Personenfilter', () => {
  const ev = (persons: PersonId[], owner: PersonId | null = null) => item({ kind: 'event', start: '2027-03-10', persons, owner });
  it('alle zeigt alles, Person zeigt Betroffene, Zuständige und Familien-Einträge', () => {
    expect(relevant(ev(['irma']), 'all')).toBe(true);
    expect(relevant(ev(['irma']), 'irma')).toBe(true);
    expect(relevant(ev(['irma']), 'ida')).toBe(false);
    expect(relevant(ev(['irma'], 'betty'), 'betty')).toBe(true); // Betty kümmert sich
    expect(relevant(ev(['irma'], 'betty'), 'sebastian')).toBe(false);
    expect(relevant(ev([]), 'ida')).toBe(true); // Familie
  });
});

describe('Widget-Daten', () => {
  it('liefert pro Tag die Zahl der Einträge, die Ampel und die offenen Einkaufsartikel', () => {
    const cal = buildCalendar(
      [
        item({ kind: 'presence', mode: 'trip', persons: ['sebastian'], start: '2027-07-13', end: '2027-07-14' }),
        item({ kind: 'presence', mode: 'homeoffice', persons: ['betty'], start: '2027-07-12' }),
        item({ kind: 'event', sub: 'arzt', title: 'Kinderarzt', time: '15:30', persons: ['irma'], start: '2027-07-14' }),
        item({ kind: 'event', sub: 'elternabend', title: 'Elternabend', time: '18:00', persons: ['irma'], owner: 'betty', start: '2027-07-12' }),
        item({ kind: 'shop', title: 'Milch', ts: 2, start: '2027-07-10' }),
        item({ kind: 'shop', title: 'Brot', ts: 1, start: '2027-07-10' }),
        item({ kind: 'shop', title: 'Eier', ts: 0, done: true, start: '2027-07-10' }),
      ],
      data,
    );
    const w = buildWidgetData(cal, '2027-07-12', new Date(2027, 6, 12, 8, 5), 'glass');
    expect(w.days).toHaveLength(14);
    expect(w).toMatchObject({ style: 'glass', updated: 'Stand 08:05', shopN: 2 });
    expect(w.days.slice(0, 3)).toEqual([
      { date: '2027-07-12', n: 2, cov: 'maybe' }, // Elternabend + Betreuungsbedarf Ida (Sommerferien)
      { date: '2027-07-13', n: 2, cov: 'gap' }, // Dienstreise Sebastian + Betreuungsbedarf
      { date: '2027-07-14', n: 3, cov: 'gap' }, // Dienstreise + Kinderarzt + Betreuungsbedarf
    ]);
    expect(w.days[5]).toMatchObject({ date: '2027-07-17', n: 0, cov: 'none' }); // Wochenende, nichts los
  });
});

describe('Änderungs-Hinweise', () => {
  it('beschreibt Einträge lesbar', () => {
    const trip = item({ kind: 'presence', mode: 'trip', persons: ['sebastian'], start: '2027-07-13', end: '2027-07-14', title: 'Messe Köln', by: 'sebastian', created: 1000, updated: 1500 });
    expect(describeChange(trip)).toEqual({ verb: 'new', text: 'Dienstreise Sebastian, Di 13.07.–Mi 14.07.2027 – Messe Köln' });
    const arzt = item({ kind: 'event', sub: 'arzt', title: 'Kinderarzt U8', persons: ['irma'], start: '2027-07-14', time: '15:30', endTime: '16:00', place: 'Praxis Dr. Müller', created: 1000, updated: 1000 + 600_000 });
    expect(describeChange(arzt)).toEqual({ verb: 'edit', text: 'Kinderarzt U8 (Irma), Mi 14.07.2027, 15:30–16:00, Praxis Dr. Müller' });
    expect(describeChange({ ...arzt, deleted: true })?.verb).toBe('del');
    expect(describeChange(item({ kind: 'shop', title: 'Milch', start: '2027-07-10' }))).toBeNull();
    expect(describeChange(item({ kind: 'config', start: '2027-01-01' }))).toBeNull();
  });
  it('meldet beim Eintragen eines Urlaubs nicht die technischen Umbauten bestehender Einträge', () => {
    const at = { by: 'sebastian' as PersonId, created: 1000 };
    const items = [
      item({ kind: 'presence', mode: 'vacation', persons: ['sebastian'], start: '2027-08-02', end: '2027-08-13', ...at, updated: 1100 }), // neu
      item({ kind: 'presence', mode: 'vacation', persons: ['sebastian'], start: '2027-08-02', end: '2027-08-03', ...at, created: 1, updated: 5_000_000 }), // gekürzter alter Eintrag
      item({ kind: 'presence', mode: 'homeoffice', persons: ['sebastian'], start: '2027-08-05', ...at, created: 1, deleted: true, updated: 5_000_000 }), // ersetzt
      item({ kind: 'event', title: 'Arzt', persons: [], start: '2027-08-04', ...at, updated: 5_000_000 }), // echte Änderung bleibt
    ];
    const r = annotateChanges(items);
    expect(r.map((x) => x._text !== undefined)).toEqual([true, false, false, true]);
  });
});
