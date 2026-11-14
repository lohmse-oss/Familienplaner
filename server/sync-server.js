#!/usr/bin/env node
/*
 * Familienplaner Sync-Server (zero dependencies, Node >= 18).
 *
 * Start:  node server/sync-server.js
 * Env:    PORT (default 8080), HOST (default 0.0.0.0),
 *         SYNC_TOKEN (shared secret; if unset, one is generated and stored in data/token.txt),
 *         DATA_DIR (default server/data)
 *
 * Endpoints:
 *   GET /            -> serves the web app (../index.html)
 *   GET /health      -> { ok: true }
 *   GET /state       -> current shared state (Bearer token required)
 *   PUT /state       -> store state if its updatedAt is newer than the stored one (last-write-wins)
 *   OPTIONS *        -> CORS preflight
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const TOKEN_FILE = path.join(DATA_DIR, 'token.txt');
const WEB_ROOT = path.join(__dirname, '..');

function loadToken() {
  if (process.env.SYNC_TOKEN) return process.env.SYNC_TOKEN;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(TOKEN_FILE)) return fs.readFileSync(TOKEN_FILE, 'utf8').trim();
  const t = crypto.randomBytes(24).toString('hex');
  fs.writeFileSync(TOKEN_FILE, t + '\n', { mode: 0o600 });
  return t;
}
const TOKEN = loadToken();

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch (err) { return null; }
}

function writeState(obj) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = STATE_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, STATE_FILE);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function send(res, code, body, extraHeaders) {
  const isObj = typeof body === 'object' && body !== null && !Buffer.isBuffer(body);
  const data = isObj ? JSON.stringify(body) : body;
  res.writeHead(code, Object.assign({
    'Content-Type': isObj ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Cache-Control': 'no-store'
  }, extraHeaders || {}));
  res.end(data);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'OPTIONS') { send(res, 204, ''); return; }

  if (url.pathname === '/health') { send(res, 200, { ok: true }); return; }

  if (url.pathname === '/state') {
    const auth = req.headers['authorization'] || '';
    if (auth !== 'Bearer ' + TOKEN) { send(res, 401, { error: 'unauthorized' }); return; }

    if (req.method === 'GET') {
      const st = readState();
      if (!st) { send(res, 404, { error: 'empty' }); return; }
      send(res, 200, st);
      return;
    }

    if (req.method === 'PUT') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 5 * 1024 * 1024) req.destroy();
      });
      req.on('end', () => {
        let incoming;
        try { incoming = JSON.parse(body); } catch (err) { send(res, 400, { error: 'invalid json' }); return; }
        if (!incoming || typeof incoming !== 'object' || typeof incoming.updatedAt !== 'number') {
          send(res, 400, { error: 'updatedAt fehlt' });
          return;
        }
        const cur = readState();
        if (cur && typeof cur.updatedAt === 'number' && incoming.updatedAt <= cur.updatedAt) {
          send(res, 409, { error: 'older', updatedAt: cur.updatedAt });
          return;
        }
        writeState(incoming);
        send(res, 200, { ok: true, updatedAt: incoming.updatedAt });
      });
      return;
    }

    send(res, 405, { error: 'method not allowed' });
    return;
  }

  if (req.method === 'GET') {
    const p = decodeURIComponent(url.pathname);
    if (p !== '/' && p !== '/index.html') { send(res, 404, 'not found'); return; }
    const file = path.join(WEB_ROOT, 'index.html');
    if (!fs.existsSync(file)) { send(res, 404, 'index.html fehlt'); return; }
    res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
    return;
  }

  send(res, 405, { error: 'method not allowed' });
});

server.listen(PORT, HOST, () => {
  console.log(`Familienplaner Sync-Server läuft auf http://${HOST}:${PORT}`);
  console.log(`App im Browser öffnen: http://<dieser-rechner>:${PORT}/`);
  console.log(`Sync-Token (in der App unter Extras → Einstellungen → Familien-Sync eintragen):`);
  console.log(`  ${TOKEN}`);
});
