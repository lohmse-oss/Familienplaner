import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useUiState } from '../resume';
import { PERSONS, type Item } from '../core/types';
import { haptic } from '../haptics';
import { addShop, createShopList, deleteList, removeShop, saveItem, sync, toggleShop, useStore } from '../store';
import { Ic } from './icons';

const rel = (a: Item, b: Item) => (b.ts ?? 0) - (a.ts ?? 0);

/** Fließende Einkaufsliste: mehrere Listen über Registerkarten oben („Allgemeines“ + eigene), eintragen, antippen = quittiert, Vorschläge aus der Historie. */
export function Shop({ focusSignal = 0 }: { focusSignal?: number }) {
  const { items, settings, readOnly } = useStore();
  const [text, setText] = useUiState('shop.text', ''); // übersteht App-Wechsel
  const [showDone, setShowDone] = useState(false);
  const [note, setNote] = useState('');
  const [listId, setListId] = useUiState('shop.list', ''); // '' = Standardliste „Allgemeines“
  const [editing, setEditing] = useState<string | null>(null); // null = zu, '' = neu anlegen, sonst Id der Liste
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focusSignal) setTimeout(() => inputRef.current?.focus(), 150); // z. B. aus der Schnellaktion „Einkauf eintragen“
  }, [focusSignal]);

  // Solange die Liste offen ist, schneller abgleichen (beide schreiben/haken parallel ab)
  useEffect(() => {
    const id = setInterval(() => document.visibilityState === 'visible' && void sync(), 12_000);
    return () => clearInterval(id);
  }, []);

  const shopLists = items.filter((i) => i.kind === 'list' && i.shopList && !i.deleted).sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));
  const activeId = shopLists.some((l) => l.id === listId) ? listId : '';
  const activeList = shopLists.find((l) => l.id === activeId);
  const pid = activeId || undefined;
  const allShop = items.filter((i) => i.kind === 'shop');
  const all = allShop.filter((i) => i.parent === pid); // aktive Liste (ohne parent = „Allgemeines“)
  const open = all.filter((i) => !i.deleted && !i.done).sort(rel);
  const done = all.filter((i) => !i.deleted && i.done).sort((a, b) => b.updated - a.updated);
  const week = Date.now() - 7 * 864e5;
  const doneRecent = done.filter((i) => i.updated > week);
  const openCountOf = (p: string | undefined) => allShop.filter((i) => !i.deleted && !i.done && i.parent === p).length;

  // Häufig gekaufte Artikel (inkl. bereits entfernter, über alle Listen) als Ein-Tap-Vorschläge
  const suggestions = useMemo(() => {
    const openSet = new Set(allShop.filter((i) => !i.deleted && !i.done).map((i) => i.title?.toLowerCase()));
    const count = new Map<string, { title: string; n: number; last: number }>();
    for (const i of allShop) {
      const k = i.title?.toLowerCase();
      if (!k || openSet.has(k)) continue;
      const c = count.get(k) ?? { title: i.title!, n: 0, last: 0 };
      c.n++;
      c.last = Math.max(c.last, i.ts ?? 0);
      count.set(k, c);
    }
    return [...count.values()].sort((a, b) => b.n - a.n || b.last - a.last).slice(0, 10);
  }, [items]);

  const flash = (m: string) => {
    setNote(m);
    setTimeout(() => setNote(''), 2000);
  };
  const submit = (e: Event) => {
    e.preventDefault();
    const parts = text.split(',').map((s) => s.trim()).filter(Boolean); // „Milch, Brot, Eier“ → drei Einträge
    let dup = 0;
    for (const p of parts) if (!addShop(p, pid)) dup++;
    if (parts.length > dup) haptic();
    setText('');
    if (dup) flash(dup === parts.length && parts.length === 1 ? 'Steht schon auf der Liste' : `${dup} bereits auf der Liste`);
  };

  const Row = ({ i }: { i: Item }) => (
    <div class={`shop-row ${i.done ? 'done' : ''}`}>
      <button class="check-btn" disabled={readOnly} onClick={() => { haptic(i.done ? 'light' : 'success'); toggleShop(i.id); }} aria-label={i.done ? 'wieder offen' : 'abhaken'}>{i.done && <Ic n="check" size={16} sw={3} />}</button>
      <span class="grow" onClick={() => { if (readOnly) return; haptic(i.done ? 'light' : 'success'); toggleShop(i.id); }}>{i.title}</span>
      {i.by && i.by !== settings.me && <i class="dot" style={{ background: PERSONS[i.by].color }} title={`von ${PERSONS[i.by].name}`} />}
      {!readOnly && <button class="x-btn" onClick={() => removeShop([i.id])} aria-label="entfernen"><Ic n="x" size={16} /></button>}
    </div>
  );

  const saveList = (e: Event) => {
    e.preventDefault();
    const t = name.trim();
    if (!t) return;
    if (editing && activeList) saveItem({ ...activeList, title: t }); // umbenennen
    else setListId(createShopList(t)); // neu anlegen und direkt aktivieren
    setName('');
    setEditing(null);
  };

  return (
    <div class="page">
      <div class="shop-tabs">
        <div class="chips scroll" role="tablist" aria-label="Einkaufslisten">
          <button class={`chip ${activeId === '' ? 'on' : ''}`} role="tab" aria-selected={activeId === ''} onClick={() => setListId('')}>
            Allgemeines{openCountOf(undefined) > 0 ? ` (${openCountOf(undefined)})` : ''}
          </button>
          {shopLists.map((l) => (
            <button key={l.id} class={`chip ${activeId === l.id ? 'on' : ''}`} role="tab" aria-selected={activeId === l.id} onClick={() => setListId(l.id)}>
              {l.title}{openCountOf(l.id) > 0 ? ` (${openCountOf(l.id)})` : ''}
            </button>
          ))}
          {!readOnly && <button class="chip" onClick={() => { setEditing(''); setName(''); }} aria-label="Neue Einkaufsliste anlegen" title="Neue Liste anlegen"><Ic n="plus" size={14} /></button>}
        </div>
        {!readOnly && activeList && (
          <button class="icon-btn" onClick={() => { setEditing(activeId); setName(activeList.title ?? ''); }} aria-label="Liste bearbeiten" title="Liste umbenennen oder löschen"><Ic n="edit" size={16} /></button>
        )}
      </div>

      {!readOnly && editing !== null && (
        <form class="card list-form" onSubmit={saveList}>
          <label>{editing ? 'Liste umbenennen' : 'Neue Einkaufsliste'}</label>
          <input type="text" autoFocus placeholder="z. B. Drogerie" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} enterkeyhint="done" autocomplete="off" />
          <div class="actions">
            <button type="button" class="btn" onClick={() => setEditing(null)}>Abbrechen</button>
            {editing && (
              <button type="button" class="btn danger" onClick={() => { deleteList(editing); if (activeId === editing) setListId(''); setName(''); setEditing(null); }}>
                <Ic n="trash" size={15} /> Löschen
              </button>
            )}
            <span class="grow" />
            <button class="btn primary" type="submit" disabled={!name.trim()}>{editing ? 'Speichern' : 'Anlegen'}</button>
          </div>
        </form>
      )}

      {!readOnly && <form class="shop-add" onSubmit={submit}>
        <input ref={inputRef} type="text" placeholder="Artikel hinzufügen …" value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} enterkeyhint="done" autocomplete="off" />
        <button class="btn primary" type="submit" disabled={!text.trim()} aria-label="hinzufügen"><Ic n="plus" size={22} /></button>
      </form>}
      {note ? <div class="hint neg">{note}</div> : open.length === 0 && all.length === 0 ? <div class="hint">Mehrere Artikel mit Komma trennen, z. B. „Milch, Brot, Eier“.</div> : null}

      {!readOnly && suggestions.length > 0 && (
        <div class="chips scroll sugg">
          {suggestions.map((s) => (
            <button key={s.title} class="chip" onClick={() => { haptic(); addShop(s.title, pid); }}><Ic n="plus" size={13} /> {s.title}</button>
          ))}
        </div>
      )}

      <section class="card shop-list">
        {open.length === 0 && <div class="empty"><Ic n="cart" size={26} /><br />Die Liste ist leer.<br /><span class="muted">Oben etwas eintragen – beide Handys sehen es sofort.</span></div>}
        {open.map((i) => <Row key={i.id} i={i} />)}
      </section>

      {doneRecent.length > 0 && (
        <>
          <button class="link done-toggle" onClick={() => setShowDone(!showDone)}><Ic n={showDone ? 'down' : 'right'} size={15} /> Erledigt ({doneRecent.length})</button>
          {showDone && (
            <section class="card shop-list">
              {doneRecent.map((i) => <Row key={i.id} i={i} />)}
              {!readOnly && <div class="actions"><button class="btn danger" onClick={() => removeShop(doneRecent.map((i) => i.id))}>Erledigte entfernen</button></div>}
            </section>
          )}
        </>
      )}
    </div>
  );
}
