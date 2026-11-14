import { useMemo } from 'preact/hooks';
import type { Calendar } from '../core/calendar';
import { findBridges } from '../core/bridges';
import { addDays, dow, fmtRange, MONTHS, range, today, WD } from '../core/dates';
import { PERSONS } from '../core/types';
import { useStore } from '../store';

interface Run {
  start: string;
  end: string;
  who: string;
  why: string;
}

/** Zusammenhängende Zeiträume mit ungeklärter Betreuung (Wochenenden/Feiertage unterbrechen nicht) */
function gapRuns(cal: Calendar, year: number): Run[] {
  const runs: Run[] = [];
  let cur: (Run & { kids: Set<string>; reasons: Set<string> }) | null = null;
  const flush = () => {
    if (cur) runs.push({ start: cur.start, end: cur.end, who: [...cur.kids].join(' & '), why: [...cur.reasons].join(', ') });
    cur = null;
  };
  for (const d of range(`${year}-01-01`, `${year}-12-31`)) {
    const day = cal.day(d);
    if (day.coverage === 'gap') {
      cur ??= { start: d, end: d, who: '', why: '', kids: new Set(), reasons: new Set() };
      cur.end = d;
      day.needs.forEach((n) => {
        cur!.kids.add(PERSONS[n.child].name);
        cur!.reasons.add(n.reason);
      });
    } else if (day.workday) flush();
  }
  flush();
  return runs;
}

export function Year({ year, setYear, openDay, goWeek }: { year: number; setYear: (y: number) => void; openDay: (d: string) => void; goWeek: (d: string) => void }) {
  const { cal } = useStore();
  const bridges = useMemo(() => new Set(findBridges(cal, year).flatMap((b) => [...range(b.gapStart, b.gapEnd)])), [cal, year]);
  const runs = useMemo(() => gapRuns(cal, year), [cal, year]);
  const t = today();

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
        {MONTHS.map((name, m) => {
          const first = `${year}-${String(m + 1).padStart(2, '0')}-01`;
          const pad = dow(first);
          const days: string[] = [];
          for (let d = first; d.slice(5, 7) === first.slice(5, 7); d = addDays(d, 1)) days.push(d);
          return (
            <section key={name} class="month">
              <h3>{name}</h3>
              <div class="grid">
                {WD.map((w) => <span key={w} class="wd">{w[0]}</span>)}
                {Array.from({ length: pad }, (_, i) => <span key={`p${i}`} />)}
                {days.map((d) => {
                  const day = cal.day(d);
                  const vac = (['sebastian', 'betty'] as const).filter((p) => day.parents[p].status === 'vacation' || day.parents[p].status === 'trip');
                  return (
                    <button
                      key={d}
                      class={`cell ${day.weekend ? 'we' : ''} ${day.holiday ? 'ho' : ''} ${day.school.length && !day.weekend ? 'sc' : ''} ${bridges.has(d) ? 'br' : ''} ${d === t ? 'tod' : ''}`}
                      onClick={() => openDay(d)}
                    >
                      <span class="num">{Number(d.slice(8))}</span>
                      <span class="marks">
                        {vac.map((p) => <i key={p} style={{ background: PERSONS[p].color }} />)}
                      </span>
                      {day.coverage !== 'none' && <i class={`lamp lamp-${day.coverage} cl`} />}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
