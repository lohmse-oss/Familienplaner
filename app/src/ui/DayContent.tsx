import { dayTag, isMultiDay, needsOwner, timeOn } from '../core/calendar';
import { ageOn, fmt, fmtRange, dow, WD_LONG } from '../core/dates';
import { isCalendarKind, PARENTS, PERSONS, type Item, type Kind, type Mode } from '../core/types';
import { setPresence, useStore } from '../store';
import { Chips, Dot, PersonTag, Pill, STATUS_LABEL, TaskCheck } from './common';
import { KINDS } from './EditSheet';
import { Details } from './Details';
import { Ic, StatusIc } from './icons';

const MODES: (Mode | 'office')[] = ['office', 'homeoffice', 'vacation', 'trip'];

interface Props {
  date: string;
  edit: (it: Item) => void;
  add: (k: Kind, date: string) => void;
  hideDoneTasks?: boolean; // Tagesblatt aus Start: erledigte Aufgaben (Archiv) nicht anzeigen
}

/** Alle Details eines Tages: Status der Eltern, Betreuung, Einträge – im Tagesblatt und in der Tagesansicht der Woche. */
export function DayContent({ date, edit, add, hideDoneTasks }: Props) {
  const { cal, readOnly } = useStore();
  const d = cal.day(date);
  const items = cal.items.filter((i) => isCalendarKind(i.kind) && i.kind !== 'birthday' && i.start <= date && i.end >= date && !(hideDoneTasks && i.kind === 'task' && i.done));

  return (
    <>
      <div class="day-meta">
        <b class="day-title">{WD_LONG[dow(date)]}, {fmt(date)}</b>
        {d.holiday && <span class="badge badge-holiday">{d.holiday}</span>}
        {d.school.map((s) => <span key={s} class="badge badge-school">{s}</span>)}
        {d.weekend && <span class="badge">Wochenende</span>}
        <Pill coverage={d.coverage} />
      </div>

      {d.workday && readOnly && PARENTS.map((p) => (
        <div key={p} class="line"><Dot p={p} /><span class="grow"><b>{PERSONS[p].name}</b></span><StatusIc s={d.parents[p].status} size={16} /> {STATUS_LABEL[d.parents[p].status]}</div>
      ))}
      {d.workday && !readOnly && PARENTS.map((p) => (
        <div key={p} class="status-row">
          <span class="who-name"><Dot p={p} /> {PERSONS[p].name}</span>
          <Chips<Mode | 'office'>
            options={MODES.map((m) => ({
              value: m,
              color: PERSONS[p].color,
              label: <StatusIc s={m === 'office' ? 'office' : m} size={16} />,
              title: m === 'office' ? 'Büro' : STATUS_LABEL[m], // Text erst beim Klick (ausgewählt) bzw. per title
            }))}
            value={[d.parents[p].status === 'free' ? 'office' : (d.parents[p].status as Mode | 'office')]}
            onChange={(v) => setPresence(p, date, v[0])}
          />
        </div>
      ))}

      {d.needs.map((n) => <div key={n.child + n.reason} class="line need"><Dot p={n.child} /><span><b>{PERSONS[n.child].name}</b>: {n.reason} – Betreuung nötig</span></div>)}
      {d.birthdays.map((b) => {
        const age = ageOn(b.start, date);
        return (
          <div key={b.id} class="line link-row" onClick={() => edit(b)}>
            <Ic n="cake" /> <span class="grow">{b.title}{age >= 0 ? ` · ${age} J.` : ''}</span>
          </div>
        );
      })}

      <h3 class="section">Einträge</h3>
      {items.length === 0 && <div class="line muted">Nichts eingetragen.</div>}
      {items.map((i) => (
        <div key={i.id} class="entry">
          <div class={`line link-row ${i.kind === 'task' && i.done ? 'done' : ''}`} onClick={() => edit(i)}>
            {i.kind === 'task' && <TaskCheck t={i} />}
            <Ic n={KINDS.find((k) => k.kind === i.kind)?.icon ?? 'info'} class="muted" />
            <span class="grow">{timeOn(i, date) ? timeOn(i, date) + ' ' : ''}{i.title || (i.mode ? STATUS_LABEL[i.mode] : '')}{isMultiDay(i) && <small class="muted"> · {dayTag(i, date)}, {fmtRange(i.start, i.end)}</small>}{i.kind === 'info' && i.away && <small class="muted"> · auswärts</small>} {i.persons.map((p) => <Dot key={p} p={p} />)}</span>
            {i.ask?.state === 'open' ? <span class="asked">angefragt</span> : null}{i.owner ? <PersonTag p={i.owner} /> : i.kind === 'event' && needsOwner(i) ? <span class="open">offen</span> : null}
          </div>
          <Details it={i} />
        </div>
      ))}
      {d.warnings.map((w) => <div key={w} class="line warn"><Ic n="warn" size={16} /> {w}</div>)}

      {!readOnly && (
        <div class="day-add">
          {KINDS.filter((k) => k.kind !== 'birthday' && k.kind !== 'cover').map((k) => (
            <button key={k.kind} class="btn ico-btn" title={k.label} aria-label={k.label} onClick={() => add(k.kind, date)}>
              <Ic n={k.icon} size={18} />
            </button>
          ))}
        </div>
      )}
    </>
  );
}
