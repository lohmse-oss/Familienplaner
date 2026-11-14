import type { Calendar } from '../core/calendar';
import { addDays, dow, MONTHS, today, WD } from '../core/dates';
import { PARENTS, PERSONS } from '../core/types';

interface Props {
  year: number;
  month: number; // 0–11
  cal: Calendar;
  onDay: (d: string) => void;
  bridges?: Set<string>;
  selected?: Set<string>;
  anchor?: string | null;
}

/** Monatskalender mit Ferien, Feiertagen, Brückentagen, Urlaub/Dienstreise, Betreuungs-Ampel und optionaler Auswahl. */
export function MonthGrid({ year, month, cal, onDay, bridges, selected, anchor }: Props) {
  const first = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const days: string[] = [];
  for (let d = first; d.slice(5, 7) === first.slice(5, 7); d = addDays(d, 1)) days.push(d);
  const t = today();

  return (
    <section class="month">
      <h3>{MONTHS[month]}</h3>
      <div class="grid">
        {WD.map((w) => <span key={w} class="wd">{w[0]}</span>)}
        {Array.from({ length: dow(first) }, (_, i) => <span key={`p${i}`} />)}
        {days.map((d) => {
          const day = cal.day(d);
          const vac = PARENTS.filter((p) => day.parents[p].status === 'vacation' || day.parents[p].status === 'trip');
          const cls = [
            'cell',
            day.weekend ? 'we' : '',
            day.holiday ? 'ho' : '',
            day.school.length && !day.weekend ? 'sc' : '',
            bridges?.has(d) ? 'br' : '',
            d === t ? 'tod' : '',
            selected?.has(d) ? 'sel' : '',
            anchor === d ? 'anc' : '',
          ].join(' ');
          return (
            <button key={d} class={cls} onClick={() => onDay(d)}>
              <span class="num">{Number(d.slice(8))}</span>
              <span class="marks">{vac.map((p) => <i key={p} style={{ background: PERSONS[p].color }} />)}</span>
              {day.coverage !== 'none' && <i class={`lamp lamp-${day.coverage} cl`} />}
            </button>
          );
        })}
      </div>
    </section>
  );
}
