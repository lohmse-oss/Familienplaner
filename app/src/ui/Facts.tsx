import { useState } from 'preact/hooks';
import { ALL, FACT_CAT_LABEL, PERSONS, type FactCat, type Item, type PersonId } from '../core/types';
import { useUiState } from '../resume';
import { deleteItem, newId, saveItem, useStore, withUndo } from '../store';
import { Chips, PersonTag, Sheet } from './common';
import { Details } from './Details';
import { Ic } from './icons';

const CATS = Object.keys(FACT_CAT_LABEL) as FactCat[];
const nowIso = () => new Date().toISOString().slice(0, 10);

/**
 * Familien-Infomappe: Kinderarzt, Kita-Telefon, Größen, Impftermine … als Karten nach Kategorien.
 * Karten mit „nur Eltern“ sind im Lesezugriff (z. B. Ida) ausgeblendet.
 */
export function Facts({ open }: { open: (it?: Item) => void }) {
  const { items, readOnly } = useStore();
  const [cat, setCat] = useUiState<FactCat | 'all'>('facts.cat', 'all');
  const facts = items.filter((i) => i.kind === 'fact' && !i.deleted && !(readOnly && i.private)).sort((a, b) => (a.title ?? '').localeCompare(b.title ?? '', 'de'));
  const used = CATS.filter((c) => facts.some((f) => (f.cat ?? 'sonstiges') === c));
  const shown = cat === 'all' ? used : used.filter((c) => c === cat);

  return (
    <div class="page narrow">
      {used.length > 1 && (
        <div class="chips scroll">
          <button class={`chip ${cat === 'all' ? 'on' : ''}`} onClick={() => setCat('all')}>Alle</button>
          {used.map((c) => <button key={c} class={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{FACT_CAT_LABEL[c]}</button>)}
        </div>
      )}
      {facts.length === 0 && (
        <section class="card">
          <div class="empty">
            <Ic n="folder" size={26} /><br />Die Infomappe ist leer.
            <br /><span class="muted">Kinderarzt, Kita- und Hort-Telefon, Größen, Impftermine, Versicherungen – alles an einem Ort, auf beiden Handys.</span>
            {!readOnly && <div><button class="btn small" onClick={() => open()}><Ic n="plus" size={14} /> Erste Karte anlegen</button></div>}
          </div>
        </section>
      )}
      {shown.map((c) => (
        <section key={c} class="card">
          <header class="card-head"><strong>{FACT_CAT_LABEL[c]}</strong></header>
          {facts.filter((f) => (f.cat ?? 'sonstiges') === c).map((f) => (
            <div key={f.id} class="entry fact">
              <div class={`line ${readOnly ? '' : 'link-row'}`} onClick={() => !readOnly && open(f)}>
                <span class="grow"><b>{f.title}</b> {f.private && <Ic n="lock" size={13} class="muted" />}</span>
                {f.persons.map((p) => <PersonTag key={p} p={p} />)}
              </div>
              <Details it={f} />
            </div>
          ))}
        </section>
      ))}
      {!readOnly && facts.length > 0 && <p class="hint">Neue Karte: Startknopf lang drücken. <Ic n="lock" size={12} /> = nur für Eltern sichtbar.</p>}
    </div>
  );
}

export function FactSheet({ initial, onClose }: { initial?: Item; onClose: () => void }) {
  const isNew = !initial;
  const [d, setD] = useUiState<Item>(
    'fact',
    () => initial ?? { id: newId(), kind: 'fact', updated: 0, start: nowIso(), end: nowIso(), persons: [], cat: 'kontakt' },
    { clearOnUnmount: true, accept: (x) => (initial ? x.id === initial.id : !x.created) },
  );
  const [confirmDel, setConfirmDel] = useState(false);
  const set = (p: Partial<Item>) => setD((x) => ({ ...x, ...p }));
  const clean = (v?: string) => v?.trim() || undefined;
  const save = () => {
    const out: Item = { ...d, title: d.title!.trim(), note: clean(d.note), contact: clean(d.contact), link: clean(d.link), place: clean(d.place), private: d.private || undefined };
    withUndo(`Infomappe ${isNew ? 'ergänzt' : 'geändert'}`, () => saveItem(out), out.title);
    onClose();
  };

  return (
    <Sheet title={isNew ? 'Neue Karte (Infomappe)' : 'Karte bearbeiten'} onClose={onClose}>
      <div class="form">
        <label>Titel</label>
        <input type="text" placeholder="z. B. Kinderarzt Dr. Müller, Schuhgröße Ida" value={d.title ?? ''} onInput={(e) => set({ title: (e.target as HTMLInputElement).value })} />
        <label>Kategorie</label>
        <Chips<FactCat> options={CATS.map((c) => ({ value: c, label: FACT_CAT_LABEL[c] }))} value={[d.cat ?? 'sonstiges']} onChange={(v) => set({ cat: v[0] })} />
        <label>Wen betrifft es? (leer = Familie)</label>
        <Chips<PersonId> options={ALL.map((p) => ({ value: p, label: PERSONS[p].name, color: PERSONS[p].color }))} value={d.persons} onChange={(persons) => set({ persons })} multi />
        <label>Inhalt</label>
        <textarea rows={4} placeholder="z. B. Sprechzeiten Mo–Fr 8–12 Uhr · Größe 128 · nächste Impfung 03/2027" value={d.note ?? ''} onInput={(e) => set({ note: (e.target as HTMLTextAreaElement).value })} />
        <label>Telefon / Kontakt (optional)</label>
        <input type="text" placeholder="z. B. 0371 123456" value={d.contact ?? ''} onInput={(e) => set({ contact: (e.target as HTMLInputElement).value })} />
        <label>Adresse (optional)</label>
        <input type="text" placeholder="z. B. Markt 3, Chemnitz" value={d.place ?? ''} onInput={(e) => set({ place: (e.target as HTMLInputElement).value })} />
        <label>Link (optional)</label>
        <input type="text" inputMode="url" placeholder="https://…" value={d.link ?? ''} onInput={(e) => set({ link: (e.target as HTMLInputElement).value })} />
        <label class="check"><input type="checkbox" checked={!!d.private} onChange={(e) => set({ private: (e.target as HTMLInputElement).checked })} /> <Ic n="lock" size={14} /> nur Eltern (im Lesezugriff ausgeblendet)</label>
        <p class="hint">Die Mappe wird wie alle Einträge über euren Server abgeglichen. „Nur Eltern“ blendet die Karte in der App aus – gespeichert ist sie trotzdem dort.</p>
      </div>
      <div class="actions sticky">
        {!isNew && (confirmDel
          ? <button class="btn danger" onClick={() => { withUndo('Karte gelöscht', () => deleteItem(d.id), d.title); onClose(); }}>Wirklich löschen</button>
          : <button class="btn danger" onClick={() => setConfirmDel(true)}>Löschen</button>)}
        <span class="grow" />
        <button class="btn" onClick={onClose}>Abbrechen</button>
        <button class="btn primary" disabled={!d.title?.trim()} onClick={save}>Speichern</button>
      </div>
    </Sheet>
  );
}
