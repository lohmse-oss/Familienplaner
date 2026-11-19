import { useEffect, useMemo, useRef } from 'preact/hooks';
import { useUiState } from '../resume';
import { fmt, today } from '../core/dates';
import { hitDateLabel, parseDateQuery, search } from '../core/search';
import type { CalView, Tab } from '../nav';
import { useStore } from '../store';
import { Sheet } from './common';
import { Ic, type IconName } from './icons';

const KIND_ICON: Record<string, IconName> = {
  presence: 'palm', care: 'baby', cover: 'hand', event: 'addcal', info: 'ticket', task: 'tasks', birthday: 'cake', shop: 'cart',
};

const GOTO: { label: string; icon: IconName; tab: Tab; view?: CalView }[] = [
  { label: 'Heute', icon: 'today', tab: 'cal', view: 'week' },
  { label: 'Verlauf', icon: 'rows', tab: 'cal', view: 'timeline' },
  { label: 'Jahr', icon: 'year', tab: 'cal', view: 'year' },
  { label: 'Urlaub', icon: 'palm', tab: 'vacation' },
  { label: 'Einkauf', icon: 'cart', tab: 'shop' },
  { label: 'Aufgaben', icon: 'tasks', tab: 'tasks' },
  { label: 'Einstellungen', icon: 'settings', tab: 'settings' },
];

/** Suche und Schnellsprung: Text suchen oder ein Datum („14.7.“) eintippen; ohne Eingabe stehen die wichtigsten Ziele bereit. */
export function SearchSheet({ onClose, onDay, onGo }: { onClose: () => void; onDay: (date: string) => void; onGo: (tab: Tab, view?: CalView) => void }) {
  const { items } = useStore();
  const [q, setQ] = useUiState('search.q', '', { clearOnUnmount: true });
  const input = useRef<HTMLInputElement>(null);
  const t = today();
  useEffect(() => { const id = setTimeout(() => input.current?.focus(), 250); return () => clearTimeout(id); }, []);

  const jump = useMemo(() => parseDateQuery(q, t), [q]);
  const hits = useMemo(() => search(items, q, t), [items, q]);
  const pick = (fn: () => void) => { onClose(); fn(); };

  return (
    <Sheet title="Suchen & springen" onClose={onClose} tall>
      <div class="search-box">
        <Ic n="search" size={18} class="muted" />
        <input ref={input} type="search" placeholder="Termin, Aufgabe, Geburtstag, Einkauf … oder Datum" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} enterkeyhint="search" autocomplete="off" />
        {q && <button class="icon-btn" onClick={() => setQ('')} aria-label="Leeren"><Ic n="x" size={16} /></button>}
      </div>

      {!q.trim() && (
        <>
          <h3 class="section">Gehe zu</h3>
          <div class="chips">
            {GOTO.map((g) => <button key={g.label} class="chip" onClick={() => pick(() => onGo(g.tab, g.view))}><Ic n={g.icon} size={15} /> {g.label}</button>)}
          </div>
          <p class="hint">Tipp: Ein Datum wie „14.7.“ oder „3.11.2027“ springt direkt zum Tag, „urlaub“, „arzt“ oder ein Name sucht in allen Einträgen.</p>
        </>
      )}

      {jump && (
        <div class="line link-row hit" onClick={() => pick(() => onDay(jump))}>
          <Ic n="today" class="muted" />
          <span class="grow"><b>Zum {fmt(jump)} springen</b></span>
          <Ic n="right" size={16} class="muted" />
        </div>
      )}

      {q.trim() && !hits.length && !jump && <div class="empty"><Ic n="search" size={24} /><br />Nichts gefunden für „{q.trim()}“.</div>}
      {hits.map((h) => (
        <div key={h.item.id} class="line link-row hit" onClick={() => pick(() => (h.kind === 'shop' ? onGo('shop') : onDay(h.date)))}>
          <Ic n={KIND_ICON[h.kind] ?? 'info'} class="muted" />
          <span class="grow">{h.text}</span>
          <span class="muted small">{hitDateLabel(h)}</span>
        </div>
      ))}
    </Sheet>
  );
}
