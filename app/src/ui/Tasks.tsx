import { useState } from 'preact/hooks';
import { addDays, diff, fmtShort, today } from '../core/dates';
import { relevant } from '../core/filter';
import { type Item } from '../core/types';
import { haptic } from '../haptics';
import { batch, deleteItem, saveItem, useStore } from '../store';
import { PersonFilterBar, PersonTag } from './common';
import { Ic } from './icons';

export function Tasks({ edit, add }: { edit: (it: Item) => void; add: () => void }) {
  const { cal, settings, readOnly } = useStore();
  const [showDone, setShowDone] = useState(false);
  const f = settings.filter;
  const t0 = today();
  const week = addDays(t0, 7);
  const tasks = cal.items.filter((i) => i.kind === 'task' && relevant(i, f));
  const open = tasks.filter((t) => !t.done).sort((a, b) => a.start.localeCompare(b.start));
  const done = tasks.filter((t) => t.done).sort((a, b) => b.start.localeCompare(a.start));

  // Gruppen nach Dringlichkeit: überfällig zuerst
  const groups: { key: string; title: string; tone?: 'late' | 'today'; list: Item[] }[] = [
    { key: 'late', title: 'Überfällig', tone: 'late' as const, list: open.filter((t) => t.start < t0) },
    { key: 'today', title: 'Heute fällig', tone: 'today' as const, list: open.filter((t) => t.start === t0) },
    { key: 'soon', title: 'Diese Woche', list: open.filter((t) => t.start > t0 && t.start <= week) },
    { key: 'later', title: 'Später', list: open.filter((t) => t.start > week) },
  ].filter((g) => g.list.length > 0);

  const toggle = (t: Item) => {
    haptic(t.done ? 'light' : 'success');
    saveItem({ ...t, done: !t.done });
  };
  const toToday = (t: Item) => {
    haptic();
    saveItem({ ...t, start: t0, end: t0 });
  };

  const Row = ({ t }: { t: Item }) => {
    const late = !t.done && t.start < t0;
    return (
      <div class={`line task-row ${t.done ? 'done' : ''}`}>
        <button class="check-btn" disabled={readOnly} onClick={() => toggle(t)} aria-label={t.done ? 'wieder offen' : 'erledigt'}>{t.done && <Ic n="check" size={16} sw={3} />}</button>
        <span class="grow" onClick={() => edit(t)}>{t.title}{t.note && <small class="task-note">{t.note}</small>}</span>
        {t.owner && <PersonTag p={t.owner} />}
        <span class={`due ${late ? 'late' : ''}`}>{late ? `${diff(t.start, t0)} Tg. · ` : ''}{fmtShort(t.start)}</span>
        {late && !readOnly && <button class="btn small" onClick={() => toToday(t)} title="Auf heute verschieben">Heute</button>}
      </div>
    );
  };

  return (
    <div class="page narrow">
      <PersonFilterBar />

      {open.length === 0 && (
        <section class="card">
          <div class="empty">
            <Ic n="check" size={24} /><br />Keine offenen Aufgaben.
            {!readOnly && <div><button class="btn small" onClick={add}><Ic n="plus" size={14} /> Aufgabe hinzufügen</button></div>}
          </div>
        </section>
      )}
      {groups.map((g) => (
        <div key={g.key}>
          <h3 class={`section ${g.tone ? 'sec-' + g.tone : ''}`}>{g.title} <span class="sec-n">{g.list.length}</span></h3>
          <section class={`card ${g.tone === 'late' ? 'card-late' : ''}`}>{g.list.map((t) => <Row key={t.id} t={t} />)}</section>
        </div>
      ))}

      {done.length > 0 && (
        <>
          <button class="link done-toggle" onClick={() => setShowDone(!showDone)}>
            <Ic n={showDone ? 'down' : 'right'} size={15} /> Erledigt ({done.length})
          </button>
          {showDone && (
            <section class="card">
              {done.slice(0, 20).map((t) => <Row key={t.id} t={t} />)}
              {!readOnly && (
                <div class="actions">
                  <button class="btn danger small" onClick={() => batch(() => done.forEach((t) => deleteItem(t.id)))}>Erledigte entfernen</button>
                </div>
              )}
            </section>
          )}
        </>
      )}

    </div>
  );
}
