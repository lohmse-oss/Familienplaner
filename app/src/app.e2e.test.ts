// @vitest-environment jsdom
/**
 * E2E-Smoke: App wird in jsdom gemountet und der Mahlzeiten-Flow per echten DOM-Events durchklickt:
 * Tab öffnen → Mahlzeit eintragen → in Übersicht sichtbar → bestätigen → Erledigt →
 * direkt in den Pool → Pool-Eintrag anklicken (Sheet mit nächstem freien Tag, nicht heute) → Start zeigt Mahlzeit.
 */
import { describe, expect, it } from 'vitest';
import { h, render } from 'preact';
import { addDays, today } from './core/dates';

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
  });
});
