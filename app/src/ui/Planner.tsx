import { useMemo, useState } from 'preact/hooks';
import { findBridges } from '../core/bridges';
import { fmtDays, fmtShort, planningYear, range, today } from '../core/dates';
import { budget } from '../core/report';
import { ALL, CHILDREN, PARENTS, PERSONS, type PersonId } from '../core/types';
import { applyToDays, useStore } from '../store';
import { Chips, Sheet } from './common';
import { MonthGrid } from './MonthGrid';

type PlanMode = 'vacation' | 'homeoffice' | 'trip' | 'office' | 'care' | 'cover';
const MODES: { value: PlanMode; label: string }[] = [
  { value: 'vacation', label: '🌴 Urlaub' },
  { value: 'homeoffice', label: '🏠 Homeoffice' },
  { value: 'trip', label: '✈️ Dienstreise' },
  { value: 'office', label: '🏢 Büro (zurücksetzen)' },
  { value: 'care', label: '🧒 Schließtag / Betreuung nötig' },
  { value: 'cover', label: '🤝 Betreuung durch Dritte' },
];
const CARE_PRESETS: { label: string; child: PersonId }[] = [
  { label: 'Schließtag Kita', child: 'irma' },
  { label: 'Schließtag Schule', child: 'ida' },
];
const opt = (ids: PersonId[]) => ids.map((p) => ({ value: p, label: PERSONS[p].name, color: PERSONS[p].color }));

interface Props {
  initial?: string[]; // vorgewählte Tage
  mode?: PlanMode;
  persons?: PersonId[];
  year?: number; // anfangs angezeigtes Jahr
  onClose: () => void;
}

/**
 * Mehrfachauswahl von Tagen für Urlaub, Homeoffice, Dienstreise, Schließtage …
 * „Zeitraum“: ersten und letzten Tag tippen. „Einzelne Tage“: jeden Tag einzeln an-/abwählen.
 */
export function Planner({ initial = [], mode: mode0 = 'vacation', persons: persons0, year: year0, onClose }: Props) {
  const { cal, settings, hd } = useStore();
  const t = today();
  const [year, setYear] = useState(initial[0] ? Number(initial[0].slice(0, 4)) : (year0 ?? planningYear()));
  const [sel, setSel] = useState<Set<string>>(new Set(initial));
  const [anchor, setAnchor] = useState<string | null>(null);
  const [selMode, setSelMode] = useState<'range' | 'single'>('range');
  const [mode, setModeRaw] = useState<PlanMode>(mode0);
  const [persons, setPersons] = useState<PersonId[]>(persons0 ?? [settings.me]);
  const [title, setTitle] = useState('');
  const [away, setAway] = useState(false);

  const bridges = useMemo(() => findBridges(cal, year), [cal, year]);
  const bridgeDays = useMemo(() => new Set(bridges.flatMap((b) => [...range(b.gapStart, b.gapEnd)])), [bridges]);
  const holidays = hd.school.filter((s) => s.start.startsWith(String(year)) && s.end > s.start);

  const forPeople = mode === 'care' || mode === 'cover' ? CHILDREN : mode === 'vacation' ? ALL : PARENTS;
  const setMode = (m: PlanMode) => {
    setModeRaw(m);
    const allowed = m === 'care' || m === 'cover' ? CHILDREN : m === 'vacation' ? ALL : PARENTS;
    setPersons((cur) => {
      const kept = cur.filter((p) => allowed.includes(p));
      if (kept.length || m === 'cover') return kept;
      return m === 'care' ? ['ida'] : [allowed.includes(settings.me) ? settings.me : 'sebastian'];
    });
  };

  const add = (days: string[]) => setSel((s) => new Set([...s, ...days]));
  const tap = (d: string) => {
    if (selMode === 'single') {
      setSel((s) => {
        const n = new Set(s);
        n.has(d) ? n.delete(d) : n.add(d);
        return n;
      });
    } else if (anchor) {
      const [a, b] = anchor <= d ? [anchor, d] : [d, anchor];
      add([...range(a, b)]);
      setAnchor(null);
    } else if (sel.has(d)) {
      setSel((s) => {
        const n = new Set(s);
        n.delete(d);
        return n;
      });
    } else {
      add([d]);
      setAnchor(d);
    }
  };
  const toggleSpan = (a: string, b: string) => {
    const days = [...range(a, b)];
    setSel((s) => {
      const n = new Set(s);
      const all = days.every((d) => n.has(d));
      for (const d of days) all ? n.delete(d) : n.add(d);
      return n;
    });
    setAnchor(null);
  };

  const days = [...sel].sort();
  const workdays = days.reduce((n, d) => n + cal.weight(d), 0);
  const valid = days.length > 0 && (mode === 'cover' || persons.length > 0);

  // Auswirkung auf das Urlaubskonto vorab zeigen
  const effects = mode !== 'vacation' || !days.length ? [] : persons.filter((p) => PARENTS.includes(p)).map((p) => {
    const y = Number(days[0].slice(0, 4));
    const b = budget(cal, p, y, t);
    const fresh = days.reduce((n, d) => n + (cal.day(d).parents[p].status !== 'vacation' ? cal.weight(d) : 0), 0);
    return { p, fresh, free: b.free };
  });

  const save = () => {
    const tt = title.trim() || undefined;
    if (mode === 'care' || mode === 'cover') applyToDays(days, { type: mode, persons, title: tt });
    else applyToDays(days, { type: 'presence', persons, mode, title: tt, away: mode === 'vacation' ? away : undefined });
    onClose();
  };

  const verb = { vacation: 'Urlaub', homeoffice: 'Homeoffice', trip: 'Dienstreise', office: 'Büro', care: 'Betreuungsbedarf', cover: 'Betreuung' }[mode];

  const footer = (
    <>
      <div class="sum-line">
        {days.length === 0 ? (
          <span class="muted">{selMode === 'range' ? (anchor ? `Jetzt den letzten Tag tippen (Start: ${fmtShort(anchor)})` : 'Ersten Tag antippen, dann den letzten Tag.') : 'Tage einzeln antippen.'}</span>
        ) : (
          <span><b>{days.length}</b> Tage gewählt · <b>{fmtDays(workdays)}</b> {mode === 'vacation' ? 'Urlaubstage' : 'Arbeitstage'}</span>
        )}
        {effects.map((e) => (
          <span key={e.p} class="eff">
            <i class="dot" style={{ background: PERSONS[e.p].color }} />
            {PERSONS[e.p].name}: {e.free === undefined ? `${fmtDays(e.fresh)} Tage` : `Rest ${fmtDays(e.free)} → `}
            {e.free !== undefined && <b class={e.free - e.fresh < 0 ? 'neg' : ''}>{fmtDays(e.free - e.fresh)}</b>}
          </span>
        ))}
      </div>
      {mode === 'care' && (
        <div class="chips tight">
          {CARE_PRESETS.map((p) => (
            <button key={p.label} class={`chip ${title === p.label ? 'on' : ''}`} onClick={() => { setTitle(p.label); setPersons([p.child]); }}>{p.label}</button>
          ))}
        </div>
      )}
      {(mode === 'vacation' || mode === 'care' || mode === 'cover' || mode === 'trip') && (
        <input class="foot-input" type="text" placeholder={mode === 'cover' ? 'Wer übernimmt? z. B. Oma' : mode === 'care' ? 'Bezeichnung (z. B. Schließtag Kita)' : mode === 'trip' ? 'Ziel (optional)' : 'Ziel (optional), z. B. Ostsee'} value={title} onInput={(e) => setTitle((e.target as HTMLInputElement).value)} />
      )}
      {mode === 'vacation' && (
        <label class="check small"><input type="checkbox" checked={away} onChange={(e) => setAway((e.target as HTMLInputElement).checked)} /> verreist (kann keine Betreuung übernehmen)</label>
      )}
      <div class="actions">
        <button class="btn" disabled={!days.length} onClick={() => { setSel(new Set()); setAnchor(null); }}>Auswahl leeren</button>
        <span class="grow" />
        <button class="btn primary" disabled={!valid} onClick={save}>{verb} eintragen</button>
      </div>
    </>
  );

  return (
    <Sheet title="Mehrere Tage eintragen" onClose={onClose} tall footer={footer}>
      <div class="form">
        <label>Was?</label>
        <Chips<PlanMode> options={MODES} value={[mode]} onChange={(v) => setMode(v[0])} />
        <label>{mode === 'cover' ? 'Für welches Kind? (leer = alle)' : mode === 'vacation' ? 'Wer? (Kinder mit = kein Betreuungsbedarf)' : 'Wer?'}</label>
        <Chips<PersonId> options={opt(forPeople)} value={persons} onChange={setPersons} multi />

        {(holidays.length > 0 || bridges.length > 0) && (
          <>
            <label>Vorschläge – antippen zum Auswählen</label>
            <div class="chips scroll">
              {holidays.map((h) => (
                <button key={h.name + h.start} class="chip" onClick={() => toggleSpan(h.start, h.end)}>
                  🏫 {h.name} {fmtShort(h.start)}–{fmtShort(h.end)}
                </button>
              ))}
              {[...bridges].sort((a, b) => b.total / b.cost - a.total / a.cost).slice(0, 8).map((b) => (
                <button key={b.gapStart} class="chip" onClick={() => toggleSpan(b.gapStart, b.gapEnd)}>
                  🌉 {fmtShort(b.gapStart)}{b.gapEnd !== b.gapStart ? `–${fmtShort(b.gapEnd)}` : ''} ({fmtDays(b.cost)} → {b.total} frei)
                </button>
              ))}
            </div>
          </>
        )}

        <label>Auswahl</label>
        <Chips<'range' | 'single'>
          options={[{ value: 'range', label: 'Zeitraum (von–bis)' }, { value: 'single', label: 'Einzelne Tage' }]}
          value={[selMode]}
          onChange={(v) => { setSelMode(v[0]); setAnchor(null); }}
        />
      </div>

      <div class="nav small">
        <button class="icon-btn" onClick={() => setYear(year - 1)} aria-label="Vorjahr">‹</button>
        <div class="nav-title"><strong>{year}</strong></div>
        <button class="icon-btn" onClick={() => setYear(year + 1)} aria-label="Nächstes Jahr">›</button>
      </div>
      <div class="months planner">
        {Array.from({ length: 12 }, (_, m) => (
          <MonthGrid key={m} year={year} month={m} cal={cal} bridges={bridgeDays} selected={sel} anchor={anchor} onDay={tap} />
        ))}
      </div>
      <p class="hint">Tipp: Wochenenden und Feiertage zählen nicht als Urlaubstage, der 24.12. und 31.12. zählen als halber Tag.</p>
    </Sheet>
  );
}

