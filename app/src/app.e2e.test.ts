// @vitest-environment jsdom
/**
 * E2E-Smoke: App wird in jsdom gemountet und der Mahlzeiten-Flow per echten DOM-Events durchklickt:
 * Tab öffnen → Mahlzeit eintragen → in Übersicht sichtbar → bestätigen → Erledigt →
 * direkt in den Pool → Pool-Eintrag anklicken (Sheet mit nächstem freien Tag, nicht heute) → Start zeigt Mahlzeit.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import { addDays, dow, fmt, fmtDay, today, WD, weekStart } from './core/dates';

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
      saveItem({ id: 'd5', kind: 'task', title: 'Erledigte Dummy-Aufgabe', start: t, end: t, persons: [], done: true, updated: 0 } as never);
      saveItem({ id: 'd6', kind: 'task', title: 'Offene Dummy-Aufgabe', start: t, end: t, persons: [], updated: 0 } as never);
      const root = document.createElement('div');
      document.body.appendChild(root);
      render(h(App, {}), root);
      await vi.advanceTimersByTimeAsync(120);

      // Sonntags-Briefing: je Tag eine Zeile, steht NACH dem Demnächst-Streifen
      const html = document.body.innerHTML;
      expect(html.indexOf('Demnächst')).toBeGreaterThanOrEqual(0);
      expect(html.indexOf('Demnächst')).toBeLessThan(html.indexOf('Briefing'));
      const days = [...document.querySelectorAll('.brief-day')];
      expect(days.length, 'Briefing-Zeilen je Tag fehlen').toBeGreaterThanOrEqual(2); // Mo (HO+Elternabend) und Di (DR+Aufgabe)
      const flowTxt = days.map((d) => d.textContent ?? '').join('\n');
      expect(flowTxt).toContain('Sebastian: Homeoffice');
      expect(flowTxt).toContain('Betty: Dienstreise');
      expect(flowTxt).toContain('Elternabend (Sebastian)');
      expect(flowTxt).toContain('Dummy-Aufgabe');
      expect(days[0].querySelector('.bf-day'), 'Tag-Label je Briefing-Zeile fehlt').toBeTruthy();
      expect(document.body.textContent).not.toContain('Betreuung offen'); // redundant zum Achtung-Chip

      // Morgen-Karte: gleiche Inhaltskategorien wie Heute (Wer-Zeile mit Status)
      const cards = [...document.querySelectorAll('.today-card')];
      expect(cards.length).toBe(2);
      expect(cards[0].querySelector('.who-row'), 'Heute-Karte ohne Wer-Zeile').toBeTruthy();
      const wm = cards[1].querySelector('.who-row');
      expect(wm, 'Morgen-Karte ohne Wer-Zeile').toBeTruthy();
      expect(wm!.textContent).toContain('Sebastian');
      expect(wm!.textContent).not.toContain('Homeoffice'); // nur Name + Symbol, Label als Tooltip
      expect(cards[1].querySelector('.who[title*="Homeoffice"]'), 'Status-Tooltip fehlt').toBeTruthy(); // Mo = morgen (relativ zu So)
      // erledigte Aufgaben nicht auf Start; keine Kommentar-Texte im UI
      expect(cards[0].textContent).not.toContain('Erledigte Dummy-Aufgabe');
      expect(document.body.textContent).not.toContain('nur im Archiv');
      expect(document.body.textContent).not.toContain('lang drücken'); // Hint-Text entfernt
      // Tagesblatt (aus Start geöffnet): offene Aufgabe ja, erledigte (Archiv) nein
      click(cards[0]);
      await vi.advanceTimersByTimeAsync(60);
      const daySheet = document.querySelector('.sheet')!;
      expect(daySheet.textContent).toContain('Offene Dummy-Aufgabe');
      expect(daySheet.textContent).not.toContain('Erledigte Dummy-Aufgabe');
      click(daySheet.querySelector('.backdrop') ?? document.querySelector('.backdrop')!);
      await vi.advanceTimersByTimeAsync(30);

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

  it('Kalender-Reiter „Urlaubsplanung“, Mehr ohne Urlaub, Langdruck ohne Geburtstag/Checkliste/Infomappe', async () => {
    localStorage.clear();
    document.body.innerHTML = '';
    const { App } = await import('./App');
    const root = document.createElement('div');
    document.body.appendChild(root);
    render(h(App, {}), root);
    await tick(60);

    // Kalender-Tab → Reiter „Urlaubsplanung" vorhanden und zeigt die Urlaubsverwaltung
    const tabs = () => [...document.querySelectorAll('.tabs button')];
    click(tabs().find((b) => b.textContent?.includes('Kalender'))!);
    await tick();
    const viewBtns = () => [...document.querySelectorAll('.seg-ctl button')];
    expect(viewBtns().some((b) => b.textContent?.includes('Urlaubsplanung')), 'Reiter „Urlaubsplanung" fehlt').toBe(true);
    click(viewBtns().find((b) => b.textContent?.includes('Urlaubsplanung'))!);
    await tick(60);
    expect(document.body.textContent).toContain('Urlaubsverwaltung');
    expect(document.querySelector('.layer-menu')).toBeNull(); // Ebenen-Schalter in der Urlaubsplanung ausgeblendet

    // Mehr enthält keinen Urlaub-Eintrag mehr
    click(tabs().find((b) => b.textContent?.includes('Mehr'))!); // Badge (überfällige Aufgaben) nicht mitmatchen
    await tick();
    const moreRows = [...document.querySelectorAll('.more-row')].map((r) => r.textContent ?? '');
    expect(moreRows.some((r) => r.includes('Urlaub'))).toBe(false);
    expect(moreRows.some((r) => r.includes('Geburtstage'))).toBe(true);

    // Langdruck auf den Startknopf → Picker ohne Geburtstag / Checkliste / Infomappe
    const homeBtn = document.querySelector('.home-btn')!;
    homeBtn.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    await tick(500); // Langdruck-Schwelle: 450 ms
    const kinds = [...document.querySelectorAll('.kinds .kind')].map((k) => k.textContent ?? '');
    expect(kinds.some((k) => k.includes('Geburtstag'))).toBe(false);
    expect(kinds.some((k) => k.includes('Checkliste'))).toBe(false);
    expect(kinds.some((k) => k.includes('Infomappe'))).toBe(false);
    expect(kinds.some((k) => k.includes('Termin'))).toBe(true);
    expect(kinds.some((k) => k.includes('Einkaufsliste'))).toBe(true);
    click(document.querySelector('.backdrop')!);
    await tick();
  });

  it('Pool-Zeilen ohne „war“-Datum und ohne roten Hinweis', async () => {
    localStorage.clear();
    document.body.innerHTML = '';
    const { App } = await import('./App');
    const { saveItem } = await import('./store');
    const root = document.createElement('div');
    document.body.appendChild(root);
    render(h(App, {}), root);
    await tick(60);
    saveItem({ id: 'pool1', kind: 'meal', title: 'Alte Suppe', start: addDays(today(), -2), end: addDays(today(), -2), persons: [], pool: true, updated: 0 } as never);
    await tick(60);
    const tabs = [...document.querySelectorAll('.tabs button')];
    click(tabs.find((b) => b.textContent?.includes('Mahlzeit'))!);
    await tick();
    const poolRow = [...document.querySelectorAll('.meal-row')].find((r) => r.textContent?.includes('Alte Suppe'))!;
    expect(poolRow, 'Pool-Zeile fehlt').toBeTruthy();
    expect(poolRow.textContent).not.toContain('war');
    expect(document.querySelector('.page .hint.neg')).toBeNull(); // roter Info-Text über dem Pool entfernt
  });

  it('Tauschen per Antippen: Mahlzeit → „Tauschen mit …“ → Ziel (Tag↔Tag, Tag↔Pool)', async () => {
    localStorage.clear();
    document.body.innerHTML = '';
    const { App } = await import('./App');
    const { saveItem } = await import('./store');
    const root = document.createElement('div');
    document.body.appendChild(root);
    render(h(App, {}), root);
    await tick(60);
    const t0 = today();
    const d1 = addDays(t0, 1);
    const d2 = addDays(t0, 2);
    saveItem({ id: 'ta', kind: 'meal', title: 'Tausch-A', start: d1, end: d1, persons: [], updated: 0 } as never);
    saveItem({ id: 'tb', kind: 'meal', title: 'Tausch-B', start: d2, end: d2, persons: [], updated: 0 } as never);
    saveItem({ id: 'tp', kind: 'meal', title: 'Tausch-Pool', start: addDays(t0, -1), end: addDays(t0, -1), persons: [], pool: true, updated: 0 } as never);
    await tick(60);
    const tabs = [...document.querySelectorAll('.tabs button')];
    click(tabs.find((b) => b.textContent?.includes('Mahlzeit'))!);
    await tick();
    const rowByTitle = (t: string) => [...document.querySelectorAll('.meal-row')].find((r) => r.textContent?.includes(t)) as HTMLElement;
    const rowByDate = (d: string) => [...document.querySelectorAll('.meal-row')].find((r) => r.querySelector('.meal-date')?.textContent?.trim() === fmtDay(d)) as HTMLElement;
    const sheetBtn = (label: string) => [...document.querySelectorAll('.sheet button')].find((b) => b.textContent?.includes(label)) as HTMLButtonElement;
    expect(rowByTitle('Tausch-A'), 'Tausch-A fehlt in der Übersicht').toBeTruthy();
    expect(rowByTitle('Tausch-B'), 'Tausch-B fehlt in der Übersicht').toBeTruthy();

    // Tag↔Tag: Tausch-A antippen → Sheet → „Tauschen mit …“ → Quelle erneut antippen = abbrechen
    click(rowByTitle('Tausch-A'));
    await tick();
    expect(document.querySelector('.sheet'), 'Sheet fehlt').toBeTruthy();
    click(sheetBtn('Tauschen mit'));
    await tick();
    expect(document.querySelector('.quick')?.textContent).toContain('Tauschen:'); // Hinweisleiste
    expect(document.querySelector('.meal-row.on')?.textContent).toContain('Tausch-A'); // Quelle markiert
    click(rowByTitle('Tausch-A'));
    await tick();
    expect(document.querySelector('.quick')).toBeNull(); // abgebrochen

    // erneut starten, diesmal Ziel in der Übersicht antippen (Tausch-B auf d2)
    click(rowByTitle('Tausch-A'));
    await tick();
    click(sheetBtn('Tauschen mit'));
    await tick();
    click(rowByTitle('Tausch-B'));
    await tick();
    expect(document.querySelector('.quick')).toBeNull(); // Tausch-Modus beendet
    expect(rowByDate(d1)?.textContent).toContain('Tausch-B'); // B jetzt auf d1
    expect(rowByDate(d2)?.textContent).toContain('Tausch-A'); // A jetzt auf d2

    // Tag↔Pool: Tausch-B (auf d1) → „Tauschen mit …“ → Pool-Eintrag antippen
    click(rowByTitle('Tausch-B'));
    await tick();
    click(sheetBtn('Tauschen mit'));
    await tick();
    click(rowByTitle('Tausch-Pool'));
    await tick();
    expect(rowByDate(d1)?.textContent).toContain('Tausch-Pool'); // Pool-Eintrag auf d1
    expect(rowByTitle('Tausch-B').querySelector('.meal-date')?.textContent?.trim()).toBe(''); // B in der Pool-Liste (kein Datum)

    // „Tauschen mit …“ auch im Sheet eines Pool-Eintrags
    click(rowByTitle('Tausch-B'));
    await tick();
    expect(sheetBtn('Tauschen mit'), 'Tauschen-Button fehlt im Pool-Sheet').toBeTruthy();
    click(document.querySelector('.backdrop')!);
    await tick();
  });
});

/**
 * E2E für den Menü-Umbau: Urlaubsplanung als Reiter (ohne Dienstreisen, Ampel bleibt), Verlauf
 * (nur Urlaub, keine Aufgaben), Event-Uhrzeit, Briefing mit Events, Undo – plus seeded Monkeytest.
 */
describe('E2E: Urlaubsplanung, Verlauf, Event-Uhrzeit, Briefing, Undo, Monkey', () => {
  beforeAll(() => {
    // jsdom: scrollIntoView/IntersectionObserver fehlen
    (Element.prototype as unknown as { scrollIntoView?: () => void }).scrollIntoView ??= () => {};
    (globalThis as Record<string, unknown>).IntersectionObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  /** Erster Arbeitstag ab `from` (mit Feiertagen aus dem gebündelten Stand). */
  const workday = async (from: string) => {
    const { buildCalendar } = await import('./core/calendar');
    const hd = (await import('./data/holidays.json')).default as never;
    const c = buildCalendar([], hd);
    let d = from;
    for (let i = 0; i < 10; i++) {
      if (c.day(d).workday) return d;
      d = addDays(d, 1);
    }
    return d;
  };
  const lsItems = () => JSON.parse(localStorage.getItem('fp.items') ?? '[]') as { id: string; kind: string; deleted?: boolean; title?: string; time?: string; endTime?: string }[];

  it('Urlaubsplanung als Reiter: DR im Band/Jahr unsichtbar, in der Woche sichtbar; „Urlaub planen“ springt in den Jahr-Reiter', async () => {
    localStorage.clear();
    document.body.innerHTML = '';
    const { App } = await import('./App');
    const { saveItem, updateSettings } = await import('./store');
    updateSettings({ me: 'sebastian', server: '', code: '' });
    const d1 = await workday(weekStart(today())); // Arbeitstag in der angezeigten Woche
    const d2 = addDays(d1, 1);
    saveItem({ id: 'u1', kind: 'presence', title: 'Messe', start: d1, end: d2, persons: ['sebastian'], mode: 'trip', updated: 0 } as never);
    saveItem({ id: 'u2', kind: 'presence', title: 'Ostsee', start: d1, end: d2, persons: ['betty'], mode: 'vacation', updated: 0 } as never);
    const root = document.createElement('div');
    document.body.appendChild(root);
    render(h(App, {}), root);
    await tick(60);

    // Woche: DR und Urlaub als Status sichtbar (Ampel/Anwesenheit unverändert)
    click([...document.querySelectorAll('.tabs button')].find((b) => b.textContent?.includes('Kalender'))!);
    await tick(40);
    click([...document.querySelectorAll('.seg-ctl button')].find((b) => b.textContent?.trim() === 'Woche')!); // calView evtl. aus Vortest verstellt
    await tick(40);
    expect(document.querySelector('.mx-cell.st-trip'), 'Dienstreise fehlt in der Wochenmatrix').toBeTruthy();
    expect(document.querySelector('.mx-cell.st-vacation'), 'Urlaub fehlt in der Wochenmatrix').toBeTruthy();

    // Urlaubsplanung: Jahresband ohne DR-Streifen, mit Urlaub; Ebenen-Schalter ausgeblendet
    click([...document.querySelectorAll('.seg-ctl button')].find((b) => b.textContent?.includes('Urlaubsplanung'))!);
    await tick(60);
    expect(document.body.textContent).toContain('Urlaubsverwaltung');
    expect(document.querySelector('.rb-trip')).toBeNull();
    expect(document.querySelectorAll('.rb-vac').length).toBeGreaterThan(0);
    expect(document.querySelector('.layer-menu')).toBeNull();

    // Jahr: keine DR-Lanes, Legende ohne „Dienstreise“
    click([...document.querySelectorAll('.seg-ctl button')].find((b) => b.textContent?.includes('Jahr'))!);
    await tick(60);
    expect(document.querySelector('.lane.trip')).toBeNull();
    expect(document.querySelector('.legend')!.textContent).not.toContain('Dienstreise');

    // „Urlaub für Betty planen“ → Jahr-Reiter
    click([...document.querySelectorAll('.seg-ctl button')].find((b) => b.textContent?.includes('Urlaubsplanung'))!);
    await tick(60);
    click([...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Urlaub für Betty planen'))!);
    await tick(80);
    expect(document.querySelector('.seg-ctl button.on')?.textContent).toContain('Jahr');
  });

  it('Verlauf: Eltern nur Urlaub (kein HO/DR), keine Aufgaben, Ampel bleibt, Event-Uhrzeit je Tag', async () => {
    localStorage.clear();
    document.body.innerHTML = '';
    const { App } = await import('./App');
    const { saveItem, updateSettings } = await import('./store');
    updateSettings({ me: 'sebastian', server: '', code: '' });
    // +40 Tage: außerhalb der Daten der Vortests, aber innerhalb der ersten 70 Verlaufstage
    const d = await workday(addDays(today(), 40));
    const d2 = await workday(addDays(d, 1));
    saveItem({ id: 'v1', kind: 'presence', start: d, end: d, persons: ['sebastian'], mode: 'homeoffice', updated: 0 } as never);
    saveItem({ id: 'v2', kind: 'presence', title: 'Messe', start: d, end: d, persons: ['betty'], mode: 'trip', updated: 0 } as never);
    saveItem({ id: 'v3', kind: 'presence', start: d2, end: d2, persons: ['sebastian'], mode: 'vacation', updated: 0 } as never);
    saveItem({ id: 'v4', kind: 'care', title: 'Schließtag Schule', start: d, end: d, persons: ['ida'], updated: 0 } as never);
    saveItem({ id: 'v5', kind: 'task', title: 'Verlaufs-Aufgabe', start: d, end: d, persons: [], owner: 'sebastian', updated: 0 } as never);
    saveItem({ id: 'v6', kind: 'event', title: 'Elternabend', start: d, end: d, persons: ['sebastian'], owner: 'sebastian', time: '15:00', updated: 0 } as never);
    saveItem({ id: 'v7', kind: 'info', title: 'Festival', start: d, end: d2, time: '18:00', persons: [], updated: 0 } as never);
    const root = document.createElement('div');
    document.body.appendChild(root);
    render(h(App, {}), root);
    await tick(60);
    click([...document.querySelectorAll('.tabs button')].find((b) => b.textContent?.includes('Kalender'))!);
    await tick(40);
    click([...document.querySelectorAll('.seg-ctl button')].find((b) => b.textContent?.includes('Verlauf'))!);
    await tick(80);

    const row = document.querySelector(`#tl-${d}`)!.closest('.tl-row')!;
    const cells = [...row.querySelectorAll('.tl-cell')]; // Reihenfolge: Sebastian, Betty, Ida, Irma
    const top = (c: Element) => c.querySelector('.tl-top')?.textContent ?? '';
    expect(top(cells[0])).not.toContain('Homeoffice'); // keine Anwesenheit außer Urlaub
    expect(top(cells[1])).not.toContain('Dienstreise');
    expect(row.textContent).not.toContain('Verlaufs-Aufgabe'); // Aufgaben raus
    expect(cells[0].textContent).toContain('15:00'); // Termin mit Uhrzeit in der Personenzelle
    expect(cells[2].textContent).toContain('Schließtag Schule'); // Betreuungsbedarf bleibt
    const dateCell = row.querySelector('.tl-date')!;
    expect(dateCell.textContent).toContain('18:00 Festival'); // Event mit Uhrzeit
    expect(dateCell.textContent).toContain('Tag 1/2');
    expect(row.querySelector('.lamp'), 'Ampel fehlt in der Datumsspalte').toBeTruthy(); // bleibt (HO + Schließtag → maybe)

    // nächster Arbeitstag: Urlaub angezeigt, Event-Uhrzeit an jedem Tag des Zeitraums
    const row2 = document.querySelector(`#tl-${d2}`)!.closest('.tl-row')!;
    expect(top(row2.querySelectorAll('.tl-cell')[0])).toContain('Urlaub');
    expect(row2.querySelector('.tl-date')!.textContent).toContain('18:00');
    expect(row2.querySelector('.tl-date')!.textContent).toContain('Tag 2/2');

    // Ebenen-Menü im Verlauf ohne Aufgaben-Toggle
    click(document.querySelector('.layer-menu button')!);
    await tick(30);
    expect(document.querySelector('.layer-pop')!.textContent).not.toContain('Aufgaben');
    click(document.querySelector('.layer-backdrop')!);
    await tick(20);
  });

  it('Event-Uhrzeit: info über Langdruck-Picker mit Start/bis anlegen, speichern, per Rückgängig entfernen', async () => {
    localStorage.clear();
    document.body.innerHTML = '';
    const { App } = await import('./App');
    const { updateSettings } = await import('./store');
    updateSettings({ me: 'sebastian', server: '', code: '' });
    const root = document.createElement('div');
    document.body.appendChild(root);
    render(h(App, {}), root);
    await tick(60);

    // Langdruck → Picker → „Event“ (kind info)
    document.querySelector('.home-btn')!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    await tick(500);
    click([...document.querySelectorAll('.kinds .kind')].find((k) => (k.textContent ?? '').includes('Event'))!);
    await tick(60);
    const sheet = document.querySelector('.sheet')!;
    expect(sheet.querySelectorAll('input[type="time"]').length).toBe(2); // Start + bis auch für Events
    setInput(sheet.querySelector('input[placeholder*="Stadtfest"]') as HTMLInputElement, 'Stadtfest');
    const day15 = [...sheet.querySelectorAll('.rpick-grid button')].find((b) => b.textContent?.trim().startsWith('15'));
    click(day15!);
    await tick(30);
    const times = sheet.querySelectorAll('input[type="time"]') as NodeListOf<HTMLInputElement>;
    setInput(times[0], '18:00');
    setInput(times[1], '23:30');
    await tick(20);
    click([...sheet.querySelectorAll('button')].find((b) => b.textContent === 'Speichern')!);
    await tick(50);

    const ev = lsItems().find((i) => i.kind === 'info' && i.title === 'Stadtfest');
    expect(ev, 'Event nicht gespeichert').toBeTruthy();
    expect(ev!.time).toBe('18:00');
    expect(ev!.endTime).toBe('23:30');

    // Undo: Snackbar → „Rückgängig“ → Eintrag als gelöscht markiert, Snackbar weg (kein Redo)
    const snack = document.querySelector('.snack');
    expect(snack, 'Undo-Snackbar fehlt').toBeTruthy();
    click([...snack!.querySelectorAll('button')].find((b) => b.textContent?.includes('Rückgängig'))!);
    await tick(40);
    expect(lsItems().find((i) => i.id === ev!.id)?.deleted).toBe(true);
    expect(document.querySelector('.snack')).toBeNull();
  });

  it('Undo (Store): Löschen rückgängig stellt her; nach dismissUndo ist Undo weg', async () => {
    const { saveItem, deleteItem, withUndo, undoLast, dismissUndo } = await import('./store');
    const t = today();
    saveItem({ id: 'ux1', kind: 'task', title: 'Undo-Test 1', start: t, end: t, persons: [], updated: 0 } as never);
    withUndo('gelöscht', () => deleteItem('ux1'));
    undoLast();
    expect(lsItems().find((i) => i.id === 'ux1' && !i.deleted), 'Undo hat Löschen nicht zurückgenommen').toBeTruthy();
    expect(() => undoLast()).not.toThrow(); // kein zweites Undo

    saveItem({ id: 'ux2', kind: 'task', title: 'Undo-Test 2', start: t, end: t, persons: [], updated: 0 } as never);
    withUndo('gelöscht', () => deleteItem('ux2'));
    dismissUndo(); // Snackbar geschlossen ohne Undo
    undoLast();
    expect(lsItems().find((i) => i.id === 'ux2')?.deleted).toBe(true); // bleibt gelöscht
  });

  it('Briefing sonntags: Events der Woche, mehrtägige an jedem Tag mit Uhrzeit und „Tag x/y“', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-22T12:00:00')); // Sonntag
    try {
      document.body.innerHTML = '';
      localStorage.clear();
      const { App } = await import('./App');
      const { saveItem, updateSettings } = await import('./store');
      updateSettings({ me: 'sebastian', server: '', code: '' });
      const t = today(); // So 22.11.2026
      const t1 = addDays(t, 1); // Mo
      const t3 = addDays(t, 3); // Mi
      saveItem({ id: 'b1', kind: 'info', title: 'Festival X', start: t1, end: t3, time: '18:00', persons: ['ida'], updated: 0 } as never);
      const root = document.createElement('div');
      document.body.appendChild(root);
      render(h(App, {}), root);
      await vi.advanceTimersByTimeAsync(120);
      const lines = [...document.querySelectorAll('.brief-day')].map((d) => d.textContent ?? '');
      const fest = lines.filter((l) => l.includes('Festival X'));
      expect(fest.length).toBe(3); // Mo, Di, Mi – mehrtägiges Event an jedem Tag
      expect(fest[0]).toContain('18:00');
      expect(fest[0]).toContain('Tag 1/3');
      expect(fest[1]).toContain('Tag 2/3');
      expect(fest[2]).toContain('Tag 3/3');
      expect(fest[0]).toContain('(Ida)'); // Personenangabe wie bei Terminen
    } finally {
      vi.useRealTimers();
    }
  });

  it('Monkeytest: 250 seeded Zufalls-Aktionen ohne Ausnahme, Daten bleiben konsistent', async () => {
    let s = 427205;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
    localStorage.clear();
    document.body.innerHTML = '';
    const { App } = await import('./App');
    const { saveItem, updateSettings } = await import('./store');
    updateSettings({ me: 'sebastian', server: '', code: '' }); // kein Netzwerk im Test
    const t = today();
    const d = await workday(t);
    saveItem({ id: 'm1', kind: 'event', title: 'Monkey-Termin', start: d, end: d, persons: ['sebastian'], owner: 'sebastian', time: '10:00', updated: 0 } as never);
    saveItem({ id: 'm2', kind: 'task', title: 'Monkey-Aufgabe', start: d, end: d, persons: [], updated: 0 } as never);
    saveItem({ id: 'm3', kind: 'presence', start: d, end: addDays(d, 2), persons: ['betty'], mode: 'vacation', updated: 0 } as never);
    saveItem({ id: 'm4', kind: 'info', title: 'Monkey-Fest', start: d, end: addDays(d, 1), time: '18:00', persons: [], updated: 0 } as never);
    saveItem({ id: 'm5', kind: 'birthday', title: 'Oma', start: '1955-05-07', end: '1955-05-07', persons: [], updated: 0 } as never);
    saveItem({ id: 'm6', kind: 'fact', title: 'Kinderarzt', cat: 'gesundheit', start: t, end: t, persons: [], updated: 0 } as never);
    saveItem({ id: 'm7', kind: 'fact', title: 'Alte Größenkarte', cat: 'groessen' as never, start: t, end: t, persons: [], updated: 0 } as never); // Migration: → Sonstiges
    saveItem({ id: 'm8', kind: 'meal', title: 'Monkey-Mahlzeit', start: t, end: t, persons: [], updated: 0 } as never);
    saveItem({ id: 'm9', kind: 'shop', title: 'Milch', start: t, end: t, persons: [], updated: 0 } as never);
    const root = document.createElement('div');
    document.body.appendChild(root);
    const errors: unknown[] = [];
    window.addEventListener('error', (e) => errors.push(e.error ?? e.message));
    render(h(App, {}), root);
    await tick(80);

    const WORDS = ['Milch', 'Brot', 'Urlaub', 'Fest', 'Test', 'x'];
    for (let i = 0; i < 250; i++) {
      try {
        const kind = Math.floor(rnd() * 25);
        if (kind === 0) {
          click(pick([...document.querySelectorAll('.tabs button')]));
        } else if (kind === 1) {
          const v = [...document.querySelectorAll('.seg-ctl button')];
          if (v.length) click(pick(v));
        } else if (kind === 2) {
          // selten Langdruck (450 ms)
          document.querySelector('.home-btn')?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
          await tick(480);
        } else if (kind === 3) {
          const bd = document.querySelector('.backdrop');
          if (bd) click(bd);
        } else if (kind === 4 || kind === 5) {
          const btns = [...document.querySelectorAll('main button, .sheet button, .layer-pop button')].filter((b) => !(b as HTMLButtonElement).disabled);
          if (btns.length) click(pick(btns));
        } else if (kind === 6) {
          const inps = [...document.querySelectorAll('main input, .sheet input')] as HTMLInputElement[];
          const inp = pick(inps);
          if (inp && (inp.type === 'text' || inp.type === 'search')) setInput(inp, pick(WORDS));
        } else if (kind === 7) {
          const fs = [...document.querySelectorAll('form')];
          if (fs.length) submit(pick(fs));
        } else if (kind === 8 || kind === 9) {
          const rows = [...document.querySelectorAll('.shop-row, .line.link-row, .mx-cell, .tl-row, .more-row, .hit')];
          if (rows.length) click(pick(rows));
        } else if (kind === 10) {
          const hb = [...document.querySelectorAll('header button')];
          if (hb.length) click(pick(hb));
        } else if (kind === 11) {
          const chips = [...document.querySelectorAll('.chips .chip, .layer-menu')];
          if (chips.length) click(pick(chips));
        } else {
          window.scrollTo(0, Math.floor(rnd() * 2000));
        }
        await tick(4);
      } catch (e) {
        errors.push(e);
      }
    }

    expect(errors).toEqual([]);
    expect(document.querySelector('.app'), 'App rendert nicht mehr').toBeTruthy();
    const items = lsItems();
    expect(items.length).toBeGreaterThan(0);
    for (const i of items) {
      expect(typeof i.id).toBe('string');
      expect(typeof i.kind).toBe('string');
    }
    // Kalender baut aus den Daten fehlerfrei
    const { buildCalendar } = await import('./core/calendar');
    const hd = (await import('./data/holidays.json')).default as never;
    expect(() => buildCalendar(items.filter((i) => !('deleted' in i) || !i.deleted) as never, hd)).not.toThrow();
  }, 30000);

  it('Migration: alte Infomappen-Kategorie „groessen“ wird beim Laden nach „Sonstiges“ gemappt', async () => {
    localStorage.clear();
    localStorage.setItem('fp.items', JSON.stringify([
      { id: 'g1', kind: 'fact', cat: 'groessen', title: 'Schuhgroesse Ida', start: '2026-01-01', end: '2026-01-01', persons: [], updated: 1 },
    ]));
    document.body.innerHTML = '';
    vi.resetModules(); // frischer Store liest fp.items inkl. Migration
    const { saveItem } = await import('./store');
    saveItem({ id: 'g2', kind: 'task', title: 'Persist-Trigger', start: '2026-01-01', end: '2026-01-01', persons: [], updated: 0 } as never); // schreibt alle Items zurück
    const items = JSON.parse(localStorage.getItem('fp.items') ?? '[]') as { id: string; cat?: string }[];
    expect(items.find((i) => i.id === 'g1')?.cat).toBe('sonstiges');
  });
});
