# Familien-Jahresplaner Sachsen

Statischer Web-Planer (HTML + JS + JSON) für eine Familie in Sachsen: Schulferien, Feiertage,
Urlaubsplanung der Eltern (Aufsummierung gegen verfügbare Urlaubstage), schulfreie Tage der Kinder
(inkl. flexibler/beweglicher Tage) und individuelle Termine/Abwesenheiten jedes Familienmitglieds.

## Dateien
- `index.html` – Frontend
- `app.js` – Logik (Ferien-/Feiertagsdaten, Urlaubszählung, Speicher, Google-Sync)
- `data.json` – Startdaten (Namen, Urlaubstage, Einträge); wird beim ersten Laden über HTTP importiert

## Lokal starten
Variante A (empfohlen, damit `data.json` geladen wird):
```
cd jahresplaner
python3 -m http.server 8000
```
Dann im Browser `http://localhost:8000` öffnen.

Variante B: `index.html` direkt per Doppelklick öffnen (file://). Dann werden die Daten im
Browser-Speicher (localStorage) gehalten; JSON-Export/Import bleibt verfügbar.

## Speicherung
- Automatisch im Browser (localStorage) nach jeder Änderung.
- **JSON exportieren** lädt den kompletten Stand als Datei; **JSON importieren** spielt ihn zurück.
- Beim Laden über HTTP wird `data.json` nur als Erst-Seed verwendet, danach gilt der Browser-Stand.

## Funktionen
- Jahresansicht 2027–2031 mit Schulferien Sachsen (orange) und Feiertagen Sachsen (rot, pro Jahr
  berechnet inkl. Karfreitag, Ostermontag, Himmelfahrt, Pfingstmontag, Buß- und Bettag, Reformationstag).
- Urlaub der Eltern: Eintrag „Urlaub“; Urlaubstage = Werktage (Mo–Fr) abzüglich Feiertage im Zeitraum.
  Übersicht oben zeigt verbraucht/verfügbar/rest je Elternteil.
- Kinder: „Schulfrei (flexibel)“ für bewegliche Ferientage/Brückentage; schulfreie Gesamttage
  (Ferien + Feiertage + eigene Einträge) je Kind in der Übersicht.
- Alle Personen: „Besonderer Tag / Termin“ und „Abwesenheit“ (Festivals, Geburtstage, Abwesenheiten).
- Klick auf einen Tag zeigt alle Einträge und erlaubt Löschen/Neu-anlegen.
- **Wandkalender-Ansicht** („Wandkalender“-Button): pro Person alle Tage des Jahres ansteigend
  von oben nach unten; Wochenenden, Feiertage und Schulferien farblich hervorgehoben.
  Klick wählt einen Tag, Shift+Klick einen Bereich; dann „Als Urlaub markieren“ /
  „Als Termin/Abwesenheit“ / „Als schulfrei (Kind)“. Mit „nur Arbeitstage“ wird ein Bereich
  in reine Arbeitstage aufgeteilt (Wochenenden/Feiertage bleiben frei). Sprung zu Monat,
  Kalenderwoche (KW) oder Datum. Doppelklick auf einen Tag öffnet die Detailansicht.
- **Halbe Tage**: 24.12. und 31.12. gelten als halbe Arbeitstage (½ Urlaubstag) und sind
  markiert (½).
- **Urlaubslisten-Ansicht** („Urlaubsliste“-Button): zusammenhängende Urlaubsblöcke je Elternteil.
  Zwei Zeiträume gelten als zusammenhängend, wenn zwischen ihnen kein Arbeitstag liegt (nur
  Wochenende/Feiertage dazwischen); Block zeigt Kalendertage, Urlaubstage und überlappende Ferien.
- Einstellungen: Namen/Farben/Rollen ändern, Urlaubstage je Elternteil, eigene Ferien ergänzen
  (z. B. 2030 Herbst/Weihnachten und 2031, sobald offiziell veröffentlicht), Fronleichnam (regional).
- **ICS-Export** für Import in Google Kalender & Co. (manuell, ohne API).

## Google Kalender Live-Sync (push)
1. In der [Google Cloud Console](https://console.cloud.google.com/) ein Projekt anlegen,
   „Google Calendar API“ aktivieren, OAuth-Client-ID (Webanwendung) erstellen.
2. In den Einstellungen der App die Client-ID eintragen; die eigene Origin
   (z. B. `http://localhost:8000`) als „Autorisierte JavaScript-Origin“ eintragen.
3. Button „Mit Google Kalender verbinden & syncen“: legt einen Kalender „Familienplaner“ an und
   überträgt alle Einträge als Ganztagstermine (bei Änderungen werden Termine aktualisiert bzw.
   gelöschte entfernt). Richtung: App → Google Kalender.

## Datenquellen
Schulferien: Sächsisches Staatsministerium für Kultus / KMK-Ferienkalender (2027–2029 vollständig,
2030 bis Sommerferien; Herbst/Weihnachten 2030 und 2031 werden noch nicht veröffentlicht und können
in den Einstellungen manuell ergänzt werden). Feiertage: Sächsisches Feiertagsgesetz, bewegliche
Termine aus dem Osterdatum berechnet.
