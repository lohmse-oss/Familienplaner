export type Tab = 'home' | 'cal' | 'vacation' | 'shop' | 'more' | 'tasks' | 'birthdays' | 'settings' | 'lists' | 'facts';

export type Link =
  | { type: 'tab'; tab: Tab }
  | { type: 'today' }
  | { type: 'day'; date: string }
  | { type: 'new'; what: 'event' | 'task' | 'shop' };

export const SCHEME = 'de.familie.planer://';
const TABS: Tab[] = ['home', 'cal', 'vacation', 'shop', 'more', 'tasks', 'birthdays', 'settings', 'lists', 'facts'];

/**
 * Direktlinks aus Widget-Kreisen und Launcher-Schnellaktionen:
 *   de.familie.planer://shop · tasks · today · day/2027-07-12 · new/event · new/task · new/shop
 */
export function parseLink(url: string): Link | null {
  if (!url.startsWith(SCHEME)) return null;
  const parts = url.slice(SCHEME.length).split(/[/?#]/).filter(Boolean);
  const [a, b] = parts;
  if (a === 'today') return { type: 'today' };
  if (a === 'day' && b && /^\d{4}-\d{2}-\d{2}$/.test(b)) return { type: 'day', date: b };
  if (a === 'new' && (b === 'event' || b === 'task' || b === 'shop')) return { type: 'new', what: b };
  if (a && (TABS as string[]).includes(a)) return { type: 'tab', tab: a as Tab };
  return null;
}
