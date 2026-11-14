import type { Item, PersonId } from './types';

export type PersonFilter = PersonId | 'all';

/**
 * Betrifft der Eintrag die Person? Einträge ohne Personen und ohne Zuständigen (Familie, z. B. Stadtfest)
 * sind für alle relevant.
 */
export function relevant(it: Item, p: PersonFilter): boolean {
  if (p === 'all') return true;
  if (it.owner === p || it.persons.includes(p)) return true;
  return it.persons.length === 0 && !it.owner;
}
