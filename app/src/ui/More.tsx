import type { Tab } from '../nav';
import { fmtShort, today } from '../core/dates';
import { budget } from '../core/report';
import { PARENTS, PERSONS } from '../core/types';
import { useStore } from '../store';
import { Ic, type IconName } from './icons';

/** Überfällige Aufgaben (Zahl fürs „Mehr“-Menü). */
export const overdueCount = (items: { kind: string; deleted?: boolean; done?: boolean; start: string }[], t0: string) =>
  items.filter((i) => i.kind === 'task' && !i.deleted && !i.done && i.start < t0).length;

/** Nächster Geburtstag ab heute (Monat/Tag). */
function nextBirthday(list: { title?: string; start: string }[], t: string) {
  const md = t.slice(5);
  const sorted = [...list].sort((a, b) => a.start.slice(5).localeCompare(b.start.slice(5)));
  return sorted.find((b) => b.start.slice(5) >= md) ?? sorted[0];
}

/**
 * „Mehr“: nur Funktionen, die nicht in der unteren Leiste stehen – gruppiert in Planen und Organisieren.
 * Einstellungen, Zugriff, Abgleich und Versionsinfo liegen unter dem Zahnrad in der Kopfzeile.
 */
export function More({ go }: { go: (t: Tab) => void }) {
  const { items, cal, readOnly } = useStore();
  const t0 = today();
  const py = Number(t0.slice(0, 4));
  const free = PARENTS.map((p) => budget(cal, p, py, t0));
  const freeText = free.every((b) => b.free === undefined) ? 'Urlaubstage eintragen' : free.map((b, i) => `${PERSONS[PARENTS[i]].name.slice(0, 3)} ${b.free ?? '–'}`).join(' · ') + ` frei (${py})`;
  const bdays = items.filter((i) => i.kind === 'birthday' && !i.deleted);
  const nb = nextBirthday(bdays, t0);
  const activeLists = items.filter((i) => i.kind === 'list' && !i.deleted && !i.template).length;
  const facts = items.filter((i) => i.kind === 'fact' && !i.deleted && !(readOnly && i.private)).length;
  const overdue = overdueCount(items, t0);

  const groups: { title: string; rows: { tab: Tab; icon: IconName; title: string; sub: string }[] }[] = [
    {
      title: 'Planen',
      rows: [
        { tab: 'vacation', icon: 'palm', title: 'Urlaub', sub: `Urlaubskonto, Zeiträume, Brückentage · ${freeText}` },
        { tab: 'birthdays', icon: 'cake', title: 'Geburtstage', sub: nb ? `nächster: ${nb.title}, ${fmtShort(`${py}-${nb.start.slice(5)}`)}` : 'noch keine eingetragen' },
      ],
    },
    {
      title: 'Organisieren',
      rows: [
        { tab: 'tasks', icon: 'tasks', title: 'Aufgaben', sub: overdue ? `${overdue} überfällig · Fristen & wiederkehrend` : 'Fristen & wiederkehrend' },
        { tab: 'lists', icon: 'listcheck', title: 'Checklisten', sub: activeLists ? `${activeLists} aktiv · Packlisten & Vorlagen` : 'Packlisten & Vorlagen' },
        { tab: 'facts', icon: 'folder', title: 'Infomappe', sub: facts ? `${facts} Karte${facts === 1 ? '' : 'n'}` : 'Kinderarzt, Kita, Größen …' },
      ],
    },
  ];

  return (
    <div class="page narrow">
      {groups.map((g) => (
        <div key={g.title}>
          <h3 class="section">{g.title}</h3>
          <section class="card">
            {g.rows.map((r) => (
              <button key={r.tab} class="more-row" onClick={() => go(r.tab)}>
                <span class="tile-ic"><Ic n={r.icon} size={22} /></span>
                <span class="grow"><b>{r.title}</b><small>{r.sub}</small></span>
                <Ic n="right" size={18} class="muted" />
              </button>
            ))}
          </section>
        </div>
      ))}
      <p class="hint">Einstellungen, Zugriff, Abgleich und Version: Zahnrad oben rechts.</p>
    </div>
  );
}
