import { useState } from 'preact/hooks';
import type { DayInfo } from '../core/calendar';
import { needsOwner } from '../core/calendar';
import { addDays, dow, fmtRange, fmtShort, isoWeek, today, weekStart, WD } from '../core/dates';
import { relevant, type PersonFilter } from '../core/filter';
import type { Layers } from '../core/layers';
import { PARENTS, PERSONS, type Item, type Kind, type Mode, type PersonId } from '../core/types';
import { haptic } from '../haptics';
import { setPresenceRange, updateSettings, useStore } from '../store';
import { Chips, Dot, PersonTag, Pill, STATUS_LABEL } from './common';
import { DayContent } from './DayContent';
import { Details } from './Details';
import { Ic, StatusIc } from './icons';

interface Props {
  weekOf: string;
  setWeekOf: (d: string) => void;
  openDay: (d: string) => void;
  edit: (it: Item) => void;
  plan: (days?: string[]) => void;
  add: (k: Kind, date: string) => void;
}

type Sel = { p: PersonId; date: string } | null;
type Scope = 'day' | 'rest' | 'week';
const MODES: (Mode | 'office')[] = ['office', 'homeoffice', 'vacation', 'trip'];

/** Inhalt eines Tages nach Personenfilter */
function filtered(d: DayInfo, f: PersonFilter, L: Layers) {
  const kid = f === 'ida' || f === 'irma';
  return {
    needs: kid ? d.needs.filter((n) => n.child === f) : d.needs,
    cover: d.cover.filter((c) => f === 'all' || !PERSONS[f].adult ? relevant(c, f) : true),
    events: L.events ? d.events.filter((e) => relevant(e, f)) : [],
    info: L.events ? d.info.filter((i) => relevant(i, f)) : [],
    tasks: L.tasks ? d.tasks.filter((t) => relevant(t, f)) : [],
    birthdays: L.birthdays ? d.birthdays : [],
    warnings: d.warnings,
  };
}

export function Week({ weekOf, setWeekOf, openDay, edit, plan, add }: Props) {
  const { cal, settings, readOnly } = useStore();
  const f = settings.filter;
  const view = settings.calView === 'day' ? 'day' : 'matrix';
  const [sel, setSel] = useState<Sel>(null);
  const [scope, setScope] = useState<Scope>('day');
  const [who, setWho] = useState<PersonId[]>([]);
  const [touch, setTouch] = useState<{ x: number; y: number } | null>(null);
  const [selDate, setSelDate] = useState<string>(today());

  const t = today();
  const start = weekStart(weekOf);
  const days = Array.from({ length: 7 }, (_, i) => cal.day(addDays(start, i)));
  const dayDate = weekStart(selDate) === start ? selDate : weekStart(t) === start ? t : start;

  const goWeek = (n: number) => {
    setWeekOf(addDays(start, n * 7));
    setSelDate(addDays(dayDate, n * 7));
    setSel(null);
  };
  const goDay = (n: number) => {
    const nd = addDays(dayDate, n);
    setSelDate(nd);
    setWeekOf(nd);
  };
  const toToday = () => {
    setWeekOf(t);
    setSelDate(t);
    setSel(null);
  };

  const gap = days.filter((d) => d.coverage === 'gap').length;
  const maybe = days.filter((d) => d.coverage === 'maybe').length;
  const openEvents = days.reduce((n, d) => n + d.events.filter((e) => needsOwner(e) && !e.owner).length, 0);
  const L = settings.layers;
  const rows = days.map((d) => ({ d, c: filtered(d, f, L) }));
  const agenda = rows.filter(({ c }) => c.needs.length || c.cover.length || c.events.length || c.info.length || c.tasks.length || c.birthdays.length || c.warnings.length);

  const pick = (p: PersonId, date: string) => {
    if (readOnly) return openDay(date);
    haptic();
    if (sel?.p === p && sel.date === date) return setSel(null);
    setSel({ p, date });
    setWho([p]);
  };
  const apply = (mode: Mode | 'office') => {
    if (!sel || !who.length) return;
    const fri = addDays(start, 4);
    const [a, b] = scope === 'day' ? [sel.date, sel.date] : scope === 'rest' ? [sel.date, fri] : [start, fri];
    setPresenceRange(who, a, b, mode);
    haptic('success');
  };
  const current = sel ? cal.day(sel.date).parents[sel.p].status : null;
  const showRow = (p: PersonId) => f === 'all' || f === p;

  return (
    <div
      class="page"
      onTouchStart={(e) => setTouch({ x: e.touches[0].clientX, y: e.touches[0].clientY })}
      onTouchEnd={(e) => {
        if (!touch) return;
        const dx = e.changedTouches[0].clientX - touch.x;
        const dy = e.changedTouches[0].clientY - touch.y;
        if (Math.abs(dx) > 70 && Math.abs(dy) < 45) (view === 'day' ? goDay : goWeek)(dx < 0 ? 1 : -1);
        setTouch(null);
      }}
    >
      <div class="nav">
        <button class="icon-btn" onClick={() => (view === 'day' ? goDay(-1) : goWeek(-1))} aria-label="Zurück"><Ic n="left" size={22} /></button>
        <div class="nav-title">
          <strong>KW {isoWeek(start)}</strong>
          <span>{fmtRange(start, addDays(start, 6))}</span>
        </div>
        <button class="icon-btn" onClick={() => (view === 'day' ? goDay(1) : goWeek(1))} aria-label="Weiter"><Ic n="right" size={22} /></button>
      </div>

      {(weekStart(t) !== start || (view === 'day' && dayDate !== t)) && (
        <div class="week-tools"><span /><button class="btn small today-btn" onClick={toToday}><Ic n="today" size={15} /> Heute</button></div>
      )}

      {(gap > 0 || maybe > 0 || openEvents > 0) && (
        <div class="alerts">
          {gap > 0 && <span class="alert alert-gap"><i class="lamp lamp-gap" /> {gap} {gap === 1 ? 'Tag' : 'Tage'} Betreuung offen</span>}
          {maybe > 0 && <span class="alert alert-maybe"><i class="lamp lamp-maybe" /> {maybe} nur per Homeoffice</span>}
          {openEvents > 0 && <span class="alert alert-gap"><Ic n="warn" size={13} /> {openEvents} Termin{openEvents === 1 ? '' : 'e'} ohne Zuständigen</span>}
        </div>
      )}

      {view === 'matrix' ? (
        <div class="week-split">
          <div>
          {/* Wochenmatrix: die ganze Woche auf einen Blick */}
          <section class="matrix">
            <div class="mx-head" />
            {days.map((d) => (
              <button key={d.date} class={`mx-day ${d.weekend ? 'off' : ''} ${d.holiday ? 'hol' : ''} ${d.school.length && !d.weekend ? 'school' : ''} ${d.date === t ? 'today' : ''}`} onClick={() => { setSelDate(d.date); updateSettings({ calView: 'day' }); }} title={d.holiday ?? d.school.join(', ')}>
                <span>{WD[dow(d.date)]}</span>
                <b>{Number(d.date.slice(8))}</b>
                <i class="mx-tag">{d.holiday ? 'Feiertag' : d.school.length && !d.weekend ? 'Ferien' : ''}</i>
              </button>
            ))}

            {PARENTS.filter(showRow).map((p) => (
              <MxRow key={p} label={PERSONS[p].name} color={PERSONS[p].color}>
                {days.map((d) => {
                  const s = d.parents[p];
                  const on = sel?.p === p && sel.date === d.date;
                  return (
                    <button key={d.date} class={`mx-cell ${d.workday ? '' : 'off'} st-${s.status} ${on ? 'on' : ''}`} disabled={!d.workday && !readOnly} onClick={() => pick(p, d.date)} aria-label={`${PERSONS[p].name} ${d.date}`}>
                      {d.workday && <StatusIc s={s.status} size={18} />}
                    </button>
                  );
                })}
              </MxRow>
            ))}

            {(['ida', 'irma'] as PersonId[]).filter(showRow).map((c) => (
              <MxRow key={c} label={PERSONS[c].name} color={PERSONS[c].color}>
                {days.map((d) => {
                  const need = d.needs.some((n) => n.child === c);
                  const fam = d.family.includes(c);
                  return (
                    <button key={d.date} class={`mx-cell kid ${need && !fam ? 'need' : ''} ${d.workday && !need && !fam ? 'faint' : ''} ${d.workday ? '' : 'off'}`} style={need && !fam ? { background: PERSONS[c].soft, color: PERSONS[c].color } : undefined} onClick={() => openDay(d.date)}>
                      {!d.workday ? null : fam ? <Ic n="palm" size={18} /> : need ? <Ic n={d.cover.length ? 'hand' : 'alert'} size={18} /> : <Ic n={c === 'ida' ? 'backpack' : 'baby'} size={18} />}
                    </button>
                  );
                })}
              </MxRow>
            ))}

            {(L.events || L.tasks || L.birthdays) && (
              <MxRow label="Termine" color="">
                {rows.map(({ d, c }) => {
                  const ev = c.events.length + c.info.length;
                  const tk = c.tasks.filter((x) => !x.done).length;
                  const bd = c.birthdays.length;
                  const late = tk > 0 && d.date < t;
                  return (
                    <button key={d.date} class={`mx-cell multi ${ev + tk + bd === 0 ? 'off' : ''}`} onClick={() => openDay(d.date)} aria-label={`${ev} Termine, ${tk} Aufgaben, ${bd} Geburtstage`}>
                      {bd > 0 && <Ic n="cake" size={14} class="mk-ic bd" />}
                      {tk > 0 && <Ic n="tasks" size={14} class={`mk-ic ${late ? 'late' : 'tk'}`} />}
                      {ev > 0 && <i class="mx-ev">{ev}</i>}
                    </button>
                  );
                })}
              </MxRow>
            )}

            <MxRow label="Betreuung" color="">
              {days.map((d) => (
                <button key={d.date} class="mx-cell lampcell" onClick={() => openDay(d.date)} aria-label={d.coverage}>
                  {d.coverage !== 'none' ? <i class={`lamp lamp-${d.coverage} big`} /> : null}
                </button>
              ))}
            </MxRow>
          </section>
          <p class="mx-legend">
            <Ic n="office" size={13} /> Büro · <Ic n="home" size={13} /> Homeoffice · <Ic n="palm" size={13} /> Urlaub · <Ic n="plane" size={13} /> Dienstreise · <Ic n="alert" size={13} /> Betreuung nötig · <Ic n="hand" size={13} /> Dritte.
            Zelle antippen zum Ändern, Wochentag für Details.
          </p>

          {sel && !readOnly && (
            <section class="quick">
              <div class="quick-title">
                <span><b>{PERSONS[sel.p].name}</b> · {WD[dow(sel.date)]} {fmtShort(sel.date)}</span>
                <button class="link" onClick={() => setSel(null)}>schließen</button>
              </div>
              <Chips<Mode | 'office'>
                options={MODES.map((m) => ({ value: m, label: <><StatusIc s={m === 'office' ? 'office' : m} size={15} /> {m === 'office' ? 'Büro' : STATUS_LABEL[m]}</> }))}
                value={current && current !== 'free' ? [current as Mode | 'office'] : []}
                onChange={(v) => apply(v[0])}
              />
              <div class="quick-row">
                <Chips<Scope> options={[{ value: 'day', label: 'Nur dieser Tag' }, { value: 'rest', label: 'Bis Freitag' }, { value: 'week', label: 'Ganze Woche' }]} value={[scope]} onChange={(v) => setScope(v[0])} />
              </div>
              <div class="quick-row">
                <Chips<PersonId> options={PARENTS.map((p) => ({ value: p, label: p === sel.p ? PERSONS[p].name : `+ ${PERSONS[p].name}`, color: PERSONS[p].color }))} value={who} onChange={setWho} multi />
                <button class="link" onClick={() => plan([sel.date])}>Mehrere Tage …</button>
              </div>
            </section>
          )}

          </div>
          <div>
          <h3 class="section">Diese Woche</h3>
          {agenda.length === 0 && <div class="empty"><Ic n="check" size={22} /><br />Keine Termine oder Betreuungsthemen{f !== 'all' ? ` für ${PERSONS[f].name}` : ''} in dieser Woche.</div>}
          {agenda.map(({ d, c }) => <AgendaDay key={d.date} d={d} c={c} today={t} openDay={openDay} edit={edit} />)}
          </div>
        </div>
      ) : (
        <>
          {/* Tagesstreifen + Details des gewählten Tages */}
          <div class="day-strip">
            {days.map((d) => {
              const c = filtered(d, f, L);
              const n = c.events.length + c.tasks.filter((x) => !x.done).length + c.birthdays.length;
              return (
                <button key={d.date} class={`ds ${d.date === dayDate ? 'on' : ''} ${d.weekend || d.holiday ? 'off' : ''} ${d.date === t ? 'today' : ''}`} onClick={() => setSelDate(d.date)}>
                  <span>{WD[dow(d.date)]}</span>
                  <b>{Number(d.date.slice(8))}</b>
                  <span class="ds-marks">
                    {d.coverage !== 'none' && <i class={`lamp lamp-${d.coverage}`} />}
                    {n > 0 && <i class="ds-count">{n}</i>}
                  </span>
                </button>
              );
            })}
          </div>
          <section class="card day-card">
            <DayContent date={dayDate} edit={edit} add={add} plan={(d) => plan([d])} />
          </section>
        </>
      )}
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

function AgendaDay({ d, c, today: t, openDay, edit }: { d: DayInfo; c: ReturnType<typeof filtered>; today: string; openDay: (d: string) => void; edit: (it: Item) => void }) {
  const needLine = c.needs.length && !d.cover.length;
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
          {c.needs.map((n) => <span key={n.child + n.reason}><Dot p={n.child} />{PERSONS[n.child].name}: {n.reason} </span>)}
        </div>
      ) : null}
      {c.cover.map((x) => <div key={x.id} class="ag-line cover" onClick={() => edit(x)}><Ic n="hand" size={16} /> Betreuung durch {x.title}</div>)}
      {c.events.map((e) => (
        <div key={e.id}>
          <div class="ag-line" onClick={() => edit(e)}>
            <span class="time">{e.time ?? '·'}</span>
            <span class="grow">{e.title}{e.persons.map((p) => <Dot key={p} p={p} />)}</span>
            {e.owner ? <PersonTag p={e.owner} /> : needsOwner(e) ? <span class="open">offen</span> : null}
          </div>
          <Details it={e} />
        </div>
      ))}
      {c.info.map((i) => <div key={i.id} class="ag-line info" onClick={() => edit(i)}><Ic n="info" size={16} /> {i.title}</div>)}
      {c.tasks.map((x) => <div key={x.id} class={`ag-line ${x.done ? 'done' : ''}`} onClick={() => edit(x)}><Ic n="tasks" size={16} /> {x.title}{x.owner ? <PersonTag p={x.owner} /> : null}</div>)}
      {c.birthdays.map((b) => <div key={b.id} class="ag-line" onClick={() => edit(b)}><Ic n="cake" size={16} /> {b.title}</div>)}
      {c.warnings.map((w) => <div key={w} class="ag-line need"><Ic n="warn" size={16} /> {w}</div>)}
    </section>
  );
}
