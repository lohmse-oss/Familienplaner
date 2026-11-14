import { useMemo } from 'preact/hooks';
import { findBridges } from '../core/bridges';
import { gapRuns } from '../core/gaps';
import { fmtRange, range } from '../core/dates';
import { useStore } from '../store';
import { MonthGrid } from './MonthGrid';

export function Year({ year, setYear, openDay, goWeek, plan }: { year: number; setYear: (y: number) => void; openDay: (d: string) => void; goWeek: (d: string) => void; plan: (days?: string[]) => void }) {
  const { cal } = useStore();
  const bridges = useMemo(() => new Set(findBridges(cal, year).flatMap((b) => [...range(b.gapStart, b.gapEnd)])), [cal, year]);
  const runs = useMemo(() => gapRuns(cal, `${year}-01-01`, `${year}-12-31`), [cal, year]);

  return (
    <div class="page">
      <div class="nav">
        <button class="icon-btn" onClick={() => setYear(year - 1)} aria-label="Vorjahr">‹</button>
        <div class="nav-title"><strong>{year}</strong><span>Jahresforecast</span></div>
        <button class="icon-btn" onClick={() => setYear(year + 1)} aria-label="Nächstes Jahr">›</button>
      </div>

      <div class="legend">
        <span><i class="lamp lamp-gap" /> Betreuung offen</span>
        <span><i class="lamp lamp-maybe" /> nur Homeoffice</span>
        <span><i class="lamp lamp-ok" /> gesichert</span>
        <span><i class="sw sw-school" /> Ferien</span>
        <span><i class="sw sw-holiday" /> Feiertag</span>
        <span><i class="sw sw-bridge" /> Brückentag</span>
      </div>
      <button class="btn primary wide" onClick={() => plan()}>＋ Mehrere Tage eintragen</button>

      <section class="card gaps">
        <header class="card-head"><strong>Offene Betreuung</strong><span class={`pill ${runs.length ? 'pill-gap' : 'pill-ok'}`}>{runs.length ? `${runs.length} Zeiträume` : 'alles geklärt'}</span></header>
        {runs.length === 0 && <div class="line">Für {year} ist jeder Betreuungstag abgedeckt.</div>}
        {runs.map((r) => (
          <div key={r.start} class="line link-row" onClick={() => goWeek(r.start)}>
            <b>{fmtRange(r.start, r.end)}</b>
            <span class="grow">{r.who} · {r.why}</span>
            <span>›</span>
          </div>
        ))}
      </section>

      <div class="months">
        {Array.from({ length: 12 }, (_, m) => (
          <MonthGrid key={m} year={year} month={m} cal={cal} bridges={bridges} onDay={openDay} />
        ))}
      </div>
    </div>
  );
}
