# Familienplaner – Konzept

Wochenplaner mit Jahresforecast für Sebastian, Betty, Ida (Schulkind) und Irma (Kindergarten) in Chemnitz, Sachsen.
Zwei arbeitende Eltern (Vollzeit 40 h), die sich täglich abstimmen. Geplant wird immer das **Folgejahr**.

## Kernlogik: Wer ist da, wer wird betreut?
Pro Tag gilt: Eltern haben einen Anwesenheitsstatus, Kinder haben ggf. Betreuungsbedarf. Die **Ampel** vergleicht beides.

| Ampel | Bedeutung |
|---|---|
| 🟢 | Betreuung gesichert (ein Elternteil im Urlaub und vor Ort, oder Betreuung durch Dritte) |
| 🟡 | nur per Homeoffice möglich – muss abgestimmt werden |
| 🔴 | Betreuung ungeklärt |

**Anwesenheit der Eltern:** Büro (Standard an Arbeitstagen) · Homeoffice · Urlaub (zu Hause oder „verreist“) · Dienstreise.
Büro, Dienstreise und verreister Urlaub zählen als nicht verfügbar; Homeoffice als eingeschränkt; Urlaub zu Hause als verfügbar.
Feste Homeoffice-Tage gibt es nicht – Homeoffice wird je Tag eingetragen.

**Betreuungsbedarf der Kinder:** Schulferien und unterrichtsfreie Tage (Ida, automatisch), Schließtage Kita/Schule (gleichartig,
manuell), krank. Wochenenden und Feiertage erzeugen keinen Bedarf. Ist ein Kind im Familienurlaub mit eingetragen, entfällt der Bedarf.

## Terminarten
| Art | Beispiele | Wirkung |
|---|---|---|
| Anwesenheit | Urlaub, Dienstreise, Homeoffice | steuert die Ampel; kein Genehmigungsstatus |
| Betreuungsbedarf | Schließtag Kita (Irma), Schließtag Schule (Ida), krank | fließt in die Ampel |
| Betreuung durch Dritte | Oma, Freunde | löst rote Tage |
| Einmaltermin | Kinderarzt, Klassenarbeit, Elternabend | Uhrzeit, Betroffene, **„Wer kümmert sich?“** (offen = Warnung) |
| Info | Festival, Veranstaltung | nur sichtbar, keine Logik |
| Aufgabe | Geschenk besorgen | Fälligkeit, Zuständiger, erledigt |
| Geburtstag | Oma Helga | jährlich |

## Automatische Daten (keine Stammdatenpflege)
* **Feiertage + Schulferien Sachsen** von [OpenHolidays API](https://www.openholidaysapi.org/) (`DE-SN`), serverseitig täglich aktualisiert und gecacht;
  bundled Offline-Stand in `app/src/data/holidays.json` (Neuaufbau: `scripts/fetch-holidays.mjs`). Quelle + Stand stehen in der App.
  Enthält auch unterrichtsfreie Tage (z. B. 7.5.2027).
* **Brückentage** werden berechnet: Zwischen zwei freien Blöcken (Wochenende/Feiertag) liegen 1–4 Arbeitstage und mindestens ein Block
  enthält einen Feiertag. Anzeige „x Urlaubstage → y Tage frei“, Hinweis wenn Ida ohnehin schulfrei hat, Eintragen mit einem Tap.

## Ansichten
Die Startseite (runder Home-Button unten in der Mitte) zeigt „Heute“, Warnungen, die nächsten Termine und Kacheln zu allen Bereichen.
* **Wochenplan**: Wochenmatrix (Eltern-Status, Betreuungsbedarf der Kinder und Ampel für alle 7 Tage auf einen Blick) plus kompakte Agenda nur
  für Tage mit Inhalt. Zelle antippen → Status ändern für den Tag, bis Freitag oder die ganze Woche, auch für beide Eltern. Wischen wechselt die Woche.
* **Jahresplaner**: Kalender des ganzen Jahres mit Zeitraum-Auswahl wie bei Reisebuchungen. Ersten Tag antippen, letzten Tag antippen → Band mit Start-/Endkreis,
  unten wählen (wer, was) und eintragen. Anzeige: Ferien, Feiertage, Brückentage, Urlaub als durchgehende Streifen je Person (Dienstreise blass), Betreuungs-Ampel.
  Bestehenden Urlaub antippen → ändern oder löschen. Langes Drücken → Tagesdetails. Schnellwahl für Schulferien und Brückentage; offene Betreuungszeiträume lassen sich
  direkt markieren. Zeigt vorab die Wirkung aufs Urlaubskonto („Rest 13 → 8“); jede Änderung ist per **Rückgängig** umkehrbar. Auch für Homeoffice, Dienstreise,
  Büro (zurücksetzen), Schließtage und Betreuung durch Dritte; wahlweise „Einzelne Tage“ statt Zeitraum.
* **Urlaubsverwaltung**: je Elternteil Urlaubskonto (genommen / geplant / **noch frei**), Jahresband, Zeiträume von–bis mit Urlaubstagen (bearbeiten/löschen),
  Betreuungslücken mit „planen“, Brückentage mit Ein-Tap-Eintragen.
* **Einkaufsliste**: fließende Liste für beide Handys – eintragen (mehrere mit Komma), antippen = quittiert, Vorschläge aus der Historie, Erledigte-Bereich.
* **Aufgaben & Geburtstage**, **Einstellungen** (Sync, Benachrichtigungen).

## Bedienung und Darstellung
* **Icons** (Lucide) statt Emojis, einheitliche Farben je Person; **Dunkelmodus** per Schalter oder wie das Handy; die **Kopfzeile trägt die Farbe der Person**, der das Handy gehört.
* **Personenfilter** („Alle · Sebastian · Betty · Ida · Irma“) für Wochenplan, Jahresplaner und Aufgaben.
* **Wochenplan** wahlweise als Matrix („Woche“) oder als Tagesstreifen mit Tagesdetails („Tag“).
* **Bottom-Sheets** mit Griff: nach unten wischen schließt; die Android-Zurück-Taste schließt das oberste Fenster, sonst Startseite, dort App beenden.
* **Rückgängig** nach Mehrfach-Eingaben, **Vibrationsfeedback** beim Abhaken, weiche Übergänge, Hinweise bei leeren Listen.

## Homescreen-Widget „Heute“ (Nothing-Stil)
Natives Android-Widget (4×2, anpassbar) in der Optik von Nothing OS: Punktmatrix-Schrift (Doto, SIL OFL), Schwarz/Weiß, rote Warnfarbe, gepunktete Trenner.
Inhalt: Datum und Feiertag/Ferien, Betreuungs-Ampel, Status von Sebastian und Betty, Betreuungsbedarf, nächste Termine (mit Ort und „wer kümmert sich?“) und
Einkaufsliste. **Hintergrund wählbar:** Transparent, Glas (halbtransparent), Dunkel, Hell (Einstellungen → Widget). Tippen öffnet die App.
Die App legt die Daten für die nächsten 14 Tage ab (bei jeder Änderung und jedem Abgleich); das Widget wählt daraus den heutigen Tag und aktualisiert sich alle
30 Minuten auch ohne App-Start. Hinzufügen: Homescreen lange drücken → Widgets → „Familienplaner Heute“.

## Hinweise, wenn der Partner etwas einträgt
* Jeder Eintrag trägt, wer ihn zuletzt gespeichert hat. Der Server beschreibt Änderungen lesbar („Sebastian hat eingetragen: Dienstreise Sebastian, Di 13.07.–Mi 14.07.2027 – Messe Köln“).
* **App geöffnet:** Hinweis-Banner oben (tippen springt zum Tag). **App im Hintergrund:** natives Android-Hintergrund-Abgleichen (WorkManager, ca. alle 15 Minuten)
  zeigt eine Benachrichtigung. Beides meldet jede Änderung nur einmal (gemeinsamer „zuletzt gemeldet“-Stand).
* Nicht gemeldet werden: eigene Änderungen, Einkaufsliste, Einstellungen sowie die technischen Umbauten beim Teilen bestehender Urlaubseinträge. Abschaltbar in den Einstellungen.
* Startseite: Karte „Neu von Betty/Sebastian“ (letzte 7 Tage). Sofort-Push per FCM wäre die Alternative zur 15-Minuten-Verzögerung im Hintergrund (benötigt ein Firebase-Projekt).

## Ergänzende Infos zu Terminen
Termine und Infos haben neben Titel, Datum und Uhrzeit: **Uhrzeit bis, Ort** (öffnet Karten), **Kontakt/Telefon** (tippen wählt), **Link** und **Notiz**; Aufgaben haben eine Notiz.
Die Infos stehen unter dem Eintrag im Wochenplan und im Tagesblatt, in den Hinweisen an den Partner und im Widget (Ort).

## Urlaub korrekt zählen
Gezählt werden nur Arbeitstage: **ohne Wochenenden und Feiertage**; **24.12. und 31.12. zählen als halber Tag** (sofern Arbeitstag).
Das gilt für Urlaubskonto, Zeiträume, Brückentage-Kosten und die Vorschau im Planer. Anzeige der Zeiträume von–bis in der App; kein PDF-Export.

## Benachrichtigungen (lokal auf dem Handy, auch offline)
Tagesvorschau 07:00 · Wochenvorschau Sonntag 18:00 · Termine 1 Std. und 1 Tag vorher (mit Warnung „niemand zuständig“) ·
Betreuungslücken 14 und 3 Tage vorher · Aufgaben · Geburtstage. Phase 2: Sofort-Push „Betty hat etwas geändert“ (FCM).

## Technik
* **App:** Preact + TypeScript, als Android-APK über Capacitor. Local-first: alles funktioniert offline.
* **Backend:** Cloudflare Worker + D1 (SQLite). Sync per Last-Write-Wins, Zugang über gemeinsamen Familiencode.
* **Farben:** Sebastian Marine/Petrol · Betty Beere · Ida Flieder · Irma Koralle.

## Etappen
1. ✅ Kern + Mehrfach-Planer, Urlaubsverwaltung, Wochenmatrix, Startseite, Einkaufsliste: Personen, Woche/Jahr, Anwesenheit + Betreuungs-Ampel, Termine/Aufgaben/Geburtstage, Ferien/Feiertage/Brückentage, Urlaubsübersicht, Sync, lokale Erinnerungen
2. Sofort-Push (FCM), Änderungsmeldung bei geänderten Ferienterminen, Import von Schul-/Kita-Kalendern (ICS), Widget mit eigenem Hintergrund-Abgleich
3. Wiederkehrende Termine, Jahresrückblick
