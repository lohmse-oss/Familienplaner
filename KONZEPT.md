# Familienplaner – Konzept

Wochenplaner mit Jahresforecast für Sebastian, Betty, Ida (Schulkind) und Irma (Kindergarten) in Chemnitz, Sachsen.
Zwei arbeitende Eltern (Vollzeit 40 h), die sich täglich abstimmen. Die App öffnet immer mit **Fokus auf den heutigen Tag** (Woche, Verlauf, Jahr und Urlaub starten im laufenden Jahr); das Folgejahr planst du mit „›“.

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
| Einmaltermin | Kinderarzt, Klassenarbeit, Elternabend | Uhrzeit, Betroffene, **„Wer kümmert sich?“** (offen = Warnung), optional mehrtägig oder wiederkehrend, **Übernahme anfragen** |
| Event | Festival, Konzert, Veranstaltung | zuhause oder auswärts, auch mehrtägig; keine Logik |
| Aufgabe | Geschenk besorgen, Kita-Beitrag | Fälligkeit, Zuständiger, erledigt; **wiederkehrend** (wöchentlich … jährlich: Abhaken rückt die Fälligkeit weiter), Übernahme anfragen |
| Frist (Aufgabe mit Vorlauf) | Personalausweis, Reisepass, Führerschein, TÜV, Vertrag kündigen, Garantie | Fälligkeit = Ablauf-/Stichtag, Vorlauf 2 Wochen … 1 Jahr: bis dahin „vorgemerkt“ (zählt nicht als offen), ab Vorlauf auf Startseite, in „Fristen – jetzt kümmern“ und als Benachrichtigung; Schnellwahl „+6 J.“/„+10 J.“ nach dem Erneuern |
| Geburtstag | Oma Helga | jährlich |

## Automatische Daten (keine Stammdatenpflege)
* **Feiertage + Schulferien Sachsen** von [OpenHolidays API](https://www.openholidaysapi.org/) (`DE-SN`), serverseitig täglich aktualisiert und gecacht;
  bundled Offline-Stand in `app/src/data/holidays.json` (deckt aktuell bis 2029 ab; Neuaufbau: `node scripts/fetch-holidays.mjs 2027-01-01 2031-12-31`, siehe README).
  Quelle + Stand stehen in der App.
  Enthält auch unterrichtsfreie Tage (z. B. 7.5.2027).
* **Brückentage** werden berechnet: Zwischen zwei freien Blöcken (Wochenende/Feiertag) liegen 1–4 Arbeitstage und mindestens ein Block
  enthält einen Feiertag. Anzeige „x Urlaubstage → y Tage frei“, Hinweis wenn Ida ohnehin schulfrei hat, Eintragen mit einem Tap.

## Menüführung (jede Funktion hat genau einen Platz)
* **Untere Leiste = Alltag:** **Kalender** · **Aufgaben** · **Start** (rund, Mitte; lang drücken = neuer Eintrag) · **Einkauf** · **Mehr** (auf Tablets als Seitenleiste).
* **Start** ist eine reine Tagesübersicht ohne Kacheln: Heute, Übernahme-Anfragen, Achtung (Lücken, Fristen, Überfälliges), Demnächst, Brückentage-Tipps; auf breiten Bildschirmen zweispaltig.
* **Mehr** enthält nur, was nicht unten steht: *Planen* – Urlaub (Urlaubskonto, Zeiträume, Brückentage), Geburtstage · *Organisieren* – Checklisten, Infomappe.
* **Einstellungen** über das **Zahnrad in der Kopfzeile** (von überall): Ich & Zugriff · Synchronisierung · Hinweise · Darstellung & Widget · Feiertage & Ferien · Kalender importieren · Über diese App (Version, Build, Commit).
  „synchron“/„offline“ in der Kopfzeile antippen öffnet direkt den Abschnitt Synchronisierung.
* Die Kalenderansichten sind in **einer Gruppe** gebündelt (umschaltbar oben, mit gemeinsamem Personenfilter): **Tag · Woche · Jahr · Verlauf**.

## Schnell finden und bewegen
* **Suche & Sprung** (Lupe in der Kopfzeile): Volltext über Termine, Aufgaben, Geburtstage, Urlaub, Betreuung und Einkauf (Titel, Notiz, Ort, Kontakt, Personen); ein Datum wie „14.7.“ springt direkt zum Tag;
  ohne Eingabe stehen „Gehe zu“-Ziele bereit (Heute, Verlauf, Jahr, Urlaub, Einkauf, Aufgaben, Einstellungen).
* **Zahlen an den Tabs:** Einkauf (offene Artikel), Mehr (überfällige Aufgaben, rot), Kalender (roter Punkt bei ungeklärter Betreuung heute/morgen).
* **Zurück mit Verlauf:** „Zurück“ (Pfeil, Android-Taste, Wischen vom linken Rand) führt dorthin, wo du herkamst; aktiven Tab nochmal tippen = nach oben. Jede Ansicht **merkt sich ihre Scrollposition**.
* **Herunterziehen** am Seitenanfang gleicht sofort ab.
* **Neuer Eintrag = Start-Knopf lang drücken:** immer die volle Auswahl (Urlaub, Termin, Event, Aufgabe, Betreuungsbedarf, Geburtstag, Einkauf, Checkliste, Infomappe) – in jedem Bereich gleich. Die Tagesdetails behalten ihre Symbolreihe (mit Datum vorbelegt).
* **Datum/Zeitraum wählen** immer direkt in einem Monatskalender (mit Feiertagen, Ferien, Ampel): 1. Tippen = Start, 2. Tippen = Ende, ein Tag = zweimal denselben Tag; Aufgaben und wiederkehrende Termine: ein Tippen. Nur das Geburtsdatum bleibt ein Eingabefeld (Jahr).
* **Betreuung durch Dritte** ist keine eigene Auswahl mehr: im Betreuungsbedarf optional „Wer betreut?“ (legt die Betreuung für denselben Zeitraum mit an); für Ferien-Lücken im Jahresplaner (Modus „Betreuung durch Dritte“).
* **Beim Eintragen** zeigt „Zu der Zeit außerdem“ Kreise je Tag wie im Widget und was im Zeitraum sonst ansteht. Nach dem Speichern bestätigt eine Karte, was gespeichert wurde (mit Rückgängig).
* **Eingaben überstehen den App-Wechsel:** offener Dialog, Entwurf, Auswahl im Jahresplaner u. Ä. werden gesichert, falls Android die App im Hintergrund beendet (max. 2 Std.).
* **Widget-Direktsprung:** Tag-Kreis → dieser Tag, Einkauf-Kreis → Einkaufsliste, Aufgaben-Kreis → Aufgaben.
* **Schnellaktionen am App-Symbol** (lang drücken): Einkauf eintragen, Neuer Termin, Neue Aufgabe, Heute. Technisch Direktlinks `de.familie.planer://shop | tasks | today | day/<Datum> | new/event | new/task | new/shop`.

## Ansichten
Die Startseite zeigt „Heute“, Warnungen, die nächsten Termine, „Neu vom Partner“ und vier Kacheln (Kalender, Urlaub, Einkauf, Aufgaben).
* **Woche**: Wochenmatrix (Eltern-Status, Betreuungsbedarf der Kinder und Ampel für alle 7 Tage auf einen Blick) plus kompakte Agenda nur
  für Tage mit Inhalt. Zelle antippen → Status ändern für den Tag, bis Freitag oder die ganze Woche, auch für beide Eltern. Wischen wechselt die Woche.
* **Tag**: Tagesstreifen mit Ampel und Terminzahl, darunter alle Details des gewählten Tages.
* **Verlauf** (für die Jahresplanung): feste Zeilenhöhe, Kalenderwochen abwechselnd getönt, Feiertagsnamen quer über die Zeile, keine Geburtstage. **Fortlaufende Endlosliste ohne Wochenumbruch**, die vier Personen nebeneinander – wahlweise *Tage als Zeilen* (Personen als Spalten, kopfzeile bleibt stehen)
  oder *Tage als Spalten* (Personen als Zeilen, horizontal scrollbar, Namen bleiben stehen). Pro Zelle: Status bzw. Betreuungsbedarf, Termine, Aufgaben; Datumsspalte mit
  Feiertag, Ferien, KW, Ampel, Infos und Geburtstagen. Lädt beim Weiterscrollen automatisch weitere Tage nach; „Heute“ und Datumssprung. Auf dem Handy kompakt
  (Symbole und Zähler), auf dem Tablet mit Text.
* **Jahr** (Jahresplaner): Kalender des ganzen Jahres mit Zeitraum-Auswahl wie bei Reisebuchungen. Ersten Tag antippen, letzten Tag antippen → Band mit Start-/Endkreis,
  unten wählen (wer, was) und eintragen. Anzeige: Ferien, Feiertage, Brückentage, Urlaub als durchgehende Streifen je Person (Dienstreise blass), Betreuungs-Ampel.
  Bestehenden Urlaub antippen → ändern oder löschen. Langes Drücken → Tagesdetails. Schnellwahl für Schulferien und Brückentage; offene Betreuungszeiträume lassen sich
  direkt markieren. Zeigt vorab die Wirkung aufs Urlaubskonto („Rest 13 → 8“); jede Änderung ist per **Rückgängig** umkehrbar. Auch für Homeoffice, Dienstreise,
  Büro (zurücksetzen), Schließtage und Betreuung durch Dritte; wahlweise „Einzelne Tage“ statt Zeitraum.
* **Urlaub** (Urlaubsverwaltung): je Elternteil Urlaubskonto (genommen / geplant / **noch frei**), Jahresband, Zeiträume von–bis mit Urlaubstagen (bearbeiten/löschen),
  Betreuungslücken mit „planen“, Brückentage mit Ein-Tap-Eintragen.
* **Einkauf**: fließende Liste für beide Handys – eintragen (mehrere mit Komma), antippen = quittiert, Vorschläge aus der Historie, Erledigte-Bereich.
* **Aufgaben & Geburtstage**, **Einstellungen**.
* **Checklisten**: Vorlagen (z. B. Packliste Urlaub, Festival, Ausflug – Beispiele per Knopf) und aktive Listen; „Starten“ kopiert eine Vorlage, beide Handys haken gemeinsam ab (jeder Punkt ist ein eigener Eintrag), Haken zurücksetzen, aktive Liste als Vorlage speichern.
* **Infomappe**: Karten nach Kategorien (Kontakte, Gesundheit, Kita & Schule, Größen, Dokumente, Sonstiges) mit Inhalt, Telefon (tippen wählt), Adresse (öffnet Karten), Link; „nur Eltern“ blendet eine Karte im Lesezugriff aus (auf dem Server liegt sie trotzdem).
* **Startseite** zusätzlich: **Übernahme-Anfragen** (Zusagen/Ablehnen; Rückmeldungen auf eigene Anfragen 7 Tage, „gesehen“ nur lokal) und **Brückentage-Tipps** (die drei lohnendsten kommenden Brücken mit „Planen“; Oktober–Dezember zusätzlich die Bilanz des Folgejahres).

## Der Kalender als zentrale Anlaufstelle
Neben Anwesenheit und Betreuung zeigen alle Kalenderansichten auch **Geburtstage, Aufgaben-Fälligkeiten und Termine**:
* **Jahr**: Marker oben links im Tag – pinker Punkt = Geburtstag, gelbes Quadrat = Aufgabe fällig (rot = überfällig), blauer Punkt = Termin/Info.
* **Woche**: eigene Zeile „Termine“ (Torte, Aufgabe, Terminzahl) unter den Personen; Agenda darunter wie bisher. **Tag**: Zähler im Tagesstreifen.
* **Verlauf**: Termine und Aufgaben in der Spalte der zuständigen Person; was niemandem gehört (Geburtstage, Infos, Familien-Termine, Aufgaben ohne Zuständigen) in der Datumsspalte.
* **Start**: „Demnächst“ (7 Tage) mit Terminen, fälligen Aufgaben und Geburtstagen; Hinweis auf überfällige Aufgaben.
* **Ebenen-Schalter** (Knopf neben dem Personenfilter): Geburtstage, Aufgaben und Termine einzeln ein-/ausblenden, damit der Kalender übersichtlich bleibt.

## Tablets (responsiv)
Ab ca. 640 px Breite werden Fenster zentrierte Dialoge statt Bottom-Sheets; ab ca. 900 px gibt es eine **Seitenleiste** statt der unteren Tab-Leiste und Mehrspalten-Layouts:
Startseite (Heute | Kacheln), Woche (Matrix | Agenda), Jahr (3–4 Monate nebeneinander), Urlaub (beide Eltern nebeneinander), Verlauf mit Klartext in allen Zellen.

## Lesezugriff (z. B. Ida)
Zwei Codes: der **Familiencode** (Sebastian, Betty: lesen und bearbeiten) und ein **Lese-Code** (nur lesen). Der Server erzwingt das (`READ_CODE`; Schreiben → 403). Die App erkennt die Rolle
beim Abgleich, blendet alle Bearbeiten-Funktionen aus (Kopfzeile „nur Lesen“) und sperrt Schreibzugriffe lokal. Das Handy wird als „Ida“ eingerichtet (Farbe, kein Partner-Hinweis).

## Bedienung und Darstellung
* **Icons** (Lucide) statt Emojis, einheitliche Farben je Person; **Dunkelmodus** per Schalter oder wie das Handy; die **Kopfzeile trägt die Farbe der Person**, der das Handy gehört.
* **Personenfilter** („Alle · Sebastian · Betty · Ida · Irma“) für Wochenplan, Jahresplaner und Aufgaben.
* **Wochenplan** wahlweise als Matrix („Woche“) oder als Tagesstreifen mit Tagesdetails („Tag“).
* **Bottom-Sheets** mit Griff: nach unten wischen schließt; die Android-Zurück-Taste schließt das oberste Fenster, sonst Startseite, dort App beenden.
* **Rückgängig** nach Mehrfach-Eingaben, **Vibrationsfeedback** beim Abhaken, weiche Übergänge, Hinweise bei leeren Listen.

## Homescreen-Widget „Heute“ (Nothing-Stil, nur Grafik)
Natives Android-Widget (4×1, anpassbar), gezeichnet in der Optik von Nothing OS (Punktmatrix-Schrift Doto, SIL OFL): **drei rollierende Tage** (Heute, +1, +2) und die **Einkaufsliste**
als Kreise mit Zahlen. *Leerer Ring* = nichts los · *gefüllter Kreis* = es stehen Einträge an (Zahl = Anzahl: Termine, Aufgaben, Geburtstage, Infos, Betreuungsbedarf, Urlaub/Dienstreise) ·
*roter Kreis* = Betreuung ungeklärt (beim Aufgaben-Kreis: heute fällig oder überfällig) · *Kreis mit rotem Rand* = Betreuung nur per Homeoffice. **Hintergrund wählbar:** Transparent, Glas, Dunkel, Hell (Einstellungen → Darstellung & Widget).
Tippen öffnet die App. Die App legt die Daten für die nächsten 14 Tage ab; das Widget wählt daraus den heutigen Tag und aktualisiert sich alle 30 Minuten auch ohne App-Start.

## Android Auto
* **Sichtbar im Launcher (Sideload):** `FamilyMediaBrowserService` (framework-`MediaBrowserService`, keine Zusatzbibliothek) + `<uses name="media"/>` in `automotive_app_desc.xml`. Als Medien-App listet Android Auto die per APK installierte App unter „Launcher anpassen“, sobald in den AA-Entwickleroptionen „Unbekannte Quellen“ aktiv ist. Der Browse-Baum zeigt **Heute/Morgen/Übermorgen**, **weitere Tage** (je 7 pro Seite), **Einkaufsliste** und **Aufgaben** mit Betreuungs-Ampel („ungeklärt!“); pro Tag die Einträge chronologisch. Tippen auf einen Eintrag / „Tag vorlesen“ liest per **Sprachausgabe (TTS)** vor – kein Bearbeiten im Auto. Der Dienst lässt nur Android Auto, Assistent/System und die App selbst zu (Debug-Builds = Sideload-APK: alle, damit der DHU nicht scheitert).
* **Template-App (CarAppService, androidx.car.app:app:1.4.0, Kategorie POI):** zusätzlich vorhanden, nur geparkt nutzbar. Google lässt Car-App-Library-Apps im realen Fahrzeug nur bei Play-Verteilung zu (Internal App Sharing / Test-Track); im Desktop Head Unit funktioniert sie auch als Sideload (Debug-Builds erlauben jeden Host).
* **Warum nicht `CAR_LAUNCHER`?** Android Auto unterstützt Parked-Apps laut Google-Doku nur für Spiele; die Kategorie brachte der Plan-App daher keinen Launcher-Eintrag und wurde wieder entfernt.
* **Daten:** dieselben wie fürs Widget (SharedPreferences, nächste 14 Tage inkl. aller Termindetails). Die App muss nach der Installation einmal gestartet werden.
* **Technik:** `minSdk` 23 (Car App Library); 1.4.0 ist die letzte Version, die mit compileSdk 34 baut.

## Hinweise, wenn der Partner etwas einträgt
* Jeder Eintrag trägt, wer ihn zuletzt gespeichert hat. Der Server beschreibt Änderungen lesbar („Sebastian hat eingetragen: Dienstreise Sebastian, Di 13.07.–Mi 14.07.2027 – Messe Köln“).
* **App geöffnet:** Hinweis-Banner oben (tippen springt zum Tag). **App im Hintergrund:** natives Android-Hintergrund-Abgleichen (WorkManager, ca. alle 15 Minuten)
  zeigt eine Benachrichtigung. Beides meldet jede Änderung nur einmal (gemeinsamer „zuletzt gemeldet“-Stand).
* Nicht gemeldet werden: eigene Änderungen, Einkaufsliste, Einstellungen sowie die technischen Umbauten beim Teilen bestehender Urlaubseinträge. Abschaltbar in den Einstellungen.
* Startseite: Karte „Neu von Betty/Sebastian“ (letzte 7 Tage). Sofort-Push per FCM wäre die Alternative zur 15-Minuten-Verzögerung im Hintergrund (benötigt ein Firebase-Projekt).

## Ergänzende Infos zu Terminen
Termine und Events haben neben Titel, Datum und Uhrzeit: **Uhrzeit bis, Ort** (öffnet Karten), **Kontakt/Telefon** (tippen wählt), **Link** und **Notiz**; Aufgaben haben eine Notiz.
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
