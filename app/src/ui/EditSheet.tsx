import { useState } from 'preact/hooks';
import { ALL, CHILDREN, MODE_LABEL, PARENTS, PERSONS, SUB_LABEL, type EventSub, type Item, type Kind, type Mode, type PersonId } from '../core/types';
import { deleteItem, newId, saveItem, useStore } from '../store';
import { today } from '../core/dates';
import { Chips, Sheet } from './common';

export const KINDS: { kind: Exclude<Kind, 'config'>; label: string; icon: string; hint: string }[] = [
  { kind: 'presence', label: 'Urlaub / Dienstreise / Homeoffice', icon: '🌴', hint: 'Wer ist anwesend?' },
  { kind: 'care', label: 'Betreuungsbedarf', icon: '🧒', hint: 'Schließtag Kita/Schule, krank …' },
  { kind: 'event', label: 'Termin', icon: '📌', hint: 'Arzt, Klassenarbeit, Elternabend' },
  { kind: 'task', label: 'Aufgabe', icon: '☑', hint: 'mit Fälligkeit' },
  { kind: 'cover', label: 'Betreuung durch Dritte', icon: '🤝', hint: 'Oma, Freunde …' },
  { kind: 'info', label: 'Info (Festival, Veranstaltung)', icon: 'ℹ️', hint: 'nur zur Orientierung' },
  { kind: 'birthday', label: 'Geburtstag', icon: '🎂', hint: 'jährlich' },
];

const personOpts = (list: PersonId[]) => list.map((p) => ({ value: p, label: PERSONS[p].name, color: PERSONS[p].color }));
const CARE_PRESETS: { label: string; child?: PersonId }[] = [
  { label: 'Schließtag Kita', child: 'irma' },
  { label: 'Schließtag Schule', child: 'ida' },
  { label: 'Krank' },
  { label: 'Sonstiges' },
];

export function KindPicker({ onPick, onClose }: { onPick: (k: Kind) => void; onClose: () => void }) {
  return (
    <Sheet title="Neuer Eintrag" onClose={onClose}>
      <div class="kinds">
        {KINDS.map((k) => (
          <button key={k.kind} class="kind" onClick={() => onPick(k.kind)}>
            <span class="ic">{k.icon}</span>
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
  const [d, setD] = useState<Item>(() => ({
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
  }));
  const set = (patch: Partial<Item>) => setD((x) => ({ ...x, ...patch }));
  const single = k === 'event' || k === 'task' || k === 'birthday';
  const info = KINDS.find((x) => x.kind === k)!;

  const valid = (() => {
    if (['event', 'task', 'birthday', 'info'].includes(k) && !d.title?.trim()) return false;
    if (k === 'care' && !d.persons.some((p) => CHILDREN.includes(p))) return false;
    if (k === 'presence' && (!d.persons.length || !d.mode)) return false;
    return d.end >= d.start;
  })();

  const save = () => {
    const out: Item = { ...d, title: d.title?.trim() || undefined, end: single ? d.start : d.end };
    if (k !== 'presence') delete out.mode;
    if (!(k === 'presence' && d.mode === 'vacation')) delete out.away;
    saveItem(out);
    onClose();
  };

  return (
    <Sheet title={`${info.icon} ${isNew ? '' : 'Bearbeiten: '}${info.label}`} onClose={onClose}>
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
            <input type="text" placeholder="z. B. Stadtfest, Festival" value={d.title ?? ''} onInput={(e) => set({ title: (e.target as HTMLInputElement).value })} />
            <label>Wen betrifft es? (leer = Familie)</label>
            <Chips<PersonId> options={personOpts(ALL)} value={d.persons} onChange={(persons) => set({ persons })} multi />
          </>
        )}

        {k === 'birthday' && (
          <>
            <label>Wer hat Geburtstag?</label>
            <input type="text" placeholder="z. B. Oma Helga" value={d.title ?? ''} onInput={(e) => set({ title: (e.target as HTMLInputElement).value })} />
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
            <label>{single ? (k === 'task' ? 'Fällig am' : 'Datum') : 'Von'}</label>
            <input type="date" value={d.start} onInput={(e) => { const v = (e.target as HTMLInputElement).value; if (v) set({ start: v, end: d.end < v ? v : d.end }); }} />
          </div>
          {!single && (
            <div>
              <label>Bis (einschließlich)</label>
              <input type="date" value={d.end} min={d.start} onInput={(e) => { const v = (e.target as HTMLInputElement).value; if (v) set({ end: v }); }} />
            </div>
          )}
          {k === 'event' && (
            <div>
              <label>Uhrzeit</label>
              <input type="time" value={d.time ?? ''} onInput={(e) => set({ time: (e.target as HTMLInputElement).value || undefined })} />
            </div>
          )}
        </div>

        {k !== 'birthday' && k !== 'task' && (
          <>
            <label>Notiz (optional)</label>
            <textarea rows={2} value={d.note ?? ''} onInput={(e) => set({ note: (e.target as HTMLTextAreaElement).value || undefined })} />
          </>
        )}
      </div>

      <div class="actions sticky">
        {!isNew && <button class="btn danger" onClick={() => { deleteItem(d.id); onClose(); }}>Löschen</button>}
        <span class="grow" />
        <button class="btn" onClick={onClose}>Abbrechen</button>
        <button class="btn primary" disabled={!valid} onClick={save}>Speichern</button>
      </div>
      {!isNew && d.by && <p class="hint">Zuletzt geändert von {PERSONS[d.by].name}</p>}
    </Sheet>
  );
}
