# Familien-Jahresplaner Sachsen

Statischer Web-Planer (HTML + JS + JSON) für eine Familie in Sachsen: Schulferien, Feiertage,
Urlaubsplanung der Eltern (Aufsummierung gegen verfügbare Urlaubstage), schulfreie Tage der Kinder
(inkl. flexibler/beweglicher Tage) und individuelle Termine/Abwesenheiten jedes Familienmitglieds.

## Dateien
- `index.html` – komplette App als eine Datei (Markup, CSS, JS und unveränderliche Basisdaten:
  Schulferien/Feiertage Sachsen, Personen Betty & Sebastian (Eltern, je 30 Urlaubstage), Ida & Irma (Kinder))

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
