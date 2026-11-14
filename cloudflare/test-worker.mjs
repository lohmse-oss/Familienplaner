#!/usr/bin/env node
/*
 * Test für cloudflare/worker.js: ruft den Worker direkt in Node auf
 * (Workers-API Request/Response existieren in Node >= 18) mit gemocktem KV.
 * Aufruf: node cloudflare/test-worker.mjs
 */
import worker from './worker.js';

const TOKEN = 'worker-test-token';
const store = new Map();
const env = {
  SYNC_TOKEN: TOKEN,
  STATE_KV: {
    get: async k => (store.has(k) ? store.get(k) : null),
    put: async (k, v) => { store.set(k, v); }
  }
};

let failures = 0;
const check = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL') + '  ' + name); if (!cond) failures++; };

const call = (path, opts) => worker.fetch(new Request('https://sync.example' + path, opts), env);
const auth = { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' };
const stateA = { version: 1, updatedAt: 1000, updatedBy: 'Bettys Handy', eintraege: [{ id: 'e1' }] };
const stateB = { version: 1, updatedAt: 2000, updatedBy: 'Sebastians Handy', eintraege: [{ id: 'e1' }, { id: 'e2' }] };

let r = await call('/state');
check('GET /state ohne Token -> 401', r.status === 401);

r = await call('/state', { headers: { Authorization: 'Bearer falsch' } });
check('GET /state falsches Token -> 401', r.status === 401);

r = await call('/state', { headers: auth });
check('GET /state leer -> 404', r.status === 404);

r = await call('/state', { method: 'PUT', headers: auth, body: JSON.stringify(stateA) });
check('PUT stateA -> 200 ok', r.status === 200 && (await r.json()).ok === true);

r = await call('/state', { headers: auth });
const got = await r.json();
check('GET liefert stateA (CORS-Header gesetzt)', got.updatedBy === 'Bettys Handy' && r.headers.get('access-control-allow-origin') === '*');

r = await call('/state', { method: 'PUT', headers: auth, body: JSON.stringify({ ...stateA, updatedAt: 500 }) });
check('PUT älterer Stand -> 409', r.status === 409 && (await r.json()).updatedAt === 1000);

r = await call('/state', { method: 'PUT', headers: auth, body: JSON.stringify(stateB) });
check('PUT stateB -> 200', r.status === 200);

r = await call('/state', { headers: auth });
check('Client A sieht stateB (2 Einträge)', (await r.json()).eintraege.length === 2);

r = await call('/state', { method: 'PUT', headers: auth, body: 'kein json' });
check('PUT ungültiges JSON -> 400', r.status === 400);

r = await call('/state', { method: 'PUT', headers: auth, body: JSON.stringify({ foo: 1 }) });
check('PUT ohne updatedAt -> 400', r.status === 400);

r = await call('/state', { method: 'OPTIONS' });
check('OPTIONS -> 204 mit CORS', r.status === 204 && r.headers.get('access-control-allow-headers').includes('Authorization'));

r = await call('/health');
check('GET /health -> ok', r.status === 200 && (await r.json()).ok === true);

r = await call('/');
const html = await r.text();
check('GET / -> Landing-Page', r.status === 200 && html.includes('Familienplaner'));

r = await call('/irgendwas', { headers: auth });
check('Unbekannter Pfad -> 404', r.status === 404);

console.log(failures === 0 ? 'ALLE WORKER-TESTS OK' : failures + ' TEST(S) FEHLGESCHLAGEN');
process.exit(failures ? 1 : 0);
