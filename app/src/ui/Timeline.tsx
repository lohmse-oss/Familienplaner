import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { DayInfo } from '../core/calendar';
import { addDays, dow, isoWeek, MONTHS, range, today, weekStart, WD } from '../core/dates';
import { marksOf, type Layers } from '../core/layers';
import { ALL, PERSONS, type PersonId } from '../core/types';
import { useStore } from '../store';
import { DateInput, STATUS_LABEL } from './common';
import { Ic, StatusIc } from './icons';

const FIRST_DAYS = 70; // anfangs angezeigte Tage
const STEP = 60; // so viele Tage kommen beim Weiterscrollen dazu
const MAX_AHEAD = 365 * 3;

/** Was steht für eine Person an einem Tag an? Eltern: Status + Termine/Aufgaben. Kinder: Betreuungsbedarf + Termine. */
function PersonCell({ p, d, L }: { p: PersonId; d: DayInfo; L: Layers }) {
  const adult = PERSONS[p].adult;
  const evs = L.events ? d.events.filter((e) => e.owner === p || e.persons.includes(p)) : [];
  const tasks = adult && L.tasks ? d.tasks.filter((t) => !t.done && t.owner === p) : [];
  const count = evs.length + tasks.length;

  let icon: preact.ComponentChildren = null;
  let label = '';
  let need = false;
  if (adult) {
    const s = d.parents[p];
    if (d.workday) {
      icon = <StatusIc s={s.status} size={16} />;
      label = s.status === 'office' ? '' : STATUS_LABEL[s.status];
    }
  } else if (d.workday) {
    const n = d.needs.find((x) => x.child === p);
    if (d.family.includes(p)) {
      icon = <Ic n="palm" size={16} class="st-ic-vacation" />;
      label = 'mit im Urlaub';
    } else if (n) {
      need = true;
      icon = <Ic n={d.cover.length ? 'hand' : 'alert'} size={16} />;
      label = n.reason;
    } else icon = <Ic n={p === 'ida' ? 'backpack' : 'baby'} size={16} class="faint" />;
  }

  return (
    <div class={`tl-cell ${need ? 'need' : ''}`} style={need ? { background: PERSONS[p].soft, color: PERSONS[p].color } : undefined}>
      <div class="tl-top">
        {icon}
        {label && <span class="tl-txt">{label}</span>}
        {count > 0 && <i class="tl-count">{count}</i>}
      </div>
      {evs.slice(0, 2).map((e) => <div key={e.id} class="tl-ev tl-txt">{e.time ? `${e.time} ` : ''}{e.title}</div>)}
      {tasks.slice(0, 1).map((t) => <div key={t.id} class="tl-ev tl-txt"><Ic n="tasks" size={11} /> {t.title}</div>)}
      {evs.length + tasks.length > 3 && <div class="tl-ev tl-txt muted">+{evs.length + tasks.length - 3} weitere</div>}
    </div>
  );
}

/** Datumsspalte: Tag, Feiertag/Ferien, KW, Ampel und alles, was keiner einzelnen Person gehört (Geburtstage, Infos, Familien-Termine, Aufgaben ohne Zuständigen). */
function DateCell({ d, t, compact, L }: { d: DayInfo; t: string; compact?: boolean; L: Layers }) {
  const m = marksOf(d, t, L);
  const famEv = L.events ? d.events.filter((e) => !e.persons.length && !e.owner) : [];
  const freeTasks = L.tasks ? d.tasks.filter((x) => !x.done && !x.owner) : [];
  const extra = [
    ...(L.events ? d.info.map((i) => i.title) : []),
    ...(L.birthdays ? d.birthdays.map((b) => `Geb. ${b.title}`) : []),
    ...famEv.map((e) => `${e.time ? e.time + ' ' : ''}${e.title}`),
    ...freeTasks.map((x) => `Aufgabe: ${x.title}`),
  ].filter(Boolean) as string[];
  return (
    <div class={`tl-date ${d.weekend ? 'we' : ''} ${d.holiday ? 'ho' : ''} ${d.school.length && !d.weekend ? 'sc' : ''} ${d.date === t ? 'tod' : ''}`} id={compact ? undefined : `tl-${d.date}`}>
      <div class="tl-dn"><span>{WD[dow(d.date)]}</span><b>{Number(d.date.slice(8))}</b>{d.coverage !== 'none' && <i class={`lamp lamp-${d.coverage}`} title={d.coverage} />}</div>
      {d.date === weekStart(d.date) && <i class="tl-kw">KW {isoWeek(d.date)}</i>}
      {(m.birthdays > 0 || freeTasks.length > 0 || m.info > 0) && (
        <span class="tl-mk">
          {m.birthdays > 0 && <Ic n="cake" size={12} class="mk-ic bd" />}
          {freeTasks.length > 0 && <Ic n="tasks" size={12} class={`mk-ic ${m.overdue ? 'late' : 'tk'}`} />}
          {m.info > 0 && <Ic n="info" size={12} class="mk-ic" />}
        </span>
      )}
      {d.holiday && <span class="tl-txt tl-hol">{d.holiday}</span>}
      {extra.length > 0 && <span class="tl-txt tl-extra"><Ic n="info" size={11} /> {extra.join(', ')}</span>}
    </div>
  );
}

/**
 * Verlauf: fortlaufende Tage ohne Wochenumbruch, Tabelle transponiert –
 * Tage als Zeilen, Personen als Spalten. Lädt beim Weiterscrollen automatisch weitere Tage nach.
 */
export function Timeline({ openDay }: { openDay: (d: string) => void }) {
  const { cal, settings } = useStore();
  const t = today();
  const L = settings.layers;
  const [from, setFrom] = useState(weekStart(t));
  const [to, setTo] = useState(addDays(weekStart(t), FIRST_DAYS));
  const sentinel = useRef<HTMLDivElement>(null);

  const persons = settings.filter === 'all' ? ALL : settings.filter;
  const dates = useMemo(() => [...range(from, to)], [from, to]);
  const maxTo = addDays(t, MAX_AHEAD);

  // Beim Öffnen direkt zum heutigen Tag
  useEffect(() => {
    const id = setTimeout(() => document.getElementById(`tl-${t}`)?.scrollIntoView({ block: 'start', inline: 'start' }), 60);
    return () => clearTimeout(id);
  }, []);

  // Weiterscrollen: am Ende automatisch Tage nachladen
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setTo((cur) => (cur >= maxTo ? cur : addDays(cur, STEP)));
      },
      { rootMargin: '400px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [to]);

  const jump = (d: string) => {
    const loaded = d >= from && d <= to; // schon geladen: nur hinscrollen
    if (!loaded) {
      const a = addDays(d, -dow(d));
      setFrom(a);
      setTo(addDays(a, FIRST_DAYS));
    }
    setTimeout(() => document.getElementById(`tl-${d}`)?.scrollIntoView({ block: 'start', inline: 'start', behavior: 'smooth' }), loaded ? 0 : 80);
  };

  const bar = (
    <div class="tl-bar">
      <button class="btn small today-btn" onClick={() => jump(t)}><Ic n="today" size={15} /> Heute</button>
      <DateInput value="" ariaLabel="Zu Datum springen" onChange={(v) => jump(v)} />
      <span class="grow" />
    </div>
  );

  let lastMonth = '';
  return (
    <div class="page timeline">
      {bar}
      <button class="btn small wide-btn" onClick={() => { const a = addDays(from, -30); setFrom(a); }}><Ic n="up" size={14} /> Frühere Tage laden</button>
      <div class="tl-rows" style={{ '--n': persons.length } as preact.JSX.CSSProperties}>
        <div class="tl-row tl-head">
          <div class="tl-hd">Tag</div>
          {persons.map((p) => <div key={p} class="tl-hp" style={{ color: PERSONS[p].color }}><i class="dot" style={{ background: PERSONS[p].color }} />{PERSONS[p].name}</div>)}
        </div>
        {dates.map((date) => {
          const d = cal.day(date);
          const ym = date.slice(0, 7);
          const header = ym !== lastMonth;
          lastMonth = ym;
          return (
            <div key={date} class="tl-group">
              {header && <div class="tl-month">{MONTHS[Number(date.slice(5, 7)) - 1]} {date.slice(0, 4)}</div>}
              <div class={`tl-row ${d.weekend ? 'we' : ''}`} onClick={() => openDay(date)}>
                <DateCell d={d} t={t} L={L} />
                {persons.map((p) => <PersonCell key={p} p={p} d={d} L={L} />)}
              </div>
            </div>
          );
        })}
        <div ref={sentinel} class="tl-sentinel" />
      </div>
      <p class="hint">Weiter scrollen lädt automatisch weitere Tage. Zeile antippen für Details.</p>
    </div>
  );
}
