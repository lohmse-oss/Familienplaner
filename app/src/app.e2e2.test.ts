// @vitest-environment jsdom
/**
 * E2E (Robustheit & Zugriff, siehe TESTSTRATEGIE.md):
 * a11y-Smoke (jeder Button hat aria-label oder Text), Offline (Sync schlägt fehl, App bleibt bedienbar),
 * App-Kill (Entwurf übersteht Remount), korruptes localStorage (App startet mit Defaults),
 * Lesezugriff (private Infomappen-Karten + Bearbeiten ausgeblendet).
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import { today } from './core/dates';

const click = (el: Element) => void el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
const setInput = (el: HTMLInputElement, v: string) => {
  el.value = v;
  el.dispatchEvent(new Event('input', { bubbles: true }));
};
const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));

const mount = async () => {
  document.body.innerHTML = '';
  const { App } = await import('./App');
  const root = document.createElement('div');
  document.body.appendChild(root);
  render(h(App, {}), root);
  await tick(60);
  return root;
};
const tabBtn = (label: string) => [...document.querySelectorAll('.tabs button')].find((b) => b.textContent?.includes(label))!;

describe('E2E: Robustheit, a11y, Offline, Resume, Lesezugriff', () => {
  beforeAll(() => {
    (Element.prototype as unknown as { scrollIntoView?: () => void }).scrollIntoView ??= () => {};
    (globalThis as Record<string, unknown>).IntersectionObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  it('a11y-Smoke: jeder Button hat aria-label oder sichtbaren Text (Home, Kalender, Mahlzeiten, Mehr)', async () => {
    localStorage.clear();
    await mount();
    const check = () =>
      [...document.querySelectorAll('button')].filter(
        (b) => !b.getAttribute('aria-label') && !(b.textContent ?? '').trim() && !b.getAttribute('title'),
      );
    expect(check(), 'Buttons ohne Label auf Start').toEqual([]);
    for (const label of ['Kalender', 'Mahlzeit', 'Mehr']) {
      click(tabBtn(label));
      await tick(50);
      expect(check(), `Buttons ohne Label in „${label}“`).toEqual([]);
    }
  });

  it('Offline: Sync schlägt fehl → Status „error/offline“, App bleibt voll bedienbar', async () => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    try {
      await mount();
      const { updateSettings, sync } = await import('./store');
      updateSettings({ me: 'sebastian', server: 'https://x.test', code: 'geheim' });
      await sync(); // fetch schlägt fehl
      await tick(60);
      const syncBtn = document.querySelector('header .sync')!;
      expect(syncBtn.className).toContain('sync-error');
      // App weiterhin bedienbar: Tabwechsel + Ansichtwechsel funktionieren
      click(tabBtn('Mahlzeit'));
      await tick(50);
      expect(document.querySelector('.meal-add')).toBeTruthy();
      click(tabBtn('Kalender'));
      await tick(50);
      expect(document.querySelector('.seg-ctl')).toBeTruthy();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('App-Kill: offener Bearbeiten-Entwurf wird nach Remount wiederhergestellt', async () => {
    localStorage.clear();
    await mount();
    // Langdruck → Picker → Termin → Titel eintippen
    document.querySelector('.home-btn')!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    await tick(500);
    click([...document.querySelectorAll('.kinds .kind')].find((k) => (k.textContent ?? '').includes('Termin'))!);
    await tick(60);
    setInput(document.querySelector('.sheet input[type="text"]') as HTMLInputElement, 'Entwurf-Test');
    await tick(40);
    // App-Kill simulieren: DOM wegwerfen OHNE React-Cleanup (so verhält sich ein echtes Kill der WebView)
    document.body.innerHTML = '';
    const { App } = await import('./App');
    const root2 = document.createElement('div');
    document.body.appendChild(root2);
    render(h(App, {}), root2);
    await tick(80);
    const sheet = document.querySelector('.sheet');
    expect(sheet, 'Sheet nach Remount nicht wiederhergestellt').toBeTruthy();
    expect((sheet!.querySelector('input[type="text"]') as HTMLInputElement).value).toBe('Entwurf-Test');
  });

  it('korruptes localStorage: App startet mit Defaults, ohne Ausnahme', async () => {
    localStorage.clear();
    localStorage.setItem('fp.items', '{kaputt');
    localStorage.setItem('fp.settings', '???');
    localStorage.setItem('fp.ui.sheet', 'nullx');
    vi.resetModules(); // frischer Store liest das kaputte localStorage
    const errors: unknown[] = [];
    window.addEventListener('error', (e) => errors.push(e.error ?? e.message));
    await mount();
    expect(errors).toEqual([]);
    expect(document.querySelector('.app')).toBeTruthy();
    click(tabBtn('Kalender'));
    await tick(50);
    expect(document.querySelector('.seg-ctl')).toBeTruthy();
  });

  it('Lesezugriff: private Infomappen-Karten und Anlage/Bearbeiten sind ausgeblendet', async () => {
    localStorage.clear();
    document.body.innerHTML = '';
    const { App } = await import('./App');
    const { saveItem, updateSettings } = await import('./store');
    updateSettings({ me: 'sebastian', server: '', code: '' });
    const t = today();
    saveItem({ id: 'f1', kind: 'fact', title: 'Kinderarzt Dr. X', cat: 'gesundheit', start: t, end: t, persons: [], updated: 0 } as never);
    saveItem({ id: 'f2', kind: 'fact', title: 'Geheimkarte Versicherung', cat: 'dokumente', private: true, start: t, end: t, persons: [], updated: 0 } as never);
    updateSettings({ role: 'read' }); // erst danach Lesezugriff – saveItem verweigert Schreiben im Lesezugriff (by design)
    const root = document.createElement('div');
    document.body.appendChild(root);
    render(h(App, {}), root);
    await tick(60);
    expect(document.querySelector('.ro-badge'), '„nur Lesen“-Badge fehlt').toBeTruthy();
    click(tabBtn('Mehr'));
    await tick(50);
    click([...document.querySelectorAll('.more-row')].find((r) => r.textContent?.includes('Infomappe'))!);
    await tick(60);
    const txt = document.body.textContent ?? '';
    expect(txt).toContain('Kinderarzt Dr. X');
    expect(txt).not.toContain('Geheimkarte');
    expect([...document.querySelectorAll('button')].some((b) => b.textContent?.includes('Neue Karte'))).toBe(false);
  });

  it('Einkaufslisten: mehrere Listen über Registerkarten anlegen, befüllen, wechseln, umbenennen, löschen (Undo)', async () => {
    localStorage.clear();
    document.body.innerHTML = '';
    vi.resetModules(); // frischer Store (vorherige Tests setzen z. B. role=read)
    const { App } = await import('./App');
    const { updateSettings } = await import('./store');
    updateSettings({ me: 'sebastian', server: '', code: '', role: 'write' }); // kein Netzwerk im Test
    const root = document.createElement('div');
    document.body.appendChild(root);
    render(h(App, {}), root);
    await tick(60);

    const submitForm = (f: Element) => void f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const listTabs = () => [...document.querySelectorAll('.shop-tabs [role="tab"]')] as HTMLElement[];
    const ls = () => JSON.parse(localStorage.getItem('fp.items') ?? '[]') as { id: string; title?: string; kind: string; parent?: string; shopList?: boolean; deleted?: boolean }[];
    const add = async (v: string) => {
      const f = document.querySelector('.shop-add') as HTMLFormElement;
      setInput(f.querySelector('input') as HTMLInputElement, v);
      await tick();
      submitForm(f);
      await tick();
    };

    click(tabBtn('Einkauf'));
    await tick(50);
    expect(listTabs().map((t) => t.textContent?.trim())).toEqual(['Allgemeines']); // nur Standardliste

    // Artikel in „Allgemeines“ (ohne parent)
    await add('Milch');
    expect(document.querySelectorAll('.shop-row').length).toBe(1);
    expect(document.querySelector('.shop-row')?.textContent).toContain('Milch');

    // Neue Liste „Drogerie“ anlegen → wird direkt aktiv
    click(document.querySelector('.shop-tabs .chip[aria-label="Neue Einkaufsliste anlegen"]')!);
    await tick();
    const lf = document.querySelector('.list-form') as HTMLFormElement;
    expect(lf, 'Anlage-Formular fehlt').toBeTruthy();
    setInput(lf.querySelector('input') as HTMLInputElement, 'Drogerie');
    await tick();
    submitForm(lf);
    await tick();
    expect(listTabs().map((t) => t.textContent?.trim())).toEqual(['Allgemeines (1)', 'Drogerie']);
    expect(document.querySelector('.shop-tabs [role="tab"].on')?.textContent).toContain('Drogerie');

    // Artikel landet in der aktiven Liste
    await add('Shampoo');
    expect(document.querySelectorAll('.shop-row').length).toBe(1);
    expect(document.querySelector('.shop-row')?.textContent).toContain('Shampoo');
    const drogerie = ls().find((i) => i.shopList);
    expect(drogerie?.title).toBe('Drogerie');
    expect(ls().find((i) => i.title === 'Shampoo')?.parent).toBe(drogerie?.id);
    expect(ls().find((i) => i.title === 'Milch')?.parent).toBeUndefined();

    // Wechsel zu „Allgemeines“: Milch sichtbar, Shampoo nicht
    click(listTabs().find((t) => t.textContent?.includes('Allgemeines'))!);
    await tick();
    expect(document.querySelector('.shop-row')?.textContent).toContain('Milch');
    expect(document.body.textContent).not.toContain('Shampoo');

    // Zurück zur eigenen Liste und umbenennen
    click(listTabs().find((t) => t.textContent?.includes('Drogerie'))!);
    await tick();
    click(document.querySelector('.shop-tabs [aria-label="Liste bearbeiten"]')!);
    await tick();
    const lf2 = document.querySelector('.list-form') as HTMLFormElement;
    expect((lf2.querySelector('input') as HTMLInputElement).value).toBe('Drogerie');
    setInput(lf2.querySelector('input') as HTMLInputElement, 'Drogerie & Co');
    await tick();
    submitForm(lf2);
    await tick();
    expect(listTabs().some((t) => t.textContent?.includes('Drogerie & Co'))).toBe(true);

    // Löschen: Liste + Artikel als gelöscht markiert, aktive Tab fällt auf „Allgemeines“, Undo stellt her
    click(document.querySelector('.shop-tabs [aria-label="Liste bearbeiten"]')!);
    await tick();
    click([...document.querySelectorAll('.list-form button')].find((b) => b.textContent?.includes('Löschen'))!);
    await tick();
    expect(listTabs()).toHaveLength(1);
    expect(document.querySelector('.shop-tabs [role="tab"].on')?.textContent).toContain('Allgemeines');
    expect(ls().find((i) => i.shopList)?.deleted).toBe(true);
    expect(ls().find((i) => i.title === 'Shampoo')?.deleted).toBe(true);
    click([...document.querySelectorAll('.snack button')].find((b) => b.textContent?.includes('Rückgängig'))!);
    await tick();
    expect(ls().find((i) => i.shopList)?.deleted).toBeFalsy();
    expect(ls().find((i) => i.title === 'Shampoo')?.deleted).toBeFalsy();
  });
});
