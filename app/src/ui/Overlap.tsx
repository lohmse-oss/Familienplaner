import { useMemo, useState } from 'preact/hooks';
import { dow, WD } from '../core/dates';
import { overview } from '../core/overview';
import { useStore } from '../store';
import { Ic } from './icons';

const SHOW = 6;

/**
 * „Was ist da sonst los?“ beim Eintragen: Kreise je Tag wie im 4×1-Widget (Zahl = Einträge, rot = Betreuung ungeklärt,
 * Ring = nur per Homeoffice) und darunter, was im gewählten Zeitraum ansteht. Bei einem einzelnen Tag zeigen die Kreise
 * zusätzlich je zwei Tage davor und danach.
 */
export function Overlap({ start, end, excludeId }: { start: string; end: string; excludeId?: string }) {
  const { cal } = useStore();
  const [all, setAll] = useState(false);
  const { days, entries } = useMemo(() => overview(cal, start, end, excludeId), [cal, start, end, excludeId]);
  if (!days.length) return null;
  const list = all ? entries : entries.slice(0, SHOW);
  return (
    <div class="ovl" aria-label="Was ist zu der Zeit sonst los?">
      <div class="ovl-head">Zu der Zeit außerdem</div>
      <div class="ovl-strip">
        {days.map((d) => (
          <div key={d.date} class={`ovl-day ${d.inRange ? 'in' : ''}`}>
            <span class="ovl-wd">{WD[dow(d.date)]}</span>
            <i class={`ovl-c ${d.n > 0 ? 'full' : ''} ${d.n > 0 ? `cov-${d.cov}` : ''}`}>{d.n > 0 ? d.n : ''}</i>
            <span class="ovl-dt">{Number(d.date.slice(8))}.{Number(d.date.slice(5, 7))}.</span>
          </div>
        ))}
      </div>
      {entries.length === 0 ? (
        <div class="ovl-line muted"><Ic n="check" size={14} /> Sonst nichts eingetragen – freie Bahn.</div>
      ) : (
        list.map((e) => (
          <div key={e.key} class="ovl-line">
            <Ic n={e.icon} size={14} class="muted" />
            <span class="grow">{e.text}</span>
            <small class="muted">{e.when}</small>
          </div>
        ))
      )}
      {entries.length > SHOW && (
        <button type="button" class="link ovl-more" onClick={() => setAll(!all)}>{all ? 'weniger' : `+${entries.length - SHOW} weitere`}</button>
      )}
    </div>
  );
}
