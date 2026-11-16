import type { Item, PersonId } from './types';

/** 'all' = alle Personen; sonst Mehrfachauswahl der gewünschten Personen. */
export type PersonFilter = 'all' | PersonId[];

/**
 * Betrifft der Eintrag eine der gewählten Personen? Einträge ohne Personen und ohne Zuständigen
 * (Familie, z. B. Stadtfest) sind für alle relevant.
 */
export function relevant(it: Item, p: PersonFilter): boolean {
  if (p === 'all' || p.length === 0) return true;
  if (it.owner && p.includes(it.owner)) return true;
  if (it.persons.some((x) => p.includes(x))) return true;
  return it.persons.length === 0 && !it.owner;
}
