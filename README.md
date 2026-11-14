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
npx wrangler d1 create familienplaner          # gibt eine database_id aus → in wrangler.toml eintragen
npx wrangler d1 execute familienplaner --remote --file=schema.sql
npx wrangler secret put FAMILY_CODE            # gemeinsames Passwort für Sebastian und Betty
npx wrangler deploy                            # gibt die Adresse https://familienplaner.<konto>.workers.dev aus
```

## 2. APK bauen und installieren
Der Build läuft in GitHub Actions (`.github/workflows/android.yml`) – lokal ist kein Android Studio nötig.
* Jeder Push baut die APK → *Actions* → Lauf öffnen → Artefakt **familienplaner-apk**.
* Mit einem Tag (`git tag v0.1.0 && git push --tags`) liegt die APK unter *Releases*, direkt vom Handy ladbar.
* Auf dem Handy: APK öffnen und „Unbekannte Apps installieren“ für den Browser/Dateimanager erlauben.
* Die APK ist mit einem festen Schlüssel signiert (`app/android/app/familienplaner.keystore`), spätere Versionen installieren sich daher als Update, ohne Datenverlust.

Beim ersten Start: *Mehr* → „Dieses Handy gehört“ wählen → Server-Adresse und Familiencode eintragen → *Speichern & verbinden*.
Danach Urlaubstage je Person im Tab *Urlaub* eintragen.

## Entwicklung
```bash
cd app && npm install
npm run dev        # Browser-Entwicklung
npm test           # Kernlogik (Ampel, Brückentage, Urlaubsübersicht, Benachrichtigungen)
npm run build && npx cap sync android

cd ../worker && npm test    # Sync-API gegen echtes SQLite
```
Ferien-Offlinestand erneuern: `node scripts/fetch-holidays.mjs 2027-01-01 2029-12-31`.
