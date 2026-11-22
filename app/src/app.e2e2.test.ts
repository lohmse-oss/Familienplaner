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
});
