import { fmtDay, WD_LONG, dow } from '../core/dates';
import { needsOwner } from '../core/calendar';
import { PARENTS, PERSONS, type Item, type Kind, type Mode } from '../core/types';
import { setPresence, useStore } from '../store';
import { Dot, PersonTag, Pill, Sheet, STATUS_ICON, STATUS_LABEL } from './common';
import { KINDS } from './EditSheet';

const MODES: (Mode | 'office')[] = ['office', 'homeoffice', 'vacation', 'trip'];

export function DaySheet({ date, onClose, edit, add, plan }: { date: string; onClose: () => void; edit: (it: Item) => void; add: (k: Kind, date: string) => void; plan: (d: string) => void }) {
  const { cal } = useStore();
  const d = cal.day(date);
  const items = cal.items.filter((i) => i.kind !== 'config' && i.kind !== 'shop' && i.kind !== 'birthday' && i.start <= date && i.end >= date);

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

      {d.needs.map((n) => <div key={n.child + n.reason} class="line need"><Dot p={n.child} /><span><b>{PERSONS[n.child].name}</b>: {n.reason} – Betreuung nötig</span></div>)}
      {d.birthdays.map((b) => <div key={b.id} class="line" onClick={() => edit(b)}>🎂 {b.title}</div>)}

      <h3 class="section">Einträge</h3>
      {items.length === 0 && <div class="line muted">Nichts eingetragen.</div>}
      {items.map((i) => (
        <div key={i.id} class="line link-row" onClick={() => edit(i)}>
          <span>{KINDS.find((k) => k.kind === i.kind)?.icon}</span>
          <span class="grow">{i.time ? i.time + ' ' : ''}{i.title || (i.mode ? STATUS_LABEL[i.mode] : '')} {i.persons.map((p) => <Dot key={p} p={p} />)}</span>
          {i.owner ? <PersonTag p={i.owner} /> : i.kind === 'event' && needsOwner(i) ? <span class="open">offen</span> : null}
        </div>
      ))}
      {d.warnings.map((w) => <div key={w} class="line warn">⚠ {w}</div>)}

      <div class="actions wrap">
        <button class="btn primary" onClick={() => plan(date)}>🗓️ Mehrere Tage …</button>
        {KINDS.filter((k) => k.kind !== 'birthday').map((k) => (
          <button key={k.kind} class="btn" onClick={() => add(k.kind, date)}>{k.icon} {k.label.split(' / ')[0].split(' (')[0]}</button>
        ))}
      </div>
    </Sheet>
  );
}
