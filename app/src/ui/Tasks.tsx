import { fmtShort, MONTHS } from '../core/dates';
import { type Item } from '../core/types';
import { saveItem, useStore } from '../store';
import { PersonTag } from './common';

export function Tasks({ edit }: { edit: (it: Item) => void }) {
  const { cal } = useStore();
  const tasks = cal.items.filter((i) => i.kind === 'task');
  const open = tasks.filter((t) => !t.done).sort((a, b) => a.start.localeCompare(b.start));
  const done = tasks.filter((t) => t.done).sort((a, b) => b.start.localeCompare(a.start)).slice(0, 10);
  const birthdays = cal.items.filter((i) => i.kind === 'birthday').sort((a, b) => a.start.slice(5).localeCompare(b.start.slice(5)));
  const toggle = (t: Item) => saveItem({ ...t, done: !t.done });

  const Row = ({ t }: { t: Item }) => (
    <div class={`line task-row ${t.done ? 'done' : ''}`}>
      <input type="checkbox" checked={!!t.done} onChange={() => toggle(t)} aria-label="erledigt" />
      <span class="grow" onClick={() => edit(t)}>{t.title}</span>
      {t.owner && <PersonTag p={t.owner} />}
      <span class={`due ${!t.done && t.start < new Date().toISOString().slice(0, 10) ? 'late' : ''}`}>{fmtShort(t.start)}</span>
    </div>
  );

  return (
    <div class="page">
      <h3 class="section">Aufgaben</h3>
      <section class="card">
        {open.length === 0 && <div class="line muted">Keine offenen Aufgaben.</div>}
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
        {birthdays.length === 0 && <div class="line muted">Noch keine Geburtstage eingetragen.</div>}
        {birthdays.map((b) => (
          <div key={b.id} class="line link-row" onClick={() => edit(b)}>
            <span>🎂</span>
            <span class="grow">{b.title}</span>
            <span>{Number(b.start.slice(8))}. {MONTHS[Number(b.start.slice(5, 7)) - 1]}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
