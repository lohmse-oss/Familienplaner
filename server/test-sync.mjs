#!/usr/bin/env node
/*
 * Test für sync-server.js: startet den Server auf 127.0.0.1 (zufälliger Port)
 * und simuliert zwei Clients (A = Bettys Handy, B = Sebastians Handy).
 * Aufruf: node server/test-sync.mjs
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = 18000 + Math.floor(Math.random() * 2000);
const TOKEN = 'test-token-123';
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-sync-test-'));
const BASE = `http://127.0.0.1:${PORT}`;

const child = spawn(process.execPath, [path.join(here, 'sync-server.js')], {
  env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', SYNC_TOKEN: TOKEN, DATA_DIR },
  stdio: ['ignore', 'pipe', 'pipe']
});
child.stderr.on('data', d => process.stderr.write(d));

let failures = 0;
function check(name, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name);
  if (!cond) failures++;
}

async function waitUp() {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(BASE + '/health');
      if (r.ok) return;
    } catch (err) {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('Server startet nicht');
}

const auth = { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' };
const stateA1 = { version: 1, updatedAt: 1000, updatedBy: 'Bettys Handy', eintraege: [{ id: 'e1', mitglied: 'm1' }], einstellungen: {} };
const stateB2 = { version: 1, updatedAt: 2000, updatedBy: 'Sebastians Handy', eintraege: [{ id: 'e1', mitglied: 'm1' }, { id: 'e2', mitglied: 'm2' }], einstellungen: {} };

try {
  await waitUp();

  let r = await fetch(BASE + '/state');
  check('GET /state ohne Token -> 401', r.status === 401);

  r = await fetch(BASE + '/state', { headers: { Authorization: 'Bearer falsch' } });
  check('GET /state mit falschem Token -> 401', r.status === 401);

  r = await fetch(BASE + '/state', { headers: auth });
  check('GET /state leer -> 404', r.status === 404);

  r = await fetch(BASE + '/state', { method: 'PUT', headers: auth, body: JSON.stringify(stateA1) });
  check('PUT stateA (updatedAt=1000) -> 200', r.status === 200 && (await r.json()).ok === true);

  r = await fetch(BASE + '/state', { headers: auth });
  let st = await r.json();
  check('GET liefert stateA zurück', st.updatedBy === 'Bettys Handy' && st.eintraege.length === 1);

  r = await fetch(BASE + '/state', { method: 'PUT', headers: auth, body: JSON.stringify({ ...stateA1, updatedAt: 500 }) });
  check('PUT älterer Stand -> 409', r.status === 409);

  r = await fetch(BASE + '/state', { method: 'PUT', headers: auth, body: JSON.stringify(stateB2) });
  check('PUT stateB (updatedAt=2000) -> 200', r.status === 200);

  r = await fetch(BASE + '/state', { headers: auth });
  st = await r.json();
  check('Client A sieht stateB (2 Einträge, von Sebastian)', st.updatedAt === 2000 && st.eintraege.length === 2);

  r = await fetch(BASE + '/state', { method: 'PUT', headers: auth, body: 'kein json' });
  check('PUT ungültiges JSON -> 400', r.status === 400);

  r = await fetch(BASE + '/state', { method: 'PUT', headers: auth, body: JSON.stringify({ foo: 1 }) });
  check('PUT ohne updatedAt -> 400', r.status === 400);

  r = await fetch(BASE + '/state', { method: 'OPTIONS' });
  check('OPTIONS preflight -> 204 mit CORS-Headern', r.status === 204 && r.headers.get('access-control-allow-origin') === '*');

  r = await fetch(BASE + '/');
  const html = await r.text();
  check('GET / liefert die App (index.html)', r.status === 200 && html.includes('Familienplaner'));

  r = await fetch(BASE + '/../server/sync-server.js');
  check('Pfad-Traversal blockiert', r.status === 404);

  r = await fetch(BASE + '/health');
  check('GET /health -> ok', r.status === 200 && (await r.json()).ok === true);

  check('State-Datei liegt in DATA_DIR', fs.existsSync(path.join(DATA_DIR, 'state.json')));
} finally {
  child.kill();
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
}

console.log(failures === 0 ? 'ALLE TESTS OK' : failures + ' TEST(S) FEHLGESCHLAGEN');
process.exit(failures === 0 ? 0 : 1);
