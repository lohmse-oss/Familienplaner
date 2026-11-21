// @vitest-environment jsdom
/**
 * E2E-Smoke: App wird in jsdom gemountet und der Mahlzeiten-Flow per echten DOM-Events durchklickt:
 * Tab öffnen → Mahlzeit eintragen → in Übersicht sichtbar → bestätigen → Erledigt →
 * direkt in den Pool → Pool-Eintrag anklicken (Sheet mit nächstem freien Tag, nicht heute) → Start zeigt Mahlzeit.
 */
import { describe, expect, it } from 'vitest';
import { h, render } from 'preact';
import { addDays, dow, today, WD } from './core/dates';

const click = (el: Element) => void el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
const setInput = (el: HTMLInputElement, v: string) => {
  el.value = v;
  el.dispatchEvent(new Event('input', { bubbles: true }));
};
const submit = (form: Element) => void form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));

describe('E2E: App + Mahlzeiten-Flow', () => {
  it('startet, spielt den kompletten Mahlzeiten-Flow durch', async () => {
    localStorage.clear();
    const { App } = await import('./App');
    const root = document.createElement('div');
    document.body.appendChild(root);
    render(h(App, {}), root);
    await tick(60);

    // Tab-Leiste: Mahlzeit-Tab öffnen
    const tabs = () => [...document.querySelectorAll('.tabs button')];
    const mealTab = tabs().find((b) => b.textContent?.includes('Mahlzeit'));
    expect(mealTab, 'Tab „Mahlzeit“ fehlt').toBeTruthy();
    click(mealTab!);
    await tick();
    expect(document.querySelector('.meal-add')).toBeTruthy();
    expect(document.body.textContent).toContain('Übersicht');

    // Mahlzeit für heute eintragen (Datum ist vorausgefüllt mit heute)
    const form = document.querySelector('.meal-add') as HTMLFormElement;
    const dateInput = form.querySelector('input[type="date"]') as HTMLInputElement;
    expect(dateInput.value).toBe(today());
    setInput(form.querySelector('input[type="text"]') as HTMLInputElement, 'Nudeln');
    await tick(); // State flushen, bevor das Formular abgeschickt wird
    submit(form);
    await tick();
    expect(document.body.textContent).toContain('Nudeln');
    expect(document.querySelector('.meal-row.today')?.textContent).toContain('Nudeln');

    // Bestätigen (Haken in der Heute-Zeile) → wandert in „Erledigt“
    const check = document.querySelector('.meal-row.today .check-btn') as HTMLButtonElement;
    expect(check, 'Haken in der Heute-Zeile fehlt').toBeTruthy();
    click(check);
    await tick();
    expect(document.body.textContent).toContain('Erledigt (1)');

    // Direkt in den Pool (Inline-Formular im Pool-Block)
    const poolForm = [...document.querySelectorAll('.meal-add')].find((f) => (f.querySelector('input[type="text"]') as HTMLInputElement).placeholder.includes('Pool')) as HTMLFormElement;
    expect(poolForm, 'Inline-Pool-Formular fehlt').toBeTruthy();
    setInput(poolForm.querySelector('input[type="text"]') as HTMLInputElement, 'Suppe');
    await tick();
    submit(poolForm);
    await tick();
    expect(document.body.textContent).toContain('Pool (1)');
    expect(document.body.textContent).toContain('Suppe');

    // Pool-Eintrag anklicken → Sheet öffnet, Tag-Feld = nächster freier Tag (nie heute; heute ist belegt)
    const poolRow = [...document.querySelectorAll('.meal-row')].find((r) => r.textContent?.includes('Suppe'))!;
    click(poolRow);
    await tick();
    const sheetDate = document.querySelector('.sheet input[type="date"]') as HTMLInputElement;
    expect(sheetDate, 'Sheet mit Tag-Feld fehlt').toBeTruthy();
    expect(sheetDate.value).toBe(addDays(today(), 1));

    // Sheet schließen, zurück zur Startseite: Heute-Karte zeigt die Mahlzeit
    click(document.querySelector('.backdrop')!);
    await tick();
    click(document.querySelector('.home-btn')!);
    await tick();
    expect(document.querySelector('.today-card')?.textContent).toContain('Nudeln');
    expect(document.body.textContent).toContain('Demnächst');

    // Demnächst-Streifen: 2 Zeilen (S/B), 7 Tage ab übermorgen, je Zelle genau 4 Felder
    const cells = [...document.querySelectorAll('.strip2 .cell')];
    expect(cells.length).toBe(14); // 2 Personen × 7 Tage
    expect(document.querySelectorAll('.strip2 .who-l').length).toBe(2);
    expect(cells.every((c) => c.querySelectorAll('.q').length === 4)).toBe(true); // je Tag 4 Elemente
    const t2 = addDays(today(), 2);
    const heads = [...document.querySelectorAll('.strip2 .h')].map((h) => h.textContent?.trim());
    expect(heads[1]).toBe(`${WD[dow(t2)]} ${t2.slice(8)}`); // beginnt übermorgen, nicht heute/morgen

    // Termin für Sebastian übermorgen → im Streifen als Zahl sichtbar
    const { saveItem } = await import('./store');
    saveItem({ id: 'e2e1', kind: 'event', title: 'E2E-Termin', start: t2, end: t2, persons: ['sebastian'], owner: 'sebastian', updated: 0 } as never);
    await tick(60);
    const cellWithEv = cells.find((c) => c.querySelector('.q:nth-child(2)')?.textContent?.trim() === '1');
    expect(cellWithEv, 'Termin-Zahl im Streifen fehlt').toBeTruthy();

    // Info-Chip „Neu vom Partner“ erscheint und lässt sich per Swipe wegwischen (dann dauerhaft weg)
    // (saveItem setzt by = me -> kurz auf Betty stellen, damit der Eintrag "vom Partner" ist)
    const { saveItem: si, updateSettings } = await import('./store');
    updateSettings({ me: 'betty' });
    const now = Date.now();
    si({ id: 'e2e2', kind: 'event', title: 'E2E-Partner', start: t2, end: t2, persons: [], created: now } as never);
    await tick(60);
    const chip = () => [...document.querySelectorAll('.chip-tile')].find((c) => c.textContent?.includes('Neu'));
    expect(chip(), 'Chip „Neu“ fehlt').toBeTruthy();
    const el = chip()!;
    el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 300 }));
    el.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 120 })); // Swipe nach links
    await tick();
    expect(chip(), 'Chip wurde nicht weggewischt').toBeUndefined();
    expect(JSON.parse(localStorage.getItem('fp.chipOff') ?? '{}').partner).toBeGreaterThan(0); // Zahl gemerkt
  });
});
