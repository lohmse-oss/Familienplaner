import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 19000 + Math.floor(Math.random() * 2000);
const TOKEN = 'app-test-token';
const BASE = `http://127.0.0.1:${PORT}`;
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-app-test-'));

const server = spawn(process.execPath, [path.join(REPO, 'server/sync-server.js')], {
  env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', SYNC_TOKEN: TOKEN, DATA_DIR },
  stdio: ['ignore', 'pipe', 'pipe']
});
server.stderr.on('data', d => process.stderr.write(d));

let failures = 0;
const check = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL') + '  ' + name); if (!cond) failures++; };

async function waitUp() {
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(BASE + '/health')).ok) return; } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('Server startet nicht');
}

function makeSandbox() {
  const store = new Map();
  const sandbox = {
    console, JSON, Math, Date, setTimeout, clearTimeout, setInterval, clearInterval,
    fetch: globalThis.fetch.bind(globalThis),
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k)
    },
    module: { exports: {} }
  };
  vm.createContext(sandbox);
  const html = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  vm.runInContext(m[1], sandbox);
  sandbox.render = () => {};
  sandbox.alert = (m) => { console.log("ALERT:", m); };
  sandbox.setSyncStatus = () => {};
  return sandbox;
}

try {
  await waitUp();
  const sb = makeSandbox();
  const KEY = 'familienplaner.v1';

  sb.load();
  let st = JSON.parse(sb.localStorage.getItem(KEY));
  check('Default-State geladen (4 Mitglieder)', st && st.mitglieder.length === 4);

  st.einstellungen.syncUrl = BASE;
  st.einstellungen.syncToken = TOKEN;
  st.einstellungen.geraetName = 'Test-Handy';
  sb.localStorage.setItem(KEY, JSON.stringify(st));
  sb.load();
  await sb.syncPush();

  let r = await fetch(BASE + '/state', { headers: { Authorization: 'Bearer ' + TOKEN } });
  let remote = await r.json();
  check('Push landet auf dem Server (updatedBy=Test-Handy)', r.status === 200 && remote.updatedBy === 'Test-Handy' && typeof remote.updatedAt === 'number');
  check('Push legt kein Sync-Token im geteilten Zustand ab', remote.einstellungen && remote.einstellungen.syncToken === '');

  const other = { ...remote, updatedAt: remote.updatedAt + 10000, updatedBy: 'Anderes Handy', eintraege: [{ id: 'e99', mitgliedId: 'm2', typ: 'urlaub', von: '2026-08-03', bis: '2026-08-07', titel: 'Festival' }] };
  r = await fetch(BASE + '/state', { method: 'PUT', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(other) });
  check('Anderes Gerät pusht -> 200', r.status === 200);

  await sb.syncPull();
  st = JSON.parse(sb.localStorage.getItem(KEY));
  check('Pull übernimmt neueren Stand (e99 da, updatedBy=Anderes Handy)', st.eintraege.some(e => e.id === 'e99') && st.updatedBy === 'Anderes Handy');

  // älterer Remote-Stand darf nicht übernommen werden
  const old = { ...other, updatedAt: 1, updatedBy: 'Alt', eintraege: [] };
  await fetch(BASE + '/state', { method: 'PUT', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...other, updatedAt: other.updatedAt + 5000 }) });
  await sb.syncPull();
  st = JSON.parse(sb.localStorage.getItem(KEY));
  check('Pull nach neuerem Push behält lokalen Stand', st.updatedBy === 'Anderes Handy' && st.eintraege.length === 1);

  // updatedAt muss einen Neustart überstehen, sonst überschreibt der Server später lokale Änderungen
  const ts = st.updatedAt;
  sb.load();
  check('load() behält updatedAt/updatedBy (Neustart)', vm.runInContext('state.updatedAt', sb) === ts && vm.runInContext('state.updatedBy', sb) === 'Anderes Handy');

  // Server-Daten sind nicht vertrauenswürdig: Pull validiert wie der Import und behält die Geräte-Einstellungen
  const boese = { ...other, updatedAt: other.updatedAt + 9000, updatedBy: 'Evil', ansicht: 'balken', jahr: 2029,
    mitglieder: [{ id: 'm1', name: 'A', rolle: 'elternteil', farbe: 'red;" onmouseover="x', urlaubstage: 30 }, ...st.mitglieder.slice(1)],
    eintraege: [{ id: 'e"><script>', mitgliedId: 'm1', typ: 'urlaub', von: '2026-08-03', bis: '2026-08-07' }, { id: 'x', mitgliedId: 'nix', typ: 'urlaub', von: '2026-08-03', bis: '2026-08-07' }],
    einstellungen: { ...st.einstellungen, syncUrl: 'http://evil', syncToken: 'evil-token', geraetName: 'Evil-Gerät' } };
  await fetch(BASE + '/state', { method: 'PUT', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(boese) });
  await sb.syncPull();
  st = JSON.parse(sb.localStorage.getItem(KEY));
  check('Pull übernimmt den neuen Stand (updatedBy=Evil)', st.updatedBy === 'Evil');
  check('Pull validiert Server-Daten (Farbe und ID bereinigt, Eintrag ohne Person verworfen)', st.mitglieder[0].farbe === '#6b7280' && st.eintraege.length === 1 && /^[A-Za-z0-9_-]+$/.test(st.eintraege[0].id));
  check('Pull behält Sync-Zugang und Gerätename dieses Geräts', st.einstellungen.syncUrl === BASE && st.einstellungen.syncToken === TOKEN && st.einstellungen.geraetName === 'Test-Handy');
  check('Pull behält eigene Ansicht und Jahr', st.ansicht !== 'balken' && st.jahr !== 2029);

  // Export darf das Token nicht enthalten
  let captured = null;
  sb.Blob = class { constructor(parts) { this.parts = parts; } text() { return Promise.resolve(this.parts.join('')); } };
  sb.URL = { createObjectURL: b => { captured = b; return 'blob:fake'; }, revokeObjectURL: () => {} };
  sb.document = { createElement: () => ({ click() {}, href: '', download: '' }) };
  sb.exportJson();
  const exported = captured ? await captured.text() : '';
  check('JSON-Export enthält kein syncToken', !!captured && !exported.includes(TOKEN) && exported.includes('"einstellungen"'));

  // Import behält lokale Sync-Konfiguration
  const importData = { version: 1, jahr: 2027, mitglieder: st.mitglieder, eintraege: [{ id: 'e1' }], eigeneFerien: [], einstellungen: { fronleichnamRegional: true, syncUrl: 'http://evil', syncToken: 'evil-token', geraetName: 'evil' } };
  sb.FileReader = class {
    readAsText() { this.result = JSON.stringify(importData); this.onload(); }
  };
  sb.importJson({});
  st = JSON.parse(sb.localStorage.getItem(KEY));
  check('Import überschreibt Sync-Konfig nicht', st.einstellungen.syncUrl === BASE && st.einstellungen.syncToken === TOKEN && st.einstellungen.geraetName === 'Test-Handy');
  check('Import übernimmt Rest (fronleichnam=true, jahr=2027)', st.einstellungen.fronleichnamRegional === true && st.jahr === 2027);

  check('Datum-/Feiertags-Modul exportiert (module.exports)', typeof sb.module.exports.feiertageSachsen === 'function');
} finally {
  server.kill();
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
}

console.log(failures === 0 ? 'ALLE APP-TESTS OK' : failures + ' TEST(S) FEHLGESCHLAGEN');
process.exit(failures ? 1 : 0);
