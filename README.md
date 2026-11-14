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
- Importierte JSON-Dateien und der gespeicherte Browser-Stand werden geprüft: ungültige Einträge (unbekannte Person/Art, ungültiges Datum) werden verworfen, Farben und IDs auf ein sicheres Format beschränkt.
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
- **Handy-Bedienung** (Breite ≤ 768 px): Wandkalender ohne seitliches Scrollen mit klebendem Spaltenkopf,
  Modus-Auswahl je Person oberhalb der Liste, Menüs und Dialoge als Bottom-Sheet, Auswahlleiste unten
  (erscheint nur bei Auswahl). Touch-Gesten: Tippen = Tag wählen, Schalter „Bereich“ + weiterer Tipp = Zeitraum,
  langes Drücken = Tag-Details (Ersatz für Doppelklick). Drag & Drop von Einträgen geht nur am Computer;
  am Handy über „Bearbeiten“ im Tag-Dialog.
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
- **ICS-Export** für Import in Google Kalender & Co. (manuell, ohne API). Alle Einträge werden einmal exportiert, jährliche als Serie (`RRULE:FREQ=YEARLY`); Sonderzeichen und lange Zeilen werden nach RFC 5545 maskiert bzw. gefaltet.
- **Resturlaub aus dem Vorjahr**: je Elternteil in den Einstellungen pflegbar (`Rest-VJ`); erhöht das Budget in Übersicht und Urlaubsliste, Verfallswarnung „⚠️ X Resturlaubstage bis 31.03. offen“ auf der Übersichtskarte.
- **Eintragstyp „Betreuung / Ferienlager (Kind)“**: eigener Modus im Personen-Schalter (Eltern: Urlaub/Abwesenheit/Termin; Kinder: Schulfrei/Betreuung/Abwesenheit/Termin). Betreuungslücken in den Tipps gelten als abgedeckt, wenn ein Elternteil Urlaub hat ODER das Kind Betreuung/Abwesenheit eingetragen ist; Lücken werden zu Zeiträumen zusammengefasst und bieten 1-Klick-Schnellbuchung („+ Urlaub Betty/Sebastian“).
- **Wandkalender-Ergonomie**: sticky Spaltenköpfe, Klick auf das Datum wählt die ganze Zeile (alle Personen), Live-Netto-Vorschau der Urlaubstage in der Auswahlleiste, „Heute“-Button mit Tageshervorhebung, Escape hebt die Auswahl auf / schließt Modals, Enter im Titel-Feld markiert direkt.
- **Einträge bearbeiten**: im Tag-Detail (Doppelklick) neben „Löschen“ auch „Bearbeiten“ – vorbefülltes Formular, Speichern aktualisiert den Eintrag.
- **Korrekturen**: Feiertag in den Ferien behält rote Markierung (CSS-Reihenfolge), schulfreie Tage der Kinder zählen nur Werktage, JSON-Export enthält wieder die Personenkonfiguration (Namen/Farben/Rollen/Kontingente).

## Google Kalender
**Ohne Einrichtung:** Tag antippen → bei einem Eintrag „In Google Kalender öffnen“. Google Kalender (App oder Browser)
öffnet sich mit dem Termin vorausgefüllt (Ganztag, bei jährlichen Einträgen als jährliche Serie); dort mit einem Tipp
speichern. Funktioniert überall, auch in einer APK/WebView, ohne Anmeldung und ohne Client-ID.

**Live-Sync (App → Google Kalender)** – alle Einträge automatisch übertragen. Das geht nur über die Google-Kalender-API
und braucht deshalb eine einmalige Einrichtung (ein Google-Dienst ohne eigene OAuth-Client-ID ist nicht möglich):
1. In der [Google Cloud Console](https://console.cloud.google.com/) ein Projekt anlegen,
   „Google Calendar API“ aktivieren, OAuth-Client-ID (Webanwendung) erstellen. Bleibt das Projekt im Status „Test“,
   dürfen bis zu 100 eingetragene Testnutzer (z. B. die Familie) sie ohne Google-Prüfung verwenden.
2. In den Einstellungen der App die Client-ID eintragen (sie steht auch im JSON-Export, so lässt sie sich auf andere
   Geräte übertragen); die eigene Adresse (z. B. `https://…` oder `http://localhost:8000`) als
   „Autorisierte JavaScript-Quelle“ eintragen.
3. Button „Mit Google Kalender verbinden & syncen“: legt einen Kalender „Familienplaner“ an und
   überträgt alle Einträge als Ganztagstermine (jährliche Einträge als jährlich wiederkehrend; bei Änderungen
   werden Termine aktualisiert bzw. gelöschte entfernt). Richtung: App → Google Kalender.
   - **Voraussetzung:** Die App muss über eine https-Adresse oder `http://localhost` im normalen Browser laufen. Aus einer
     lokal geöffneten Datei (`file://`) und aus einer eingebetteten App-WebView (Capacitor, Website-zu-APK) bietet Google
     den Login nicht an; die App meldet das und verweist auf „In Google Kalender öffnen“.
   - Von der App angelegte Termine sind markiert; **nur diese** werden je gelöscht. Fremde Termine im selben
     Kalender bleiben unangetastet. Vor dem Löschen fragt die App nach.
   - Das Google-Skript wird erst nachgeladen, wenn eine Client-ID hinterlegt ist und das Extras-Menü geöffnet wird.
   - Läuft die Google-Sitzung ab (ca. 1 Stunde), warnt die App in der Kopfzeile, statt still nicht mehr zu synchronisieren.
   - Die Google-Termin-IDs werden nicht in die JSON-Datei exportiert (gehören zu einem Konto/Kalender).

## Ferien & Feiertage pflegen (Extras ▸ „Ferien & Feiertage pflegen“)
- **Online-Abgleich:** Die App holt Schulferien und Feiertage für Sachsen von der freien
  [OpenHolidays-API](https://www.openholidaysapi.org) (`openholidaysapi.org`, CORS-offen, funktioniert auch aus `file://`).
  Beim Start automatisch, höchstens einmal pro Woche (abschaltbar), oder per Knopf „Jetzt aktualisieren“.
  Übermittelt wird nur die IP-Adresse, keine Planungsdaten. Bei Fehlern/Offline gelten die gespeicherten bzw.
  eingebauten Daten; die App bleibt voll nutzbar.
- **Zusammenführung:** Online-Daten haben Vorrang vor den eingebauten (gleiche Ferienart im selben Jahr bzw. gleicher
  Zeitraum). Was die API nicht liefert (z. B. Herbst/Weihnachten 2030, 2031), bleibt aus den eingebauten Daten bzw.
  der Gesetzesberechnung erhalten. Feiertage ohne Online-Daten werden nach Gesetz berechnet; weichen Online-Daten von
  der Berechnung ab, zeigt der Dialog einen Hinweis.
- **Pflege:** Je Jahr lassen sich Ferien und Feiertage ausblenden/deaktivieren (Häkchen), eigene Ferien und eigene
  Feiertage (z. B. Betriebsferien, Brückentage) anlegen, bearbeiten und löschen sowie Fronleichnam (sorbische
  Gemeinden) zuschalten. Eigene Feiertage zählen wie gesetzliche (kein Urlaubstag, schulfrei). Die Pflegedaten stehen im
  JSON-Export; der Online-Cache nicht (er wird neu abgerufen).

## Datenquellen
Schulferien: eingebaute Termine 2027–2030 (Sächsisches Staatsministerium für Kultus / KMK-Ferienkalender, mit der
OpenHolidays-API abgeglichen; Herbst/Weihnachten 2030 und 2031 sind noch nicht veröffentlicht) plus Online-Abgleich und
eigene Ergänzungen. Feiertage: Sächsisches Feiertagsgesetz, bewegliche Termine aus dem Osterdatum berechnet, bzw.
Online-Daten (2026–2030). Hinweis: Die OpenHolidays-API ist ein Drittanbieter-Dienst und keine amtliche Quelle.
