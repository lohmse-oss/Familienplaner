import { dow, fmt, fmtShort, WD } from './dates';
import { PERSONS, type Item, type PersonId } from './types';

export type Verb = 'new' | 'edit' | 'del';

const MODE = { vacation: 'Urlaub', trip: 'Dienstreise', homeoffice: 'Homeoffice' } as const;
const names = (ps: PersonId[]) => (ps.length >= 4 ? 'Familie' : ps.map((p) => PERSONS[p].name).join(', '));

/** „Do 14.07.2027“ bzw. „Mo 13.07.–Mi 14.07.2027“ */
export function span(a: string, b: string): string {
  if (a === b) return `${WD[dow(a)]} ${fmt(a)}`;
  return `${WD[dow(a)]} ${fmtShort(a)}–${WD[dow(b)]} ${fmt(b)}`;
}

/** Neu, geändert oder gelöscht? (Neu = innerhalb von 2 Minuten nach dem ersten Speichern noch einmal gespeichert.) */
export function verbOf(it: Item): Verb {
  if (it.deleted) return 'del';
  return it.created && it.updated - it.created < 120_000 ? 'new' : 'edit';
}

export const VERB_TEXT: Record<Verb, string> = { new: 'hat eingetragen', edit: 'hat geändert', del: 'hat gelöscht' };

/** Kurze, lesbare Beschreibung eines Eintrags – für Hinweise und die Liste „Neu vom Partner“. null = nicht melden (Einkauf, Einstellungen). */
export function describeChange(it: Item): { verb: Verb; text: string } | null {
  const verb = verbOf(it);
  const t = it.title?.trim();
  const when = span(it.start, it.end);
  let text: string;
  switch (it.kind) {
    case 'presence':
      text = `${MODE[it.mode ?? 'vacation']} ${names(it.persons)}, ${when}${t ? ` – ${t}` : ''}${it.away ? ' (verreist)' : ''}`;
      break;
    case 'care':
      text = `${t || 'Betreuungsbedarf'} (${names(it.persons)}), ${when}`;
      break;
    case 'cover':
      text = `Betreuung durch ${t || 'Dritte'}, ${when}`;
      break;
    case 'event':
      text = `${t || 'Termin'}${it.persons.length ? ` (${names(it.persons)})` : ''}, ${span(it.start, it.recur ? it.start : it.end)}${it.time ? `, ${it.time}${it.endTime ? `–${it.endTime}` : ''}` : ''}${it.place ? `, ${it.place}` : ''}`;
      break;
    case 'info':
      text = `${t || 'Info'}, ${when}${it.place ? `, ${it.place}` : ''}`;
      break;
    case 'task':
      text = `Aufgabe: ${t || '?'}, fällig ${span(it.start, it.start)}${it.owner ? ` (${PERSONS[it.owner].name})` : ''}`;
      break;
    case 'birthday':
      text = `Geburtstag: ${t || '?'}, ${fmtShort(it.start)}`;
      break;
    default:
      return null;
  }
  return { verb, text };
}

/**
 * Änderungen eines Abgleichs für Hinweise aufbereiten. Beim Eintragen eines Urlaubs werden bestehende
 * Einträge geteilt/gekürzt – diese technischen Umbauten melden wir nicht zusätzlich.
 */
export function annotateChanges<T extends Item>(items: T[]): (T & { _text?: string; _verb?: Verb })[] {
  const described = items.map((it) => ({ it, d: describeChange(it) }));
  const addedBy = new Set<string>();
  for (const { it, d } of described) if (d?.verb === 'new' && it.kind === 'presence' && it.by) addedBy.add(it.by);
  return described.map(({ it, d }) => {
    if (!d) return { ...it };
    if (it.kind === 'presence' && it.by && addedBy.has(it.by) && d.verb !== 'new') return { ...it };
    return { ...it, _text: d.text, _verb: d.verb };
  });
}
