import { annotateChanges } from '../../app/src/core/describe';
import type { Item } from '../../app/src/core/types';

export interface Env {
  DB: D1Database;
  FAMILY_CODE: string; // Vollzugriff (Sebastian, Betty)
  READ_CODE?: string; // nur Lesezugriff (z. B. Ida)
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, x-family-code',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...CORS } });

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

type Role = 'write' | 'read';
function roleOf(code: string, env: Env): Role | null {
  if (env.FAMILY_CODE && safeEqual(code, env.FAMILY_CODE)) return 'write';
  if (env.READ_CODE && safeEqual(code, env.READ_CODE)) return 'read';
  return null;
}

/* ---------- Rate-Limit für Fehlversuche am Code (best effort, pro Worker-Isolate) ---------- */
const RL_WINDOW_MS = 60_000;
const RL_MAX = 20;
const rlFails = new Map<string, { n: number; reset: number }>();
function tooManyFails(ip: string): boolean {
  const now = Date.now();
  if (rlFails.size > 1000) rlFails.clear();
  const e = rlFails.get(ip);
  if (!e || e.reset < now) {
    rlFails.set(ip, { n: 1, reset: now + RL_WINDOW_MS });
    return false;
  }
  e.n++;
  return e.n > RL_MAX;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
interface Incoming {
  id: string;
  kind: string;
  updated: number;
  start: string;
  end: string;
  [k: string]: unknown;
}
function valid(i: unknown): i is Incoming {
  const x = i as Incoming;
  return (
    !!x &&
    typeof x.id === 'string' && x.id.length > 0 && x.id.length <= 100 &&
    typeof x.kind === 'string' &&
    typeof x.updated === 'number' && Number.isFinite(x.updated) &&
    typeof x.start === 'string' && ISO.test(x.start) &&
    typeof x.end === 'string' && ISO.test(x.end)
  );
}

/** Abgleich: Client schickt geänderte Einträge + letzte bekannte Revision, bekommt alles Neuere zurück. */
async function sync(req: Request, env: Env, role: Role): Promise<Response> {
  let body: { since?: number; items?: unknown[] };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'ungültiges JSON' }, 400);
  }
  const since = Number(body.since) || 0;
  const incoming = Array.isArray(body.items) ? body.items : [];
  if (incoming.length > 1000) return json({ error: 'zu viele Einträge' }, 413);
  if (role === 'read' && incoming.length) return json({ error: 'Nur Lesezugriff', role }, 403);

  if (incoming.length) {
    // Last-Write-Wins: nur schreiben, wenn der Eintrag neuer ist als der gespeicherte
    const upsert = (raw: Incoming, rev: number) =>
      env.DB.prepare(
        `INSERT INTO items (id, data, updated, rev) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated = excluded.updated, rev = excluded.rev
         WHERE excluded.updated > items.updated`,
      ).bind(raw.id, JSON.stringify(raw), raw.updated, rev);
    const build = async (): Promise<D1PreparedStatement[]> => {
      const max = (await env.DB.prepare('SELECT COALESCE(MAX(rev),0) AS m FROM items').first<{ m: number }>())?.m ?? 0;
      let rev = Math.max(Date.now(), max + 1);
      return incoming.filter(valid).map((raw) => upsert(raw, rev++));
    };
    const stmts = await build();
    if (stmts.length) {
      try {
        await env.DB.batch(stmts);
      } catch {
        // UNIQUE(rev) verletzt durch parallelen Sync -> einmal mit frischen Revisionen wiederholen
        await env.DB.batch(await build());
      }
    }
  }

  const rows = await env.DB.prepare('SELECT data, rev FROM items WHERE rev > ?1 ORDER BY rev').bind(since).all<{ data: string; rev: number }>();
  const top = (await env.DB.prepare('SELECT COALESCE(MAX(rev),0) AS m FROM items').first<{ m: number }>())?.m ?? 0;
  // _rev: Server-Revision, _text/_verb: lesbare Beschreibung der Änderung (für Hinweise „Betty hat … eingetragen“)
  const items = annotateChanges((rows.results ?? []).map((r) => ({ ...(JSON.parse(r.data) as Item), _rev: r.rev })));
  return json({ rev: Math.max(top, since), role, items });
}

/* ---------- Feiertage & Schulferien Sachsen (OpenHolidays API) ---------- */
const OH = 'https://openholidaysapi.org';
const HOLIDAY_TTL_MS = 3 * 24 * 3600 * 1000;

interface OhEntry {
  name: { text: string }[];
  startDate: string;
  endDate: string;
  nationwide?: boolean;
}
const norm = (h: OhEntry) => ({ name: h.name[0]?.text ?? '?', start: h.startDate, end: h.endDate, nationwide: !!h.nationwide });

export async function refreshHolidays(env: Env, f: typeof fetch = fetch): Promise<unknown> {
  const y = new Date().getUTCFullYear();
  const q = `countryIsoCode=DE&subdivisionCode=DE-SN&validFrom=${y - 1}-01-01&validTo=${y + 1}-12-31&languageIsoCode=DE`;
  const get = async (p: string) => {
    const r = await f(`${OH}/${p}?${q}`);
    if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`);
    return (await r.json()) as OhEntry[];
  };
  const [pub, school] = await Promise.all([get('PublicHolidays'), get('SchoolHolidays')]);
  const data = {
    source: 'openholidaysapi.org (DE-SN)',
    fetchedAt: new Date().toISOString().slice(0, 10),
    holidays: pub.map(norm),
    school: school.map(norm),
  };
  await env.DB.prepare('INSERT INTO kv (k, v, ts) VALUES (?1, ?2, ?3) ON CONFLICT(k) DO UPDATE SET v = excluded.v, ts = excluded.ts')
    .bind('holidays', JSON.stringify(data), Date.now())
    .run();
  return data;
}

async function holidays(env: Env, f: typeof fetch): Promise<Response> {
  const cached = await env.DB.prepare("SELECT v, ts FROM kv WHERE k = 'holidays'").first<{ v: string; ts: number }>();
  if (cached && Date.now() - cached.ts < HOLIDAY_TTL_MS) return json(JSON.parse(cached.v));
  try {
    return json(await refreshHolidays(env, f));
  } catch (e) {
    if (cached) return json(JSON.parse(cached.v)); // veralteter Stand ist besser als nichts
    return json({ error: String(e) }, 502);
  }
}

export async function handle(req: Request, env: Env, f: typeof fetch = fetch): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const url = new URL(req.url);
  if (url.pathname === '/' || url.pathname === '/health') return json({ ok: true, app: 'familienplaner' });

  const role = roleOf(req.headers.get('x-family-code') ?? '', env);
  if (!role) {
    const ip = req.headers.get('cf-connecting-ip') ?? 'unknown';
    if (tooManyFails(ip)) return json({ error: 'zu viele Fehlversuche – kurz warten' }, 429);
    return json({ error: 'Familiencode falsch' }, 401);
  }

  if (url.pathname === '/api/sync' && req.method === 'POST') return sync(req, env, role);
  if (url.pathname === '/api/holidays' && req.method === 'GET') return holidays(env, f);
  return json({ error: 'nicht gefunden' }, 404);
}

export default {
  fetch: (req: Request, env: Env) => handle(req, env),
  scheduled: async (_e: ScheduledController, env: Env, ctx: ExecutionContext) => {
    ctx.waitUntil(refreshHolidays(env).catch(() => undefined));
  },
} satisfies ExportedHandler<Env>;
