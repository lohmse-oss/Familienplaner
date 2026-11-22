# Teststrategie (nach ISO/IEC 25000 / Qualitätsmodell ISO/IEC 25010)

Gilt für `app/` (Preact + TypeScript + Capacitor, local-first) und `worker/` (Cloudflare Worker + D1).
Prinzip: **nur Tests, die ein reales Risiko adressieren.** Die App hat 2 Schreib- + 1 Lese-Nutzer, alle Daten liegen lokal –
daraus folgt eine schlanke Pyramide: viele Unit-Tests der Kernlogik, wenige aber komplette E2E-Flows, gezielte manuelle Gerätetests.

## Qualitätsmerkmale → Testarten

| ISO-25010-Merkmal | Relevante Untermerkmale | Testarten | Konkrete Umsetzung |
|---|---|---|---|
| **Funktionale Eignung** | Vollständigkeit, Korrektheit | Unit (Kernlogik), Integration (Sync), E2E (Flows) | `app/src/core/core.test.ts` (Ampel/Coverage, Urlaubszählung inkl. 24./31.12.-Halbtage, Brückentage, Wiederholungen, Pool/Tausch, Presence-Splitting, `timeOn`/`evText`, Suche, Migrationen) · `worker/src/worker.test.ts` gegen echtes SQLite (LWW-Merge, Tombstones, Auth) · `app/src/app.e2e.test.ts` (jsdom-Klickflows: Mahlzeiten, Urlaubsplanung, Verlauf, Briefing, Undo, seeded Monkeytest). Soll-Definition: [KONZEPT.md](KONZEPT.md) |
| **Performance-Effizienz** | Zeitverhalten bei realistischer Datenmenge | Budget-Tests mit großzügigem Limit | Einmalig pro Release: `buildCalendar` über 1 Jahr, `vacationReport` je Person/Jahr, ein Timeline-Ladeschritt (60 Tage) – jeweils unter festem Zeitbudget (z. B. < 200 ms) gegen Fixtur mit ~1000 Einträgen. Der 400-Tage-Cap je Eintrag ist als Schutz Unit-getestet |
| **Kompatibilität** | Interoperabilität, Koexistenz | Unit + Integration | ICS-Import (`core/ics.ts`): Unit-Tests mit echten ICS-Fixtures · Sync-Protokoll: Worker bleibt abwärtskompatibel (unbekannte Felder tolerieren, `_rev`-Strip) – Worker-Tests · Speicher-Migrationen (`store.ts`: `elternabend`→`schule`, `groessen`→`sonstiges`): eigener Migrationstest (frischer Store liest vorbelegtes `fp.items`) |
| **Interaktionsfähigkeit** | Erkennbarkeit, Bedienbarkeit, Fehlerschutz | E2E + a11y-Smoke | E2E prüft sichtbare Labels/Hints und Validierung (31.02. rot markiert, Speichern ohne Datum deaktiviert, leeres Datum bei Neuanlage) · a11y-Smoke in jsdom: jedes Icon-Button trägt `aria-label` oder Text · seeded Monkeytest als Robustheit gegen Fehleingaben (250 Aktionen, PRNG-Seed fix, 0 Exceptions, Daten konsistent) |
| **Zuverlässigkeit** | Fehlertoleranz, Wiederherstellbarkeit | Unit + E2E mit Fehlerzuständen | Offline: `fetch` schlägt fehl → App bleibt voll bedienbar, Sync-Status „offline“ (keine Netzwerkzugriffe in Tests: `server`/`code` leer) · Undo stellt gelöschte/geänderte Einträge wieder her (E2E + Store-Test, inkl. „nach dismissUndo kein Undo mehr“) · App-Kill: offene Sheets/Entwürfe über `useUiState` (`resume.ts`) – E2E mit Remount · korruptes `localStorage` (kaputtes JSON) → `read()` fällt auf Default zurück, App startet |
| **Sicherheit** | Vertraulichkeit, Integrität, Authentizität | Worker-Tests + App-Test + Repo-Check | Falscher Familiencode → 401, Lese-Code → Schreiben 403, fehlender Header → 401 (`worker.test.ts`) · „nur Eltern“-Infomappen-Karten im Lesezugriff ausgeblendet (App-Test mit `role: 'read'`) · kein Secret in Repo/Logs: einfacher grep-Check (`console.log`, Token-Muster) als Skript/CI-Step |
| **Wartbarkeit** | Analysierbarkeit, Änderbarkeit, Testbarkeit | Gates + Coverage | Kernlogik liegt DOM-frei in `core/` → unit-testbar (bereits umgesetzt) · Gate vor jedem Merge: `tsc --noEmit` + `npm test` (app) + `npm test` (worker) + APK-Build – CI führt app-Tests bereits vor dem Build aus (`android.yml`), Worker-Tests + Coverage-Schwelle für `app/src/core` (`vitest run --coverage`) als CI-Ergänzung vorgesehen · tote CSS-Regeln/ ungenutzte Exporte: Audit bei Cleanup-Commits (bisher manuell) |
| **Portabilität** | Installierbarkeit, Anpassbarkeit | Build-Test + Datenpfad-Tests + manuell | CI baut die APK (`gradlew assembleDebug`) = Installations-/Build-Test · Widget/Android-Auto-Datenpfad (`core/widget.ts`, 14-Tage-Ausschnitt) per Unit-Test · Dark Mode, Tablet-Layout (Seitenleiste ab 900 px), Widget-Hintergründe, Android Auto: manuelle Prüfung auf den Familiengeräten (2–3 Geräte, Sideload-APK) |

## Testebenen und Ausführung

| Ebene | Befehl | Wann |
|---|---|---|
| Unit (App-Kernlogik) | `cd app && npm test` (vitest, `core.test.ts`) | lokal vor jedem Commit, in CI vor dem APK-Build |
| Integration (Sync/Worker) | `cd worker && npm test` (echtes SQLite) | lokal vor Worker-Änderungen, CI-Vorschlag: eigener Job |
| E2E (UI-Flows, jsdom) | `cd app && npm test` (`app.e2e.test.ts`, inkl. Monkeytest) | lokal + CI |
| Build/Install | `cd app && npm run build` + CI: `gradlew assembleDebug` | jeder Push auf `main`/Tags |
| Manuell (Gerät) | Checkliste: Widget, Android Auto, Dark Mode, Hintergrund-Sync, Lesezugriff (Ida), App-Update ohne Datenverlust | vor jedem Release |

Testdaten: Fixtures in `core.test.ts` (Feiertage/Ferien), pro E2E-Test `localStorage.clear()` + eindeutige Item-Ids, jsdom-Lücken (`scrollIntoView`, `IntersectionObserver`) gestubbt.

## Bewusst **nicht** getestet (mit Begründung)

- **Last-/Stresstests** gegen Worker oder App: 2–4 Nutzer, Datenmenge lokal winzig – kein Risiko, nur Flake-Quelle.
- **Penetrationstests / formale Verifikation:** Auth ist bewusst ein Shared Secret (Familiencode); scope = Familie, nicht öffentlich.
- **Usability-Lab / WCAG-Zertifizierung:** stattdessen a11y-Smoke (aria-labels) + manuelle Geräteprüfung.
- **Große Geräte-/Android-Matrix:** manuelle Prüfung auf den vorhandenen Geräten; `minSdk 23` wird über den CI-Build abgedeckt.
- **Echter FCM-Push:** Phase 2 (noch nicht umgesetzt) – dann Smoke-Test mit Test-Projekt.
- **Netzwerk in Unit/E2E-Tests:** immer deaktiviert (`server`/`code` leer), damit Tests offline und deterministisch laufen.

## Definition of Done pro Änderung

1. `tsc --noEmit` fehlerfrei, `npm test` (app + worker) grün.
2. Neue Kernlogik → Unit-Tests; neues UI-Verhalten → E2E-Flow; Migration → Migrationstest.
3. KONZEPT.md aktualisiert (Soll-Verhalten), README falls betroffen.
4. APK-Build in CI grün; manuelle Geräte-Checkliste vor Release.

## Metriken und Flake-Vermeidung

- Messbar und im Blick: Testanzahl, Coverage von `app/src/core` (Ziel: alle Kernfunktionen abgedeckt, Schwelle im CI), Build-Dauer, Flake-Rate.
- Flake-Vermeidung: keine echten Wartezeiten (fake timers bzw. explizite `tick()`), Monkeytest mit festem PRNG-Seed, Perf-Budgets großzügig (nur Größenordnungen sichern), keine echten Netzwerk-/Gerätezugriffe in Tests.
