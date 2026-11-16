import { MONTHS } from '../core/dates';
import type { Item } from '../core/types';
import { useStore } from '../store';

/** Geburtstage (jährlich), entkoppelt von den Aufgaben. */
export function Birthdays({ edit, add }: { edit: (it: Item) => void; add: () => void }) {
  const { cal } = useStore();
  const birthdays = cal.items.filter((i) => i.kind === 'birthday').sort((a, b) => a.start.slice(5).localeCompare(b.start.slice(5)));

  return (
    <div class="page">
      <section class="card">
        {birthdays.length === 0 && <div class="line muted">Noch keine Geburtstage eingetragen.</div>}
        {birthdays.map((b) => (
          <div key={b.id} class="line link-row" onClick={() => edit(b)}>
            <span>🎂</span>
            <span class="grow">{b.title}</span>
            <span>{Number(b.start.slice(8))}. {MONTHS[Number(b.start.slice(5, 7)) - 1]}</span>
          </div>
        ))}
      </section>
      <button class="btn primary wide" onClick={add}>＋ Geburtstag eintragen</button>
      <p class="hint">Geburtstage gelten jährlich am eingetragenen Datum (Monat/Tag).</p>
    </div>
  );
}
