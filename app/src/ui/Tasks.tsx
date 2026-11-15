import { fmtShort, MONTHS, today } from '../core/dates';
import { relevant } from '../core/filter';
import { type Item } from '../core/types';
import { haptic } from '../haptics';
import { saveItem, useStore } from '../store';
import { PersonFilterBar, PersonTag } from './common';
import { Ic } from './icons';

export function Tasks({ edit, add }: { edit: (it: Item) => void; add: () => void }) {
  const { cal, settings, readOnly } = useStore();
  const f = settings.filter;
  const t0 = today();
  const tasks = cal.items.filter((i) => i.kind === 'task' && relevant(i, f));
  const open = tasks.filter((t) => !t.done).sort((a, b) => a.start.localeCompare(b.start));
  const done = tasks.filter((t) => t.done).sort((a, b) => b.start.localeCompare(a.start)).slice(0, 10);
  const birthdays = cal.items.filter((i) => i.kind === 'birthday').sort((a, b) => a.start.slice(5).localeCompare(b.start.slice(5)));
  const toggle = (t: Item) => {
    haptic(t.done ? 'light' : 'success');
    saveItem({ ...t, done: !t.done });
  };

  const Row = ({ t }: { t: Item }) => (
    <div class={`line task-row ${t.done ? 'done' : ''}`}>
      <button class="check-btn" disabled={readOnly} onClick={() => toggle(t)} aria-label={t.done ? 'wieder offen' : 'erledigt'}>{t.done && <Ic n="check" size={16} sw={3} />}</button>
      <span class="grow" onClick={() => edit(t)}>{t.title}</span>
      {t.owner && <PersonTag p={t.owner} />}
      <span class={`due ${!t.done && t.start < t0 ? 'late' : ''}`}>{fmtShort(t.start)}</span>
    </div>
  );

  return (
    <div class="page narrow">
      <PersonFilterBar />
      <h3 class="section">Aufgaben</h3>
      <section class="card">
        {open.length === 0 && (
          <div class="empty">
            <Ic n="check" size={24} /><br />Keine offenen Aufgaben.
            {!readOnly && <div><button class="btn small" onClick={add}><Ic n="plus" size={14} /> Aufgabe hinzufügen</button></div>}
          </div>
        )}
        {open.map((t) => <Row key={t.id} t={t} />)}
      </section>
      {done.length > 0 && (
        <>
          <h3 class="section">Erledigt</h3>
          <section class="card">{done.map((t) => <Row key={t.id} t={t} />)}</section>
        </>
      )}
      <h3 class="section">Geburtstage</h3>
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
    </div>
  );
}
