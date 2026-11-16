import { needsOwner, type DayInfo } from '../core/calendar';
import { dow, fmtShort, WD } from '../core/dates';
import { PERSONS, type Item } from '../core/types';
import { Dot, PersonTag, Pill } from './common';

/**
 * Komplette Übersicht eines Tages: Betreuungsbedarf, Deckung, Termine (mit Uhrzeit/Zuständigem),
 * Info, Aufgaben, Geburtstage und Warnungen. Mit `onOpen` wird der Kopf zum Öffnen des Tages klickbar
 * (Wochenansicht); ohne `onOpen` nur der Inhalt (z. B. im Tag-Sheet).
 */
export function AgendaDay({ d, today: t, onOpen, edit }: { d: DayInfo; today?: string; onOpen?: (date: string) => void; edit: (it: Item) => void }) {
  const needLine = d.needs.length && !d.cover.length;
  return (
    <section class={`ag ${t && d.date === t ? 'is-today' : ''}`}>
      {onOpen && (
        <header class="ag-head" onClick={() => onOpen(d.date)}>
          <b>{WD[dow(d.date)]} {fmtShort(d.date)}</b>
          {d.holiday && <span class="badge badge-holiday">{d.holiday}</span>}
          {d.school.map((s) => <span key={s} class="badge badge-school">{s}</span>)}
          <span class="grow" />
          <Pill coverage={d.coverage} />
        </header>
      )}
      {needLine ? (
        <div class={`ag-line ${d.coverage === 'gap' ? 'need' : ''}`}>
          {d.needs.map((n) => <span key={n.child + n.reason}><Dot p={n.child} />{PERSONS[n.child].name}: {n.reason} </span>)}
        </div>
      ) : null}
      {d.cover.map((c) => <div key={c.id} class="ag-line cover" onClick={() => edit(c)}>🤝 Betreuung durch {c.title}</div>)}
      {d.events.map((e) => (
        <div key={e.id} class="ag-line" onClick={() => edit(e)}>
          <span class="time">{e.time ?? '·'}</span>
          <span class="grow">{e.title}{e.persons.map((p) => <Dot key={p} p={p} />)}</span>
          {e.owner ? <PersonTag p={e.owner} /> : needsOwner(e) ? <span class="open">offen</span> : null}
        </div>
      ))}
      {d.info.map((i) => <div key={i.id} class="ag-line info" onClick={() => edit(i)}>ℹ️ {i.title}</div>)}
      {d.tasks.map((x) => <div key={x.id} class={`ag-line ${x.done ? 'done' : ''}`} onClick={() => edit(x)}>☑ {x.title}{x.owner ? <PersonTag p={x.owner} /> : null}</div>)}
      {d.birthdays.map((b) => <div key={b.id} class="ag-line" onClick={() => edit(b)}>🎂 {b.title}</div>)}
      {d.warnings.map((w) => <div key={w} class="ag-line need">⚠ {w}</div>)}
    </section>
  );
}
