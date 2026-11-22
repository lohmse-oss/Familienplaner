import { useRef } from 'preact/hooks';
import type { Calendar } from '../core/calendar';
import { addDays, dow, MONTHS, today, WD } from '../core/dates';
import { marksOf, type Layers } from '../core/layers';
import { PARENTS, PERSONS, type Mode } from '../core/types';

interface Props {
  year: number;
  month: number; // 0–11
  cal: Calendar;
  onDay: (d: string) => void;
  onLong?: (d: string) => void; // langes Drücken: Tagesdetails
  bridges?: Set<string>;
  selected?: Set<string>; // markierte Tage → durchgehendes Band
  edges?: Set<string>; // Start-/Endtage → gefüllter Kreis
  bands?: Record<string, Map<string, Mode>>; // Urlaub je Elternteil → Streifen
  layers?: Layers; // Marker für Geburtstage, Aufgaben (Fälligkeit) und Termine
  anchor?: boolean; // Sprungmarke m-YYYY-MM setzen (Jahresplaner); im Datums-Wähler aus
  title?: boolean; // Monatsname über dem Raster
}

/**
 * Monatskalender: Ferien, Feiertage, Brückentage, Urlaub (durchgehende Streifen je Elternteil),
 * Betreuungs-Ampel und eine Zeitraum-Auswahl wie bei Reisebuchungen (Band mit Start-/Endkreis).
 */
export function MonthGrid({ year, month, cal, onDay, onLong, bridges, selected, edges, bands, layers, anchor = true, title = true }: Props) {
  const first = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const days: string[] = [];
  for (let d = first; d.slice(5, 7) === first.slice(5, 7); d = addDays(d, 1)) days.push(d);
  const t = today();
  const timer = useRef<number | undefined>(undefined);
  const fired = useRef(false);

  // Nachbartag in derselben Wochenzeile und demselben Monat – bestimmt die runden Enden der Bänder
  const sameRow = (d: string, dir: -1 | 1) => {
    const k = dow(d);
    if ((dir < 0 && k === 0) || (dir > 0 && k === 6)) return null;
    const n = addDays(d, dir);
    return n.slice(0, 7) === d.slice(0, 7) ? n : null;
  };

  return (
    <section class="month" id={anchor ? `m-${first.slice(0, 7)}` : undefined}>
      {title && <h3>{MONTHS[month]}</h3>}
      <div class="grid">
        {WD.map((w) => <span key={w} class="wd">{w[0]}</span>)}
        {Array.from({ length: dow(first) }, (_, i) => <span key={`p${i}`} />)}
        {days.map((d) => {
          const day = cal.day(d);
          const sel = selected?.has(d) ?? false;
          const mk = layers ? marksOf(day, t, layers) : null;
          const pl = sameRow(d, -1);
          const nl = sameRow(d, 1);
          const cls = [
            'cell',
            day.weekend ? 'we' : '',
            day.holiday ? 'ho' : '',
            day.school.length && !day.weekend ? 'sc' : '',
            bridges?.has(d) ? 'br' : '',
            d === t ? 'tod' : '',
          ].join(' ');
          return (
            <button
              key={d}
              class={cls}
              onClick={() => {
                if (fired.current) {
                  fired.current = false;
                  return;
                }
                onDay(d);
              }}
              onPointerDown={() => {
                fired.current = false;
                if (!onLong) return;
                timer.current = window.setTimeout(() => {
                  fired.current = true;
                  onLong(d);
                }, 480);
              }}
              onPointerUp={() => clearTimeout(timer.current)}
              onPointerLeave={() => clearTimeout(timer.current)}
              onPointerCancel={() => clearTimeout(timer.current)}
              onContextMenu={(e) => e.preventDefault()}
            >
              <i class="fill" />
              {sel && <i class={`rng ${pl && selected!.has(pl) ? '' : 'rng-l'} ${nl && selected!.has(nl) ? '' : 'rng-r'}`} />}
              {mk && mk.total > 0 && (
                <span class="mk" title={`${mk.birthdays ? mk.birthdays + ' Geburtstag ' : ''}${mk.tasks ? mk.tasks + ' Aufgabe(n) fällig ' : ''}${mk.events + mk.info ? mk.events + mk.info + ' Termin(e)' : ''}`}>
                  {mk.birthdays > 0 && <i class="mk-b" />}
                  {mk.tasks > 0 && <i class={`mk-t ${mk.overdue ? 'late' : ''}`} />}
                  {mk.events + mk.info > 0 && <i class="mk-e" />}
                </span>
              )}
              <span class={`num ${edges?.has(d) ? 'edge' : ''}`}>{Number(d.slice(8))}</span>
              {PARENTS.map((p, lane) => {
                const m = bands?.[p]?.get(d);
                if (!m) return null;
                const capL = !(pl && bands![p].has(pl));
                const capR = !(nl && bands![p].has(nl));
                return <i key={p} class={`lane lane-${lane} ${capL ? 'cl' : ''} ${capR ? 'cr' : ''}`} style={{ background: PERSONS[p].color }} />;
              })}
              {day.coverage !== 'none' && <i class={`lamp lamp-${day.coverage} cl-dot`} />}
            </button>
          );
        })}
      </div>
    </section>
  );
}
