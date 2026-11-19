import { BUILD } from '../build';
import type { Tab } from '../nav';
import { fmt, today } from '../core/dates';
import { budget } from '../core/report';
import { PARENTS, PERSONS } from '../core/types';
import { useStore } from '../store';
import { Ic, type IconName } from './icons';

/** „Mehr“: alles, was nicht täglich gebraucht wird, an einem Ort. */
export function More({ go }: { go: (t: Tab) => void }) {
  const { items, cal, settings, readOnly, sync, hd } = useStore();
  const openTasks = items.filter((i) => i.kind === 'task' && !i.deleted && !i.done).length;
  const bdays = items.filter((i) => i.kind === 'birthday' && !i.deleted).length;
  const activeLists = items.filter((i) => i.kind === 'list' && !i.deleted && !i.template).length;
  const facts = items.filter((i) => i.kind === 'fact' && !i.deleted && !(readOnly && i.private)).length;
  const t0 = today();
  const py = Number(t0.slice(0, 4));
  const free = PARENTS.map((p) => budget(cal, p, py, t0));
  const freeText = free.every((b) => b.free === undefined) ? 'Urlaubstage eintragen' : free.map((b, i) => `${PERSONS[PARENTS[i]].name.slice(0, 3)} ${b.free ?? '–'}`).join(' · ') + ' frei';
  const rows: { tab: Tab; icon: IconName; title: string; sub: string; badge?: number }[] = [
    { tab: 'vacation', icon: 'palm', title: 'Urlaubsverwaltung', sub: freeText },
    { tab: 'tasks', icon: 'tasks', title: 'Aufgaben', sub: openTasks ? `${openTasks} offen` : 'Nichts offen', badge: openTasks || undefined },
    { tab: 'birthdays', icon: 'cake', title: 'Geburtstage', sub: `${bdays} eingetragen` },
    { tab: 'lists', icon: 'listcheck', title: 'Checklisten', sub: activeLists ? `${activeLists} aktiv · Vorlagen` : 'Packlisten & Vorlagen' },
    { tab: 'facts', icon: 'folder', title: 'Infomappe', sub: facts ? `${facts} Karten` : 'Kinderarzt, Kita, Größen …' },
    { tab: 'settings', icon: 'settings', title: 'Einstellungen', sub: 'Ich, Darstellung, Hinweise, Widget, Synchronisierung' },
  ];
  return (
    <div class="page narrow">
      <section class="card">
        {rows.map((r) => (
          <button key={r.tab} class="more-row" onClick={() => go(r.tab)}>
            <span class="tile-ic"><Ic n={r.icon} size={22} />{r.badge && <i class="tile-badge">{r.badge}</i>}</span>
            <span class="grow"><b>{r.title}</b><small>{r.sub}</small></span>
            <Ic n="right" size={18} class="muted" />
          </button>
        ))}
      </section>
      <section class="card">
        <div class="line">
          <Ic n={readOnly ? 'eye' : 'edit'} class="muted" />
          <span class="grow"><b>Zugriff:</b> {readOnly ? 'nur Lesen' : 'Lesen und Bearbeiten'}</span>
        </div>
        <div class="line">
          <Ic n={sync.status === 'error' ? 'warn' : 'check'} class="muted" />
          <span class="grow"><b>Abgleich:</b> {sync.status === 'off' ? 'nicht verbunden (nur auf diesem Handy)' : sync.status === 'error' ? sync.msg ?? 'Fehler' : 'verbunden'}</span>
        </div>
        <div class="line"><Ic n="user" class="muted" /><span class="grow"><b>Dieses Handy:</b> {settings.me[0].toUpperCase() + settings.me.slice(1)}</span></div>
      </section>

      <section class="card build-info">
        <header class="card-head"><strong><Ic n="info" size={15} /> Über diese App</strong></header>
        <div class="kv"><span>Version</span><b>{BUILD.version}</b></div>
        <div class="kv"><span>Build</span><b>{BUILD.number === 'lokal' ? 'lokal' : `#${BUILD.number}`}</b></div>
        <div class="kv"><span>Stand (Commit)</span><b class="mono">{BUILD.commit}</b></div>
        <div class="kv"><span>Gebaut am</span><b>{new Date(BUILD.builtAt).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}</b></div>
        <div class="kv"><span>Ferien & Feiertage</span><b>Stand {fmt(hd.fetchedAt)}</b></div>
        <p class="hint">Die Build-Nummer steht auch auf der Release-Seite bei GitHub („Aktuelle APK (Build …)“). So erkennst du, ob beide Handys dieselbe Version haben.</p>
      </section>
    </div>
  );
}
