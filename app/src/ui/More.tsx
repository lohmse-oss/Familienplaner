import { planningYear, today } from '../core/dates';
import { budget } from '../core/report';
import { PARENTS, PERSONS } from '../core/types';
import type { Tab } from '../nav';
import { useStore } from '../store';

/** "Mehr"-Menü: alles, was nicht direkt in der unteren Leiste liegt. */
export function More({ go }: { go: (t: Tab) => void }) {
  const { items, cal, sync, settings } = useStore();
  const t = today();
  const py = planningYear();
  const openShop = items.filter((i) => i.kind === 'shop' && !i.deleted && !i.done).length;
  const bdays = items.filter((i) => i.kind === 'birthday' && !i.deleted).length;
  const free = PARENTS.map((p) => budget(cal, p, py, t));
  const freeText = free.every((b) => b.free === undefined) ? 'Urlaubstage eintragen' : free.map((b, i) => `${PERSONS[PARENTS[i]].name.slice(0, 3)} ${b.free ?? '–'}`).join(' · ') + ' frei';
  const syncText = { off: 'lokal', idle: 'synchron', syncing: '…', error: 'Fehler' }[sync.status];

  const rows: { tab: Tab; icon: string; title: string; sub: string }[] = [
    { tab: 'vacation', icon: '🌴', title: 'Urlaubsverwaltung', sub: freeText },
    { tab: 'shop', icon: '🛒', title: 'Einkaufsliste', sub: openShop ? `${openShop} offen` : 'alles besorgt' },
    { tab: 'birthdays', icon: '🎂', title: 'Geburtstage', sub: `${bdays} eingetragen` },
    { tab: 'settings', icon: '⚙️', title: 'Einstellungen', sub: `${PERSONS[settings.me].name} · Sync: ${syncText}` },
  ];

  return (
    <div class="page">
      <section class="card">
        {rows.map((r) => (
          <div key={r.tab} class="line link-row" onClick={() => go(r.tab)}>
            <span>{r.icon}</span>
            <span class="grow"><b>{r.title}</b><br /><span class="muted">{r.sub}</span></span>
            <span>›</span>
          </div>
        ))}
      </section>
      <p class="hint">Wochenplan und Jahresforecast erreichst du direkt über die untere Leiste.</p>
    </div>
  );
}
