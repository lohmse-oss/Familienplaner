import { addDays } from './dates';
import type { Item, Mode, PersonId } from './types';

export interface PresenceOptions {
  title?: string;
  away?: boolean; // nur bei Urlaub: verreist
  onlyMode?: Mode; // nur Einträge dieser Art überschreiben/entfernen (sonst alle Anwesenheitsarten)
}

/**
 * Berechnet, welche Einträge geschrieben werden müssen, damit die Personen im Zeitraum start..end den
 * Status `mode` haben ('office' = Standard, entfernt nur). Bestehende Einträge, die den Zeitraum
 * überlappen, werden geteilt bzw. gekürzt – Reste vor/nach dem Zeitraum bleiben erhalten.
 * Gibt die zu speichernden Einträge zurück (gelöschte als `deleted: true`).
 */
export function planPresence(
  items: Item[],
  persons: PersonId[],
  start: string,
  end: string,
  mode: Mode | 'office',
  opts: PresenceOptions = {},
  newId: () => string,
): Item[] {
  const out = new Map<string, Item>();
  const active = items.filter((i) => !i.deleted && i.kind === 'presence');

  for (const person of persons) {
    for (const it of active) {
      if (!it.persons.includes(person) || it.end < start || it.start > end) continue;
      if (opts.onlyMode && it.mode !== opts.onlyMode) continue;
      const base = out.get(it.id) ?? it;
      const others = base.persons.filter((p) => p !== person);
      out.set(it.id, others.length ? { ...base, persons: others } : { ...base, deleted: true });
      if (it.start < start) {
        const id = newId();
        out.set(id, { ...it, id, persons: [person], start: it.start, end: addDays(start, -1) });
      }
      if (it.end > end) {
        const id = newId();
        out.set(id, { ...it, id, persons: [person], start: addDays(end, 1), end: it.end });
      }
    }
  }

  if (mode !== 'office') {
    const id = newId();
    const item: Item = { id, kind: 'presence', mode, persons: [...persons], start, end, updated: 0 };
    if (opts.title) item.title = opts.title;
    if (mode === 'vacation' && opts.away) item.away = true;
    out.set(id, item);
  }
  return [...out.values()];
}
