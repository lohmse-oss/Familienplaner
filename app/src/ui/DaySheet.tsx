import { fmtDay, WD_LONG, dow } from '../core/dates';
import { PARENTS, PERSONS, type Item, type Kind, type Mode } from '../core/types';
import { setPresence, useStore } from '../store';
import { AgendaDay } from './DayAgenda';
import { Dot, Pill, Sheet, STATUS_ICON, STATUS_LABEL } from './common';
import { KINDS } from './EditSheet';

const MODES: (Mode | 'office')[] = ['office', 'homeoffice', 'vacation', 'trip'];

export function DaySheet({ date, onClose, edit, add, plan }: { date: string; onClose: () => void; edit: (it: Item) => void; add: (k: Kind, date: string) => void; plan: (d: string) => void }) {
  const { cal } = useStore();
  const d = cal.day(date);
  // Anwesenheit/Betreuungsbedarf als eigene Einträge (zum Bearbeiten); Termine & Co. kommen aus der Agenda
  const raw = cal.items.filter((i) => (i.kind === 'presence' || i.kind === 'care') && i.start <= date && i.end >= date);
  const empty = !raw.length && !d.needs.length && !d.cover.length && !d.events.length && !d.info.length && !d.tasks.length && !d.birthdays.length && !d.warnings.length;

  return (
    <Sheet title={`${WD_LONG[dow(date)]}, ${fmtDay(date).split(', ')[1]}`} onClose={onClose}>
      <div class="day-meta">
        {d.holiday && <span class="badge badge-holiday">{d.holiday}</span>}
        {d.school.map((s) => <span key={s} class="badge badge-school">{s}</span>)}
        {d.weekend && <span class="badge">Wochenende</span>}
        <Pill coverage={d.coverage} />
      </div>

      {d.workday && PARENTS.map((p) => (
        <div key={p} class="status-row">
          <span><Dot p={p} /> {PERSONS[p].name}</span>
          <div class="chips">
            {MODES.map((m) => {
              const on = (m === 'office' ? d.parents[p].status === 'office' : d.parents[p].status === m);
              return (
                <button key={m} class={`chip ${on ? 'on' : ''}`} style={on ? { background: PERSONS[p].color, borderColor: PERSONS[p].color, color: '#fff' } : undefined} onClick={() => setPresence(p, date, m)}>
                  {m === 'office' ? '🏢 Büro' : `${STATUS_ICON[m]} ${STATUS_LABEL[m]}`}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <AgendaDay d={d} edit={edit} />
      {empty && <div class="line muted">An diesem Tag ist nichts eingetragen.</div>}

      {raw.length > 0 && (
        <>
          <h3 class="section">Einträge</h3>
          {raw.map((i) => (
            <div key={i.id} class="line link-row" onClick={() => edit(i)}>
              <span>{KINDS.find((k) => k.kind === i.kind)?.icon}</span>
              <span class="grow">{i.title || (i.mode ? STATUS_LABEL[i.mode] : '')}{i.away ? ' (verreist)' : ''} {i.persons.map((p) => <Dot key={p} p={p} />)}</span>
            </div>
          ))}
        </>
      )}

      <div class="actions wrap">
        <button class="btn primary" onClick={() => plan(date)}>🗓️ Mehrere Tage …</button>
        {KINDS.filter((k) => k.kind !== 'birthday').map((k) => (
          <button key={k.kind} class="btn" onClick={() => add(k.kind, date)}>{k.icon} {k.label.split(' / ')[0].split(' (')[0]}</button>
        ))}
      </div>
    </Sheet>
  );
}
