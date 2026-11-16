import { MONTHS } from '../core/dates';
import type { Item } from '../core/types';
import { useStore } from '../store';
import { Ic } from './icons';

/** Geburtstage (jährlich), entkoppelt von den Aufgaben. */
export function Birthdays({ edit, add }: { edit: (it: Item) => void; add: () => void }) {
  const { cal, readOnly } = useStore();
  const birthdays = cal.items.filter((i) => i.kind === 'birthday').sort((a, b) => a.start.slice(5).localeCompare(b.start.slice(5)));

  return (
    <div class="page narrow">
      <section class="card">
        {birthdays.length === 0 && <div class="empty"><Ic n="cake" size={24} /><br />Noch keine Geburtstage eingetragen.</div>}
        {birthdays.map((b) => (
          <div key={b.id} class="line link-row" onClick={() => edit(b)}>
            <Ic n="cake" class="muted" />
            <span class="grow">{b.title}</span>
            <span>{Number(b.start.slice(8))}. {MONTHS[Number(b.start.slice(5, 7)) - 1]}</span>
          </div>
        ))}
      </section>
      {!readOnly && (
        <button class="btn primary wide" onClick={add}>
          <Ic n="plus" size={16} /> Geburtstag eintragen
        </button>
      )}
      <p class="hint">Geburtstage gelten jährlich am eingetragenen Datum (Monat/Tag).</p>
    </div>
  );
}
