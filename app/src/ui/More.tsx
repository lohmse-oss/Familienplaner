import { BUILD } from '../build';
import type { Tab } from '../nav';
import { fmt } from '../core/dates';
import { useStore } from '../store';
import { Ic, type IconName } from './icons';

/** „Mehr“: alles, was nicht täglich gebraucht wird, an einem Ort. */
export function More({ go }: { go: (t: Tab) => void }) {
  const { items, settings, readOnly, sync, hd } = useStore();
  const openTasks = items.filter((i) => i.kind === 'task' && !i.deleted && !i.done).length;
  const rows: { tab: Tab; icon: IconName; title: string; sub: string; badge?: number }[] = [
    { tab: 'tasks', icon: 'tasks', title: 'Aufgaben & Geburtstage', sub: openTasks ? `${openTasks} offen` : 'Nichts offen', badge: openTasks || undefined },
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
