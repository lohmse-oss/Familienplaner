import { useState } from 'preact/hooks';
import { fmt } from '../core/dates';
import { buildNotices } from '../core/notify';
import { today } from '../core/dates';
import { PARENTS, PERSONS } from '../core/types';
import { sync, updateSettings, useStore } from '../store';
import { Chips } from './common';
import { Ic } from './icons';

export function Settings() {
  const { settings, sync: st, hd, cal } = useStore();
  const [server, setServer] = useState(settings.server);
  const [code, setCode] = useState(settings.code);
  const upcoming = buildNotices(cal, new Date(), today());

  const status = {
    off: 'nicht verbunden – Daten liegen nur auf diesem Handy',
    idle: st.last ? `verbunden · zuletzt ${new Date(st.last).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` : 'verbunden',
    syncing: 'synchronisiere …',
    error: `Fehler: ${st.msg ?? 'unbekannt'} (Daten bleiben lokal gespeichert)`,
  }[st.status];

  return (
    <div class="page">
      <h3 class="section">Dieses Handy gehört</h3>
      <section class="card form">
        <Chips<string> options={PARENTS.map((p) => ({ value: p, label: PERSONS[p].name, color: PERSONS[p].color }))} value={[settings.me]} onChange={(v) => updateSettings({ me: v[0] as 'sebastian' | 'betty' })} />
        <p class="hint">Damit sehen beide, wer etwas eingetragen hat.</p>
      </section>

      <h3 class="section">Darstellung</h3>
      <section class="card form">
        <label>Farbschema</label>
        <Chips<'system' | 'light' | 'dark'>
          options={[{ value: 'system', label: 'Wie das Handy' }, { value: 'light', label: <><Ic n="sun" size={15} /> Hell</> }, { value: 'dark', label: <><Ic n="moon" size={15} /> Dunkel</> }]}
          value={[settings.theme]}
          onChange={(v) => updateSettings({ theme: v[0] })}
        />
        <p class="hint">Die Kopfzeile zeigt die Farbe der Person, der dieses Handy gehört.</p>
      </section>

      <h3 class="section">Synchronisierung (Cloudflare)</h3>
      <section class="card form">
        <label>Server-Adresse</label>
        <input type="url" placeholder="https://familienplaner-sync.<konto>.workers.dev" value={server} onInput={(e) => setServer((e.target as HTMLInputElement).value)} autocapitalize="off" />
        <label>Familiencode</label>
        <input type="password" value={code} onInput={(e) => setCode((e.target as HTMLInputElement).value)} autocomplete="off" />
        <div class="actions">
          <button class="btn primary" onClick={() => { updateSettings({ server: server.trim(), code: code.trim() }); }}>Speichern &amp; verbinden</button>
          <button class="btn" disabled={!settings.server || !settings.code} onClick={() => void sync()}>Jetzt abgleichen</button>
        </div>
        <p class={`hint ${st.status === 'error' ? 'neg' : ''}`}>{status}</p>
      </section>

      <h3 class="section">Hinweise vom Partner</h3>
      <section class="card form">
        <label class="check"><input type="checkbox" checked={settings.notifyPartner} onChange={(e) => updateSettings({ notifyPartner: (e.target as HTMLInputElement).checked })} /> Hinweis, wenn {settings.me === 'betty' ? 'Sebastian' : 'Betty'} etwas einträgt oder ändert</label>
        <p class="hint">Bei geöffneter App sofort, sonst über den Hintergrund-Abgleich spätestens nach etwa 15 Minuten. Einkaufsliste und Einstellungen lösen keinen Hinweis aus.</p>
      </section>

      <h3 class="section">Widget „Heute“</h3>
      <section class="card form">
        <label>Hintergrund</label>
        <Chips<'transparent' | 'glass' | 'dark' | 'light'>
          options={[{ value: 'transparent', label: 'Transparent' }, { value: 'glass', label: 'Glas' }, { value: 'dark', label: 'Dunkel' }, { value: 'light', label: 'Hell' }]}
          value={[settings.widgetStyle]}
          onChange={(v) => updateSettings({ widgetStyle: v[0] })}
        />
        <p class="hint">Gestaltet im Stil von Nothing OS: Punktmatrix-Schrift, schwarz-weiß mit roter Warnfarbe. Hinzufügen: Homescreen lange drücken → Widgets → „Familienplaner Heute“.</p>
      </section>

      <h3 class="section">Benachrichtigungen</h3>
      <section class="card form">
        <label class="check"><input type="checkbox" checked={settings.notify} onChange={(e) => updateSettings({ notify: (e.target as HTMLInputElement).checked })} /> Erinnerungen, Tages- und Wochenvorschau, Betreuungs-Warnungen</label>
        <p class="hint">{upcoming.length} Benachrichtigungen geplant (nächste 60 Tage). Tagesvorschau 07:00 · Wochenvorschau Sonntag 18:00 · Termine 1 Std. und 1 Tag vorher · Betreuungslücken 14 und 3 Tage vorher.</p>
      </section>

      <h3 class="section">Feiertage &amp; Ferien</h3>
      <section class="card form">
        <p class="hint">Sachsen / Chemnitz · Quelle: {hd.source} · Stand {fmt(hd.fetchedAt)}. Wird automatisch aktualisiert; abweichende Schließtage trägst du als „Betreuungsbedarf“ ein.</p>
      </section>
    </div>
  );
}
