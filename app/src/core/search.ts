import { describeChange } from './describe';
import { addDays, fmtShort } from './dates';
import { PERSONS, SUB_LABEL, type Item, type Kind } from './types';

export interface Hit {
  item: Item;
  kind: Kind;
  date: string; // zu diesem Tag springen ('' = kein Datum, z. B. Einkauf)
  text: string; // lesbare Beschreibung
}

const MODE_WORDS = { vacation: 'urlaub', trip: 'dienstreise reise', homeoffice: 'homeoffice home' } as const;
const KIND_WORDS: Record<Kind, string> = {
  presence: 'anwesenheit',
  care: 'betreuung betreuungsbedarf schließtag',
  cover: 'betreuung oma opa',
  event: 'termin',
  info: 'event info veranstaltung festival konzert',
  task: 'aufgabe',
  birthday: 'geburtstag',
  config: '',
  shop: 'einkauf einkaufsliste',
  list: 'checkliste liste vorlage packliste',
  check: 'checkliste liste',
  fact: 'infomappe info kontakt',
  meal: 'mahlzeit essen gericht kochen pool',
};

const NO_DATE: Kind[] = ['shop', 'list', 'check', 'fact'];

/** Beschreibung für Einträge ohne Datum (Einkauf, Checklisten, Infomappe). */
function listText(it: Item, all: Item[]): string | undefined {
  const t = it.title ?? '';
  if (it.kind === 'shop') return `${t}${it.done ? ' (erledigt)' : ''}`;
  if (it.kind === 'list') return `${it.template ? 'Vorlage' : 'Checkliste'}: ${t}`;
  if (it.kind === 'check') return `${t} – ${all.find((l) => l.id === it.parent)?.title ?? 'Checkliste'}${it.done ? ' ✓' : ''}`;
  if (it.kind === 'fact') return `Infomappe: ${t}`;
  return undefined;
}

/** Nächstes Auftreten eines Geburtstags (ab heute). */
function nextBirthday(start: string, today: string): string {
  const y = Number(today.slice(0, 4));
  const md = start.slice(5);
  const thisYear = `${y}-${md}`;
  return thisYear >= today ? thisYear : `${y + 1}-${md}`;
}

/**
 * Volltextsuche über alle Einträge: jedes Suchwort muss vorkommen (Titel, Notiz, Ort, Kontakt, Link,
 * Personen, Art). Ergebnis: Kommende zuerst (nach Datum), dann Vergangenes (neuestes zuerst), dann Einkauf.
 */
export function search(items: Item[], query: string, today: string, limit = 40, opts: { hidePrivate?: boolean } = {}): Hit[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const hits: Hit[] = [];
  for (const it of items) {
    if (it.deleted || it.kind === 'config' || (opts.hidePrivate && it.private)) continue;
    const hay = [
      it.title, it.note, it.place, it.contact, it.link,
      ...it.persons.map((p) => PERSONS[p].name),
      it.owner ? PERSONS[it.owner].name : '',
      it.mode ? MODE_WORDS[it.mode] : '',
      it.sub ? SUB_LABEL[it.sub] : '',
      KIND_WORDS[it.kind],
    ].join(' ').toLowerCase();
    if (!terms.every((t) => hay.includes(t))) continue;
    const date = NO_DATE.includes(it.kind) ? '' : it.kind === 'birthday' ? nextBirthday(it.start, today) : it.start;
    const text = listText(it, items) ?? describeChange(it)?.text ?? it.title ?? '';
    hits.push({ item: it, kind: it.kind, date, text });
  }
  const rank = (h: Hit) => (h.date === '' ? 2 : h.date >= today ? 0 : 1);
  hits.sort((a, b) => rank(a) - rank(b) || (rank(a) === 1 ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));
  return hits.slice(0, limit);
}

/** „14.7.“, „14.07.2027“, „3.11.26“ → ISO-Datum (Jahr fehlt = laufendes Jahr). */
export function parseDateQuery(q: string, today: string): string | null {
  const m = q.trim().match(/^(\d{1,2})\.(\d{1,2})\.?(?:(\d{2}|\d{4}))?$/);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  let y = m[3] ? Number(m[3]) : Number(today.slice(0, 4));
  if (m[3] && m[3].length === 2) y += 2000;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return addDays(iso, 0) === iso ? iso : null; // ungültige Tage (31.02.) verwerfen
}

export const hitDateLabel = (h: Hit) => (h.date ? fmtShort(h.date) : '');
