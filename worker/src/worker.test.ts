import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it } from 'vitest';
import { handle, type Env } from './index';

/** Minimaler D1-Ersatz auf Basis von node:sqlite, damit die echten SQL-Statements getestet werden. */
// node:sqlite per require laden (Vite kennt das Modul noch nicht als Builtin)
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as { DatabaseSync: new (p: string) => any };

function fakeD1(): D1Database {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  const stmt = (sql: string, args: unknown[] = []) => ({
    bind: (...a: unknown[]) => stmt(sql, a),
    first: async () => (db.prepare(sql).get(...(args as never[])) as unknown) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...(args as never[])) }),
    run: async () => (db.prepare(sql).run(...(args as never[])), { success: true }),
    __run: () => db.prepare(sql).run(...(args as never[])),
  });
  return {
    prepare: (sql: string) => stmt(sql),
    batch: async (list: { __run: () => unknown }[]) => list.map((s) => s.__run()),
  } as unknown as D1Database;
}

const env = (): Env => ({ DB: fakeD1(), FAMILY_CODE: 'geheim', READ_CODE: 'nurlesen' });
const call = (e: Env, path: string, init: RequestInit & { code?: string } = {}, f?: typeof fetch) =>
  handle(new Request(`https://x.test${path}`, { ...init, headers: { 'x-family-code': init.code ?? 'geheim', 'content-type': 'application/json' } }), e, f);
const item = (id: string, updated: number, extra = {}) => ({ id, kind: 'event', start: '2027-03-10', end: '2027-03-10', persons: [], updated, ...extra });

describe('Worker', () => {
  let e: Env;
  beforeEach(() => (e = env()));

  it('lehnt falschen Familiencode ab', async () => {
    expect((await call(e, '/api/sync', { method: 'POST', body: '{}', code: 'falsch' })).status).toBe(401);
    expect((await call(e, '/api/holidays', { code: '' })).status).toBe(401);
  });

  it('synchronisiert zwischen zwei Geräten', async () => {
    const a = await (await call(e, '/api/sync', { method: 'POST', body: JSON.stringify({ since: 0, items: [item('1', 100, { title: 'Arzt' })] }) })).json() as { rev: number; items: { id: string }[] };
    expect(a.items.map((i) => i.id)).toEqual(['1']);
    // zweites Gerät holt alles
    const b = await (await call(e, '/api/sync', { method: 'POST', body: JSON.stringify({ since: 0, items: [] }) })).json() as typeof a;
    expect(b.items).toHaveLength(1);
    // zweites Gerät ändert, erstes holt nur das Neue
    await call(e, '/api/sync', { method: 'POST', body: JSON.stringify({ since: b.rev, items: [item('2', 200, { title: 'Kita' })] }) });
    const c = await (await call(e, '/api/sync', { method: 'POST', body: JSON.stringify({ since: a.rev, items: [] }) })).json() as typeof a;
    expect(c.items.map((i) => i.id)).toEqual(['2']);
    expect(c.rev).toBeGreaterThan(a.rev);
  });

  it('Last-Write-Wins: ältere Änderung überschreibt nicht', async () => {
    await call(e, '/api/sync', { method: 'POST', body: JSON.stringify({ items: [item('1', 500, { title: 'neu' })] }) });
    await call(e, '/api/sync', { method: 'POST', body: JSON.stringify({ items: [item('1', 400, { title: 'alt' })] }) });
    const r = await (await call(e, '/api/sync', { method: 'POST', body: '{"since":0}' })).json() as { items: { title: string }[] };
    expect(r.items[0].title).toBe('neu');
  });

  it('Löschen wird als Markierung synchronisiert und ungültige Einträge ignoriert', async () => {
    await call(e, '/api/sync', { method: 'POST', body: JSON.stringify({ items: [item('1', 1), { id: 'x' }, item('3', 5, { start: 'kaputt' })] }) });
    await call(e, '/api/sync', { method: 'POST', body: JSON.stringify({ items: [item('1', 2, { deleted: true })] }) });
    const r = await (await call(e, '/api/sync', { method: 'POST', body: '{"since":0}' })).json() as { items: { id: string; deleted?: boolean }[] };
    expect(r.items).toEqual([expect.objectContaining({ id: '1', deleted: true })]);
  });

  it('lädt Ferien von OpenHolidays, cached sie und fällt bei Ausfall auf den Cache zurück', async () => {
    let calls = 0;
    const f = (async (url: string) => {
      calls++;
      const school = String(url).includes('SchoolHolidays');
      return new Response(JSON.stringify([{ name: [{ text: school ? 'Sommerferien' : 'Neujahr' }], startDate: '2027-07-10', endDate: '2027-08-20', nationwide: !school }]));
    }) as unknown as typeof fetch;
    const r1 = await (await call(e, '/api/holidays', {}, f)).json() as { school: { name: string }[]; holidays: unknown[] };
    expect(r1.school[0].name).toBe('Sommerferien');
    expect(calls).toBe(2);
    await call(e, '/api/holidays', {}, f);
    expect(calls).toBe(2); // aus dem Cache
    const down = (async () => new Response('x', { status: 500 })) as unknown as typeof fetch;
    await e.DB.prepare("UPDATE kv SET ts = 0 WHERE k = 'holidays'").run(); // Cache abgelaufen
    const r3 = await call(e, '/api/holidays', {}, down);
    expect(r3.status).toBe(200); // veralteter Stand statt Fehler
  });

  it('liefert Revision und lesbare Beschreibung der Änderungen mit (für Hinweise)', async () => {
    const trip = item('t1', 2000, { kind: 'presence', mode: 'trip', persons: ['sebastian'], start: '2027-07-13', end: '2027-07-14', title: 'Messe Köln', by: 'sebastian', created: 1500 });
    const shop = item('s1', 2100, { kind: 'shop', title: 'Milch', by: 'sebastian' });
    await call(e, '/api/sync', { method: 'POST', body: JSON.stringify({ since: 0, items: [trip, shop] }) });
    const r = await (await call(e, '/api/sync', { method: 'POST', body: JSON.stringify({ since: 0, items: [] }) })).json() as { items: { id: string; _rev: number; _text?: string; _verb?: string }[] };
    const t = r.items.find((x) => x.id === 't1')!;
    expect(t._verb).toBe('new');
    expect(t._text).toBe('Dienstreise Sebastian, Di 13.07.–Mi 14.07.2027 – Messe Köln');
    expect(typeof t._rev).toBe('number');
    expect(r.items.find((x) => x.id === 's1')!._text).toBeUndefined(); // Einkauf wird nicht gemeldet
  });

  it('Lesecode: darf abgleichen und Ferien laden, aber nichts schreiben', async () => {
    await call(e, '/api/sync', { method: 'POST', body: JSON.stringify({ items: [item('1', 100, { title: 'Arzt' })] }) });
    const read = await call(e, '/api/sync', { method: 'POST', body: JSON.stringify({ since: 0, items: [] }), code: 'nurlesen' });
    expect(read.status).toBe(200);
    const data = await read.json() as { role: string; items: { id: string }[] };
    expect(data.role).toBe('read');
    expect(data.items).toHaveLength(1);
    const write = await call(e, '/api/sync', { method: 'POST', body: JSON.stringify({ items: [item('2', 200)] }), code: 'nurlesen' });
    expect(write.status).toBe(403);
    const all = await (await call(e, '/api/sync', { method: 'POST', body: '{"since":0}' })).json() as { role: string; items: unknown[] };
    expect(all.role).toBe('write');
    expect(all.items).toHaveLength(1); // der abgelehnte Eintrag wurde nicht gespeichert
  });
  it('ohne gesetzten Lesecode bleibt nur der Familiencode gültig', async () => {
    const e2: Env = { DB: fakeD1(), FAMILY_CODE: 'geheim' };
    expect((await call(e2, '/api/sync', { method: 'POST', body: '{}', code: 'nurlesen' })).status).toBe(401);
    expect((await call(e2, '/api/sync', { method: 'POST', body: '{}', code: '' })).status).toBe(401);
  });
});
