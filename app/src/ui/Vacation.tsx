import { useMemo, useState } from 'preact/hooks';
import { findBridges } from '../core/bridges';
import { fmt, fmtRange, range, WD, dow } from '../core/dates';
import { entitlementOf, reportText, vacationReport } from '../core/report';
import { PARENTS, PERSONS, type PersonId } from '../core/types';
import { newId, saveItem, setEntitlement, useStore } from '../store';
import { Dot } from './common';

export function Vacation({ year, setYear, goWeek }: { year: number; setYear: (y: number) => void; goWeek: (d: string) => void }) {
  const { cal, items } = useStore();
  const [msg, setMsg] = useState('');
  const bridges = useMemo(() => findBridges(cal, year).sort((a, b) => b.total / b.days - a.total / a.days || a.gapStart.localeCompare(b.gapStart)), [cal, year]);
  const reports = PARENTS.map((p) => vacationReport(cal, p, year));

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(''), 2500);
  };
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      flash('Kopiert');
    } catch {
      flash('Kopieren nicht möglich');
    }
  };
  const share = async (text: string, title: string) => {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        const { Share } = await import('@capacitor/share');
        await Share.share({ title, text });
      } else if (navigator.share) await navigator.share({ title, text });
      else await copy(text);
    } catch {
      /* abgebrochen */
    }
  };

  const book = (who: PersonId[], start: string, end: string) =>
    saveItem({ id: newId(), kind: 'presence', mode: 'vacation', persons: who, start, end, title: 'Brückentage' });
  const booked = (p: PersonId, a: string, b: string) => [...range(a, b)].every((d) => cal.day(d).parents[p].status === 'vacation');

  return (
    <div class="page">
      <div class="nav">
        <button class="icon-btn" onClick={() => setYear(year - 1)} aria-label="Vorjahr">‹</button>
        <div class="nav-title"><strong>Urlaub {year}</strong><span>Übersicht für den Arbeitgeber</span></div>
        <button class="icon-btn" onClick={() => setYear(year + 1)} aria-label="Nächstes Jahr">›</button>
      </div>
      {msg && <div class="toast">{msg}</div>}

      {reports.map((r) => {
        const text = reportText(r);
        return (
          <section key={r.person} class="card vac print-block">
            <header class="card-head">
              <strong><Dot p={r.person} /> {PERSONS[r.person].name}</strong>
              <label class="ent no-print">
                Urlaubstage
                <input type="number" min="0" inputMode="numeric" value={entitlementOf(items, r.person, year) ?? ''} onChange={(e) => { const v = (e.target as HTMLInputElement).value; setEntitlement(r.person, year, v === '' ? undefined : Number(v)); }} />
              </label>
            </header>
            {r.periods.length === 0 && <div class="line muted">Noch kein Urlaub geplant. Trage Urlaub im Wochenplan oder über „＋" ein.</div>}
            {r.periods.map((p) => (
              <div key={p.start} class="line link-row" onClick={() => goWeek(p.start)}>
                <b>{fmtRange(p.start, p.end)}</b>
                <span class="grow">{p.titles.join(', ')}</span>
                <span>{p.workdays} Tg.</span>
              </div>
            ))}
            <div class="sum">
              <span>Geplant: <b>{r.used}</b> Arbeitstage</span>
              {r.entitlement !== undefined && <span>Rest: <b class={r.rest! < 0 ? 'neg' : ''}>{r.rest}</b> von {r.entitlement}</span>}
            </div>
            <div class="actions no-print">
              <button class="btn" onClick={() => copy(text)}>Text kopieren</button>
              <button class="btn" onClick={() => share(text, `Urlaubsplanung ${year} – ${PERSONS[r.person].name}`)}>Teilen</button>
            </div>
          </section>
        );
      })}
      <div class="actions no-print">
        <button class="btn primary" onClick={() => window.print()}>Drucken / als PDF speichern</button>
        <button class="btn" onClick={() => share(reports.map(reportText).join('\n\n'), `Urlaubsplanung ${year}`)}>Beide teilen</button>
      </div>

      <h3 class="section no-print">Brückentage {year}</h3>
      <p class="hint no-print">Sortiert nach Ausbeute: freie Tage am Stück pro Urlaubstag.</p>
      <div class="no-print">
        {bridges.map((b) => (
          <section key={b.gapStart} class="card bridge">
            <header class="card-head" onClick={() => goWeek(b.gapStart)}>
              <strong>{b.days === 1 ? '1 Urlaubstag' : `${b.days} Urlaubstage`} → {b.total} Tage frei</strong>
              <span class="badge badge-holiday">{[...new Set(b.holidays)].join(', ')}</span>
            </header>
            <div class="line col">
              <span>{WD[dow(b.start)]} {fmt(b.start)} – {WD[dow(b.end)]} {fmt(b.end)}</span>
              <span>Urlaub nehmen: <b>{fmtRange(b.gapStart, b.gapEnd)}</b></span>
              {b.idaFree > 0 && <span class="muted">Ida hat {b.idaFree === b.days ? 'an diesen Tagen' : `an ${b.idaFree} von ${b.days} Tagen`} ohnehin schulfrei.</span>}
            </div>
            <div class="actions">
              {PARENTS.map((p) =>
                booked(p, b.gapStart, b.gapEnd) ? <span key={p} class="booked"><Dot p={p} /> ✓ eingetragen</span> : (
                  <button key={p} class="btn" onClick={() => book([p], b.gapStart, b.gapEnd)}><Dot p={p} /> {PERSONS[p].name}</button>
                ),
              )}
              {!PARENTS.every((p) => booked(p, b.gapStart, b.gapEnd)) && (
                <button class="btn" onClick={() => book(['sebastian', 'betty'], b.gapStart, b.gapEnd)}>Beide</button>
              )}
            </div>
          </section>
        ))}
        {bridges.length === 0 && <div class="line muted">Keine Brückentage gefunden.</div>}
      </div>
    </div>
  );
}
