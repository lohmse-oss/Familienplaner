# Archiv: Entwicklungspfad von `index.html`

Vollständige Entwicklungsgeschichte der Web-App (`index.html`, Single-File: Markup + CSS + JS + Basisdaten),
archiviert am 2026-11-14 auf Branch `vibe/jahresplaner-754bf0` (HEAD `2f0b8cc`).

## Snapshots

Jede Station der Datei als lauffähige Kopie: `index-<commit>-<datum>.html` (per Doppelklick öffnen, file:// genügt).
Die neueste Datei `index-2f0b8cc-2026-11-14.html` entspricht exakt dem aktuellen `index.html` im Repo-Wurzelverzeichnis.

## Stationen (chronologisch)

| # | Commit | Datum | Diff | Zeilen | Bytes | Inhalt |
|---|--------|-------|------|--------|-------|--------|
| 1 | `b5c43d4` | 2026-11-08 | +179 | 179 | 7.059 | Familien-Jahresplaner Sachsen: HTML/JS/JSON-App mit Schulferien 2027-2030, Feiertagen, Urlaubszaehlung, schulfreien Tagen und Google-Kalender-Sync |
| 2 | `f7a0e80` | 2026-11-08 | +53 | 232 | 10.379 | Wandkalender-Ansicht pro Person: tageweise Liste mit Wochenend-/Feiertags-/Ferien-Markierung, Bereichsauswahl, Markieren als Urlaub/Termin/schulfrei, optional nur Arbeitstage, Sprung zu Monat/KW/Datum; 24.12. und 31.12. als halbe Urlaubstage (0,5) |
| 3 | `3052af7` | 2026-11-08 | +12 | 244 | 10.954 | Urlaubslisten-Ansicht: zusammenhaengende Urlaubsbloecke je Elternteil (Merge, wenn kein Arbeitstag dazwischen liegt), inkl. Kalendertage, Urlaubstage und ueberlappende Ferien |
| 4 | `6781e94` | 2026-11-08 | +33 | 277 | 12.599 | Multifunktions-Erweiterung: Betreuungsluecken, Brueckentag-Tipps, Personen-Filter, Jahresbalken (KW-Gantt), Alle-Eintraege-Ansicht, jaehrlich wiederkehrende Termine, Drag & Drop im Wandkalender, Druckansicht |
| 5 | `c5d8443` | 2026-11-08 | +40 / -13 | 304 | 15.082 | UX: Wandkalender (alle Tage vertikal) als Standardansicht; Header-Buttons in Submenues (Ansicht/Datei/Extras) im gemeinsamen Dropdown-Muster (dd/dd-menu, aria-haspopup=menu, Escape/Pfeiltasten, aria-pressed) |
| 6 | `a7597cb` | 2026-11-08 | +1.225 / -12 | 1.517 | 68.698 | Bugfixes aus Review (Doppelzaehlung Urlaub via bloeckeFor, gcal POST /calendars, Jahresfilter Alle-Eintraege, KW-Jahreskollision, Segmentierung nicht-kontinuierlicher Auswahl, Drag&Drop jaehrlicher Eintraege, 29.02., ICS vollstaendig, DOM-Update bei Auswahl) + app.js in index.html integriert (Single-File); Datei-Ex/Import nur Planungsdaten |
| 7 | `d89d2b2` | 2026-11-08 | +192 / -40 | 1.669 | 76.769 | Planungs-Intelligenz & Wandkalender-Ergonomie: Resturlaub Vorjahr + 31.03.-Warnung, Typ 'betreuung', Modus-Select je Person, Betreuungsluecken abgedeckt/geblockt + Schnellbuchung, sticky Spaltenkopf, Zeilen-Auswahl, Netto-Vorschau, Bearbeiten im Tag-Modal, Heute-Button, Escape/Enter, nur Werktage schulfrei, Feiertag-in-Ferien CSS, Export inkl. Mitglieder |
| 8 | `82a8776` | 2026-11-14 | +160 / -5 | 1.824 | 83.499 | Multi-User-Sync (selbstgehosteter Server) + Android-APK-Wrapper |
| 9 | `a89c889` | 2026-11-14 | +27 / -2 | 1.849 | 84.957 | Mobile-optimierte Oberflaeche (≤768px) + APK v1.1 |
| 10 | `f643663` | 2026-11-14 | +191 / -207 | 1.833 | 88.359 | Mobile-Optimierung: kompakte Kopfzeile, Bottom-Sheets, Touch-Bereichsauswahl und Long-Press, Wandkalender ohne seitliches Scrollen, Spaltenkoepfe buendig |
| 11 | `e9bad5f` | 2026-11-14 | +112 / -15 | 1.930 | 93.498 | Review-Fixes: Import/localStorage validieren (HTML-Injection), Jahresbalken springt per Datum statt KW-Nummer, Rollenwechsel setzt Urlaubstage/Modus korrekt |
| 12 | `3c0987b` | 2026-11-14 | +117 / -44 | 2.003 | 96.395 | Google-Sync: nur markierte App-Termine loeschen (mit Rueckfrage), Sitzungsablauf sichtbar, 404 -> neu anlegen, Paginierung, Skript erst bei Bedarf laden, jaehrliche Eintraege als Serie, gcalId nicht exportieren |
| 13 | `594c546` | 2026-11-14 | +69 / -29 | 2.043 | 98.298 | Kleinere Review-Punkte: Tag-Dialog nutzt Jahr des Tages, Ferien per Index loeschen, Drag&Drop relativ zum gezogenen Tag, nur echte Brueckentage (inkl. Nachbarjahre), ICS RFC-konform (Escaping, Faltung, Serien) |
| 14 | `6abd799` | 2026-11-14 | +422 / -46 | 2.419 | 120.930 | Pflegedialog fuer Ferien & Feiertage + automatischer Online-Abgleich (OpenHolidays-API) |
| 15 | `9d2856b` | 2026-11-14 | +34 / -1 | 2.452 | 123.417 | Google Kalender: Direktlink 'In Google Kalender oeffnen' je Eintrag (ohne Client-ID), Umgebungspruefung fuer Live-Sync (file://, WebView), README |
| 16 | `2f0b8cc` | 2026-11-14 | +189 / -17 | 2.624 | 131.535 | Merge main (PR #7) in PR #6: Konflikte in index.html geloest, Sync mit Validierung verzahnt (aktueller Stand) |

Diff = Aenderung gegenueber der vorherigen Station (`git diff <alt> <neu> -- index.html`).

## Phasen

1. **Grundstein (08.11., Stationen 1-4):** Basis-App mit Ferien/Feiertagen/Google-Sync, dann Wandkalender-, Urlaubslisten- und Multifunktions-Ansicht — noch als getrennte Dateien, klein (bis 12,6 KB).
2. **Single-File & Intelligenz (08.11., Stationen 5-7):** UX-Redesign mit Dropdown-Menues; `app.js` wird in `index.html` integriert (+1.225 Zeilen auf einen Schlag), danach Planungs-Intelligenz (Resturlaub, Betreuung, Brueckentage).
3. **Sync & Android (14.11., Stationen 8-9):** Multi-User-Sync (selbstgehosteter Server) + WebView-APK-Wrapper, mobile Optimierung + APK v1.1.
4. **Mobile-Feinschliff & Review (14.11., Stationen 10-13):** Bottom-Sheets/Touch, Validierung gegen HTML-Injection, Google-Sync-Details, Review-Punkte.
5. **Pflege & Abschluss (14.11., Stationen 14-16):** Pflegedialog fuer Ferien/Feiertage mit OpenHolidays-Abgleich (groesster Zuwachs: +422), Google-Kalender-Direktlink, Merge von PR #7.

Wachstum gesamt: 179 -> 2.624 Zeilen, 7.059 -> 131.535 Bytes (Faktor ~14 Zeilen, ~19 Bytes).

## Weiterfuehrende Historie

- Alle Commits, die `index.html` betreffen: `git log --all --oneline -- index.html`
- Diff zwischen zwei Stationen: `git diff <commit-alt> <commit-neu> -- index.html`
- Stand einer Station: `git show <commit>:index.html > index.html`
