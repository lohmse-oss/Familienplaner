import { useEffect, useMemo, useState } from 'preact/hooks';
import { findBridges } from '../core/bridges';
import { dow, fmt, fmtDays, fmtRange, fmtShort, range, today, WD } from '../core/dates';
import { gapRuns } from '../core/gaps';
import { budget, vacationReport } from '../core/report';
import { ALL, CHILDREN, PARENTS, PERSONS, type Mode, type PersonId } from '../core/types';
import { applyToDays, setPresenceRange, useStore, withUndo } from '../store';
import { Chips } from './common';
import { haptic } from '../haptics';
import { Ic, type IconName } from './icons';
import { MonthGrid } from './MonthGrid';

export type PlanMode = 'vacation' | 'homeoffice' | 'trip' | 'office' | 'care' | 'cover';
export interface PlanPreset {
  id: number; // neue Id = Vorgabe erneut anwenden
  start?: string;
  end?: string;
  persons?: PersonId[];
  mode?: PlanMode;
}

const MODE_DEF: { value: PlanMode; text: string; icon: IconName }[] = [
  { value: 'vacation', text: 'Urlaub', icon: 'palm' },
  { value: 'homeoffice', text: 'Homeoffice', icon: 'home' },
  { value: 'trip', text: 'Dienstreise', icon: 'plane' },
  { value: 'office', text: 'Büro (zurücksetzen)', icon: 'office' },
  { value: 'care', text: 'Schließtag / Betreuung nötig', icon: 'baby' },
  { value: 'cover', text: 'Betreuung durch Dritte', icon: 'hand' },
];
const MODES = MODE_DEF.map((m) => ({ value: m.value, label: <><Ic n={m.icon} size={15} /> {m.text}</> }));
const VERB: Record<PlanMode, string> = { vacation: 'Urlaub', homeoffice: 'Homeoffice', trip: 'Dienstreise', office: 'Büro', care: 'Betreuungsbedarf', cover: 'Betreuung' };
const CARE_PRESETS: { label: string; child: PersonId }[] = [
  { label: 'Schließtag Kita', child: 'irma' },
  { label: 'Schließtag Schule', child: 'ida' },
];
const opt = (ids: PersonId[]) => ids.map((p) => ({ value: p, label: PERSONS[p].name, color: PERSONS[p].color }));
const peopleFor = (m: PlanMode) => (m === 'care' || m === 'cover' ? CHILDREN : m === 'vacation' ? ALL : PARENTS);
const dayLabel = (d: string) => `${WD[dow(d)]} ${fmt(d)}`;

interface Editing {
  person: PersonId;
  start: string;
  end: string;
}

/**
 * Jahresplaner: Kalender des ganzen Jahres mit Zeitraum-Auswahl wie bei Reisebuchungen.
 * Ersten Tag tippen, letzten Tag tippen → Band mit Start-/Endkreis → unten eintragen.
 * Bestehenden Urlaub antippen = ändern oder löschen. Langes Drücken = Tagesdetails.
 */
export function Year({ year, setYear, openDay, preset }: { year: number; setYear: (y: number) => void; openDay: (d: string) => void; preset?: PlanPreset }) {
  const { cal, settings, hd, readOnly } = useStore();
  const t = today();

  const [selMode, setSelMode] = useState<'range' | 'single'>('range');
  const [rg, setRg] = useState<{ start: string | null; end: string | null }>({ start: null, end: null });
  const [multi, setMulti] = useState<Set<string>>(new Set());
  const [mode, setModeRaw] = useState<PlanMode>('vacation');
  const [persons, setPersons] = useState<PersonId[]>([settings.me]);
  const [title, setTitle] = useState('');
  const [away, setAway] = useState(false);
  const [more, setMore] = useState(false);
  const [gapsOpen, setGapsOpen] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);

  const bridges = useMemo(() => findBridges(cal, year), [cal, year]);
  const bridgeDays = useMemo(() => new Set(bridges.flatMap((b) => [...range(b.gapStart, b.gapEnd)])), [bridges]);
  const gaps = useMemo(() => gapRuns(cal, `${year}-01-01`, `${year}-12-31`).filter((g) => settings.filter === 'ida' || settings.filter === 'irma' ? g.who.includes(PERSONS[settings.filter].name) : true), [cal, year, settings.filter]);
  const periods = useMemo(() => PARENTS.flatMap((p) => vacationReport(cal, p, year).periods.map((x) => ({ person: p, ...x }))), [cal, year]);
  const bands = useMemo(() => {
    const out: Record<string, Map<string, Mode>> = {};
    for (const p of PARENTS) {
      if (settings.filter !== 'all' && settings.filter !== p) {
        out[p] = new Map();
        continue;
      }
      const m = new Map<string, Mode>();
      for (const per of periods.filter((x) => x.person === p)) for (const d of range(per.start, per.end)) m.set(d, 'vacation');
      for (const d of range(`${year}-01-01`, `${year}-12-31`)) if (cal.day(d).parents[p].status === 'trip') m.set(d, 'trip');
      out[p] = m;
    }
    return out;
  }, [cal, year, periods, settings.filter]);

  const days = useMemo(() => (selMode === 'range' ? (rg.start ? [...range(rg.start, rg.end ?? rg.start)] : []) : [...multi].sort()), [selMode, rg, multi]);
  const selected = useMemo(() => new Set(days), [days]);
  const edges = useMemo(() => (selMode === 'range' ? new Set([rg.start, rg.end].filter((x): x is string => !!x)) : selected), [selMode, rg, selected]);

  const cy = Number(t.slice(0, 4));
  const scrollTo = (d: string) => setTimeout(() => document.getElementById(`m-${d.slice(0, 7)}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
  const reset = () => {
    setRg({ start: null, end: null });
    setMulti(new Set());
    setEditing(null);
    setTitle('');
    setAway(false);
    setMore(false);
  };
  const pickRange = (a: string, b: string) => {
    setSelMode('range');
    setMulti(new Set());
    setEditing(null);
    setRg({ start: a, end: b });
    scrollTo(a);
  };
  const setMode = (m: PlanMode) => {
    setModeRaw(m);
    const allowed = peopleFor(m);
    setPersons((cur) => {
      const kept = cur.filter((p) => allowed.includes(p));
      if (kept.length || m === 'cover') return kept;
      return m === 'care' ? ['ida'] : [allowed.includes(settings.me) ? settings.me : 'sebastian'];
    });
  };

  // Vorgabe von außen (z. B. „planen“ bei einer Betreuungslücke)
  useEffect(() => {
    if (!preset) return;
    reset();
    setSelMode('range');
    if (preset.mode) setModeRaw(preset.mode);
    setPersons(preset.persons ?? [settings.me]);
    if (preset.start) {
      setRg({ start: preset.start, end: preset.end ?? null });
      scrollTo(preset.start);
    }
  }, [preset?.id]);

  // Im laufenden Jahr direkt zum aktuellen Monat; „Heute“ springt von jedem Jahr dorthin
  useEffect(() => {
    if (year === cy) setTimeout(() => document.getElementById(`m-${t.slice(0, 7)}`)?.scrollIntoView({ block: 'start' }), 60);
  }, [year]);
  const toToday = () => {
    reset();
    if (year !== cy) setYear(cy);
    scrollTo(t);
  };

  const startEdit = (per: { person: PersonId; start: string; end: string; titles: string[] }) => {
    setEditing({ person: per.person, start: per.start, end: per.end });
    setSelMode('range');
    setRg({ start: per.start, end: per.end });
    setModeRaw('vacation');
    setPersons([per.person]);
    setTitle(per.titles[0] ?? '');
    setAway(!!cal.day(per.start).parents[per.person].away);
  };

  const tap = (d: string) => {
    if (readOnly) return openDay(d);
    if (selMode === 'single') {
      setMulti((s) => {
        const n = new Set(s);
        n.has(d) ? n.delete(d) : n.add(d);
        return n;
      });
      return;
    }
    if (!rg.start) {
      const per = periods.find((x) => x.start <= d && d <= x.end);
      if (per) return startEdit(per); // bestehenden Urlaub antippen → ändern/löschen
      return setRg({ start: d, end: null });
    }
    haptic();
    if (rg.end || d < rg.start) setRg({ start: d, end: null }); // neuer Start
    else setRg({ start: rg.start, end: d });
  };

  // Zusammenfassung und Wirkung aufs Urlaubskonto
  const weight = days.reduce((n, d) => n + cal.weight(d), 0);
  const effects =
    mode !== 'vacation' || !days.length
      ? []
      : persons.filter((p) => PARENTS.includes(p)).map((p) => {
          const b = budget(cal, p, Number(days[0].slice(0, 4)), t);
          const isEdit = editing?.person === p;
          const fresh = days.reduce((n, d) => n + (isEdit || cal.day(d).parents[p].status !== 'vacation' ? cal.weight(d) : 0), 0);
          const back = isEdit ? [...range(editing!.start, editing!.end)].reduce((n, d) => n + (cal.day(d).parents[p].status === 'vacation' ? cal.weight(d) : 0), 0) : 0;
          return { p, fresh, after: b.free === undefined ? undefined : b.free + back - fresh, before: b.free === undefined ? undefined : b.free + back };
        });
  const valid = days.length > 0 && (mode === 'cover' || persons.length > 0);
  const verb = VERB[mode];

  const commit = () => {
    const tt = title.trim() || undefined;
    withUndo(editing ? 'Urlaub geändert' : `${verb} eingetragen`, () => {
      if (editing) setPresenceRange([editing.person], editing.start, editing.end, 'office', { onlyMode: 'vacation' });
      if (mode === 'care' || mode === 'cover') applyToDays(days, { type: mode, persons, title: tt });
      else applyToDays(days, { type: 'presence', persons, mode, title: tt, away: mode === 'vacation' ? away : undefined });
    });
    haptic('success');
    reset();
  };
  const remove = () => {
    if (!editing) return;
    withUndo('Urlaub gelöscht', () => setPresenceRange([editing.person], editing.start, editing.end, 'office', { onlyMode: 'vacation' }));
    reset();
  };

  const rangeText =
    selMode === 'single'
      ? `${days.length} ${days.length === 1 ? 'Tag' : 'Tage'} gewählt`
      : rg.start && rg.end
        ? `${dayLabel(rg.start)} – ${dayLabel(rg.end)}`
        : rg.start
          ? `Start: ${dayLabel(rg.start)}`
          : '';
  const hint =
    selMode === 'single'
      ? 'Tage einzeln antippen – nochmal tippen entfernt sie.'
      : !rg.start
        ? 'Ersten Tag antippen, dann den letzten. Bestehenden Urlaub antippen zum Ändern. Langes Drücken: Tagesdetails.'
        : !rg.end
          ? 'Jetzt den letzten Tag antippen (oder direkt unten eintragen für einen einzelnen Tag).'
          : 'Zeitraum steht. Anderen Start antippen für eine neue Auswahl.';
  const ferien = hd.school.filter((s) => s.end >= `${year}-01-01` && s.start <= `${year}-12-31` && s.end > s.start);
  const panel = days.length > 0 || !!editing;

  return (
    <div class={`page ${panel ? 'has-panel' : ''}`}>
      <div class="nav">
        <button class="icon-btn" onClick={() => { setYear(year - 1); reset(); }} aria-label="Vorjahr"><Ic n="left" size={22} /></button>
        <div class="nav-title"><strong>{year}</strong><span>Jahresplaner</span></div>
        <button class="icon-btn" onClick={() => { setYear(year + 1); reset(); }} aria-label="Nächstes Jahr"><Ic n="right" size={22} /></button>
        <button class="btn small today-btn" onClick={toToday}><Ic n="today" size={15} /> Heute</button>
      </div>

      {!readOnly && <div class="plan-hint">
        <span>{hint}</span>
        <Chips<'range' | 'single'> options={[{ value: 'range', label: 'Zeitraum' }, { value: 'single', label: 'Einzelne Tage' }]} value={[selMode]} onChange={(v) => { setSelMode(v[0]); reset(); }} />
      </div>}

      {!readOnly && (ferien.length > 0 || bridges.length > 0) && (
        <div class="chips scroll quick-pick">
          {ferien.map((h) => <button key={h.name + h.start} class="chip" onClick={() => pickRange(h.start, h.end)}><Ic n="school" size={14} /> {h.name} {fmtShort(h.start)}–{fmtShort(h.end)}</button>)}
          {[...bridges].sort((a, b) => b.total / b.cost - a.total / a.cost).slice(0, 8).map((b) => (
            <button key={b.gapStart} class="chip" onClick={() => pickRange(b.gapStart, b.gapEnd)}>
              <Ic n="bridge" size={14} /> {fmtShort(b.gapStart)}{b.gapEnd !== b.gapStart ? `–${fmtShort(b.gapEnd)}` : ''} ({fmtDays(b.cost)} → {b.total} frei)
            </button>
          ))}
        </div>
      )}

      <section class="card gaps">
        <header class="card-head link-row" onClick={() => setGapsOpen(!gapsOpen)}>
          <strong><Ic n={gapsOpen ? 'down' : 'right'} size={15} /> Offene Betreuung</strong>
          <span class={`pill ${gaps.length ? 'pill-gap' : 'pill-ok'}`}>{gaps.length ? `${gaps.length} Zeiträume` : 'alles geklärt'}</span>
        </header>
        {gapsOpen && gaps.length === 0 && <div class="line">Für {year} ist jeder Betreuungstag abgedeckt.</div>}
        {gapsOpen && gaps.map((r) => (
          <div key={r.start} class="line link-row" onClick={() => !readOnly && pickRange(r.start, r.end)}>
            <span class="grow"><b>{fmtRange(r.start, r.end)}</b> · {r.who} · {r.why}</span>
            {!readOnly && <span class="btn small">markieren</span>}
          </div>
        ))}
      </section>

      <div class="legend">
        <span><i class="lamp lamp-gap" /> Betreuung offen</span>
        <span><i class="lamp lamp-maybe" /> nur Homeoffice</span>
        <span><i class="lamp lamp-ok" /> gesichert</span>
        <span><i class="sw sw-school" /> Ferien</span>
        <span><i class="sw sw-holiday" /> Feiertag</span>
        <span><i class="sw sw-bridge" /> Brückentag</span>
        <span><i class="sw sw-stripe" /> Urlaub je Person · blass = Dienstreise</span>
        <span><i class="mk-leg mk-b" /> Geburtstag</span>
        <span><i class="mk-leg mk-t" /> Aufgabe fällig <i class="mk-leg mk-t late" /> überfällig</span>
        <span><i class="mk-leg mk-e" /> Termin</span>
      </div>

      <div class="months">
        {Array.from({ length: 12 }, (_, m) => (
          <MonthGrid key={m} year={year} month={m} cal={cal} bridges={bridgeDays} selected={selected} edges={edges} bands={bands} layers={settings.layers} onDay={tap} onLong={openDay} />
        ))}
      </div>

      {panel && (
        <aside class="plan-panel">
          <div class="pp-top">
            <div>
              {editing && <div class="pp-edit"><Ic n="edit" size={12} /> Urlaub {PERSONS[editing.person].name} ändern</div>}
              <b class="pp-range">{rangeText || 'Zeitraum wählen'}</b>
              <div class="pp-sub">
                {days.length > 0 && <span><b>{fmtDays(weight)}</b> {mode === 'vacation' ? 'Urlaubstage' : 'Arbeitstage'} · {days.length} Kalendertage</span>}
                {effects.map((e) => (
                  <span key={e.p} class="eff"><i class="dot" style={{ background: PERSONS[e.p].color }} />{PERSONS[e.p].name}: {e.after === undefined ? `${fmtDays(e.fresh)} Tage` : <>Rest {fmtDays(e.before!)} → <b class={e.after < 0 ? 'neg' : ''}>{fmtDays(e.after)}</b></>}</span>
                ))}
              </div>
            </div>
            <button class="icon-btn" onClick={reset} aria-label="Auswahl verwerfen"><Ic n="x" size={16} /></button>
          </div>

          <Chips<PersonId> options={opt(peopleFor(mode))} value={persons} onChange={setPersons} multi />

          {more && (
            <div class="pp-more">
              <label>Was?</label>
              <Chips<PlanMode> options={MODES} value={[mode]} onChange={(v) => setMode(v[0])} />
              {mode === 'care' && (
                <div class="chips tight">
                  {CARE_PRESETS.map((p) => <button key={p.label} class={`chip ${title === p.label ? 'on' : ''}`} onClick={() => { setTitle(p.label); setPersons([p.child]); }}>{p.label}</button>)}
                </div>
              )}
              {mode !== 'homeoffice' && mode !== 'office' && (
                <input class="foot-input" type="text" placeholder={mode === 'cover' ? 'Wer übernimmt? z. B. Oma' : mode === 'care' ? 'Bezeichnung (z. B. Schließtag Kita)' : 'Ziel / Notiz (optional), z. B. Ostsee'} value={title} onInput={(e) => setTitle((e.target as HTMLInputElement).value)} />
              )}
              {mode === 'vacation' && <label class="check small"><input type="checkbox" checked={away} onChange={(e) => setAway((e.target as HTMLInputElement).checked)} /> verreist (kann keine Betreuung übernehmen)</label>}
            </div>
          )}

          <div class="actions">
            <button class="btn small" onClick={() => setMore(!more)}>{more ? <>Weniger <Ic n="up" size={14} /></> : <>{MODES.find((x) => x.value === mode)!.label} <Ic n="down" size={14} /></>}</button>
            {editing && <button class="btn danger small" onClick={remove}>Löschen</button>}
            {days.length === 1 && !editing && <button class="btn small" onClick={() => openDay(days[0])}>Details</button>}
            <span class="grow" />
            <button class="btn primary" disabled={!valid} onClick={commit}>{editing ? 'Speichern' : `${verb} eintragen`}</button>
          </div>
        </aside>
      )}
    </div>
  );
}
