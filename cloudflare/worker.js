/*
 * Familienplaner Sync-Worker für Cloudflare Workers + KV.
 *
 * Gleiches Protokoll wie server/sync-server.js (die App braucht keine Änderung):
 *   GET  /state  -> letzter Stand (Bearer-Token) oder 404
 *   PUT  /state  -> speichert, wenn updatedAt neuer ist (last-write-wins), sonst 409
 *   GET  /health -> { ok: true }
 *   OPTIONS      -> CORS-Preflight
 *
 * Deploy: siehe README ("Cloudflare Workers") – wrangler.toml, KV-Namespace, SYNC_TOKEN als Secret.
 */
const KV_KEY = 'state';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Cache-Control': 'no-store'
  };
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, corsHeaders())
  });
}

const LANDING = `<!doctype html><meta charset="utf-8"><title>Familienplaner Sync</title>
<body style="font-family:system-ui,sans-serif;max-width:40em;margin:3rem auto;padding:0 1rem">
<h1>Familienplaner Sync läuft ✅</h1>
<p>Dieser Worker hält den gemeinsamen Planungsstand für die Familienplaner-App
(GET/PUT <code>/state</code> mit Bearer-Token).</p>
<p>App: APK (<code>dist/familienplaner-1.0.apk</code>) installieren und in
<strong>Extras ▸ Einstellungen ▸ Familien-Sync</strong> diese URL + das Sync-Token eintragen.</p>
</body>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (url.pathname === '/health') return json({ ok: true }, 200);

    if (url.pathname === '/' && request.method === 'GET') {
      return new Response(LANDING, {
        status: 200,
        headers: Object.assign({ 'Content-Type': 'text/html; charset=utf-8' }, corsHeaders())
      });
    }

    if (url.pathname === '/state') {
      const auth = request.headers.get('authorization') || '';
      if (!env.SYNC_TOKEN || auth !== 'Bearer ' + env.SYNC_TOKEN) {
        return json({ error: 'unauthorized' }, 401);
      }

      if (request.method === 'GET') {
        const raw = await env.STATE_KV.get(KV_KEY);
        if (!raw) return json({ error: 'empty' }, 404);
        return new Response(raw, {
          status: 200,
          headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, corsHeaders())
        });
      }

      if (request.method === 'PUT') {
        let incoming;
        try { incoming = await request.json(); } catch (err) { return json({ error: 'invalid json' }, 400); }
        if (!incoming || typeof incoming !== 'object' || typeof incoming.updatedAt !== 'number') {
          return json({ error: 'updatedAt fehlt' }, 400);
        }
        const curRaw = await env.STATE_KV.get(KV_KEY);
        if (curRaw) {
          try {
            const cur = JSON.parse(curRaw);
            if (cur && typeof cur.updatedAt === 'number' && incoming.updatedAt <= cur.updatedAt) {
              return json({ error: 'older', updatedAt: cur.updatedAt }, 409);
            }
          } catch (err) { /* beschädigter Eintrag wird überschrieben */ }
        }
        await env.STATE_KV.put(KV_KEY, JSON.stringify(incoming));
        return json({ ok: true, updatedAt: incoming.updatedAt }, 200);
      }

      return json({ error: 'method not allowed' }, 405);
    }

    return json({ error: 'not found' }, 404);
  }
};
