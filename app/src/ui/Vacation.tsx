import { useMemo, useState } from 'preact/hooks';
import { findBridges } from '../core/bridges';
import { dayOfYear, daysInYear, diff, fmt, fmtDays, fmtRange, MONTHS, range, today, WD, dow } from '../core/dates';
import { gapRuns } from '../core/gaps';
import { budget, entitlementOf, vacationReport, workdaysBetween, type VacationPeriod } from '../core/report';
import { PARENTS, PERSONS, type PersonId } from '../core/types';
import { applyToDays, setEntitlement, setPresenceRange, useStore, withUndo } from '../store';
import { Dot, Sheet } from './common';
import { Ic } from './icons';

interface Props {
  year: number;
  setYear: (y: number) => void;
  goWeek: (d: string) => void;
  plan: (days?: string[], persons?: PersonId[]) => void;
}

export function Vacation({ year, setYear, goWeek, plan }: Props) {
  const { cal, items, hd, readOnly } = useStore();
  const t = today();
  const [edit, setEdit] = useState<{ person: PersonId; period: VacationPeriod } | null>(null);

  const bridges = useMemo(() => findBridges(cal, year).sort((a, b) => b.total / b.cost - a.total / a.cost || a.gapStart.localeCompare(b.gapStart)), [cal, year]);
  const gaps = useMemo(() => gapRuns(cal, `${year}-01-01`, `${year}-12-31`), [cal, year]);
  const reports = PARENTS.map((p) => vacationReport(cal, p, year));

  const booked = (p: PersonId, a: string, b: string) => [...range(a, b)].every((d) => cal.day(d).parents[p].status === 'vacation');
  const book = (who: PersonId[], a: string, b: string) => withUndo('Brückentage eingetragen', () => applyToDays([...range(a, b)], { type: 'presence', persons: who, mode: 'vacation', title: 'Brückentage' }));

  return (
    <div class="page">
      <div class="nav">
        <button class="icon-btn" onClick={() => setYear(year - 1)} aria-label="Vorjahr"><Ic n="left" size={22} /></button>
        <div class="nav-title"><strong>Urlaubsverwaltung {year}</strong><span>Konto · Planung · Übersicht für den Arbeitgeber</span></div>
        <button class="icon-btn" onClick={() => setYear(year + 1)} aria-label="Nächstes Jahr"><Ic n="right" size={22} /></button>
        {year !== Number(t.slice(0, 4)) && <button class="btn small today-btn" onClick={() => setYear(Number(t.slice(0, 4)))}><Ic n="today" size={15} /> {t.slice(0, 4)}</button>}
      </div>

      {/* Urlaubskonto: genommen + geplant + noch frei */}
      <div class="vac-cols">
      {PARENTS.map((p) => {
        const b = budget(cal, p, year, t);
        const ent = b.entitlement;
        const pct = (n: number) => (ent ? Math.max(0, Math.min(100, (n / ent) * 100)) : 0);
        return (
          <section key={p} class="card budget">
            <header class="card-head">
              <strong><Dot p={p} /> {PERSONS[p].name}</strong>
              <label class="ent">
                Urlaubstage {year}
                <input type="number" min="0" step="0.5" inputMode="decimal" disabled={readOnly} value={ent ?? ''} placeholder="z. B. 30" onChange={(e) => { const v = (e.target as HTMLInputElement).value; setEntitlement(p, year, v === '' ? undefined : Number(v)); }} />
              </label>
            </header>
            {ent === undefined ? (
              <div class="line muted">Trage oben die Urlaubstage ein (inkl. Übertrag), dann siehst du, wie viel noch frei ist.</div>
            ) : (
              <>
                <div class="bar" role="img" aria-label={`${fmtDays(b.taken)} genommen, ${fmtDays(b.planned)} geplant, ${fmtDays(b.free!)} frei`}>
                  <i class="seg seg-taken" style={{ width: `${pct(b.taken)}%` }} />
                  <i class="seg seg-planned" style={{ width: `${pct(b.planned)}%`, background: PERSONS[p].color }} />
                </div>
                <div class="bar-legend">
                  <span><i class="sw seg-taken" /> genommen <b>{fmtDays(b.taken)}</b></span>
                  <span><i class="sw" style={{ background: PERSONS[p].color }} /> geplant <b>{fmtDays(b.planned)}</b></span>
                  <span class={`free ${b.free! < 0 ? 'neg' : ''}`}>noch frei <b>{fmtDays(b.free!)}</b></span>
                </div>
              </>
            )}
            {!readOnly && <button class="btn primary wide" onClick={() => plan(undefined, [p])}><Ic n="plus" size={16} /> Urlaub für {PERSONS[p].name} planen</button>}
          </section>
        );
      })}

      </div>

      <Ribbon year={year} />

      {/* Geplante Zeiträume von–bis */}
      <div class="vac-cols">
      {reports.map((r) => (
        <section key={r.person} class="card vac">
          <header class="card-head">
            <strong><Dot p={r.person} /> Urlaub {PERSONS[r.person].name} {year}</strong>
            <span class="muted">{fmtDays(r.used)} {r.used === 1 ? 'Tag' : 'Tage'}</span>
          </header>
          {r.periods.length === 0 && <div class="line muted">Noch kein Urlaub geplant.</div>}
          {r.periods.map((p) => (
            <div key={p.start} class="line link-row" onClick={() => !readOnly && setEdit({ person: r.person, period: p })}>
              <span class="grow">
                <b>{WD[dow(p.start)]} {fmt(p.start)} – {WD[dow(p.end)]} {fmt(p.end)}</b>
                {p.titles.length > 0 && <><br /><span class="muted">{p.titles.join(', ')}</span></>}
              </span>
              <span class="days-badge">{fmtDays(p.workdays)} {p.workdays === 1 ? 'Tag' : 'Tage'}</span>
              {!readOnly && <Ic n="edit" size={15} class="muted" />}
            </div>
          ))}
          <p class="hint">Gezählt werden nur Arbeitstage: ohne Wochenenden und Feiertage; 24.12. und 31.12. zählen als halber Tag.</p>
        </section>
      ))}
      </div>

      {/* Wo Urlaub gebraucht wird */}
      <div>
        <h3 class="section">Betreuung noch offen – Urlaub nötig?</h3>
        <section class="card">
          {gaps.length === 0 && <div class="empty"><Ic n="check" size={24} /><br />Für {year} ist jeder Betreuungstag abgedeckt.</div>}
          {gaps.map((g) => (
            <div key={g.start} class="line link-row" onClick={() => !readOnly && plan([...range(g.start, g.end)].filter((d) => !cal.isFree(d)))}>
              <span class="grow"><b>{fmtRange(g.start, g.end)}</b> · {g.who} · {g.why}<br /><span class="muted">{g.days} Arbeitstage offen</span></span>
              {!readOnly && <span class="btn small">planen</span>}
            </div>
          ))}
        </section>

        <h3 class="section">Brückentage {year}</h3>
        <p class="hint">Sortiert nach Ausbeute: freie Tage am Stück pro Urlaubstag.</p>
        {bridges.map((b) => (
          <section key={b.gapStart} class="card bridge">
            <header class="card-head" onClick={() => goWeek(b.gapStart)}>
              <strong>{b.cost === 1 ? '1 Urlaubstag' : `${fmtDays(b.cost)} Urlaubstage`} → {b.total} Tage frei</strong>
              <span class="badge badge-holiday">{[...new Set(b.holidays)].join(', ')}</span>
            </header>
            <div class="line col">
              <span>{WD[dow(b.start)]} {fmt(b.start)} – {WD[dow(b.end)]} {fmt(b.end)}</span>
              <span>Urlaub nehmen: <b>{fmtRange(b.gapStart, b.gapEnd)}</b></span>
              {b.idaFree > 0 && <span class="muted">Ida hat {b.idaFree === b.days ? 'an diesen Tagen' : `an ${b.idaFree} von ${b.days} Tagen`} ohnehin schulfrei.</span>}
            </div>
            {!readOnly && <div class="actions">
              {PARENTS.map((p) =>
                booked(p, b.gapStart, b.gapEnd) ? <span key={p} class="booked"><Dot p={p} /> <Ic n="check" size={14} /> eingetragen</span> : (
                  <button key={p} class="btn" onClick={() => book([p], b.gapStart, b.gapEnd)}><Dot p={p} /> {PERSONS[p].name}</button>
                ),
              )}
              {!PARENTS.every((p) => booked(p, b.gapStart, b.gapEnd)) && <button class="btn" onClick={() => book([...PARENTS], b.gapStart, b.gapEnd)}>Beide</button>}
            </div>}
          </section>
        ))}
        {bridges.length === 0 && <div class="line muted">Keine Brückentage gefunden.</div>}
        <p class="hint">Ferien und Feiertage: {hd.source}, Stand {fmt(hd.fetchedAt)}.</p>
      </div>

      {edit && <PeriodSheet person={edit.person} period={edit.period} year={year} onClose={() => setEdit(null)} entitlement={entitlementOf(items, edit.person, year)} />}
    </div>
  );
}

/** Jahresband: Urlaub beider Eltern und Ferien von Ida in einer Zeitleiste */
function Ribbon({ year }: { year: number }) {
  const { cal, hd } = useStore();
  const n = daysInYear(year);
  const pos = (a: string, b: string) => {
    const s = a < `${year}-01-01` ? `${year}-01-01` : a;
    const e = b > `${year}-12-31` ? `${year}-12-31` : b;
    return { left: `${((dayOfYear(s) - 1) / n) * 100}%`, width: `${((diff(s, e) + 1) / n) * 100}%` };
  };
  const school = hd.school.filter((s) => s.end >= `${year}-01-01` && s.start <= `${year}-12-31`);
  const holidays = hd.holidays.filter((h) => h.start.startsWith(String(year)));
  const rows = PARENTS.map((p) => ({ p, periods: vacationReport(cal, p, year).periods }));
  const trips = PARENTS.map((p) => ({ p, days: [...range(`${year}-01-01`, `${year}-12-31`)].filter((d) => cal.day(d).parents[p].status === 'trip') }));

  return (
    <section class="card ribbon">
      <header class="card-head"><strong>Jahresband {year}</strong></header>
      <div class="rb-months">
        {MONTHS.map((m, i) => <span key={m} style={{ left: `${((dayOfYear(`${year}-${String(i + 1).padStart(2, '0')}-01`) - 1) / n) * 100}%` }}>{m.slice(0, 1)}</span>)}
      </div>
      <div class="rb-row">
        <span class="rb-label">Ida</span>
        <div class="rb-track">
          {school.map((s) => <i key={s.start} class="rb-school" style={pos(s.start, s.end)} title={s.name} />)}
          {holidays.map((h) => <i key={h.start} class="rb-holiday" style={pos(h.start, h.end)} title={h.name} />)}
        </div>
      </div>
      {rows.map(({ p, periods }) => (
        <div key={p} class="rb-row">
          <span class="rb-label"><Dot p={p} />{PERSONS[p].name}</span>
          <div class="rb-track">
            {school.map((s) => <i key={s.start} class="rb-school faint" style={pos(s.start, s.end)} />)}
            {periods.map((x) => <i key={x.start} class="rb-vac" style={{ ...pos(x.start, x.end), background: PERSONS[p].color }} title={`${fmtRange(x.start, x.end)} · ${x.workdays} Tage`} />)}
            {trips.find((x) => x.p === p)!.days.map((d) => <i key={d} class="rb-trip" style={pos(d, d)} title="Dienstreise" />)}
          </div>
        </div>
      ))}
      <div class="bar-legend"><span><i class="sw sw-school" /> Schulferien</span><span><i class="sw sw-holiday" /> Feiertag</span><span><i class="sw" style={{ background: 'var(--ink)' }} /> Dienstreise</span></div>
    </section>
  );
}

function PeriodSheet({ person, period, onClose, year, entitlement }: { person: PersonId; period: VacationPeriod; onClose: () => void; year: number; entitlement?: number }) {
  const { cal } = useStore();
  const [a, setA] = useState(period.start);
  const [b, setB] = useState(period.end);
  const away = !!cal.day(period.start).parents[person].away;
  const days = a <= b ? workdaysBetween(cal, a, b) : 0;
  const title = period.titles[0];

  const save = () => {
    withUndo('Urlaub geändert', () => {
      setPresenceRange([person], period.start, period.end, 'office', { onlyMode: 'vacation' });
      setPresenceRange([person], a, b, 'vacation', { title, away });
    });
    onClose();
  };
  const remove = () => {
    withUndo('Urlaub gelöscht', () => setPresenceRange([person], period.start, period.end, 'office', { onlyMode: 'vacation' }));
    onClose();
  };

  return (
    <Sheet title={`Urlaub ${PERSONS[person].name}`} onClose={onClose}>
      <div class="form">
        <div class="row">
          <div><label>Von</label><input type="date" value={a} onInput={(e) => { const v = (e.target as HTMLInputElement).value; if (v) { setA(v); if (b < v) setB(v); } }} /></div>
          <div><label>Bis (einschließlich)</label><input type="date" value={b} min={a} onInput={(e) => { const v = (e.target as HTMLInputElement).value; if (v) setB(v); }} /></div>
        </div>
        <p class="hint">{fmtDays(days)} Urlaubstage{entitlement !== undefined ? ` · Konto ${year}: ${fmtDays(entitlement)}` : ''}. Wochenenden und Feiertage zählen nicht mit, 24.12. und 31.12. als halber Tag.</p>
      </div>
      <div class="actions sticky">
        <button class="btn danger" onClick={remove}>Urlaub löschen</button>
        <span class="grow" />
        <button class="btn" onClick={onClose}>Abbrechen</button>
        <button class="btn primary" disabled={a > b} onClick={save}>Speichern</button>
      </div>
    </Sheet>
  );
}
