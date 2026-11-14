import { useState } from 'preact/hooks';
import type { DayInfo } from '../core/calendar';
import { needsOwner } from '../core/calendar';
import { addDays, dow, fmtRange, fmtShort, isoWeek, today, weekStart, WD } from '../core/dates';
import { PARENTS, PERSONS, type Item, type Mode, type PersonId } from '../core/types';
import { setPresenceRange, useStore } from '../store';
import { Chips, Dot, PersonTag, Pill, STATUS_ICON } from './common';

interface Props {
  weekOf: string;
  setWeekOf: (d: string) => void;
  openDay: (d: string) => void;
  edit: (it: Item) => void;
  plan: (days?: string[]) => void;
}

type Sel = { p: PersonId; date: string } | null;
type Scope = 'day' | 'rest' | 'week';
const MODES: { value: Mode | 'office'; label: string }[] = [
  { value: 'office', label: '🏢 Büro' },
  { value: 'homeoffice', label: '🏠 Homeoffice' },
  { value: 'vacation', label: '🌴 Urlaub' },
  { value: 'trip', label: '✈️ Dienstreise' },
];
const KID_ICON: Record<string, string> = { ida: '🎒', irma: '🧸' };

export function Week({ weekOf, setWeekOf, openDay, edit, plan }: Props) {
  const { cal } = useStore();
  const [sel, setSel] = useState<Sel>(null);
  const [scope, setScope] = useState<Scope>('day');
  const [who, setWho] = useState<PersonId[]>([]);
  const [touch, setTouch] = useState<{ x: number; y: number } | null>(null);

  const start = weekStart(weekOf);
  const days = Array.from({ length: 7 }, (_, i) => cal.day(addDays(start, i)));
  const t = today();
  const go = (n: number) => {
    setWeekOf(addDays(start, n * 7));
    setSel(null);
  };

  const gap = days.filter((d) => d.coverage === 'gap').length;
  const maybe = days.filter((d) => d.coverage === 'maybe').length;
  const openEvents = days.reduce((n, d) => n + d.events.filter((e) => needsOwner(e) && !e.owner).length, 0);
  const agenda = days.filter((d) => d.needs.length || d.cover.length || d.events.length || d.info.length || d.tasks.length || d.birthdays.length || d.warnings.length);

  const pick = (p: PersonId, date: string) => {
    if (sel?.p === p && sel.date === date) return setSel(null);
    setSel({ p, date });
    setWho([p]);
  };
  const apply = (mode: Mode | 'office') => {
    if (!sel || !who.length) return;
    const fri = addDays(start, 4);
    const [a, b] = scope === 'day' ? [sel.date, sel.date] : scope === 'rest' ? [sel.date, fri] : [start, fri];
    setPresenceRange(who, a, b, mode);
  };
  const current = sel ? cal.day(sel.date).parents[sel.p].status : null;

  return (
    <div
      class="page"
      onTouchStart={(e) => setTouch({ x: e.touches[0].clientX, y: e.touches[0].clientY })}
      onTouchEnd={(e) => {
        if (!touch) return;
        const dx = e.changedTouches[0].clientX - touch.x;
        const dy = e.changedTouches[0].clientY - touch.y;
        if (Math.abs(dx) > 70 && Math.abs(dy) < 45) go(dx < 0 ? 1 : -1);
        setTouch(null);
      }}
    >
      <div class="nav">
        <button class="icon-btn" onClick={() => go(-1)} aria-label="Vorige Woche">‹</button>
        <div class="nav-title">
          <strong>KW {isoWeek(start)}</strong>
          <span>{fmtRange(start, addDays(start, 6))}</span>
        </div>
        <button class="icon-btn" onClick={() => go(1)} aria-label="Nächste Woche">›</button>
        {weekStart(t) !== start && <button class="link" onClick={() => { setWeekOf(t); setSel(null); }}>Heute</button>}
      </div>

      {(gap > 0 || maybe > 0 || openEvents > 0) && (
        <div class="alerts">
          {gap > 0 && <span class="alert alert-gap">🔴 {gap} {gap === 1 ? 'Tag' : 'Tage'} Betreuung offen</span>}
          {maybe > 0 && <span class="alert alert-maybe">🟡 {maybe} nur per Homeoffice</span>}
          {openEvents > 0 && <span class="alert alert-gap">⚠ {openEvents} Termin{openEvents === 1 ? '' : 'e'} ohne Zuständigen</span>}
        </div>
      )}

      {/* Wochenmatrix: die ganze Woche auf einen Blick */}
      <section class="matrix">
        <div class="mx-head" />
        {days.map((d) => (
          <button key={d.date} class={`mx-day ${d.weekend ? 'off' : ''} ${d.holiday ? 'hol' : ''} ${d.school.length && !d.weekend ? 'school' : ''} ${d.date === t ? 'today' : ''}`} onClick={() => openDay(d.date)} title={d.holiday ?? d.school.join(', ')}>
            <span>{WD[dow(d.date)]}</span>
            <b>{Number(d.date.slice(8))}</b>
            <i class="mx-tag">{d.holiday ? 'Feiertag' : d.school.length && !d.weekend ? 'Ferien' : ''}</i>
          </button>
        ))}

        {PARENTS.map((p) => (
          <MxRow key={p} label={PERSONS[p].name} color={PERSONS[p].color}>
            {days.map((d) => {
              const s = d.parents[p];
              const on = sel?.p === p && sel.date === d.date;
              return (
                <button key={d.date} class={`mx-cell ${d.workday ? '' : 'off'} st-${s.status} ${on ? 'on' : ''}`} style={on ? { outlineColor: PERSONS[p].color } : undefined} disabled={!d.workday} onClick={() => pick(p, d.date)} aria-label={`${PERSONS[p].name} ${d.date}`}>
                  {d.workday ? STATUS_ICON[s.status] : ''}
                </button>
              );
            })}
          </MxRow>
        ))}

        {(['ida', 'irma'] as PersonId[]).map((c) => (
          <MxRow key={c} label={PERSONS[c].name} color={PERSONS[c].color}>
            {days.map((d) => {
              const need = d.needs.some((n) => n.child === c);
              const fam = d.family.includes(c);
              const icon = !d.workday ? '' : fam ? '🌴' : need ? (d.cover.length ? '🤝' : '❗') : KID_ICON[c];
              return (
                <button key={d.date} class={`mx-cell kid ${need && !fam ? 'need' : ''} ${d.workday && !need && !fam ? 'faint' : ''} ${d.workday ? '' : 'off'}`} style={need && !fam ? { background: PERSONS[c].soft } : undefined} onClick={() => openDay(d.date)}>
                  {icon}
                </button>
              );
            })}
          </MxRow>
        ))}

        <MxRow label="Betreuung" color="">
          {days.map((d) => (
            <button key={d.date} class="mx-cell lampcell" onClick={() => openDay(d.date)} aria-label={d.coverage}>
              {d.coverage !== 'none' ? <i class={`lamp lamp-${d.coverage} big`} /> : ''}
            </button>
          ))}
        </MxRow>
      </section>
      <p class="mx-legend">🏢 Büro · 🏠 Homeoffice · 🌴 Urlaub · ✈️ Dienstreise · ❗ Betreuung nötig · 🤝 Dritte · Zelle antippen zum Ändern, Wochentag für Details</p>

      {sel && (
        <section class="quick">
          <div class="quick-title">
            <span><b>{PERSONS[sel.p].name}</b> · {WD[dow(sel.date)]} {fmtShort(sel.date)}</span>
            <button class="link" onClick={() => setSel(null)}>schließen</button>
          </div>
          <Chips<Mode | 'office'> options={MODES} value={current && current !== 'free' ? [current] : []} onChange={(v) => apply(v[0])} />
          <div class="quick-row">
            <Chips<Scope> options={[{ value: 'day', label: 'Nur dieser Tag' }, { value: 'rest', label: 'Bis Freitag' }, { value: 'week', label: 'Ganze Woche' }]} value={[scope]} onChange={(v) => setScope(v[0])} />
          </div>
          <div class="quick-row">
            <Chips<PersonId> options={PARENTS.map((p) => ({ value: p, label: p === sel.p ? PERSONS[p].name : `+ ${PERSONS[p].name}`, color: PERSONS[p].color }))} value={who} onChange={setWho} multi />
            <button class="link" onClick={() => plan([sel.date])}>Mehrere Tage …</button>
          </div>
        </section>
      )}

      {/* Agenda: nur Tage mit Inhalt, jeweils kompakt */}
      <h3 class="section">Diese Woche</h3>
      {agenda.length === 0 && <div class="empty">Keine Termine oder Betreuungsthemen in dieser Woche.</div>}
      {agenda.map((d) => <AgendaDay key={d.date} d={d} today={t} openDay={openDay} edit={edit} />)}
    </div>
  );
}

function MxRow({ label, color, children }: { label: string; color: string; children: preact.ComponentChildren }) {
  return (
    <>
      <div class="mx-label">{color && <i class="dot" style={{ background: color }} />}{label}</div>
      {children}
    </>
  );
}

function AgendaDay({ d, today: t, openDay, edit }: { d: DayInfo; today: string; openDay: (d: string) => void; edit: (it: Item) => void }) {
  const needLine = d.needs.length && !d.cover.length;
  return (
    <section class={`ag ${d.date === t ? 'is-today' : ''}`}>
      <header class="ag-head" onClick={() => openDay(d.date)}>
        <b>{WD[dow(d.date)]} {fmtShort(d.date)}</b>
        {d.holiday && <span class="badge badge-holiday">{d.holiday}</span>}
        {d.school.map((s) => <span key={s} class="badge badge-school">{s}</span>)}
        <span class="grow" />
        <Pill coverage={d.coverage} />
      </header>
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
