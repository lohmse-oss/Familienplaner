// @vitest-environment jsdom
/**
 * E2E-Smoke: App wird in jsdom gemountet und der Mahlzeiten-Flow per echten DOM-Events durchklickt:
 * Tab öffnen → Mahlzeit eintragen → in Übersicht sichtbar → bestätigen → Erledigt →
 * direkt in den Pool → Pool-Eintrag anklicken (Sheet mit nächstem freien Tag, nicht heute) → Start zeigt Mahlzeit.
 */
import { describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import { addDays, dow, fmt, today, WD } from './core/dates';

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
    const dateInput = form.querySelector('input[inputmode="numeric"]') as HTMLInputElement;
    expect(dateInput.value).toBe(fmt(today())); // vorbefüllt mit heute (TT.MM.JJJJ)
    // manuelle Ziffern-Eingabe wird automatisch segmentiert: 2311 -> 23.11, 23112026 -> 23.11.2026
    setInput(dateInput, '2311');
    await tick();
    expect(dateInput.value).toBe('23.11');
    setInput(dateInput, '23112026');
    await tick();
    expect(dateInput.value).toBe('23.11.2026');
    setInput(dateInput, fmt(today()).replace(/\D/g, '')); // wieder auf heute
    await tick();
    expect(dateInput.value).toBe(fmt(today()));
    setInput(form.querySelector('input[placeholder*="Mahlzeit"]') as HTMLInputElement, 'Nudeln'); // Textfeld (nicht das Datumsfeld)
    await tick(); // State flushen, bevor das Formular abgeschickt wird
    submit(form);
    await tick();
    expect(document.body.textContent).toContain('Nudeln');
    expect(document.querySelector('.meal-row.today')?.textContent).toContain('Nudeln');
    // „+1 Tag“ nur wenn alle Tage im Bereich belegt (hier nur heute) – und kein „+7 Tage“ mehr
    expect(document.body.textContent).not.toContain('+1 Tag');
    expect(document.body.textContent).not.toContain('+7 Tage');

    // Bestätigen (Haken in der Heute-Zeile) → wandert in „Erledigt“
    const check = document.querySelector('.meal-row.today .check-btn') as HTMLButtonElement;
    expect(check, 'Haken in der Heute-Zeile fehlt').toBeTruthy();
    click(check);
    await tick();
    expect(document.body.textContent).toContain('Erledigt (1)');
    // Undo-Snackbar erscheint und bleibt bis zum Antippen (kein Auto-Dismiss)
    const snack = document.querySelector('.snack');
    expect(snack, 'Undo-Snackbar fehlt').toBeTruthy();
    click(snack!);
    await tick();
    expect(document.querySelector('.snack')).toBeNull();
    // zusätzlich per Swipe schließbar (Timer bleibt parallel aktiv)
    const { withUndo } = await import('./store');
    withUndo('E2E-Test', () => {});
    await tick();
    const snack2 = document.querySelector('.snack');
    expect(snack2, 'Snackbar nach withUndo fehlt').toBeTruthy();
    snack2!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 300 }));
    snack2!.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 100 }));
    await tick();
    expect(document.querySelector('.snack')).toBeNull();

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
    expect(cells.every((c) => c.querySelectorAll('.q').length === 4)).toBe(true); // je Zelle 4 Segmente (2x2) wie das App-Icon
    const t2 = addDays(today(), 2);
    const heads = [...document.querySelectorAll('.strip2 .h')].map((h) => h.textContent?.trim());
    expect(heads[1]).toBe(`${WD[dow(t2)]} ${t2.slice(8)}`); // beginnt übermorgen, nicht heute/morgen

    // 2 Termine für Sebastian übermorgen + 1 Familien-Termin (ohne Zuständigen) → S zeigt 3, B zeigt 1; auch einzelne Einträge werden angezeigt
    const { saveItem } = await import('./store');
    saveItem({ id: 'e2e1', kind: 'event', title: 'E2E-Termin 1', start: t2, end: t2, persons: ['sebastian'], owner: 'sebastian', updated: 0 } as never);
    saveItem({ id: 'e2e1b', kind: 'event', title: 'E2E-Termin 2', start: t2, end: t2, persons: ['sebastian'], owner: 'sebastian', updated: 0 } as never);
    saveItem({ id: 'e2e3', kind: 'event', title: 'E2E-Familientermin', start: t2, end: t2, persons: [], updated: 0 } as never);
    saveItem({ id: 'e2e4', kind: 'info', title: 'E2E-Familienevent', start: t2, end: t2, persons: [], updated: 0 } as never);
    await tick(60);
    const qTexts = [...document.querySelectorAll('.strip2 .cell .q')].map((q) => q.textContent?.trim());
    expect(qTexts).toContain('3'); // S: 2 eigene + 1 Familien-Termin
    expect(qTexts).toContain('1'); // B: nur der Familien-Termin – einzelner Eintrag wird auch angezeigt
    const qOn = [...document.querySelectorAll('.strip2 .cell .q.on')].find((q) => q.textContent?.trim() === '1' && (q as HTMLElement).style.color === 'rgb(240, 108, 160)') as HTMLElement;
    expect(qOn, 'eingefärbtes Segment fehlt').toBeTruthy();
    expect(qOn.style.color).toBe('rgb(240, 108, 160)'); // Icon-Farbe Pink (#F06CA0)
    // BR-Segment = Events (kind info), orange #FF8A5C
    const qEv = [...document.querySelectorAll('.strip2 .cell .q.on')].find((q) => q.textContent?.trim() === '1' && (q as HTMLElement).style.color === 'rgb(255, 138, 92)') as HTMLElement;
    expect(qEv, 'Event-Segment (orange) fehlt').toBeTruthy();
    // Zellen sind dunkel wie das App-Icon
    expect(document.querySelector('.strip2 .cell')!.className).toContain('cell');

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

  it('zeigt sonntags Briefing UND Demnächst-Streifen', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-22T12:00:00')); // Sonntag
    try {
      document.body.innerHTML = ''; // alte App-Instanz aus dem ersten Test entfernen
      localStorage.clear();
      const { App } = await import('./App');
      const root = document.createElement('div');
      document.body.appendChild(root);
      render(h(App, {}), root);
      await vi.advanceTimersByTimeAsync(100);
      const txt = document.body.textContent ?? '';
      expect(txt).toContain('Briefing'); // Sonntags-Briefing
      expect(txt).toContain('Demnächst'); // Streifen bleibt sichtbar
      expect(document.querySelector('.strip2')).toBeTruthy();
      expect(document.querySelectorAll('.strip2 .cell').length).toBe(14); // 2 Personen x 7 Tage
    } finally {
      vi.useRealTimers();
    }
  });

  it('Dummy-Daten: Briefing mit Anwesenheit/Events, Morgen wie Heute, Neuanlage leeres Datum + Plausibilitaet', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-22T12:00:00')); // Sonntag
    try {
      document.body.innerHTML = '';
      localStorage.clear();
      const { App } = await import('./App');
      const { saveItem, updateSettings } = await import('./store');
      updateSettings({ me: 'sebastian' });
      const t = today(); // So 22.11.2026
      const t1 = addDays(t, 1); // Mo
      const t2 = addDays(t, 2); // Di
      saveItem({ id: 'd1', kind: 'presence', start: t1, end: t1, persons: ['sebastian'], mode: 'homeoffice', updated: 0 } as never);
      saveItem({ id: 'd2', kind: 'presence', title: 'Messe', start: t2, end: addDays(t2, 1), persons: ['betty'], mode: 'trip', updated: 0 } as never);
      saveItem({ id: 'd3', kind: 'event', title: 'Elternabend', start: t1, end: t1, persons: ['sebastian'], owner: 'sebastian', updated: 0 } as never);
      saveItem({ id: 'd4', kind: 'task', title: 'Dummy-Aufgabe', start: t2, end: t2, persons: [], updated: 0 } as never);
      const root = document.createElement('div');
      document.body.appendChild(root);
      render(h(App, {}), root);
      await vi.advanceTimersByTimeAsync(120);

      // Sonntags-Briefing als Fließtext: Anwesenheit + Abwesenheit + Event mit Person + Aufgabe
      const flow = document.querySelector('.brief-flow');
      expect(flow, 'Briefing-Fließtext fehlt').toBeTruthy();
      expect(flow!.textContent).toContain('Sebastian: Homeoffice');
      expect(flow!.textContent).toContain('Betty: Dienstreise');
      expect(flow!.textContent).toContain('Elternabend (Sebastian)');
      expect(flow!.textContent).toContain('Dummy-Aufgabe');
      expect(document.body.textContent).not.toContain('Betreuung offen'); // redundant zum Achtung-Chip

      // Morgen-Karte: gleiche Inhaltskategorien wie Heute (Wer-Zeile mit Status)
      const cards = [...document.querySelectorAll('.today-card')];
      expect(cards.length).toBe(2);
      expect(cards[0].querySelector('.who-row'), 'Heute-Karte ohne Wer-Zeile').toBeTruthy();
      const wm = cards[1].querySelector('.who-row');
      expect(wm, 'Morgen-Karte ohne Wer-Zeile').toBeTruthy();
      expect(wm!.textContent).toContain('Sebastian');
      expect(wm!.textContent).toContain('Homeoffice'); // Mo = morgen (relativ zu So)

      // Neuanlage Geburtstag: manuelles Datumsfeld leer + Plausibilitäts-Maske
      const { EditSheet } = await import('./ui/EditSheet');
      const r3 = document.createElement('div');
      document.body.appendChild(r3);
      render(h(EditSheet, { initial: { kind: 'birthday' }, onClose: () => {} }), r3);
      await vi.advanceTimersByTimeAsync(60);
      const bdayDate = r3.querySelector('.date-input input[inputmode="numeric"]') as HTMLInputElement;
      expect(bdayDate, 'Datumsfeld fehlt').toBeTruthy();
      expect(bdayDate.value).toBe(''); // leer bei Neuanlage
      setInput(bdayDate, '2343');
      await vi.advanceTimersByTimeAsync(30);
      expect(bdayDate.value).toBe('23.04.3'); // Monat kann nie 43 werden
      setInput(bdayDate, '31022027');
      await vi.advanceTimersByTimeAsync(30);
      expect(bdayDate.value).toBe('31.02.2027');
      expect(r3.querySelector('.date-input .neg'), 'Plausibilitätsfehler (31.02.) nicht markiert').toBeTruthy();
      render(null, r3); // unmount -> Entwurf wird geleert

      // Neuanlage Termin: Kalender leer, Speichern erst nach Datumswahl
      const r2 = document.createElement('div');
      document.body.appendChild(r2);
      render(h(EditSheet, { initial: { kind: 'event' }, onClose: () => {} }), r2);
      await vi.advanceTimersByTimeAsync(60);
      const sheet = r2.querySelector('.sheet')!;
      expect(sheet.querySelector('.rpick-sum')!.textContent).toContain('antippen'); // nicht vorbelegt
      const saveBtn = () => [...sheet.querySelectorAll('button')].find((b) => b.textContent === 'Speichern') as HTMLButtonElement;
      setInput(sheet.querySelector('input[type="text"]') as HTMLInputElement, 'Dummy-Termin');
      await vi.advanceTimersByTimeAsync(30);
      expect(saveBtn()!.disabled, 'Speichern ohne Datum erlaubt').toBe(true);
      const day15 = [...sheet.querySelectorAll('.rpick-grid button')].find((b) => b.textContent?.trim().startsWith('15'));
      expect(day15, 'Kalendertag 15 fehlt').toBeTruthy();
      click(day15!);
      await vi.advanceTimersByTimeAsync(30);
      expect(saveBtn()!.disabled, 'Speichern nach Datumswahl noch deaktiviert').toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
