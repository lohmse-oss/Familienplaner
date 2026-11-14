import { useState } from 'preact/hooks';
import type { DayInfo } from '../core/calendar';
import { needsOwner } from '../core/calendar';
import { addDays, fmtRange, fmtShort, isoWeek, today, weekStart, WD, dow } from '../core/dates';
import { PARENTS, PERSONS, type Item, type Mode, type PersonId } from '../core/types';
import { setPresence, useStore } from '../store';
import { Dot, PersonTag, Pill, STATUS_ICON, STATUS_LABEL } from './common';

interface Props {
  weekOf: string;
  setWeekOf: (d: string) => void;
  openDay: (d: string) => void;
  edit: (it: Item) => void;
}

const MENU: (Mode | 'office')[] = ['office', 'homeoffice', 'vacation', 'trip'];

export function Week({ weekOf, setWeekOf, openDay, edit }: Props) {
  const { cal } = useStore();
  const [picking, setPicking] = useState<{ date: string; p: PersonId } | null>(null);
  const start = weekStart(weekOf);
  const days = Array.from({ length: 7 }, (_, i) => cal.day(addDays(start, i)));
  const t = today();

  return (
    <div class="page">
      <div class="nav">
        <button class="icon-btn" onClick={() => setWeekOf(addDays(start, -7))} aria-label="Vorige Woche">‹</button>
        <div class="nav-title">
          <strong>KW {isoWeek(start)}</strong>
          <span>{fmtRange(start, addDays(start, 6))}</span>
        </div>
        <button class="icon-btn" onClick={() => setWeekOf(addDays(start, 7))} aria-label="Nächste Woche">›</button>
        {weekStart(t) !== start && <button class="link" onClick={() => setWeekOf(t)}>Heute</button>}
      </div>

      <div class="strip">
        {days.map((d) => (
          <button key={d.date} class={`strip-cell ${d.date === t ? 'today' : ''} ${d.weekend || d.holiday ? 'off' : ''}`} onClick={() => document.getElementById(`d-${d.date}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
            <span>{WD[dow(d.date)]}</span>
            <i class={`lamp lamp-${d.coverage}`} />
          </button>
        ))}
      </div>

      {days.map((d) => (
        <DayCard key={d.date} d={d} today={t} picking={picking} setPicking={setPicking} openDay={openDay} edit={edit} />
      ))}
    </div>
  );
}

function DayCard(props: {
  d: DayInfo;
  today: string;
  picking: { date: string; p: PersonId } | null;
  setPicking: (v: { date: string; p: PersonId } | null) => void;
  openDay: (d: string) => void;
  edit: (it: Item) => void;
}) {
  const { d, picking, setPicking } = props;
  const off = d.weekend || !!d.holiday;
  return (
    <section id={`d-${d.date}`} class={`card ${d.date === props.today ? 'is-today' : ''} ${off ? 'is-off' : ''}`}>
      <header class="card-head" onClick={() => props.openDay(d.date)}>
        <div>
          <strong>{WD[dow(d.date)]} {fmtShort(d.date)}</strong>
          {d.holiday && <span class="badge badge-holiday">{d.holiday}</span>}
          {d.school.map((s) => <span key={s} class="badge badge-school">{s}</span>)}
        </div>
        <Pill coverage={d.coverage} />
      </header>

      <div class="parents">
        {PARENTS.map((p) => {
          const s = d.parents[p];
          const on = picking?.date === d.date && picking.p === p;
          return (
            <button key={p} class={`pstate ${on ? 'on' : ''}`} style={{ borderColor: PERSONS[p].color, background: on ? PERSONS[p].soft : undefined }} onClick={() => setPicking(on ? null : { date: d.date, p })} disabled={!d.workday}>
              <Dot p={p} />
              <span>{PERSONS[p].name}</span>
              <span class="st">{STATUS_ICON[s.status]} {s.status === 'free' ? '' : STATUS_LABEL[s.status]}{s.away && s.status === 'vacation' ? ' (verreist)' : ''}</span>
            </button>
          );
        })}
      </div>
      {picking?.date === d.date && (
        <div class="menu">
          {MENU.map((m) => (
            <button key={m} class="chip" onClick={() => { setPresence(picking.p, d.date, m); setPicking(null); }}>
              {m === 'office' ? '🏢 Büro' : `${STATUS_ICON[m]} ${STATUS_LABEL[m]}`}
            </button>
          ))}
        </div>
      )}

      {d.needs.map((n) => (
        <div key={n.child + n.reason} class="line need"><Dot p={n.child} /><span><b>{PERSONS[n.child].name}</b>: {n.reason} – Betreuung nötig</span></div>
      ))}
      {d.cover.map((c) => (
        <div key={c.id} class="line cover" onClick={() => props.edit(c)}>🤝 Betreuung: {c.title}</div>
      ))}
      {d.events.map((e) => (
        <div key={e.id} class="line event" onClick={() => props.edit(e)}>
          <span class="time">{e.time ?? '·'}</span>
          <span class="grow">{e.title}{e.persons.map((p) => <> <Dot key={p} p={p} /></>)}</span>
          {e.owner ? <PersonTag p={e.owner} /> : needsOwner(e) ? <span class="open">wer kümmert sich?</span> : null}
        </div>
      ))}
      {d.info.map((i) => <div key={i.id} class="line info" onClick={() => props.edit(i)}>ℹ️ {i.title}</div>)}
      {d.tasks.map((t) => <div key={t.id} class={`line task ${t.done ? 'done' : ''}`} onClick={() => props.edit(t)}>☑ {t.title}{t.owner ? <> <PersonTag p={t.owner} /></> : null}</div>)}
      {d.birthdays.map((b) => <div key={b.id} class="line" onClick={() => props.edit(b)}>🎂 {b.title}</div>)}
      {d.warnings.map((w) => <div key={w} class="line warn">⚠ {w}</div>)}
    </section>
  );
}
