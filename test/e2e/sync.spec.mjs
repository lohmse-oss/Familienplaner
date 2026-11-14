import { test, expect } from '@playwright/test';
import { freshApp, getState, setField } from './helpers.mjs';

const SYNC_URL = process.env.E2E_SYNC_URL;
const SYNC_TOKEN = process.env.E2E_SYNC_TOKEN;

async function serverState() {
  const r = await fetch(`${SYNC_URL}/state`, { headers: { Authorization: `Bearer ${SYNC_TOKEN}` } });
  return r.status === 200 ? r.json() : null;
}

async function configureSync(page) {
  await freshApp(page);
  await page.click('#btnExtras');
  await page.click('#btnEinstellungen');
  await expect(page.locator('#einstellModal')).toHaveClass(/offen/);
  await setField(page, 'syncUrl', SYNC_URL);
  await setField(page, 'syncToken', SYNC_TOKEN);
  await setField(page, 'geraetName', 'E2E-Handy');
  const st = await getState(page);
  expect(st.einstellungen).toMatchObject({ syncUrl: SYNC_URL, syncToken: SYNC_TOKEN, geraetName: 'E2E-Handy' });
}

test.beforeEach(async ({ page }) => {
  page.on('dialog', d => d.accept());
});

test('Sync konfigurieren + "Jetzt synchronisieren" pusht den State auf den Server', async ({ page }) => {
  await configureSync(page);
  await page.click('#btnSyncNow');
  await expect(page.locator('#syncStatus')).toHaveClass(/ok/);
  await expect(page.locator('#syncStatus')).toContainText(/aktuell|gesichert/);

  const remote = await serverState();
  expect(remote).not.toBeNull();
  expect(remote.updatedBy).toBe('E2E-Handy');
  expect(remote.einstellungen.syncToken).toBe('');
  expect(remote.mitglieder).toHaveLength(4);
});

test('neuer Eintrag wird automatisch gepusht (Debounce ~1s)', async ({ page }) => {
  await configureSync(page);
  await page.click('#btnSyncNow');
  await expect(page.locator('#syncStatus')).toHaveClass(/ok/);

  const jahr = (await getState(page)).jahr;
  await page.click('#einstellModal .schliessen');
  await page.click('#btnNeu');
  await page.fill('#eVon', `${jahr}-04-01`);
  await page.fill('#eBis', `${jahr}-04-02`);
  await page.fill('#eTitel', 'Push-Test');
  await page.click('#eintragSpeichern');
  await expect(page.locator('#eintragModal')).not.toHaveClass(/offen/);

  await expect.poll(async () => {
    const remote = await serverState();
    return remote && remote.eintraege.some(e => e.titel === 'Push-Test');
  }, { timeout: 10_000 }).toBe(true);
});

test('Pull holt neueren Fremdzustand (last-write-wins), lokale Sync-Konfig bleibt', async ({ page }) => {
  await configureSync(page);
  await page.click('#btnSyncNow');
  await expect(page.locator('#syncStatus')).toHaveClass(/ok/);

  const cur = await serverState();
  expect(cur).not.toBeNull();
  const fremd = {
    ...cur,
    updatedAt: cur.updatedAt + 100_000,
    updatedBy: 'Anderes Handy',
    eintraege: [...cur.eintraege, { id: 'e-fremd', mitgliedId: 'm1', typ: 'termin', von: `${cur.jahr}-05-10`, bis: `${cur.jahr}-05-10`, titel: 'Fremder Termin', notiz: '' }]
  };
  const put = await fetch(`${SYNC_URL}/state`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${SYNC_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(fremd)
  });
  expect(put.status).toBe(200);

  await page.evaluate(() => window.famSync.now());
  await expect.poll(async () => (await getState(page)).eintraege.some(e => e.id === 'e-fremd'), { timeout: 10_000 }).toBe(true);

  const st = await getState(page);
  expect(st.einstellungen).toMatchObject({ syncUrl: SYNC_URL, syncToken: SYNC_TOKEN, geraetName: 'E2E-Handy' });
  await expect(page.locator('#syncStatus')).toHaveClass(/ok/);
  await expect(page.locator('#syncStatus')).toContainText('Anderes Handy');
});
