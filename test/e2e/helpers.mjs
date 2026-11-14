export const STORAGE_KEY = 'familienplaner.v1';

export async function freshApp(page) {
  await page.goto('/index.html');
  await page.evaluate(k => localStorage.clear(), STORAGE_KEY);
  await page.reload();
  await page.waitForSelector('#wandliste .tag-zelle', { state: 'visible' });
}

export async function getState(page) {
  return page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), STORAGE_KEY);
}

export async function setState(page, mutate) {
  await page.evaluate(({ k, mutate: src }) => {
    const st = JSON.parse(localStorage.getItem(k));
    const fn = eval(`(${src})`);
    fn(st);
    localStorage.setItem(k, JSON.stringify(st));
  }, { k: STORAGE_KEY, mutate: mutate.toString() });
}

export async function jahrOf(page) {
  return (await getState(page)).jahr;
}

export async function openMenu(page, triggerId, itemId) {
  await page.click(`#${triggerId}`);
  await page.click(`#${itemId}`);
}

export async function setField(page, id, value) {
  const loc = page.locator(`#${id}`);
  await loc.fill(String(value));
  await loc.dispatchEvent('change');
}
