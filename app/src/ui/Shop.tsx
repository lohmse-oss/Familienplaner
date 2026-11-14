import { useEffect, useMemo, useState } from 'preact/hooks';
import { PERSONS, type Item } from '../core/types';
import { haptic } from '../haptics';
import { addShop, removeShop, sync, toggleShop, useStore } from '../store';
import { Ic } from './icons';

const rel = (a: Item, b: Item) => (b.ts ?? 0) - (a.ts ?? 0);

/** Fließende Einkaufsliste: eintragen, antippen = quittiert (wandert nach unten), Vorschläge aus der Historie. */
export function Shop() {
  const { items, settings } = useStore();
  const [text, setText] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [note, setNote] = useState('');

  // Solange die Liste offen ist, schneller abgleichen (beide schreiben/haken parallel ab)
  useEffect(() => {
    const id = setInterval(() => document.visibilityState === 'visible' && void sync(), 12_000);
    return () => clearInterval(id);
  }, []);

  const all = items.filter((i) => i.kind === 'shop');
  const open = all.filter((i) => !i.deleted && !i.done).sort(rel);
  const done = all.filter((i) => !i.deleted && i.done).sort((a, b) => b.updated - a.updated);
  const week = Date.now() - 7 * 864e5;
  const doneRecent = done.filter((i) => i.updated > week);

  // Häufig gekaufte Artikel (inkl. bereits entfernter) als Ein-Tap-Vorschläge
  const suggestions = useMemo(() => {
    const openSet = new Set(open.map((i) => i.title?.toLowerCase()));
    const count = new Map<string, { title: string; n: number; last: number }>();
    for (const i of all) {
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
    for (const p of parts) if (!addShop(p)) dup++;
    if (parts.length > dup) haptic();
    setText('');
    if (dup) flash(dup === parts.length && parts.length === 1 ? 'Steht schon auf der Liste' : `${dup} bereits auf der Liste`);
  };

  const Row = ({ i }: { i: Item }) => (
    <div class={`shop-row ${i.done ? 'done' : ''}`}>
      <button class="check-btn" onClick={() => { haptic(i.done ? 'light' : 'success'); toggleShop(i.id); }} aria-label={i.done ? 'wieder offen' : 'abhaken'}>{i.done && <Ic n="check" size={16} sw={3} />}</button>
      <span class="grow" onClick={() => { haptic(i.done ? 'light' : 'success'); toggleShop(i.id); }}>{i.title}</span>
      {i.by && i.by !== settings.me && <i class="dot" style={{ background: PERSONS[i.by].color }} title={`von ${PERSONS[i.by].name}`} />}
      <button class="x-btn" onClick={() => removeShop([i.id])} aria-label="entfernen"><Ic n="x" size={16} /></button>
    </div>
  );

  return (
    <div class="page">
      <form class="shop-add" onSubmit={submit}>
        <input type="text" placeholder="Artikel hinzufügen …" value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} enterkeyhint="done" autocomplete="off" />
        <button class="btn primary" type="submit" disabled={!text.trim()} aria-label="hinzufügen"><Ic n="plus" size={22} /></button>
      </form>
      {note ? <div class="hint neg">{note}</div> : open.length === 0 && all.length === 0 ? <div class="hint">Mehrere Artikel mit Komma trennen, z. B. „Milch, Brot, Eier“.</div> : null}

      {suggestions.length > 0 && (
        <div class="chips scroll sugg">
          {suggestions.map((s) => (
            <button key={s.title} class="chip" onClick={() => { haptic(); addShop(s.title); }}><Ic n="plus" size={13} /> {s.title}</button>
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
              <div class="actions"><button class="btn danger" onClick={() => removeShop(doneRecent.map((i) => i.id))}>Erledigte entfernen</button></div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
