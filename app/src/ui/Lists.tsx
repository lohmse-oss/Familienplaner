import { useEffect, useState } from 'preact/hooks';
import { PERSONS, type Item } from '../core/types';
import { haptic } from '../haptics';
import { useUiState } from '../resume';
import { addChecks, batch, createList, deleteList, resetList, saveItem, useStore } from '../store';
import { sheetStack } from './common';
import { Ic } from './icons';

const STARTER: { title: string; entries: string[] }[] = [
  {
    title: 'Packliste Urlaub',
    entries: ['Ausweise / Reisepässe', 'Versichertenkarten', 'Medikamente & Reiseapotheke', 'Ladekabel & Powerbank', 'Sonnencreme', 'Badesachen', 'Schlafanzüge', 'Wechselkleidung', 'Zahnbürsten & Kulturbeutel', 'Kuscheltiere', 'Bücher & Spiele für die Fahrt', 'Snacks & Getränke', 'Kühlschrank leeren', 'Müll raus', 'Fenster zu, Herd aus'],
  },
  {
    title: 'Festival',
    entries: ['Tickets / Bändchen', 'Ausweis', 'Bargeld', 'Zelt', 'Isomatte & Schlafsack', 'Regenjacke', 'Gummistiefel', 'Gehörschutz (Kinder: Kapselgehörschutz)', 'Powerbank', 'Sonnencreme & Kappe', 'Taschenlampe', 'Klopapier', 'Becher & Trinkflasche'],
  },
  {
    title: 'Ausflug mit Kindern',
    entries: ['Trinkflaschen', 'Brotdosen & Snacks', 'Wechselsachen', 'Sonnenhut / Mütze', 'Regenjacken', 'Pflaster', 'Taschentücher & Feuchttücher', 'Sonnencreme'],
  },
];

const byTs = (a: Item, b: Item) => (a.ts ?? 0) - (b.ts ?? 0);

/** Checklisten: aktive Listen (abhaken) und Vorlagen (wiederverwendbar, daraus eine aktive Liste starten). */
export function Lists() {
  const { items, readOnly } = useStore();
  const [openId, setOpenId] = useUiState<string | null>('lists.open', null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useUiState('lists.name', '');

  const lists = items.filter((i) => i.kind === 'list' && !i.deleted).sort(byTs);
  const checks = items.filter((i) => i.kind === 'check' && !i.deleted);
  const entriesOf = (id: string) => checks.filter((c) => c.parent === id).sort(byTs);
  const cur = openId ? lists.find((l) => l.id === openId) : undefined;
  if (cur) return <ListDetail list={cur} entries={entriesOf(cur.id)} close={() => setOpenId(null)} open={setOpenId} />;

  const active = lists.filter((l) => !l.template);
  const templates = lists.filter((l) => l.template);
  const make = (template: boolean) => {
    const id = createList(name, template);
    setName('');
    setCreating(false);
    setOpenId(id);
  };
  const starter = () =>
    batch(() => {
      for (const s of STARTER) {
        const id = createList(s.title, true);
        addChecks(id, s.entries.join('\n'), false);
      }
    });
  const start = (tpl: Item) => {
    haptic();
    setOpenId(createList(tpl.title ?? '', false, tpl.id));
  };

  return (
    <div class="page narrow">
      {!readOnly && (creating ? (
        <section class="card">
          <label>Name</label>
          <input type="text" autoFocus placeholder="z. B. Packliste Ostsee" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
          <div class="actions">
            <button class="btn" onClick={() => setCreating(false)}>Abbrechen</button>
            <span class="grow" />
            <button class="btn" onClick={() => make(true)}>Als Vorlage</button>
            <button class="btn primary" onClick={() => make(false)}>Checkliste anlegen</button>
          </div>
        </section>
      ) : (
        <button class="btn wide" onClick={() => setCreating(true)}><Ic n="plus" size={16} /> Neue Checkliste oder Vorlage</button>
      ))}

      <h3 class="section">Aktive Checklisten</h3>
      <section class="card">
        {active.length === 0 && <div class="empty"><Ic n="listcheck" size={24} /><br />Keine aktive Checkliste.<br /><span class="muted">Aus einer Vorlage starten oder neu anlegen.</span></div>}
        {active.map((l) => {
          const es = entriesOf(l.id);
          const done = es.filter((e) => e.done).length;
          return (
            <button key={l.id} class="more-row" onClick={() => setOpenId(l.id)}>
              <span class="tile-ic"><Ic n={es.length && done === es.length ? 'check' : 'listcheck'} size={22} /></span>
              <span class="grow">
                <b>{l.title}</b>
                <small>{done} von {es.length} erledigt</small>
                <i class="progress"><i style={{ width: `${es.length ? (100 * done) / es.length : 0}%` }} /></i>
              </span>
              <Ic n="right" size={18} class="muted" />
            </button>
          );
        })}
      </section>

      <h3 class="section">Vorlagen</h3>
      <section class="card">
        {templates.length === 0 && (
          <div class="empty">
            Noch keine Vorlagen.
            {!readOnly && <div><button class="btn small" onClick={starter}><Ic n="plus" size={14} /> Beispiele anlegen (Urlaub, Festival, Ausflug)</button></div>}
          </div>
        )}
        {templates.map((l) => (
          <div key={l.id} class="line link-row" onClick={() => setOpenId(l.id)}>
            <Ic n="copy" size={18} class="muted" />
            <span class="grow"><b>{l.title}</b> <span class="muted small">· {entriesOf(l.id).length} Punkte</span></span>
            {!readOnly && <button class="btn small" onClick={(e) => { e.stopPropagation(); start(l); }}>Starten</button>}
          </div>
        ))}
      </section>
      <p class="hint">Vorlagen sind wiederverwendbar (z. B. Packliste Urlaub). „Starten“ legt eine Kopie zum Abhaken an – beide Handys haken gemeinsam ab.</p>
    </div>
  );
}

function ListDetail({ list, entries, close, open }: { list: Item; entries: Item[]; close: () => void; open: (id: string) => void }) {
  const { readOnly, settings } = useStore();
  const [text, setText] = useUiState(`lists.add.${list.id}`, '');
  const [title, setTitle] = useState(list.title ?? '');
  const [note, setNote] = useState('');
  const tpl = !!list.template;
  const done = entries.filter((e) => e.done).length;

  // Android-Zurück schließt erst die Liste
  useEffect(() => {
    sheetStack.push(close);
    return () => {
      const i = sheetStack.indexOf(close);
      if (i >= 0) sheetStack.splice(i, 1);
    };
  }, []);

  const flash = (m: string) => {
    setNote(m);
    setTimeout(() => setNote(''), 2500);
  };
  const add = (e: Event) => {
    e.preventDefault();
    if (!text.trim()) return;
    addChecks(list.id, text);
    haptic();
    setText('');
  };
  const toggle = (c: Item) => {
    if (readOnly || tpl) return;
    haptic(c.done ? 'light' : 'success');
    saveItem({ ...c, done: !c.done });
  };
  const rename = () => {
    if (title.trim() && title.trim() !== list.title) saveItem({ ...list, title: title.trim() });
  };

  return (
    <div class="page narrow">
      <button class="link" onClick={close}><Ic n="left" size={15} /> Alle Checklisten</button>
      <section class="card">
        <div class="list-head">
          <Ic n={tpl ? 'copy' : 'listcheck'} size={20} class="muted" />
          {readOnly ? <h2 class="grow">{list.title}</h2> : <input class="grow title-input" value={title} onInput={(e) => setTitle((e.target as HTMLInputElement).value)} onBlur={rename} aria-label="Name der Liste" />}
        </div>
        <div class="muted small">{tpl ? `Vorlage · ${entries.length} Punkte` : `${done} von ${entries.length} erledigt`}</div>
        {!tpl && <i class="progress"><i style={{ width: `${entries.length ? (100 * done) / entries.length : 0}%` }} /></i>}
      </section>

      {!readOnly && (
        <form class="shop-add" onSubmit={add}>
          <input type="text" placeholder="Punkt hinzufügen (mehrere mit Komma) …" value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} enterkeyhint="done" autocomplete="off" />
          <button class="btn primary" type="submit" disabled={!text.trim()} aria-label="hinzufügen"><Ic n="plus" size={22} /></button>
        </form>
      )}

      <section class="card shop-list">
        {entries.length === 0 && <div class="empty muted">Noch leer – oben Punkte eintragen.</div>}
        {entries.map((c) => (
          <div key={c.id} class={`shop-row ${c.done && !tpl ? 'done' : ''}`}>
            {tpl ? <i class="dot list-dot" /> : <button class="check-btn" disabled={readOnly} onClick={() => toggle(c)} aria-label={c.done ? 'wieder offen' : 'abhaken'}>{c.done && <Ic n="check" size={16} sw={3} />}</button>}
            <span class="grow" onClick={() => toggle(c)}>{c.title}</span>
            {!tpl && c.done && c.by && c.by !== settings.me && <i class="dot" style={{ background: PERSONS[c.by].color }} title={`abgehakt von ${PERSONS[c.by].name}`} />}
            {!readOnly && <button class="x-btn" onClick={() => saveItem({ ...c, deleted: true })} aria-label="entfernen"><Ic n="x" size={16} /></button>}
          </div>
        ))}
      </section>

      {note && <div class="hint">{note}</div>}
      {!readOnly && (
        <div class="actions wrap">
          {tpl ? (
            <button class="btn primary" onClick={() => { haptic(); open(createList(list.title ?? '', false, list.id)); }}><Ic n="listcheck" size={16} /> Checkliste daraus starten</button>
          ) : (
            <>
              <button class="btn" disabled={!done} onClick={() => resetList(list.id)}><Ic n="reset" size={16} /> Haken zurücksetzen</button>
              <button class="btn" onClick={() => { createList(list.title ?? '', true, list.id); flash('Als Vorlage gespeichert.'); }}><Ic n="copy" size={16} /> Als Vorlage speichern</button>
            </>
          )}
          <span class="grow" />
          <button class="btn danger" onClick={() => { deleteList(list.id); close(); }}><Ic n="trash" size={16} /> Löschen</button>
        </div>
      )}
    </div>
  );
}
