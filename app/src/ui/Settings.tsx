import type { ComponentChildren } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { fmt, today } from '../core/dates';
import { parseIcs } from '../core/ics';
import { buildNotices } from '../core/notify';
import { PERSONS, type PersonId } from '../core/types';
import { batch, newId, saveItem, sync, updateSettings, useStore } from '../store';
import { Chips } from './common';
import { Ic, type IconName } from './icons';

/** Aufklappbare Gruppe – hält die Einstellungen übersichtlich. */
function Group({ icon, title, summary, open, children }: { icon: IconName; title: string; summary?: string; open?: boolean; children: ComponentChildren }) {
  return (
    <details class="acc" open={open}>
      <summary>
        <Ic n={icon} size={18} class="muted" />
        <span class="grow"><b>{title}</b>{summary && <small>{summary}</small>}</span>
        <Ic n="down" size={16} class="muted chev" />
      </summary>
      <div class="acc-body form">{children}</div>
    </details>
  );
}

const WHO: PersonId[] = ['sebastian', 'betty', 'ida'];

export function Settings() {
  const { settings, sync: st, hd, cal, readOnly } = useStore();
  const [server, setServer] = useState(settings.server);
  const [code, setCode] = useState(settings.code);
  const [icsText, setIcsText] = useState('');
  const [icsMsg, setIcsMsg] = useState('');
  const icsFile = useRef<HTMLInputElement>(null);
  const upcoming = buildNotices(cal, new Date(), today());

  const importIcs = (text: string) => {
    const evs = parseIcs(text);
    if (!evs.length) {
      setIcsMsg('Keine Termine (VEVENT) gefunden.');
      return;
    }
    batch(() => {
      for (const ev of evs) saveItem({ id: newId(), kind: 'event', sub: 'sonstiges', persons: [], owner: null, ...ev });
    });
    setIcsText('');
    setIcsMsg(`${evs.length} Termin${evs.length === 1 ? '' : 'e'} importiert.`);
  };
  const partnerName = settings.me === 'betty' ? 'Sebastian' : settings.me === 'sebastian' ? 'Betty' : 'Sebastian und Betty';

  const status = {
    off: 'nicht verbunden – Daten liegen nur auf diesem Handy',
    idle: st.last ? `verbunden · zuletzt ${new Date(st.last).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` : 'verbunden',
    syncing: 'synchronisiere …',
    error: `Fehler: ${st.msg ?? 'unbekannt'} (Daten bleiben lokal gespeichert)`,
  }[st.status];

  return (
    <div class="page narrow">
      <Group icon="user" title="Ich & Zugriff" summary={`${PERSONS[settings.me].name} · ${readOnly ? 'nur Lesen' : 'Lesen & Bearbeiten'}`} open>
        <label>Dieses Handy gehört</label>
        <Chips<PersonId>
          options={WHO.map((p) => ({ value: p, label: PERSONS[p].name, color: PERSONS[p].color }))}
          value={[settings.me]}
          onChange={(v) => updateSettings({ me: v[0], ...(PERSONS[v[0]].adult ? {} : { notifyPartner: false }) })}
        />
        <p class="hint">Damit sehen alle, wer etwas eingetragen hat. Die Kopfzeile trägt deine Farbe.</p>
        <p class="hint">Zugriff: <b>{readOnly ? 'nur Lesen' : 'Lesen und Bearbeiten'}</b> – bestimmt der Code unter „Synchronisierung“.</p>
      </Group>

      <Group icon="check" title="Synchronisierung" summary={status}>
        <label>Server-Adresse</label>
        <input type="url" placeholder="https://familienplaner-sync.<konto>.workers.dev" value={server} onInput={(e) => setServer((e.target as HTMLInputElement).value)} autocapitalize="off" />
        <label>Code (Familiencode oder Lese-Code)</label>
        <input type="password" value={code} onInput={(e) => setCode((e.target as HTMLInputElement).value)} autocomplete="off" />
        <div class="actions">
          <button class="btn primary" onClick={() => { updateSettings({ server: server.trim(), code: code.trim() }); }}>Speichern &amp; verbinden</button>
          <button class="btn" disabled={!settings.server || !settings.code} onClick={() => void sync()}>Jetzt abgleichen</button>
        </div>
        <p class={`hint ${st.status === 'error' ? 'neg' : ''}`}>{status}</p>
      </Group>

      <Group icon="bell" title="Hinweise" summary={settings.notify || settings.notifyPartner ? 'an' : 'aus'}>
        <label class="check"><input type="checkbox" checked={settings.notifyPartner} onChange={(e) => updateSettings({ notifyPartner: (e.target as HTMLInputElement).checked })} /> Hinweis, wenn {partnerName} etwas einträgt oder ändert</label>
        <p class="hint">Bei geöffneter App sofort, sonst über den Hintergrund-Abgleich nach etwa 15 Minuten. Einkaufsliste und Einstellungen lösen keinen Hinweis aus.</p>
        <label class="check"><input type="checkbox" checked={settings.notify} onChange={(e) => updateSettings({ notify: (e.target as HTMLInputElement).checked })} /> Erinnerungen, Tages- und Wochenvorschau, Betreuungs-Warnungen</label>
        <p class="hint">{upcoming.length} Benachrichtigungen geplant (nächste 60 Tage). Tagesvorschau 07:00 · Wochenvorschau Sonntag 18:00 · Termine 1 Std. und 1 Tag vorher · Betreuungslücken 14 und 3 Tage vorher.</p>
      </Group>

      <Group icon="sun" title="Darstellung & Widget" summary={`${settings.theme === 'system' ? 'Wie das Handy' : settings.theme === 'dark' ? 'Dunkel' : 'Hell'} · Widget ${{ transparent: 'transparent', glass: 'Glas', dark: 'dunkel', light: 'hell' }[settings.widgetStyle]}`}>
        <label>Farbschema</label>
        <Chips<'system' | 'light' | 'dark'>
          options={[{ value: 'system', label: 'Wie das Handy' }, { value: 'light', label: <><Ic n="sun" size={15} /> Hell</> }, { value: 'dark', label: <><Ic n="moon" size={15} /> Dunkel</> }]}
          value={[settings.theme]}
          onChange={(v) => updateSettings({ theme: v[0] })}
        />
        <label>Widget „Heute“: Hintergrund</label>
        <Chips<'transparent' | 'glass' | 'dark' | 'light'>
          options={[{ value: 'transparent', label: 'Transparent' }, { value: 'glass', label: 'Glas' }, { value: 'dark', label: 'Dunkel' }, { value: 'light', label: 'Hell' }]}
          value={[settings.widgetStyle]}
          onChange={(v) => updateSettings({ widgetStyle: v[0] })}
        />
        <p class="hint">Zwei Widget-Designs: „Familienplaner Heute“ (Nothing-Stil: Kreise mit Zahlen) und „Familienplaner Heute (Standard)“ (Text-Kachel). Hinzufügen: Homescreen lange drücken → Widgets. Der Hintergrund (diese Einstellung) gilt für beide.</p>
      </Group>

      <Group icon="year" title="Feiertage & Ferien" summary={`Sachsen · Stand ${fmt(hd.fetchedAt)}`}>
        <p class="hint">Sachsen / Chemnitz · Quelle: {hd.source} · Stand {fmt(hd.fetchedAt)}. Wird automatisch aktualisiert; abweichende Schließtage trägst du als „Betreuungsbedarf“ ein.</p>
      </Group>

      {!readOnly && (
        <Group icon="addcal" title="Kalender importieren (ICS)" summary="Schul-/Kita-Kalender als .ics">
          <textarea rows={4} placeholder="ICS-Inhalt hier einfügen …" value={icsText} onInput={(e) => setIcsText((e.target as HTMLTextAreaElement).value)} />
          <div class="actions">
            <button class="btn" onClick={() => icsFile.current?.click()}>Datei wählen …</button>
            <span class="grow" />
            <button class="btn primary" disabled={!icsText.trim()} onClick={() => importIcs(icsText)}>Importieren</button>
          </div>
          <input ref={icsFile} type="file" accept=".ics,text/calendar" style={{ display: 'none' }} onChange={async (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) importIcs(await f.text()); }} />
          {icsMsg && <p class="hint">{icsMsg}</p>}
          <p class="hint">Termine aus der Datei landen als „Termin (Sonstiges)“ – Datum, Uhrzeit, Ort/Notiz werden übernommen.</p>
        </Group>
      )}
    </div>
  );
}
