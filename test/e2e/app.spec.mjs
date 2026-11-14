import { test, expect } from '@playwright/test';
import { freshApp, getState, setState, jahrOf, openMenu } from './helpers.mjs';

test.beforeEach(async ({ page }) => {
  page.on('dialog', d => d.accept());
  await freshApp(page);
});

test('laedt mit Default-State: 4 Personen, Wandkalender sichtbar, Jahr 2027..2031 waehlbar', async ({ page }) => {
  await expect(page.locator('h1')).toContainText('Familien-Jahresplaner');
  await expect(page.locator('#wandkalender')).toBeVisible();
  await expect(page.locator('#wandliste .tag-zelle').first()).toBeVisible();
  const personen = await page.locator('#filterMitglied option').allTextContents();
  expect(personen).toHaveLength(5);
  expect(personen[0]).toContain('alle Personen');
  const jahre = await page.locator('#jahrSelect option').allTextContents();
  expect(jahre).toEqual(['2027', '2028', '2029', '2030', '2031']);
  const st = await getState(page);
  expect(st.mitglieder.map(m => m.name)).toEqual(['Betty', 'Sebastian', 'Ida', 'Irma']);
  expect(st.eintraege).toEqual([]);
});

test('Ansicht wechseln: Monate, Liste, Balken, Alle, Tipps, zurueck zu Wand', async ({ page }) => {
  const ansichten = [
    ['btnAnsichtMonate', '#monate', '#wandkalender'],
    ['btnAnsichtListe', '#urlaubsliste', '#monate'],
    ['btnAnsichtBalken', '#balkenansicht', '#urlaubsliste'],
    ['btnAnsichtAlle', '#alleEintraege', '#balkenansicht'],
    ['btnAnsichtTipps', '#tippsansicht', '#alleEintraege'],
    ['btnAnsichtWand', '#wandkalender', '#tippsansicht']
  ];
  for (const [btn, sichtbar, versteckt] of ansichten) {
    await openMenu(page, 'btnAnsicht', btn);
    await expect(page.locator(sichtbar)).toBeVisible();
    await expect(page.locator(versteckt)).toBeHidden();
  }
  const jahr = await jahrOf(page);
  const tage = new Date(jahr, 1, 29).getDate() === 29 ? 366 : 365;
  await openMenu(page, 'btnAnsicht', 'btnAnsichtMonate');
  await expect(page.locator('#monate .tag[data-key]')).toHaveCount(tage);
});

test('Eintrag anlegen ueber "+ Eintrag", in Alle-Eintraege sichtbar', async ({ page }) => {
  const jahr = await jahrOf(page);
  await page.click('#btnNeu');
  await expect(page.locator('#eintragModal')).toHaveClass(/offen/);
  await expect(page.locator('#eintragModalTitel')).toHaveText('Neuer Eintrag');
  await page.selectOption('#eMitglied', 'm2');
  await page.selectOption('#eTyp', 'urlaub');
  await page.fill('#eVon', `${jahr}-03-01`);
  await page.fill('#eBis', `${jahr}-03-05`);
  await page.fill('#eTitel', 'E2E Urlaub');
  await page.fill('#eNotiz', 'Notiz aus Playwright');
  await page.click('#eintragSpeichern');
  await expect(page.locator('#eintragModal')).not.toHaveClass(/offen/);

  const st = await getState(page);
  expect(st.eintraege).toHaveLength(1);
  expect(st.eintraege[0]).toMatchObject({ mitgliedId: 'm2', typ: 'urlaub', von: `${jahr}-03-01`, bis: `${jahr}-03-05`, titel: 'E2E Urlaub' });

  await openMenu(page, 'btnAnsicht', 'btnAnsichtAlle');
  await expect(page.locator('#alleInhalt')).toContainText('E2E Urlaub');
  await expect(page.locator('#alleInhalt')).toContainText('Sebastian');
});

test('Tag-Dialog per Doppelklick: Eintrag anlegen, bearbeiten, loeschen', async ({ page }) => {
  const jahr = await jahrOf(page);
  const key = `${jahr}-06-15`;
  const zelle = page.locator(`.tag-zelle[data-mitglied="m1"][data-key="${key}"]`);
  await zelle.dblclick();
  await expect(page.locator('#tagModal')).toHaveClass(/offen/);
  await expect(page.locator('#tagModalBody h3')).toHaveText(`15.6.${jahr}`);

  await page.click('#tagNeuBtn');
  await expect(page.locator('#eintragModal')).toHaveClass(/offen/);
  await expect(page.locator('#eVon')).toHaveValue(key);
  await expect(page.locator('#eBis')).toHaveValue(key);
  await page.selectOption('#eTyp', 'termin');
  await page.fill('#eTitel', 'Kindergeburtstag');
  await page.click('#eintragSpeichern');
  await expect(page.locator('#eintragModal')).not.toHaveClass(/offen/);

  await zelle.dblclick();
  await expect(page.locator('#tagModalBody')).toContainText('Kindergeburtstag');

  await page.click('#tagModalBody .bearbeiten');
  await expect(page.locator('#eintragModalTitel')).toHaveText('Eintrag bearbeiten');
  await expect(page.locator('#eTitel')).toHaveValue('Kindergeburtstag');
  await page.fill('#eTitel', 'Geburtstag Neu');
  await page.click('#eintragSpeichern');

  await zelle.dblclick();
  await expect(page.locator('#tagModalBody')).toContainText('Geburtstag Neu');
  await page.click('#tagModalBody .loeschen');
  await expect(page.locator('#tagModal')).not.toHaveClass(/offen/);
  const st = await getState(page);
  expect(st.eintraege).toHaveLength(0);
});

test('Zellen auswaehlen und ueber "markieren" als Eintrag anlegen', async ({ page }) => {
  const jahr = await jahrOf(page);
  const z1 = page.locator(`.tag-zelle[data-mitglied="m1"][data-key="${jahr}-01-04"]`);
  const z2 = page.locator(`.tag-zelle[data-mitglied="m1"][data-key="${jahr}-01-05"]`);
  await z1.click();
  await expect(page.locator('#auswahlInfo')).toContainText('1 Zelle ausgewählt');
  await z2.click();
  await expect(page.locator('#auswahlInfo')).toContainText('2 Zellen ausgewählt');
  await expect(z1).toHaveClass(/ausgewaehlt/);

  await page.selectOption('.wand-kopf select[data-modus="m1"]', 'termin');
  await page.fill('#auswahlKommentar', 'Teamtag');
  await page.click('#btnMarkieren');

  await expect(page.locator('#auswahlInfo')).toContainText('0 Zellen ausgewählt');
  const st = await getState(page);
  expect(st.eintraege).toHaveLength(1);
  expect(st.eintraege[0]).toMatchObject({ mitgliedId: 'm1', typ: 'termin', von: `${jahr}-01-04`, bis: `${jahr}-01-05`, titel: 'Teamtag' });
});

test('JSON-Export (ohne Sync-Token) und Import als Roundtrip', async ({ page }) => {
  const jahr = await jahrOf(page);
  await setState(page, st => {
    st.einstellungen.syncToken = 'geheimes-token';
    st.eintraege.push({ id: 'e-export', mitgliedId: 'm1', typ: 'urlaub', von: `${st.jahr}-07-01`, bis: `${st.jahr}-07-10`, titel: 'Export-Test', notiz: '' });
  });
  await page.reload();
  await page.waitForSelector('#wandliste .tag-zelle');

  await page.click('#btnDatei');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#btnExport')
  ]);
  expect(download.suggestedFilename()).toBe(`familienplaner-${jahr}.json`);
  const file = await download.path();
  const exported = JSON.parse((await import('node:fs')).readFileSync(file, 'utf8'));
  expect(exported.eintraege.map(e => e.titel)).toContain('Export-Test');
  expect(exported.einstellungen.syncToken ?? '').toBe('');

  await setState(page, st => { st.eintraege = []; });
  await page.reload();
  await page.waitForSelector('#wandliste .tag-zelle');
  expect((await getState(page)).eintraege).toHaveLength(0);

  await page.setInputFiles('#importFile', file);
  await expect.poll(async () => (await getState(page)).eintraege.length).toBe(1);
  const st = await getState(page);
  expect(st.eintraege[0].titel).toBe('Export-Test');
  expect(st.einstellungen.syncToken).toBe('geheimes-token');
});

test('Jahr wechseln rendert das neue Jahr', async ({ page }) => {
  await page.selectOption('#jahrSelect', '2028');
  await expect(page.locator('#jahrSelect')).toHaveValue('2028');
  expect((await getState(page)).jahr).toBe(2028);
  await expect(page.locator('#wandliste')).toContainText('2028');
});

test('Datumsprung scrollt im Wandkalender', async ({ page }) => {
  const jahr = await jahrOf(page);
  await page.fill('#jumpDatum', `${jahr}-12-24`);
  await page.click('#btnJumpDatum');
  await expect.poll(async () => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
});

test.describe('mobil (390px)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('Eintrag-Dialog als Bottom-Sheet mit 16px-Eingaben', async ({ page }) => {
    await page.click('#btnNeu');
    await expect(page.locator('#eintragModal')).toHaveClass(/offen/);
    await expect(page.locator('#eTitel')).toBeVisible();
    const fs = await page.locator('#eTitel').evaluate(el => getComputedStyle(el).fontSize);
    expect(fs).toBe('16px');
    await page.click('#eintragModal .schliessen');
    await expect(page.locator('#eintragModal')).not.toHaveClass(/offen/);
  });
});
