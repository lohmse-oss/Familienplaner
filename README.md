# Familien-Jahresplaner Sachsen

Statischer Web-Planer (HTML + JS + JSON) für eine Familie in Sachsen: Schulferien, Feiertage,
Urlaubsplanung der Eltern (Aufsummierung gegen verfügbare Urlaubstage), schulfreie Tage der Kinder
(inkl. flexibler/beweglicher Tage) und individuelle Termine/Abwesenheiten jedes Familienmitglieds.

## Dateien
- `index.html` – komplette App als eine Datei (Markup, CSS, JS und unveränderliche Basisdaten:
  Schulferien/Feiertage Sachsen, Personen Betty & Sebastian (Eltern, je 30 Urlaubstage), Ida & Irma (Kinder))
- `server/sync-server.js` – optionaler Sync-Server für Self-Hosting (siehe unten)
- `cloudflare/worker.js` + `wrangler.toml` – gleicher Sync-Server als Cloudflare Worker (kostenlos, HTTPS, siehe unten)
- `server/test-sync.mjs` – Test für den Sync-Server (zero dependencies)
- `android/` – WebView-Wrapper, baut die App als APK (siehe unten)
- `test/` – App-seitige Sync-Tests (happy-dom, `cd test && npm install && npm test`)
- `dist/` – fertige, signierte APK aus dem jeweiligen Branch

## Lokal starten
`index.html` direkt per Doppelklick öffnen (file://) – die Basisdaten sind in `app.js` integriert,
keine Datei wird nachgeladen. Alternativ über HTTP: `python3 -m http.server 8000` und
`http://localhost:8000` öffnen (gleiches Verhalten).

## Speicherung
- Automatisch im Browser (localStorage) nach jeder Änderung; ohne localStorage (z. B. blockierte Cookies) arbeitet die App mit den integrierten Basisdaten weiter.
- **JSON exportieren** speichert nur die eigene Planung als Datei (Einträge inkl. Titel/Kommentare, eigene Ferien, Einstellungen, Jahr); **JSON importieren** spielt sie zurück. Die Basisdaten (Personen, Sachsen-Ferien/Feiertage) bleiben fest in der HTML-Datei integriert.

## Funktionen
- Jahresansicht 2027–2031 mit Schulferien Sachsen (orange) und Feiertagen Sachsen (rot, pro Jahr
  berechnet inkl. Karfreitag, Ostermontag, Himmelfahrt, Pfingstmontag, Buß- und Bettag, Reformationstag).
- Urlaub der Eltern: Eintrag „Urlaub“; Urlaubstage = Werktage (Mo–Fr) abzüglich Feiertage im Zeitraum.
  Übersicht oben zeigt verbraucht/verfügbar/rest je Elternteil.
- Kinder: „Schulfrei (flexibel)“ für bewegliche Ferientage/Brückentage; schulfreie Gesamttage
  (Ferien + Feiertage + eigene Einträge) je Kind in der Übersicht.
- Alle Personen: „Besonderer Tag / Termin“ und „Abwesenheit“ (Festivals, Geburtstage, Abwesenheiten).
- Klick auf einen Tag zeigt alle Einträge und erlaubt Löschen/Neu-anlegen.
- **Wandkalender-Ansicht** (Standardansicht, Menü „Ansicht ▾“ im Header): alle Personen nebeneinander
  (eine Spalte pro Person), alle Tage des Jahres ansteigend von oben nach unten; Wochenenden, Feiertage
  und Schulferien farblich hervorgehoben. Pro Person gibt es oben einen Schalter **Urlaub/Abwesenheit**.
  Klick auf eine Personen-Zelle wählt den Tag, Shift+Klick einen Bereich; „Ausgewählte markieren“ legt
  die Einträge mit dem je Person eingestellten Modus an, das **Kommentarfeld** landet als Notiz am Eintrag.
  Mit „nur Arbeitstage“ wird ein Bereich in reine Arbeitstage aufgeteilt (Wochenenden/Feiertage bleiben
  frei). Sprung zu Monat, Kalenderwoche (KW) oder Datum. Doppelklick auf eine Zelle öffnet die Detailansicht.
  Die übrigen Funktionen (Ansichten, Datei-Ex/Import, Drucken, Einstellungen, Google-Sync) liegen
  in den Header-Submenüs „Ansicht ▾“, „Datei ▾“ und „Extras ▾“.
- **Halbe Tage**: 24.12. und 31.12. gelten als halbe Arbeitstage (½ Urlaubstag) und sind
  markiert (½).
- **Urlaubslisten-Ansicht** („Urlaubsliste“-Button): zusammenhängende Urlaubsblöcke je Elternteil.
  Zwei Zeiträume gelten als zusammenhängend, wenn zwischen ihnen kein Arbeitstag liegt (nur
  Wochenende/Feiertage dazwischen); Block zeigt Kalendertage, Urlaubstage und überlappende Ferien.
- **Jahresbalken** („Jahresbalken“-Button): KW-Spalten pro Person, farbige Zellen für
  Ferien/Urlaub/schulfrei/Termine; Klick auf eine KW springt in den Wandkalender.
- **Alle Einträge** („Alle Einträge“-Button): chronologische Liste aller Urlaube/Termine/Abwesenheiten
  aller Personen, gruppiert nach Monat, Klick öffnet den Tag.
- **Betreuung & Brückentage** („Betreuung & Brückentage“-Button): Betreuungslücken (Werktag mit
  schulfreiem Kind, aber keinem Elternteil im Urlaub) und Brückentag-Tipps (1 Urlaubstag → 4+ freie Tage).
- **Personen-Filter** (oben rechts): Einträge nur einer Person oder aller anzeigen (Monats-, Wand-,
  Balken- und Listenansicht).
- **Jährlich wiederkehrende Termine**: Checkbox im Eintragsformular (z. B. Geburtstage) – werden
  jedes Jahr automatisch am gleichen Datum angezeigt.
- **Drag & Drop im Wandkalender**: Eintrags-Chip auf einen anderen Tag ziehen, um den ganzen
  Zeitraum zu verschieben.
- **Druckansicht**: „Drucken“-Button (window.print) mit printoptimierter Darstellung.
- Einstellungen: Namen/Farben/Rollen ändern, Urlaubstage je Elternteil, eigene Ferien ergänzen
  (z. B. 2030 Herbst/Weihnachten und 2031, sobald offiziell veröffentlicht), Fronleichnam (regional).
- **ICS-Export** für Import in Google Kalender & Co. (manuell, ohne API).
- **Resturlaub aus dem Vorjahr**: je Elternteil in den Einstellungen pflegbar (`Rest-VJ`); erhöht das Budget in Übersicht und Urlaubsliste, Verfallswarnung „⚠️ X Resturlaubstage bis 31.03. offen“ auf der Übersichtskarte.
- **Eintragstyp „Betreuung / Ferienlager (Kind)“**: eigener Modus im Personen-Schalter (Eltern: Urlaub/Abwesenheit/Termin; Kinder: Schulfrei/Betreuung/Abwesenheit/Termin). Betreuungslücken in den Tipps gelten als abgedeckt, wenn ein Elternteil Urlaub hat ODER das Kind Betreuung/Abwesenheit eingetragen ist; Lücken werden zu Zeiträumen zusammengefasst und bieten 1-Klick-Schnellbuchung („+ Urlaub Betty/Sebastian“).
- **Wandkalender-Ergonomie**: sticky Spaltenköpfe, Klick auf das Datum wählt die ganze Zeile (alle Personen), Live-Netto-Vorschau der Urlaubstage in der Auswahlleiste, „Heute“-Button mit Tageshervorhebung, Escape hebt die Auswahl auf / schließt Modals, Enter im Titel-Feld markiert direkt.
- **Einträge bearbeiten**: im Tag-Detail (Doppelklick) neben „Löschen“ auch „Bearbeiten“ – vorbefülltes Formular, Speichern aktualisiert den Eintrag.
- **Korrekturen**: Feiertag in den Ferien behält rote Markierung (CSS-Reihenfolge), schulfreie Tage der Kinder zählen nur Werktage, JSON-Export enthält wieder die Personenkonfiguration (Namen/Farben/Rollen/Kontingente).

## Google Kalender Live-Sync (push)
1. In der [Google Cloud Console](https://console.cloud.google.com/) ein Projekt anlegen,
   „Google Calendar API“ aktivieren, OAuth-Client-ID (Webanwendung) erstellen.
2. In den Einstellungen der App die Client-ID eintragen; die eigene Origin
   (z. B. `http://localhost:8000`) als „Autorisierte JavaScript-Origin“ eintragen.
3. Button „Mit Google Kalender verbinden & syncen“: legt einen Kalender „Familienplaner“ an und
   überträgt alle Einträge als Ganztagstermine (bei Änderungen werden Termine aktualisiert bzw.
   gelöschte entfernt). Richtung: App → Google Kalender.

## Familien-Sync: gemeinsame Nutzung auf mehreren Handys (Multi-User)

Die App kann ihren kompletten Stand (Einträge, Personen, eigene Ferien, Einstellungen) mit einem kleinen
Server abgleichen, den du selbst hostest (z. B. Raspberry Pi / NAS zuhause oder ein kleiner VPS).
Du und deine Partnerin installiert die App jeweils auf dem eigenen Handy und tragt dieselbe
Server-URL + dasselbe Token ein – danach arbeiten beide auf demselben Datenstand.

### Server starten (Node.js >= 18 auf dem Server-Rechner)
```
node server/sync-server.js                                  # Port 8080, Daten in server/data/
PORT=8080 SYNC_TOKEN=<geheimes-passwort> node server/sync-server.js
```
Beim ersten Start ohne `SYNC_TOKEN` wird ein zufälliges Token generiert, in `server/data/token.txt`
abgelegt (Datei nur für den Server lesbar) und in der Konsole ausgegeben.
Der Server liefert außerdem die App selbst aus: `http://<server>:8080/`.

- `GET /state` / `PUT /state` mit `Authorization: Bearer <token>`; gespeichert wird immer der Stand mit dem
  neueren `updatedAt` (last-write-wins). Ohne gültiges Token: 401.
- Test (startet den Server nur auf 127.0.0.1 und simuliert zwei Clients): `node server/test-sync.mjs`

### In der App einrichten (pro Handy)
**Extras ▸ Einstellungen ▸ Familien-Sync**: Server-URL (z. B. `http://192.168.1.50:8080` im Heimnetz oder
`https://planer.example.de` von unterwegs), Sync-Token und ein Gerätename (z. B. „Bettys Handy“).
Danach synchronisiert die App automatisch: jede Änderung wird ca. 1 Sek. nach dem Speichern gepusht,
alle 20 Sek. wird der Serverstand gepullt (zusätzlich beim Sichtbarwerden der App); der Status steht
oben im Header („aktuell (vor 2 Min. · Sebastians Handy)“). Button „Jetzt synchronisieren“ in den
Einstellungen erzwingt einen Abgleich.

- Konflikte: zuletzt schreibend gewinnt (einfaches last-write-wins auf dem Gesamtstand) – bei
  gleichzeitigem Bearbeiten auf beiden Geräten gewinnt der neuere Stand.
- Das Sync-Token wird **nicht** im JSON-Export mit ausgegeben und beim JSON-Import nicht überschrieben.
- Zugriff von unterwegs nur über HTTPS (z. B. Reverse Proxy mit DynDNS); im Heimnetz reicht http.

### Alternative: kostenlos bei Cloudflare (Workers + KV, immer HTTPS)
Wenn du einen Cloudflare-Account hast, läuft derselbe Sync-Server ohne eigenen Rechner als Worker
(gleiche API, die App braucht keine Änderung – nur die Worker-URL in den Einstellungen eintragen):
```
cd cloudflare
npx wrangler login                                   # einmalig im Browser autorisieren
npx wrangler kv namespace create STATE_KV            # ausgegebene ID in wrangler.toml eintragen
npx wrangler secret put SYNC_TOKEN                   # gemeinsames Token (Secret, nicht in wrangler.toml!)
npx wrangler deploy
# danach erreichbar unter: https://familienplaner-sync.<deine-subdomain>.workers.dev
```
Free-Tier reicht locker für 2 Handys: 100.000 Worker-Requests/Tag, KV 100k Reads + 1k Writes/Tag.
Test des Workers lokal (mit gemocktem KV): `node cloudflare/test-worker.mjs`

#### Auto-Deploy des Workers (GitHub ↔ Cloudflare verbunden)
Zwei Wege, beide ohne manuelles `wrangler deploy`:

**A) GitHub Actions (`.github/workflows/deploy-worker.yml`, deployt bei Push auf `main`)** – einmalig:
1. Repo → **Settings ▸ Secrets and variables ▸ Actions** → zwei Secrets anlegen:
   - `CLOUDFLARE_API_TOKEN` – API-Token aus dem Cloudflare-Dashboard (My Profile ▸ API Tokens) mit den Berechtigungen
     „Workers Scripts: Edit“, „Workers KV Storage: Edit“, „Account Settings: Read“
   - `CLOUDFLARE_ACCOUNT_ID` – aus dem Cloudflare-Dashboard (rechte Seitenleiste bzw. Workers-Übersicht)
2. KV-Namespace einmalig anlegen und ID in `cloudflare/wrangler.toml` eintragen:
   `npx wrangler kv namespace create STATE_KV` (lokal mit `npx wrangler login`) oder direkt im Dashboard.
3. `SYNC_TOKEN` als Worker-Secret setzen (persistiert, wird nicht bei jedem Deploy neu gesetzt):
   lokal `npx wrangler secret put SYNC_TOKEN` oder Dashboard → Workers & Pages → `familienplaner-sync` → Settings → Variables → Encrypted.
   Danach PR #6 auf `main` mergen bzw. auf `main` pushen – der Worker deployt automatisch.

**B) Cloudflare „Workers Builds“ (connected Git)** – im Cloudflare-Dashboard: Workers & Pages → Create →
Builds → dieses Repo verbinden, Branch `main`, Deploy-Command: `npx wrangler deploy --config cloudflare/wrangler.toml`.
KV-Namespace-ID und `SYNC_TOKEN` wie oben (Schritte 2–3) setzen.

Das Sync-Token landet so nie im Repo und wird nicht übergeben – es bleibt Worker-seitig als Secret gespeichert.

## Android-APK

`android/` enthält einen schlanken WebView-Wrapper ohne externe App-Dependencies: Er lädt die gebündelte
`index.html` aus den APK-Assets (localStorage bleibt pro Handy erhalten) und ist für den Familien-Sync
konfiguriert (Server-URL + Token werden in den App-Einstellungen gepflegt, Internetzugriff via
`INTERNET`-Permission, `usesCleartextTraffic` für LAN-Server im Heimnetz).
Die Oberfläche ist für Smartphones optimiert (Media Query ≤ 768 px: kompakter Header, einspaltige
Monatsansicht, Wandkalender mit schmaleren Spalten + horizontalem Scrollen, Modals fast vollflächig,
16-px-Eingabefelder gegen Fokus-Zoom, Touch ohne Verzögerung).

```
cd android
cp keystore.properties.example keystore.properties   # Keystore-Pfad/Passwörter anpassen
# Keystore erzeugen: keytool -genkeypair -keystore familienplaner.keystore -alias familienplaner \
#   -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Familienplaner"
./gradlew :app:assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
```
Voraussetzungen: JDK 17 und Android SDK (compileSdk 34). Die Web-App (`../index.html`) wird vor jedem
Build automatisch als Asset in die APK kopiert (`copyWebApp`).
Ohne `keystore.properties` wird eine unsignierte APK gebaut.

## Tests
- `node server/test-sync.mjs` – Sync-Server (Loopback, zwei simulierte Clients: Auth, LWW, CORS, Static)
- `node cloudflare/test-worker.mjs` – Cloudflare-Worker (in Node aufgerufen, KV gemockt: Auth, LWW, CORS)
- `cd test && npm install && npm test` – App-Sync-Logik (Push/Pull, last-write-wins, Token nicht im Export,
  Import überschreibt Sync-Konfig nicht) gegen einen lokalen Test-Server

## Datenquellen
Schulferien: Sächsisches Staatsministerium für Kultus / KMK-Ferienkalender (2027–2029 vollständig,
2030 bis Sommerferien; Herbst/Weihnachten 2030 und 2031 werden noch nicht veröffentlicht und können
in den Einstellungen manuell ergänzt werden). Feiertage: Sächsisches Feiertagsgesetz, bewegliche
Termine aus dem Osterdatum berechnet.
