import { useUiState } from '../resume';
import { ALL, CHILDREN, MODE_LABEL, PARENTS, PERSONS, RECUR_LABEL, SUB_LABEL, type EventSub, type Item, type Kind, type Mode, type PersonId, type Recur } from '../core/types';
import { deleteItem, newId, saveItem, useStore, withUndo } from '../store';
import { describeChange } from '../core/describe';
import { Overlap } from './Overlap';
import { addDays, diff, today } from '../core/dates';
import { Chips, DateInput, Sheet } from './common';
import { Ic, type IconName } from './icons';

export const KINDS: { kind: Exclude<Kind, 'config' | 'shop'>; short: string; label: string; icon: IconName; hint: string }[] = [
  { kind: 'presence', short: 'Eintrag', label: 'Urlaub / Dienstreise / Homeoffice', icon: 'palm', hint: 'Wer ist anwesend?' },
  { kind: 'care', short: 'Betreuungsbedarf', label: 'Betreuungsbedarf', icon: 'baby', hint: 'Schließtag Kita/Schule, krank …' },
  { kind: 'event', short: 'Termin', label: 'Termin', icon: 'addcal', hint: 'Arzt, Klassenarbeit, Elternabend' },
  { kind: 'task', short: 'Aufgabe', label: 'Aufgabe', icon: 'tasks', hint: 'mit Fälligkeit' },
  { kind: 'cover', short: 'Betreuung', label: 'Betreuung durch Dritte', icon: 'hand', hint: 'Oma, Freunde …' },
  { kind: 'info', short: 'Event', label: 'Event', icon: 'ticket', hint: 'Festival, Konzert, Veranstaltung – zuhause oder auswärts' },
  { kind: 'birthday', short: 'Geburtstag', label: 'Geburtstag', icon: 'cake', hint: 'jährlich' },
];

const personOpts = (list: PersonId[]) => list.map((p) => ({ value: p, label: PERSONS[p].name, color: PERSONS[p].color }));
const CARE_PRESETS: { label: string; child?: PersonId }[] = [
  { label: 'Schließtag Kita', child: 'irma' },
  { label: 'Schließtag Schule', child: 'ida' },
  { label: 'Krank' },
  { label: 'Sonstiges' },
];

export function KindPicker({ onPick, onClose, onShop }: { onPick: (k: Kind) => void; onClose: () => void; onShop: () => void }) {
  return (
    <Sheet title="Neuer Eintrag" onClose={onClose}>
      <div class="kinds">
        <button class="kind" onClick={onShop}>
          <span class="ic"><Ic n="cart" size={24} /></span>
          <span><b>Artikel zur Einkaufsliste</b><small>direkt eintippen</small></span>
        </button>
        {KINDS.map((k) => (
          <button key={k.kind} class="kind" onClick={() => onPick(k.kind)}>
            <span class="ic"><Ic n={k.icon} size={24} /></span>
            <span><b>{k.label}</b><small>{k.hint}</small></span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

export function EditSheet({ initial, onClose }: { initial: Partial<Item> & { kind: Kind }; onClose: () => void }) {
  const { settings } = useStore();
  const isNew = !initial.id;
  const k = initial.kind;
  // Entwurf wird laufend gesichert: Wechselt man kurz in eine andere App und Android startet den Planer neu, ist die Eingabe noch da.
  const [d, setD] = useUiState<Item>('edit', () => ({
    id: initial.id ?? newId(),
    updated: 0,
    start: initial.start ?? today(),
    end: initial.end ?? initial.start ?? today(),
    persons: initial.persons ?? (k === 'presence' ? [settings.me] : []),
    mode: k === 'presence' ? (initial.mode ?? 'vacation') : initial.mode,
    owner: initial.owner ?? null,
    sub: k === 'event' ? (initial.sub ?? 'arzt') : initial.sub,
    ...initial,
    kind: k,
  }), { clearOnUnmount: true, accept: (x) => x.kind === k && (initial.id ? x.id === initial.id : !x.created) });
  const set = (patch: Partial<Item>) => setD((x) => ({ ...x, ...patch }));
  // Termine: eintägig, mehrtägig (Festival, Ausflug) oder wiederkehrend (dann ist end das Serienende)
  const multi = k === 'event' && !d.recur && d.end > d.start;
  const single = (k === 'event' && !multi) || k === 'task' || k === 'birthday';
  const info = KINDS.find((x) => x.kind === k)!;
  const what = k === 'presence' && d.mode ? MODE_LABEL[d.mode] : info.short;

  const valid = (() => {
    if (['event', 'task', 'birthday', 'info'].includes(k) && !d.title?.trim()) return false;
    if (k === 'care' && !d.persons.some((p) => CHILDREN.includes(p))) return false;
    if (k === 'presence' && (!d.persons.length || !d.mode)) return false;
    return d.end >= d.start;
  })();

  const save = () => {
    const clean = (v?: string) => v?.trim() || undefined;
    const out: Item = { ...d, title: clean(d.title), place: clean(d.place), contact: clean(d.contact), link: clean(d.link), end: single ? d.start : d.end };
    if (k !== 'event') delete out.endTime;
    if (k !== 'event' && k !== 'info') {
      delete out.place;
      delete out.contact;
      delete out.link;
    }
    if (k !== 'presence') delete out.mode;
    if (!(k === 'presence' && d.mode === 'vacation') && k !== 'info') delete out.away;
    if (k === 'info' && !out.away) delete out.away;
    if (k !== 'event' || !out.recur) delete out.recur;
    // Bestätigung: was genau gespeichert wurde, mit „Rückgängig“
    withUndo(`${what} ${isNew ? 'gespeichert' : 'geändert'}`, () => saveItem(out), describeChange({ ...out, updated: 0 })?.text);
    onClose();
  };
  const remove = () => {
    withUndo(`${what} gelöscht`, () => deleteItem(d.id), describeChange({ ...d, updated: 0 })?.text);
    onClose();
  };

  return (
    <Sheet title={`${isNew ? '' : 'Bearbeiten: '}${info.label}`} onClose={onClose}>
      <div class="form">
        {k === 'presence' && (
          <>
            <label>Art</label>
            <Chips<Mode> options={(['vacation', 'trip', 'homeoffice'] as Mode[]).map((m) => ({ value: m, label: MODE_LABEL[m] }))} value={d.mode ? [d.mode] : []} onChange={(v) => set({ mode: v[0] })} />
            <label>Wer?</label>
            <Chips<PersonId> options={personOpts(ALL)} value={d.persons} onChange={(persons) => set({ persons })} multi />
            {d.persons.some((p) => CHILDREN.includes(p)) && <p class="hint">Kinder mit im Urlaub → sie brauchen in dieser Zeit keine Betreuung.</p>}
            {d.mode === 'vacation' && (
              <label class="check"><input type="checkbox" checked={!!d.away} onChange={(e) => set({ away: (e.target as HTMLInputElement).checked })} /> verreist (nicht vor Ort, kann keine Betreuung übernehmen)</label>
            )}
          </>
        )}

        {k === 'care' && (
          <>
            <label>Was?</label>
            <Chips<string>
              options={CARE_PRESETS.map((p) => ({ value: p.label, label: p.label }))}
              value={d.title ? [d.title] : []}
              onChange={(v) => {
                const p = CARE_PRESETS.find((x) => x.label === v[0]);
                set({ title: v[0], persons: p?.child ? [p.child] : d.persons });
              }}
            />
            <label>Welches Kind?</label>
            <Chips<PersonId> options={personOpts(CHILDREN)} value={d.persons} onChange={(persons) => set({ persons })} multi />
          </>
        )}

        {k === 'cover' && (
          <>
            <label>Wer übernimmt?</label>
            <input type="text" placeholder="z. B. Oma, Nachbarin" value={d.title ?? ''} onInput={(e) => set({ title: (e.target as HTMLInputElement).value })} />
            <label>Für welches Kind? (leer = alle)</label>
            <Chips<PersonId> options={personOpts(CHILDREN)} value={d.persons} onChange={(persons) => set({ persons })} multi />
          </>
        )}

        {k === 'event' && (
          <>
            <label>Art</label>
            <Chips<EventSub> options={(Object.keys(SUB_LABEL) as EventSub[]).map((s) => ({ value: s, label: SUB_LABEL[s] }))} value={d.sub ? [d.sub] : []} onChange={(v) => set({ sub: v[0] })} />
            <label>Titel</label>
            <input type="text" placeholder="z. B. Kinderarzt U8" value={d.title ?? ''} onInput={(e) => set({ title: (e.target as HTMLInputElement).value })} />
            <label>Betrifft</label>
            <Chips<PersonId> options={personOpts(ALL)} value={d.persons} onChange={(persons) => set({ persons })} multi />
            {d.sub !== 'schule' && (
              <>
                <label>Wer kümmert sich?</label>
                <Chips<string> options={[...personOpts(PARENTS), { value: '', label: 'noch offen' }]} value={[d.owner ?? '']} onChange={(v) => set({ owner: (v[0] || null) as PersonId | null })} />
              </>
            )}
            <label>Wiederholung</label>
            <Chips<string>
              options={[{ value: '', label: 'keine' }, ...(Object.keys(RECUR_LABEL) as Recur[]).map((r) => ({ value: r, label: RECUR_LABEL[r] }))]}
              value={[d.recur ?? '']}
              onChange={(v) => set({ recur: (v[0] || undefined) as Recur | undefined, end: d.start })}
            />
            {!d.recur && (
              <label class="check"><input type="checkbox" checked={multi} onChange={(e) => set({ end: (e.target as HTMLInputElement).checked ? addDays(d.start, 1) : d.start })} /> mehrtägig (z. B. Festival, Ausflug, Klassenfahrt)</label>
            )}
            {d.recur && d.end <= d.start && <p class="hint">Ohne Enddatum wiederholt sich der Termin bis zum Anzeigelimit (400 Tage ab erstem Vorkommen).</p>}
          </>
        )}

        {k === 'task' && (
          <>
            <label>Aufgabe</label>
            <input type="text" placeholder="z. B. Geschenk besorgen" value={d.title ?? ''} onInput={(e) => set({ title: (e.target as HTMLInputElement).value })} />
            <label>Zuständig</label>
            <Chips<string> options={[...personOpts(PARENTS), { value: '', label: 'offen' }]} value={[d.owner ?? '']} onChange={(v) => set({ owner: (v[0] || null) as PersonId | null })} />
            <label class="check"><input type="checkbox" checked={!!d.done} onChange={(e) => set({ done: (e.target as HTMLInputElement).checked })} /> erledigt</label>
          </>
        )}

        {k === 'info' && (
          <>
            <label>Titel</label>
            <input type="text" placeholder="z. B. Stadtfest, Festival, Konzert" value={d.title ?? ''} onInput={(e) => set({ title: (e.target as HTMLInputElement).value })} />
            <label>Wo?</label>
            <Chips<string>
              options={[
                { value: 'home', label: <><Ic n="home" size={15} /> zuhause / vor Ort</> },
                { value: 'away', label: <><Ic n="luggage" size={15} /> auswärts</> },
              ]}
              value={[d.away ? 'away' : 'home']}
              onChange={(v) => set({ away: v[0] === 'away' })}
            />
            <label>Wen betrifft es? (leer = Familie)</label>
            <Chips<PersonId> options={personOpts(ALL)} value={d.persons} onChange={(persons) => set({ persons })} multi />
          </>
        )}

        {k === 'birthday' && (
          <>
            <label>Wer hat Geburtstag?</label>
            <input type="text" placeholder="z. B. Oma Helga" value={d.title ?? ''} onInput={(e) => set({ title: (e.target as HTMLInputElement).value })} />
            <p class="hint">Geburtsdatum inkl. Jahr eintragen (auch als Text, z. B. 7.5.1955) – das Jahr wird nur für die Altersanzeige verwendet; im Kalender zählt weiterhin nur Tag/Monat.</p>
          </>
        )}

        {k === 'presence' && (
          <>
            <label>Ziel / Notiz (optional)</label>
            <input type="text" placeholder="z. B. Ostsee, Messe Köln" value={d.title ?? ''} onInput={(e) => set({ title: (e.target as HTMLInputElement).value })} />
          </>
        )}

        <div class="row">
          <div>
            <label>{single ? (k === 'task' ? 'Fällig am' : k === 'birthday' ? 'Geburtsdatum' : 'Datum') : 'Von'}</label>
            <DateInput value={d.start} onChange={(v) => set({ start: v, end: multi ? addDays(v, diff(d.start, d.end)) : d.end < v ? v : d.end })} />
            {diff(d.start, d.end) > 400 && <p class="hint neg">Zeitraum länger als 400 Tage – ab Tag 401 wird der Eintrag nicht mehr angezeigt.</p>}
          </div>
          {!single && (
            <div>
              <label>Bis (einschließlich)</label>
              <DateInput value={d.end} min={k === 'event' ? addDays(d.start, 1) : d.start} onChange={(v) => set({ end: v })} />
            </div>
          )}
          {k === 'event' && (
            <div>
              <label>{multi ? 'Beginn (Uhr)' : 'Uhrzeit'}</label>
              <input type="time" value={d.time ?? ''} onInput={(e) => set({ time: (e.target as HTMLInputElement).value || undefined })} />
            </div>
          )}
          {k === 'event' && (
            <div>
              <label>{multi ? 'Ende am letzten Tag (Uhr)' : 'Bis (Uhr, optional)'}</label>
              <input type="time" value={d.endTime ?? ''} onInput={(e) => set({ endTime: (e.target as HTMLInputElement).value || undefined })} />
            </div>
          )}
        </div>

        {k !== 'birthday' && <Overlap start={d.start} end={single ? d.start : d.end} excludeId={d.id} />}

        {(k === 'event' || k === 'info') && (
          <>
            <label>Ort (optional)</label>
            <input type="text" placeholder="z. B. Praxis Dr. Müller, Markt 3" value={d.place ?? ''} onInput={(e) => set({ place: (e.target as HTMLInputElement).value })} />
            <label>Kontakt / Telefon (optional)</label>
            <input type="text" placeholder="z. B. Frau Meier 0371 123456" value={d.contact ?? ''} onInput={(e) => set({ contact: (e.target as HTMLInputElement).value })} />
            <label>Link (optional)</label>
            <input type="text" inputMode="url" placeholder="https://…" value={d.link ?? ''} onInput={(e) => set({ link: (e.target as HTMLInputElement).value })} />
          </>
        )}

        {k !== 'birthday' && (
          <>
            <label>Notiz / ergänzende Infos (optional)</label>
            <textarea rows={2} value={d.note ?? ''} onInput={(e) => set({ note: (e.target as HTMLTextAreaElement).value || undefined })} />
          </>
        )}
      </div>

      <div class="actions sticky">
        {!isNew && <button class="btn danger" onClick={remove}>Löschen</button>}
        <span class="grow" />
        <button class="btn" onClick={onClose}>Abbrechen</button>
        <button class="btn primary" disabled={!valid} onClick={save}>Speichern</button>
      </div>
      {!isNew && d.by && <p class="hint">Zuletzt geändert von {PERSONS[d.by].name}</p>}
    </Sheet>
  );
}
