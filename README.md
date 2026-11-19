# Familienplaner

Wochenplaner mit Jahresforecast für die Familie (Chemnitz, Sachsen). Konzept und Entscheidungen: [KONZEPT.md](KONZEPT.md).

```
app/      Android-App (Preact + TypeScript + Capacitor)
worker/   Sync-Backend (Cloudflare Worker + D1)
scripts/  Hilfsskripte (Ferien-Offlinestand aktualisieren)
```

## 1. Backend bei Cloudflare einrichten (einmalig, ca. 5 Minuten)
Voraussetzung: Cloudflare-Konto (kostenloser Plan reicht), Node.js 22.

```bash
cd worker
npm install
npx wrangler login
npx wrangler d1 create familienplaner --location weur   # gibt eine database_id aus → in wrangler.toml eintragen
npx wrangler d1 execute familienplaner --remote --file=schema.sql
npx wrangler secret put FAMILY_CODE            # gemeinsames Passwort für Sebastian und Betty
npx wrangler deploy                            # gibt die Adresse https://familienplaner-sync.<konto>.workers.dev aus
```

## 2. APK bauen und installieren
Der Build läuft in GitHub Actions (`.github/workflows/android.yml`) – lokal ist kein Android Studio nötig.
* Jeder Push baut die APK → *Actions* → Lauf öffnen → Artefakt **familienplaner-apk**.
* Mit einem Tag (`git tag v0.1.0 && git push --tags`) liegt die APK unter *Releases*, direkt vom Handy ladbar.
* Auf dem Handy: APK öffnen und „Unbekannte Apps installieren“ für den Browser/Dateimanager erlauben.
* Die APK ist mit einem festen Schlüssel signiert (`app/android/app/familienplaner.keystore`), spätere Versionen installieren sich daher als Update, ohne Datenverlust.

Beim ersten Start: *Mehr* → „Dieses Handy gehört“ wählen → Familiencode eintragen (die Server-Adresse ist in `app/src/store.ts` als `DEFAULT_SERVER` voreingestellt) → *Speichern & verbinden*.
Danach Urlaubstage je Person im Tab *Urlaub* eintragen.

**Widget:** Homescreen lange drücken → Widgets → „Familienplaner Heute“ (Nothing-Stil, nur Grafik; Hintergrund transparent/Glas/dunkel/hell unter *Mehr → Einstellungen → Darstellung & Widget*).

**Android Auto:** Die App meldet sich bei Android Auto als **Medien-App** („Familienplaner“). Nur so listet Android Auto eine per Sideload installierte APK im Launcher – Template-Apps (CarAppService) erscheinen im echten Auto ausschließlich bei Verteilung über Google Play, und `CAR_LAUNCHER` gilt bei Android Auto nur für Spiele. Einrichtung (einmalig, am Handy):
1. **Android-Auto-App** → Einstellungen → ganz unten *Version* 10× antippen → Entwicklermodus bestätigen → ⋮-Menü → **Entwickleroptionen** → **„Unbekannte Quellen“** aktivieren.
2. Android Auto → Einstellungen → **„Launcher anpassen“** → Haken bei **Familienplaner** setzen.
3. Einmal die Familienplaner-App öffnen (legt die Daten ab) und das Auto neu verbinden.

Im Auto: *Familienplaner* im Launcher (Medien) → Heute / Morgen / Übermorgen / Weitere Tage / Einkaufsliste / Aufgaben (mit Betreuungs-Ampel, „ungeklärt!“). Ein Tipp auf einen Eintrag oder auf „Tag vorlesen“ **liest ihn per Sprachausgabe vor**. Zusätzlich ist ein CarAppService (Template-UI, Kategorie POI) enthalten – sichtbar im Desktop Head Unit (DHU) und bei Play-Verteilung (Internal App Sharing / Test-Track).

**Hinweise vom Partner:** Beim ersten Start die Benachrichtigungen erlauben. In Android ggf. den Akku-Sparmodus für die App lockern, damit der Hintergrund-Abgleich (ca. alle 15 Min.) zuverlässig läuft.

**Lesezugriff (z. B. Ida):** APK auf ihrem Handy installieren, unter *Mehr → Einstellungen → Ich & Zugriff* „Ida“ wählen und unter *Synchronisierung* den **Lese-Code** eintragen.
Der Lese-Code wird beim Server als Secret gesetzt: `npx wrangler secret put READ_CODE`. Mit ihm kann nur gelesen werden, Schreiben lehnt der Server ab.

Der Server (`worker/`) muss nach Änderungen neu deployt werden: `cd worker && npx wrangler deploy`.

## Entwicklung
```bash
cd app && npm install
npm run dev        # Browser-Entwicklung
npm test           # Kernlogik (Ampel, Brückentage, Urlaubsübersicht, Benachrichtigungen)
npm run build && npx cap sync android

cd ../worker && npm test    # Sync-API gegen echtes SQLite
```
Ferien-Offlinestand erneuern: `node scripts/fetch-holidays.mjs 2027-01-01 2029-12-31`.
