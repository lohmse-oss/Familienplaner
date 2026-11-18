import { ageOn, MONTHS, today } from '../core/dates';
import type { Item } from '../core/types';
import { useStore } from '../store';
import { Ic } from './icons';

/** Geburtstage (jährlich), entkoppelt von den Aufgaben. Das Geburtsjahr wird nur für die Altersanzeige genutzt. */
export function Birthdays({ edit }: { edit: (it: Item) => void }) {
  const { cal, readOnly } = useStore();
  const t = today();
  const birthdays = cal.items.filter((i) => i.kind === 'birthday').sort((a, b) => a.start.slice(5).localeCompare(b.start.slice(5)));

  return (
    <div class="page narrow">
      <section class="card">
        {birthdays.length === 0 && <div class="empty"><Ic n="cake" size={24} /><br />Noch keine Geburtstage eingetragen.</div>}
        {birthdays.map((b) => {
          const age = ageOn(b.start, t);
          return (
            <div key={b.id} class="line link-row" onClick={() => edit(b)}>
              <Ic n="cake" class="muted" />
              <span class="grow">{b.title}</span>
              {age >= 0 && <span class="muted">{age} J.</span>}
              <span>{Number(b.start.slice(8))}. {MONTHS[Number(b.start.slice(5, 7)) - 1]}</span>
            </div>
          );
        })}
      </section>
      <p class="hint">Geburtstage gelten jährlich am eingetragenen Datum (Monat/Tag).{!readOnly && ' Neuer Geburtstag: Startknopf unten lang drücken.'}</p>
    </div>
  );
}
