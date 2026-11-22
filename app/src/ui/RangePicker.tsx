import { useState } from 'preact/hooks';
import { diff, dow, fmt, fmtShort, MONTHS, range, today, WD } from '../core/dates';
import { addMonths } from '../core/recur';
import { useStore } from '../store';
import { Ic } from './icons';
import { MonthGrid } from './MonthGrid';

/**
 * Datum bzw. Zeitraum direkt im Kalender wählen – statt getrennter Von/Bis-Felder.
 * Zeitraum: 1. Tippen = Start, 2. Tippen = Ende (früherer Tag → wird getauscht); ein Tag = zweimal denselben Tag.
 * single: ein Tippen setzt das Datum (Aufgaben, wiederkehrende Termine).
 * Zeigt Wochenenden, Feiertage, Ferien und die Betreuungs-Ampel wie der Jahresplaner.
 */
export function RangePicker({ start, end, onChange, single }: { start: string; end: string; onChange: (start: string, end: string) => void; single?: boolean }) {
  const { cal } = useStore();
  const [ym, setYm] = useState((start || today()).slice(0, 7));
  const [pending, setPending] = useState(false); // Start gewählt, Ende steht noch aus
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(5, 7)) - 1;
  const shift = (months: number) => setYm(addMonths(`${ym}-01`, months).slice(0, 7));

  const pick = (d: string) => {
    if (single) return onChange(d, d);
    if (!pending) {
      onChange(d, d);
      setPending(true);
    } else {
      if (d < start) onChange(d, start);
      else onChange(start, d);
      setPending(false);
    }
  };

  const days = !single && end > start ? [...range(start, end)] : [start];
  const n = diff(start, end) + 1;
  const label = (s: string) => `${WD[dow(s)]} ${fmtShort(s)}`;
  const summary = !start
    ? 'Im Kalender antippen = Datum w\u00e4hlen'
    : single
    ? `${WD[dow(start)]} ${fmt(start)}`
    : pending
      ? `Start ${label(start)} – jetzt Ende antippen (gleicher Tag = nur dieser Tag)`
      : start === end
        ? `${WD[dow(start)]} ${fmt(start)} · 1 Tag`
        : `${label(start)} – ${label(end)}${end.slice(0, 4)} · ${n} Tage`;

  return (
    <div class="rpick">
      <div class="rpick-head">
        <button type="button" class="icon-btn" onClick={() => shift(-12)} aria-label="Ein Jahr zurück">«</button>
        <button type="button" class="icon-btn" onClick={() => shift(-1)} aria-label="Monat zurück"><Ic n="left" size={16} /></button>
        <b class="grow">{MONTHS[m]} {y}</b>
        <button type="button" class="icon-btn" onClick={() => shift(1)} aria-label="Monat vor"><Ic n="right" size={16} /></button>
        <button type="button" class="icon-btn" onClick={() => shift(12)} aria-label="Ein Jahr vor">»</button>
        <button type="button" class="btn small" onClick={() => setYm(today().slice(0, 7))}>Heute</button>
      </div>
      <div class="rpick-grid">
        <MonthGrid year={y} month={m} cal={cal} onDay={pick} selected={new Set(days)} edges={new Set(single ? [start] : [start, end])} anchor={false} title={false} />
      </div>
      <div class={`rpick-sum ${pending ? 'pending' : ''}`}><Ic n={pending ? 'clock' : 'check'} size={14} /> {summary}</div>
    </div>
  );
}
